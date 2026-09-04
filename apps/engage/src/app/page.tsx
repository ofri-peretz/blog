"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { gauges, blocked, type Acted } from "@/lib/safety";
import { cachedFetch, cachedAt } from "@/lib/client-cache";
import { NetworkGraph, type Graph } from "@/components/network-graph";
import { AudienceClock } from "@/components/audience-clock";
import {
  Threads,
  Impact,
  Plugins,
  PluginCatalog,
  Promotion,
  Skel,
  Collapse,
  Correlate,
  Roster,
  TrendGrid,
  Benchmark,
  SiteHealth,
  People,
  Board,
  Ecosystem,
  ArticleWeb,
  Person,
  Trends,
  Refresh,
  type Thread,
} from "@/components/panels";
import { Callout } from "@/components/ui/callout";
import { Skeleton } from "@/components/ui/skeleton";
import { Meter } from "@/components/ui/meter";
import { StatStrip } from "@/components/ui/stat-strip";
import { rankActions } from "@/lib/nba";
import { ME as ME_USER } from "@/lib/me";
import { DataTable } from "@/components/ui/patterns/data-table";

interface Article {
  id: number;
  title: string;
  url: string;
  author: string;
  tags: string[];
}
interface Item {
  kind: "comment" | "reaction";
  slot: number;
  date: string;
  article: Article;
  tldr?: string;
  comment?: string;
  category?: string;
  why?: string | null;
  relevance?: "high" | "medium" | "low" | null;
  alt_comment?: string | null;
}
interface State {
  date: string;
  items: Item[];
  acted: Acted[];
  release: { queue?: unknown[]; nextFire?: string; minDays?: number } | null;
  totals: { open: number; everActed: number; everDrafted: number };
}
interface Insights {
  asOf?: string | null;
  metrics: Record<string, number | null>;
  metricsError: string | null;
  authors: {
    author: string;
    drafted: number;
    sent: number;
    repliedToUs: number;
    weAnswered: number;
    conversion: number;
    tags: string[];
    last: string;
  }[];
}

const LEVEL: Record<string, string> = {
  green: "text-[var(--success)] border-[var(--success)]",
  amber: "text-[var(--warning)] border-[var(--warning)]",
  red: "text-[var(--primary)] border-[var(--primary)]",
};

export default function Page() {
  const [state, setState] = useState<State | null>(null);
  const [i, setI] = useState(0);
  /** Actions taken in THIS session, so the meter reacts instantly rather than
   *  waiting for the next poll — the queue file only carries day granularity. */
  const [session, setSession] = useState<Acted[]>([]);
  const [draft, setDraft] = useState("");
  /**
   * Insights and the graph load independently of the action stream. The graph
   * crawls Dev.to and takes ~17s; blocking the card behind it would put the one
   * thing you came here to do behind the one thing you came here to look at.
   */
  const [insights, setInsights] = useState<Insights | null>(null);
  const [graph, setGraph] = useState<Graph | null>(null);
  const [threads, setThreads] = useState<Thread[] | null>(null);
  const [alerts, setAlerts] = useState<any>(null);
  const [sources, setSources] = useState<any>(null);
  const [people, setPeople] = useState<any>(null);
  const [board, setBoard] = useState<any>(null);
  const [eco, setEco] = useState<any>(null);
  const [web, setWeb] = useState<any>(null);
  const [person, setPerson] = useState<any>(null);
  const [audience, setAudience] = useState<any>(null);
  const [catalog, setCatalog] = useState<any>(null);
  const [corr, setCorr] = useState<any>(null);
  const [trends, setTrends] = useState<any>(null);
  const [bench, setBench] = useState<any>(null);
  const [grain, setGrain] = useState<"day" | "week" | "month">("day");
  const [metric, setMetric] = useState<string>("followers");

  /** Open one author. Cached 6h server-side, so re-opening costs nothing. */
  /**
   * Focus one author, and put them in the URL.
   *
   * A control room you cannot link into is one you cannot hand to anyone —
   * including yourself in a week, or a second session working the same queue.
   * `replaceState` rather than `push` so the browser Back button still leaves
   * the app instead of walking back through every author you glanced at.
   */
  const openPerson = useCallback(async (u: string) => {
    setPerson({ username: u, loading: true });
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("u", u);
      window.history.replaceState(null, "", url);
    } catch {
      /* URL updates are a convenience; never let one break the drill-down */
    }
    try {
      const r = await fetch(`/api/person?u=${encodeURIComponent(u)}`, { cache: "no-store" });
      setPerson(await r.json());
    } catch {
      setPerson({ username: u, error: "unreachable", posts: [] });
    }
  }, []);
  /** Reply stepper: index into `threads`, plus the editable draft for it. */
  const [ri, setRi] = useState(0);
  const [reply, setReply] = useState("");
  /** Which stepper owns Enter/s/r right now. Set by touching either card. */
  const [focus, setFocus] = useState<"queue" | "replies">("queue");
  /** A bookkeeping write that failed after the public action already happened. */
  const [actErr, setActErr] = useState<string | null>(null);

  /**
   * The reply text arrives WITH the thread — `engage-replies.ts` drafts into
   * reply-drafts.json and /api/threads serves it. Drafting on card display, as
   * this did briefly, put an agent round-trip in the middle of the flow and
   * failed outright whenever the CLI auth had lapsed. Same contract as the
   * comment queue now: batch writes, app reads.
   */
  const [threadHint, setThreadHint] = useState<string | null>(null);
  /** When the inbox crawl actually read dev.to — the source time behind the threads header. */
  const [threadsAsOf, setThreadsAsOf] = useState<string | null>(null);
  /** Today's standing row + history — see lib/standing.ts. */
  const [standing, setStanding] = useState<any>(null);
  /** The profile scorecard — readers, resonance, followers-who-read. */
  const [profile, setProfile] = useState<any>(null);
  /** The Author Impact Score — one definition, five pillars, fourteen metrics. */
  const [impact, setImpact] = useState<any>(null);
  const [levers, setLevers] = useState<any>(null);
  const [bands, setBands] = useState<any>(null);


  /** at[section] = when that section's data was last read. */
  const [at, setAt] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  /**
   * Fetch a section, through the shared client cache.
   *
   * `force` is passed only by the section's refresh button, which is the whole
   * contract: navigation and remounts reuse what is already loaded, and the
   * only two ways to hit the network are an expired TTL or an explicit click.
   * Before this, every navigation re-ran a dozen requests to redisplay data
   * that had been on screen seconds earlier.
   */
  const pull = useCallback(
    async (key: string, url: string, set: (v: unknown) => void, force = false) => {
      setBusy((b) => ({ ...b, [key]: true }));
      try {
        set(await cachedFetch(key, url, { force }));
        setAt((a) => ({ ...a, [key]: cachedAt(key) ?? Date.now() }));
      } finally {
        setBusy((b) => ({ ...b, [key]: false }));
      }
    },
    [],
  );

  /**
   * `force` is not optional here. `pull` defaults it to false, so this button
   * re-read the 5-minute client cache and looked like a no-op — you pressed
   * refresh after `engage:replies` had just written new drafts and the panel
   * still showed the old set. Every other section's button passes it; this one
   * was the outlier.
   */
  const refreshThreads = useCallback(
    (force = true) =>
      pull(
        "threads",
        "/api/threads",
        (v: any) => {
          setThreads(v.threads ?? []);
          setThreadHint(v.hint ?? null);
          setThreadsAsOf(v.asOf ?? null);
          setRi(0);
        },
        force,
      ),
    [pull],
  );

  const load = useCallback(async () => {
    const r = await fetch("/api/state", { cache: "no-store" });
    setState(await r.json());
  }, []);

  useEffect(() => {
    load();
    pull("insights", "/api/insights", (v: any) => setInsights(v)).catch(() => setInsights({ metrics: {}, metricsError: "unreachable", authors: [] }));
    pull("network", "/api/network", (v: any) => setGraph(v)).catch(() => setGraph(null));
    // On failure this sets `error`, never an empty alert list. A monitoring
    // panel that renders "all clear" when it could not evaluate is the exact
    // failure it exists to catch.
    pull("alerts", "/api/alerts", (v: any) => setAlerts(v)).catch(() =>
      setAlerts({ alerts: [], evaluated: 0, error: "unreachable" }),
    );
    refreshThreads(false).catch(() => setThreads([]));
    pull("sources", "/api/sources", (v: any) => setSources(v)).catch(() => setSources({}));
    pull("audience", "/api/audience", (v: any) => setAudience(v)).catch(() =>
      setAudience({ hours: [], zones: [], error: "unreachable" }),
    );
    pull("people", "/api/people", (v: any) => setPeople(v)).catch(() => setPeople({ people: [] }));
    pull("board", "/api/board", (v: any) => setBoard(v)).catch(() => setBoard({ prs: [] }));
    pull("eco", "/api/ecosystem", (v: any) => setEco(v)).catch(() => setEco({}));
    pull("web", "/api/articles", (v: any) => setWeb(v)).catch(() => setWeb({ nodes: [] }));
    pull("catalog", "/api/plugins", (v: any) => setCatalog(v)).catch(() => setCatalog({ plugins: [] }));
    pull("corr", "/api/correlate", (v: any) => setCorr(v)).catch(() => setCorr({ results: [], blocked: "unreachable" }));
    pull(`trends:day`, "/api/trends?grain=day", (v: any) => setTrends(v)).catch(() => setTrends(null));
    pull("bench", "/api/benchmark", (v: any) => setBench(v)).catch(() => setBench(null));
    pull("standing", "/api/standing", (v: any) => setStanding(v)).catch(() => setStanding({ today: null, history: [], error: "unreachable" }));
    pull("profile", "/api/profile", (v: any) => setProfile(v)).catch(() => setProfile({ hint: "unreachable" }));
    pull("impact", "/api/impact", (v: any) => setImpact(v)).catch(() => setImpact(null));
    pull("levers", "/api/levers", (v: any) => setLevers(v)).catch(() => setLevers(null));
    pull("bands", "/api/bands", (v: any) => setBands(v)).catch(() => setBands(null));

    // Deep link: /?u=<author> opens that author's drill-down on load, so a link
    // to a person survives being pasted into a note or a second session.
    const u = new URLSearchParams(window.location.search).get("u");
    if (u) openPerson(u);
  }, [load, pull, refreshThreads]);

  const items = state?.items ?? [];
  const item = items[i];

  useEffect(() => {
    setDraft(item?.comment ?? "");
  }, [item]);

  /** Load the pre-written draft for whichever thread is currently on screen. */
  const thread = threads?.[ri];
  useEffect(() => {
    setReply(thread?.draft ?? "");
  }, [thread]);

  /**
   * Copy, open, dismiss, advance — the reply twin of `act()`. Skipping still
   * marks the thread handled: the inbox is a worklist, and an item you looked
   * at and passed on should not be offered again tomorrow.
   */
  const replyAct = useCallback(
    async (action: "done" | "skip") => {
      const t = threads?.[ri];
      if (!t) return;
      if (action === "done") {
        try {
          await navigator.clipboard.writeText(reply);
        } catch {
          /* clipboard needs a gesture + permission; the tab still opens */
        }
        /*
         * Open the COMMENT, not the article.
         *
         * `articleUrl` alone drops you at the top of the post and you scroll
         * hunting for the thread you are answering — on a piece with 15
         * comments, or one from February, that is most of the time the reply
         * takes. `#comment-<id_code>` is the anchor Dev.to renders on every
         * comment, so the browser lands on the exact thread with its reply box
         * already in view.
         *
         * Verified: `<articleUrl>#comment-<id>` returns 200. The other two
         * plausible shapes do not — `/<commenter>/comment/<id>` is a 404
         * because the permalink lives in the ARTICLE AUTHOR's namespace, and
         * `<articleUrl>/comments/<id>` is a 404 outright.
         */
        window.open(
          t.commentId ? `${t.articleUrl}#comment-${t.commentId}` : t.articleUrl,
          "_blank",
          "noopener",
        );
        // A reply IS a comment to Forem: it spends the same
        // `comment_antispam_creation` 5-minute budget as a queue comment. Not
        // recording it here left the one server-enforced gauge reading green
        // straight after a reply, so the next queue comment got rejected by
        // Dev.to with nothing on screen having warned about it.
        setSession((s) => [
          ...s,
          { kind: "comment", author: t.author, at: Date.now() },
        ]);
      }
      setRi((n) => n + 1);
      setReply("");

      /**
       * The write is checked, not fired and forgotten.
       *
       * This exact call silently failed once: the tab posted while the server
       * was restarting, the card advanced anyway, and a reply that was already
       * live on Dev.to stayed `pending` forever — so the batch job kept
       * re-offering it and the partnership table kept it amber. The action that
       * has already happened in public is the one whose bookkeeping must never
       * fail quietly.
       */
      try {
        const r = await fetch("/api/threads", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ commentId: t.commentId, action }),
        });
        const j = await r.json().catch(() => ({ ok: false }));
        if (!j.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
        setActErr(null);
      } catch (e: any) {
        setActErr(
          `@${t.author} was not recorded (${String(e?.message ?? e).slice(0, 80)}). ` +
            `If you posted it, mark it handled again once the server is back — otherwise it will be offered twice.`,
        );
      }
    },
    [threads, ri, reply],
  );

  /**
   * Mark any row in the waiting list handled without walking the stepper to
   * it. Same write as `replyAct`, same checked result. Deliberately NOT added
   * to `session`: "replied" here means a reply posted at some earlier, unknown
   * time, and charging it to the pace gauge now would block the next real one.
   */
  const markThread = useCallback(
    async (n: number, action: "done" | "skip") => {
      const t = threads?.[n];
      if (!t) return;
      try {
        const r = await fetch("/api/threads", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ commentId: t.commentId, action }),
        });
        const j = await r.json().catch(() => ({ ok: false }));
        if (!j.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
        setThreads((ts) => (ts ? ts.filter((_, k) => k !== n) : ts));
        // Keep the card pointing at the same thread when a row above it goes.
        if (n < ri) setRi((k) => Math.max(0, k - 1));
        setActErr(null);
      } catch (e: any) {
        setActErr(
          `@${t.author} was not recorded (${String(e?.message ?? e).slice(0, 80)}). ` +
            `If you replied, mark it again once the server is back — otherwise it will be offered twice.`,
        );
      }
    },
    [threads, ri],
  );

  /**
   * Skip any queue item without walking the stepper to it. Same checked write
   * as `act("skip")`; the current card keeps pointing at the same item.
   */
  const skipItem = useCallback(
    async (n: number) => {
      const it = state?.items?.[n];
      if (!it) return;
      try {
        const r = await fetch("/api/act", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ kind: it.kind, date: it.date, slot: it.slot, action: "skip" }),
        });
        const j = await r.json().catch(() => ({ ok: false }));
        if (!j.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
        setState((st) => (st ? { ...st, items: st.items.filter((_, k) => k !== n) } : st));
        if (n < i) setI((k) => Math.max(0, k - 1));
        setActErr(null);
      } catch (e: any) {
        setActErr(`@${it.article.author} was not recorded (${String(e?.message ?? e).slice(0, 80)}).`);
      }
    },
    [state, i],
  );

  const acted = useMemo(
    () => [...(state?.acted ?? []), ...session],
    [state, session],
  );
  const gs = useMemo(() => gauges(acted), [acted]);

  /**
   * "Do these first": the open items ranked by what each does to standing.
   * Arithmetic over the graph and ages (lib/nba.ts) — the model never picks who.
   * Jumping a row puts that card in place; Enter then sends it as before.
   */
  const nba = useMemo(() => {
    if (!state) return [];
    return rankActions(
      graph as any,
      ME_USER,
      (threads ?? []).map((t, index) => ({ index, author: t.author, ageDays: t.ageDays, replyToUs: t.replyToUs, authorGone: t.authorGone })),
      (state.items ?? []).map((it, index) => ({ index, author: it.article.author, kind: it.kind })),
      acted.map((a) => ({ author: a.author, at: a.at })),
    )
      .filter((r) => r.score > 0)
      .slice(0, 5);
  }, [state, threads, graph, acted]);
  const hardBlock = blocked(gs);

  async function act(action: "done" | "skip") {
    if (!item) return;
    if (action === "done") {
      if (item.kind === "comment" && draft) {
        try {
          await navigator.clipboard.writeText(draft);
        } catch {
          /* clipboard needs a user gesture + permission; the tab still opens */
        }
      }
      window.open(item.article.url, "_blank", "noopener");
      setSession((s) => [
        ...s,
        { kind: item.kind, author: item.article.author, at: Date.now() },
      ]);
    }
    // Same contract as replyAct: the queue write is awaited AND checked. It was
    // awaited but its result thrown away, so a failed write looked identical to
    // a successful one and the item silently came back tomorrow.
    try {
      const r = await fetch("/api/act", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: item.kind,
          date: item.date,
          slot: item.slot,
          // "done" means the tab opened; the server records it as `opened` and
          // the reconciler promotes it to `posted` once dev.to shows the comment.
          action: action === "done" ? "open" : action,
          // The edited text, so the ledger carries what was pasted, not the draft.
          text: item.kind === "comment" && action === "done" ? draft : null,
        }),
      });
      const j = await r.json().catch(() => ({ ok: false }));
      if (!j.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      setActErr(null);
    } catch (e: any) {
      setActErr(
        `@${item.article.author} was not recorded (${String(e?.message ?? e).slice(0, 80)}). ` +
          `If you posted it, mark it handled again once the server is back — otherwise it will be offered twice.`,
      );
    }
    setI((n) => n + 1);
  }

  /**
   * Two steppers, one keyboard. Enter cannot mean "post the queue comment" and
   * "post the reply" at the same time, so the keys follow the card you last
   * touched and the focused card says so on its hint line. Binding them to the
   * queue unconditionally — the previous shape — meant a reply could only ever
   * be sent with the mouse, and Enter over the reply card fired the WRONG card's
   * button, which on this surface is a publicly visible mistake.
   */
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "TEXTAREA") return;
      const replies = focus === "replies";
      if (e.key === "Enter") {
        e.preventDefault();
        replies ? replyAct("done") : act("done");
      }
      if (e.key === "s") {
        e.preventDefault();
        replies ? replyAct("skip") : act("skip");
      }
      if (e.key === "r") {
        e.preventDefault();
        replies ? refreshThreads() : load();
      }
    };
    addEventListener("keydown", h);
    return () => removeEventListener("keydown", h);
  });

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-5 py-10 pb-24">
      <header className="flex flex-col gap-1">
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
          Interlace · control room
        </span>
        <div className="flex flex-wrap items-baseline gap-4">
          <h1 className="text-[28px] font-semibold tracking-tight">Engage</h1>
          <Link href="/queue" className="font-mono text-[11px] uppercase tracking-wider text-[var(--muted-foreground)] hover:text-[var(--primary)]">
            queue
          </Link>
          <Link href="/journeys" className="font-mono text-[11px] uppercase tracking-wider text-[var(--muted-foreground)] hover:text-[var(--primary)]">
            journeys
          </Link>
          <Link href="/calendar" className="font-mono text-[11px] uppercase tracking-wider text-[var(--muted-foreground)] hover:text-[var(--primary)]">
            calendar
          </Link>
          <Link href="/raw" className="font-mono text-[11px] uppercase tracking-wider text-[var(--muted-foreground)] hover:text-[var(--primary)]">
            raw data →
          </Link>
          <Link href="/releases" className="font-mono text-[11px] uppercase tracking-wider text-[var(--muted-foreground)] hover:text-[var(--primary)]">
            releases →
          </Link>
          <Link href="/rules" className="font-mono text-[11px] uppercase tracking-wider text-[var(--muted-foreground)] hover:text-[var(--primary)]">
            rules →
          </Link>
          <Link href="/customers" className="font-mono text-[11px] uppercase tracking-wider text-[var(--muted-foreground)] hover:text-[var(--primary)]">
            customers →
          </Link>
        </div>
      </header>

      {/* Pace meter. Deliberately not a cap — it reports, and only the one
          server-enforced limit can disable the button. */}
      <section>
        {/*
          `<StatStrip>` reserves the strip's real geometry while loading — the
          hand-rolled version drew four `.skeleton` boxes that were silent to a
          screen reader, and a `null` gauge printed nothing at all rather than
          saying it was unmeasured.
        */}
        <StatStrip
          cols={4}
          loading={!state}
          announce={{ noun: "pace gauges" }}
          items={gs.map((g) => ({
            key: g.label,
            label: `${g.label}${g.hard ? " ·  enforced" : ""}`,
            value: g.value ?? null,
            // `StatItem` has no tone: `value` is `number | string | null` and
            // nothing carries severity. The green/amber/red level therefore
            // moves into `note`, where it is a WORD as well as a colour — which
            // is strictly better than the colour-only cell it replaces, but it
            // is a workaround, not an API.
            note: (
              <>
                <span className={LEVEL[g.level].split(" ")[0]}>{g.level}</span>
                {" · "}
                {g.hint}
              </>
            ),
          }))}
        />
        {actErr && (
          <Callout tone="danger" title="Not recorded" className="mt-3">
            {actErr}
          </Callout>
        )}
        {hardBlock && (
          <Callout tone="warn" title={hardBlock.label} className="mt-3">
            {hardBlock.hint} Waiting is the only fix; Dev.to rejects the write,
            not us.
          </Callout>
        )}
      </section>

      {/* ── Stalled feeds ────────────────────────────────────────────────────
          Placed above "Up next" deliberately. A feed that stopped nine days ago
          outranks today's queue, and the reason this panel exists is that the
          blog's client-side analytics died on 2026-08-02 and was found by hand
          on the 11th — server-side /go/ events kept arriving, so nothing ever
          looked broken. */}
      <Collapse
        id="s0"
        head={
          <>
            <span>
              Stalled feeds{" "}
              {alerts?.firing ? `· ${alerts.firing}` : ""}
              {alerts?.high ? ` · ${alerts.high} high` : ""}
            </span>
            <Refresh
              onClick={() => pull("alerts", "/api/alerts", (v: any) => setAlerts(v), true)}
              at={at.alerts ?? null}
              busy={!!busy.alerts}
            />
          </>
        }
      >
        {!alerts ? (
          <Skel rows={2} />
        ) : alerts.error ? (
          <Callout tone="warn">
            Could not evaluate alerts ({alerts.error}). This is an error, not an
            all-clear.
          </Callout>
        ) : alerts.alerts?.length ? (
          <ul className="flex flex-col gap-2">
            {alerts.alerts.map((a: any) => (
              <li
                key={a.id}
                className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`font-mono text-[10px] uppercase tracking-[0.08em] ${
                      a.severity === "high"
                        ? "text-[var(--destructive)]"
                        : "text-[var(--warning)]"
                    }`}
                  >
                    {a.severity} · {a.kind}
                  </span>
                  <code className="font-mono text-[11px] text-[var(--muted-foreground)]">
                    {a.id}
                  </code>
                </div>
                <p className="mt-1 text-[13px]">{a.message}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-[var(--muted-foreground)]">
            Nothing stalled — {alerts.evaluated} series evaluated. The count is
            here because &ldquo;no alerts&rdquo; and &ldquo;no series had enough
            data to judge&rdquo; are different answers.
          </p>
        )}
      </Collapse>

      {bands?.results?.length ? (
        <p className="-mt-4 font-mono text-[11px] text-[var(--muted-foreground)]">
          control bands · {bands.results.map((r: any) => `${r.id} ${r.tier ?? "ok"}`).join(" · ")} · as of {String(bands.at).slice(0, 10)}
        </p>
      ) : null}

      {/* ── Do these first ──────────────────────────────────────────────── */}
      {nba.length > 0 && (
        <Collapse id="s23" head={<><span>Do these first · {nba.length}</span></>}>
          <ul className="flex flex-col gap-1">
            {nba.map((r) => {
              const t = r.source === "thread" ? threads?.[r.index] : null;
              const it = r.source === "item" ? state?.items?.[r.index] : null;
              const title = t?.articleTitle ?? it?.article.title ?? "";
              return (
                <li key={`${r.source}:${r.index}`} className="flex items-center gap-2 rounded border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-[12.5px]">
                  <span className="w-10 shrink-0 font-mono text-[10px] text-[var(--muted-foreground)]">
                    {r.source === "thread" ? "reply" : it?.kind === "reaction" ? "react" : "comment"}
                  </span>
                  <span className="w-40 shrink-0 truncate font-mono text-[11px]">@{r.author}</span>
                  <span className="min-w-0 flex-1 truncate" title={title}>{title}</span>
                  <span className="hidden shrink-0 text-[11px] text-[var(--muted-foreground)] md:inline" title={r.why}>{r.why}</span>
                  <span className="shrink-0 font-mono text-[10px] text-[var(--success)]">+{r.score}</span>
                  <button
                    onClick={() => {
                      if (r.source === "thread") { setRi(r.index); setReply(threads?.[r.index]?.draft ?? ""); setFocus("replies"); }
                      else { setI(r.index); setFocus("queue"); }
                    }}
                    className="shrink-0 rounded border border-[var(--border)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--primary)] hover:bg-[var(--muted)]/40"
                    aria-label={`jump to @${r.author}`}
                  >
                    jump
                  </button>
                  <button
                    onClick={() => (r.source === "thread" ? markThread(r.index, "skip") : skipItem(r.index))}
                    className="shrink-0 rounded border border-[var(--border)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--muted-foreground)] hover:bg-[var(--muted)]/40"
                    aria-label={`skip @${r.author}`}
                  >
                    skip
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-[12px] text-[var(--muted-foreground)]">
            Ranked by what each action does to standing: closing a mutual tie first, an untouched core
            node next, then any new author, with waiting time on top. Jump puts the card in place;
            Enter sends it.
          </p>
        </Collapse>
      )}

      <Collapse id="s1" head={<>
          Up next
        </>}>

        {!state ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
            <Skeleton variant="article-card" label="Loading the next comment" />
          </div>
        ) : item ? (
          <article
            onMouseDown={() => setFocus("queue")}
            onFocusCapture={() => setFocus("queue")}
            className={`rounded-xl border bg-[var(--card)] p-6 ${focus === "queue" ? "border-[var(--primary)]" : "border-[var(--border)]"}`}
          >
            {item.kind === "reaction" && (
              <div className="mb-3 inline-block rounded-md border border-[var(--warning)] px-2.5 py-1 font-mono text-[13px] text-[var(--warning)]">
                React: {(item.category ?? "").replace(/_/g, " ").toUpperCase()}
              </div>
            )}
            <div className="font-mono text-[12px] text-[var(--primary)]">
              @{item.article.author}
            </div>
            <h3 className="mt-1.5 text-[19px] font-semibold leading-snug">
              {item.article.title}
            </h3>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {item.article.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-[var(--border)] px-2 py-0.5 font-mono text-[10px] text-[var(--muted-foreground)]"
                >
                  #{t}
                </span>
              ))}
            </div>
            {(item.relevance || item.why) && (
              <div className="mt-2.5 flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-[0.08em]">
                {item.relevance && (
                  <span
                    title="Relevance tier from the morning batch — a keyword heuristic that only sets the default button"
                    className={`rounded border px-1.5 py-0.5 ${
                      item.relevance === "high"
                        ? "border-[var(--success)] text-[var(--success)]"
                        : item.relevance === "low"
                          ? "border-[var(--warning)] text-[var(--warning)]"
                          : "border-[var(--border)] text-[var(--muted-foreground)]"
                    }`}
                  >
                    {item.relevance} relevance
                  </span>
                )}
                {item.why && (
                  <span className="normal-case tracking-normal text-[var(--muted-foreground)]">{item.why}</span>
                )}
              </div>
            )}
            {item.tldr && (
              <p className="mt-3 border-l-2 border-[var(--border)] pl-3 text-sm text-[var(--muted-foreground)]">
                {item.tldr}
              </p>
            )}
            {item.kind === "comment" && (
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="mt-4 min-h-40 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] p-3 text-[14.5px] leading-relaxed"
              />
            )}
            <div className="mt-4 flex flex-wrap items-center gap-2.5">
              {/* LOW relevance pre-selects Skip, per the skill's gate: still one
                  click to override, but the default is the honest one. */}
              <button
                onClick={() => act("done")}
                className={
                  item.relevance === "low"
                    ? "rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm text-[var(--muted-foreground)]"
                    : "rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-[var(--primary-foreground)]"
                }
              >
                {item.kind === "comment" ? "Copy & open →" : "Open →"}
              </button>
              <button
                onClick={() => act("skip")}
                className={
                  item.relevance === "low"
                    ? "rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-[var(--primary-foreground)]"
                    : "rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm text-[var(--muted-foreground)]"
                }
              >
                Skip
              </button>
              {item.kind === "comment" && item.alt_comment && (
                <button
                  onClick={() => {
                    // Swap, don't regenerate: both takes were drafted in the
                    // morning batch, so this is a file read, never a model call.
                    const other = draft === item.alt_comment ? (item.comment ?? "") : item.alt_comment!;
                    setDraft(other);
                  }}
                  title="Swap to the second take drafted this morning"
                  className="rounded-lg border border-[var(--border)] px-3 py-2.5 text-sm text-[var(--muted-foreground)]"
                >
                  {draft === item.alt_comment ? "First take" : "Other take"}
                </button>
              )}
              <span className="ml-auto font-mono text-[12px] text-[var(--muted-foreground)]">
                {i + 1} of {items.length}
              </span>
            </div>
            <p className="mt-2.5 text-[12.5px] text-[var(--muted-foreground)]">
              {focus === "queue"
                ? "Enter next · s skip · r refresh"
                : "Keys are on Replies — click this card to take them back."}
            </p>
          </article>
        ) : (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-8 text-center">
            <b className="block text-[var(--success)]">Stream drained</b>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              {items.length === 0
                ? "No open items on disk. Generate more with engage-daily."
                : "You cleared every open item — including earlier days."}
            </p>
          </div>
        )}
      </Collapse>

      {/* ── Platform metrics ─────────────────────────────────────────────── */}
      {/* ── Impact score ────────────────────────────────────────────────────
          One definition of "more impactful author": five pillars of 20, each
          the mean of metrics scored linearly floor→target. The catalog and the
          targets live in lib/impact-score.ts and nowhere else. */}
      <Collapse id="s25" head={<><span>
          Impact score{impact?.score != null ? ` · ${impact.score} / 100` : ""}
        </span><Refresh onClick={() => pull("impact", "/api/impact", (v: any) => setImpact(v), true)} at={at.impact ?? null} busy={!!busy.impact} source={impact?.day ?? null} /></>}>
        {!impact ? (
          <Skel rows={3} />
        ) : (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
              {impact.pillars.map((p: any) => (
                <div key={p.id} className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
                  <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--muted-foreground)]">{p.label}</div>
                  <div className="mt-1 text-xl font-semibold tabular-nums">{p.points}<span className="text-[12px] font-normal text-[var(--muted-foreground)]"> / {p.max}</span></div>
                  <div className="mt-2 h-1.5 w-full rounded bg-[var(--border)]"><div className="h-1.5 rounded bg-[var(--primary)]" style={{ width: `${Math.round((100 * p.points) / p.max)}%` }} /></div>
                  <div className="mt-1 text-[11px] text-[var(--muted-foreground)]">{p.question}</div>
                </div>
              ))}
            </div>
            <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
              <table className="w-full text-[12px]">
                <thead><tr className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--muted-foreground)]">
                  <th className="px-2 py-1.5 text-left">metric</th><th className="px-2 py-1.5 text-right">value</th><th className="px-2 py-1.5 text-right">floor → target</th><th className="px-2 py-1.5 text-right">points</th><th className="px-2 py-1.5 text-left">source</th>
                </tr></thead>
                <tbody>
                  {impact.pillars.flatMap((p: any) => p.metrics.map((m: any) => (
                    <tr key={m.id} className="border-t border-[var(--border)]">
                      <td className="px-2 py-1"><span className="font-mono text-[10px] text-[var(--muted-foreground)]">{p.label} · </span>{m.label}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{m.value == null ? <span className="text-[var(--warning)]">unmeasured</span> : `${m.value}${m.unit}`}</td>
                      <td className="px-2 py-1 text-right font-mono text-[11px] text-[var(--muted-foreground)]">{m.floor} → {m.target}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{Math.round(m.unitScore * 100)}%</td>
                      <td className="px-2 py-1 font-mono text-[10px] text-[var(--muted-foreground)]">{m.source}</td>
                    </tr>
                  )))}
                </tbody>
              </table>
            </div>
            {impact.league?.length ? (
              <div className="text-[12px] text-[var(--muted-foreground)]">
                <span className="font-mono text-[10px] uppercase tracking-[0.08em]">arena, 30-day top-300 by tag · </span>
                {impact.league.map((t: any) => `#${t.tag} ${t.rank ? `${t.rank}/${t.authors}` : "absent"}${t.above?.length ? ` (next up: ${t.above.slice(-2).map((l: any) => `@${l.author} ${l.reactions}rx`).join(", ")})` : ""}`).join(" · ")}
              </div>
            ) : null}
            <p className="text-[12px] text-[var(--muted-foreground)]">
              {impact.measured} of {impact.total} metrics measured. Unmeasured scores zero on purpose: it is a fact about our instrumentation, not about the author. Followers, lifetime totals and badges are excluded.
            </p>
          </div>
        )}
      </Collapse>

      {/* ── What drives what ─────────────────────────────────────────────────
          Rank correlation between article shape and outcome over our own
          articles. Correlation, labelled; n on every row; nothing under the
          threshold prints. lib/levers.ts. */}
      <Collapse id="s26" head={<><span>
          What drives what{levers?.levers?.length ? ` · ${levers.levers.length} levers` : ""}
        </span><Refresh onClick={() => pull("levers", "/api/levers", (v: any) => setLevers(v), true)} at={at.levers ?? null} busy={!!busy.levers} source={levers?.cachedAt ?? null} /></>}>
        {!levers ? <Skel rows={3} /> : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {(["views14", "comments14", "reactions_per_100_views"] as const).map((o) => (
              <div key={o} className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
                <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--muted-foreground)]">{o === "views14" ? "views, first 14 days" : o === "comments14" ? "comments, first 14 days" : "reactions per 100 views"}</div>
                <ul className="mt-2 flex flex-col gap-1 text-[12px]">
                  {levers.levers.filter((l: any) => l.outcome === o).slice(0, 8).map((l: any) => (
                    <li key={l.feature} className="flex items-baseline gap-2" title={l.note}>
                      <span className={`w-12 shrink-0 text-right font-mono tabular-nums ${l.r > 0 ? "text-[var(--success)]" : "text-[var(--warning)]"}`}>{l.r > 0 ? "+" : ""}{l.r}</span>
                      <span className="min-w-0 flex-1 truncate">{l.feature.replace(/_/g, " ")}</span>
                      <span className="shrink-0 font-mono text-[10px] text-[var(--muted-foreground)]">n={l.n}</span>
                    </li>
                  ))}
                  {levers.levers.filter((l: any) => l.outcome === o).length === 0 && <li className="text-[var(--muted-foreground)]">nothing above the threshold (n ≥ 20, |r| ≥ 0.2)</li>}
                </ul>
              </div>
            ))}
            <p className="text-[12px] text-[var(--muted-foreground)] md:col-span-3">{levers.caveat} {levers.withSnapshots} of {levers.articles} articles have 14-day windows.</p>
          </div>
        )}
      </Collapse>

      {/* ── Profile ─────────────────────────────────────────────────────────
          How the profile is doing, off the dev.to warehouse rather than the
          follower count. The follower tile prints the share that arrived as
          same-day accounts (onboarding suggestions) and how many followers
          ever commented — the one honest proxy for "followers who read". */}
      <Collapse id="s24" head={<><span>
          Profile{profile?.readers?.viewsPerDay7 != null ? ` · ${profile.readers.viewsPerDay7} views/day` : ""}
        </span><Refresh onClick={() => pull("profile", "/api/profile", (v: any) => setProfile(v), true)} at={at.profile ?? null} busy={!!busy.profile} source={profile?.asOf ?? null} /></>}>
        <StatStrip
          cols={4}
          loading={!profile}
          state={{ error: profile?.hint }}
          announce={{ noun: "profile metrics" }}
          items={[
            { key: "views7", label: "Views / day", value: profile?.readers?.viewsPerDay7 ?? null, note: "7-day mean, dev.to analytics" },
            { key: "read7", label: "Read time", value: profile?.readers?.readTimeAvgS7 ?? null, unit: "s", note: "average per view, 7 days" },
            { key: "rx100", label: "Reactions / 100 views", value: profile?.resonance?.reactionsPer100Views30 ?? null, note: "30 days" },
            { key: "cm100", label: "Comments / 100 views", value: profile?.resonance?.commentsPer100Views30 ?? null, note: "30 days" },
            { key: "fol7", label: "Follows / day", value: profile?.followers?.followsPerDay7 ?? null, note: "7-day mean, all sources" },
            { key: "onb", label: "Onboarding share", value: profile?.followers?.onboardingShare30 ?? null, unit: "%", note: "follows from same-day accounts, 30 days" },
            { key: "fread", label: "Followers who commented", value: profile?.followers?.commentersWhoFollow ?? null, note: `of ${profile?.followers?.total ?? "—"} followers` },
            { key: "onbt", label: "Onboarding followers", value: profile?.followers?.onboardingTotal ?? null, note: "accounts created the day they followed" },
          ]}
        />
        {profile?.referrers?.length ? (
          <p className="mt-3 font-mono text-[11px] text-[var(--muted-foreground)]">
            referrers · {profile.referrers.map((r: any) => `${r.domain} ${r.views.toLocaleString()}`).join(" · ")}
          </p>
        ) : null}
        <p className="mt-2 text-[12.5px] text-[var(--muted-foreground)]">
          Followers are not readers: dev.to suggests authors to every new account, and those follows arrive
          on days with fewer views than follows. Read time and comments per view are the numbers that move
          only when someone actually read.
        </p>
      </Collapse>

      <Collapse id="s2" head={<><span>
          Reach
        </span><Refresh onClick={() => pull("insights", "/api/insights", (v: any) => setInsights(v), true)} at={at.insights ?? null} source={insights?.asOf ?? null} busy={!!busy.insights} /></>}>
        <StatStrip
          cols={5}
          loading={!insights}
          state={{ error: insights?.metricsError }}
          announce={{ noun: "platform metrics" }}
          items={(
            [
              ["Followers", "followers"],
              ["Articles", "articles"],
              ["Reactions", "reactions"],
              ["Comments", "comments"],
              ["Views", "views"],
            ] as const
          ).map(([label, k]) => ({
            key: k,
            label,
            value: insights?.metrics[k] ?? null,
          }))}
        />
        {insights?.metricsError && (
          <Callout tone="warn" title="Platform metrics unavailable" className="mt-3">
            {insights.metricsError}. Showing an explicit unmeasured badge rather
            than a stale cached number — a wrong figure here would be worse than
            none.
          </Callout>
        )}
      </Collapse>

      {/* ── Standing ────────────────────────────────────────────────────────
          Are we becoming a more important author? Counts of observed comment
          edges, see lib/standing.ts. Sample-bound, and the strip says so. */}
      <Collapse id="s22" head={<><span>
          Standing{standing?.today?.rank_nonstaff ? ` · #${standing.today.rank_nonstaff} among non-staff` : ""}
        </span><Refresh onClick={() => pull("standing", "/api/standing", (v: any) => setStanding(v), true)} at={at.standing ?? null} source={standing?.graphFetchedAt ?? null} busy={!!busy.standing} /></>}>
        <StatStrip
          cols={4}
          loading={!standing}
          state={{ error: standing?.error }}
          announce={{ noun: "standing metrics" }}
          items={(
            [
              ["Mutual ties", "mutual", "two-way comment ties"],
              ["Commented on us", "in_authors", "distinct authors, observed"],
              ["Core reach", "core_reach", "mutual ties with the top 40"],
              ["Replies waiting", "replies_waiting", "unanswered threads"],
              ["Rank", "rank_nonstaff", "among non-staff, by ties"],
              ["Authors tied", "degree", "either direction"],
              ["Reply latency", "reply_latency_h", "median hours, over marks"],
              ["Sampled", "sample_size", "articles behind every number"],
            ] as const
          ).map(([label, k, note]) => {
            const hist = standing?.history ?? [];
            const prior = hist.length > 7 ? hist[hist.length - 8]?.[k] : null;
            return { key: k, label, note, value: standing?.today?.[k] ?? null, prior: typeof prior === "number" ? prior : null };
          })}
        />
        {standing?.error && (
          <Callout tone="warn" title="No standing yet" className="mt-3">{standing.error}</Callout>
        )}
        <p className="mt-3 text-[12.5px] text-[var(--muted-foreground)]">
          Every number is a count of comment edges or threads that exist on dev.to. Followers and
          reactions are absent on purpose: the first is invisible for other accounts, the second
          carries no &ldquo;who&rdquo;. Rank compares within one crawl policy only.
        </p>
      </Collapse>

      {/* ── DEV community network ────────────────────────────────────────── */}
      <Collapse id="s3" head={<><span>
          DEV community network
        </span><Refresh onClick={() => pull("network", "/api/network", (v: any) => setGraph(v), true)} at={at.network ?? null} source={graph?.fetchedAt ?? null} busy={!!busy.network} /></>}>
        {graph ? (
          <NetworkGraph graph={graph} onOpenPerson={openPerson} />
        ) : (
          <div className="flex flex-col gap-3">
            <Skeleton variant="chart" label="Crawling public comment threads" />
            <p className="text-[12px] text-[var(--muted-foreground)]">
              Crawling public comment threads — this takes ~15s.
            </p>
          </div>
        )}
      </Collapse>

      {person && (
        <Collapse id="s4" head={<>
            Author focus
          </>}>
          {person.loading ? <Skel rows={4} /> : <Person data={person} onClose={() => {
              setPerson(null);
              try {
                const url = new URL(window.location.href);
                url.searchParams.delete("u");
                window.history.replaceState(null, "", url);
              } catch {
                /* see openPerson */
              }
            }} />}
        </Collapse>
      )}

      {/* ── Partnerships ─────────────────────────────────────────────────── */}
      <Collapse id="s5" head={<><span>
          Author partnerships
        </span><Refresh onClick={() => pull("insights", "/api/insights", (v: any) => setInsights(v), true)} at={at.insights ?? null} source={insights?.asOf ?? null} busy={!!busy.insights} /></>}>
        {/*
          The conversion bar was a `<span>`-in-`<span>` with an inline width —
          no role, no value, invisible to anything that is not an eye. `<Meter>`
          is `role="meter"` with a real `aria-valuenow`, and a null conversion
          hatches instead of drawing an empty bar that reads as zero.
        */}
        <DataTable
          caption="Author partnerships, ranked by who talked back"
          captionHidden
          loading={!insights}
          rows={insights?.authors.slice(0, 20) ?? []}
          rowKey={(a) => a.author}
          empty="No author partnerships recorded yet."
          columns={[
            {
              id: "author",
              header: "Author",
              cell: (a) => (
                <a
                  href={`https://dev.to/${a.author}`}
                  target="_blank"
                  rel="noopener"
                  className="text-[var(--primary)]"
                >
                  @{a.author}
                </a>
              ),
            },
            {
              id: "talkedBack",
              header: "Talked back",
              align: "end",
              className: "whitespace-nowrap",
              cell: (a) =>
                a.repliedToUs ? (
                  <span
                    className={
                      a.weAnswered < a.repliedToUs
                        ? "text-[var(--warning)]"
                        : "text-[var(--success)]"
                    }
                    title={
                      a.weAnswered < a.repliedToUs
                        ? `${a.repliedToUs - a.weAnswered} reply(ies) still unanswered`
                        : "every reply answered"
                    }
                  >
                    {a.weAnswered}/{a.repliedToUs}
                  </span>
                ) : (
                  <span className="text-[var(--muted-foreground)]">—</span>
                ),
            },
            { id: "drafted", header: "Drafted", align: "end", cell: (a) => a.drafted },
            { id: "sent", header: "Sent", align: "end", cell: (a) => a.sent },
            {
              id: "conversion",
              header: "Conversion",
              className: "min-w-[160px]",
              cell: (a) => (
                <Meter
                  size="sm"
                  // `label` is required and always painted — it carries no
                  // `data-slot`, so there is no CSS hook to hide it and no
                  // `labelHidden` prop. In a table the column header already
                  // names the measure, so the label is repeated noise; wrapping
                  // it in `sr-only` is the only way to suppress it.
                  label={<span className="sr-only">{a.author} conversion</span>}
                  value={a.conversion ?? null}
                  max={100}
                  unit="%"
                  tone="positive"
                />
              ),
            },
            {
              id: "tags",
              header: "Topics",
              cell: (a) => (
                <span className="flex flex-wrap gap-1">
                  {a.tags.map((t) => (
                    <span
                      key={t}
                      className="rounded-full border border-[var(--border)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--muted-foreground)]"
                    >
                      #{t}
                    </span>
                  ))}
                </span>
              ),
            },
            {
              id: "last",
              header: "Last",
              className: "font-mono text-[12px] text-[var(--muted-foreground)]",
              cell: (a) => a.last,
            },
          ]}
        />
        <p className="text-[12.5px] text-[var(--muted-foreground)]">
          Ranked by who <b>talked back</b> first, then by volume — a reply is the
          only signal here we did not manufacture. Amber means they answered us
          and we have not answered them. A tall <b>Drafted</b> with 0% conversion
          is a relationship the queue keeps proposing and nobody ever completes.
        </p>
      </Collapse>
      {/* ── Reply inbox ──────────────────────────────────────────────────── */}
      <Collapse id="s6" head={<><span>
          {/* Count what is LEFT, not what was loaded. The header said "· 1"
              while the card said "No unanswered replies" — both were reading
              the same array, one from its length and one through a cursor that
              had already walked past the end. A header that disagrees with the
              card under it is worse than either number alone. */}
          Replies waiting{" "}
          {threads && threads.length - ri > 0 ? `· ${threads.length - ri}` : ""}
        </span><Refresh onClick={() => refreshThreads()} at={at.threads ?? null} source={threadsAsOf} busy={!!busy.threads} /></>}>
        {threadHint && <Callout tone="warn">{threadHint}</Callout>}
        {threads ? (
          <Threads
            threads={threads}
            i={ri}
            reply={reply}
            setReply={setReply}
            drafting={false}
            error={null}
            onAct={replyAct}
            onRetry={refreshThreads}
            focused={focus === "replies"}
            onFocus={() => setFocus("replies")}
            onMark={markThread}
            onJump={(n) => {
              setRi(n);
              // Load that thread's draft, or clear the box — carrying the
              // previous thread's text into a different conversation is how you
              // post the wrong reply.
              setReply(threads[n]?.draft ?? "");
            }}
          />
        ) : (
          <Skel rows={3} />
        )}
      </Collapse>

      {/* ── Impact ───────────────────────────────────────────────────────── */}
      <Collapse id="s7" head={<><span>
          Impact
        </span><Refresh onClick={() => pull("sources", "/api/sources", (v: any) => setSources(v), true)} at={at.sources ?? null} source={sources?.asOf ?? null} busy={!!busy.sources} /></>}>
        {sources ? (
          sources.impact?.error ? (
            <p className="text-[13px] text-[var(--warning)]">
              {sources.impact.error}
            </p>
          ) : (
            <Impact
              rows={sources.impact?.rows ?? []}
              live={insights?.metrics?.followers ?? null}
              today={state?.date}
            />
          )
        ) : (
          <Skel rows={2} />
        )}
      </Collapse>

      {/* ── Promotion ────────────────────────────────────────────────────── */}
      <Collapse id="s8" head={<><span>
          Plugin promotion {sources?.promotion?.prs?.length ? `· ${sources.promotion.prs.length} PRs` : ""}
        </span><Refresh onClick={() => pull("sources", "/api/sources", (v: any) => setSources(v), true)} at={at.sources ?? null} source={sources?.asOf ?? null} busy={!!busy.sources} /></>}>
        {sources ? <Promotion prs={sources.promotion?.prs ?? []} /> : <Skel rows={4} />}
      </Collapse>

      {/* ── Benchmark ────────────────────────────────────────────────────── */}
      <Collapse id="s21" head={<><span>Beating the index?{bench?.daysCollected ? ` · ${bench.daysCollected}d sampled` : ""}</span><Refresh onClick={() => pull("bench", "/api/benchmark", (v: any) => setBench(v), true)} at={at.bench ?? null} source={bench?.day ?? null} busy={!!busy.bench} /></>}>
        <Benchmark data={bench} />
      </Collapse>

      {/* ── Trend grid ───────────────────────────────────────────────────── */}
      <Collapse id="s20" head={<><span>Trends{trends?.days ? ` · ${trends.days}d` : ""}</span><Refresh onClick={() => pull(`trends:${grain}`, `/api/trends?grain=${grain}`, (v: any) => setTrends(v), true)} at={at[`trends:${grain}`] ?? null} busy={!!busy[`trends:${grain}`]} /></>}>
        <TrendGrid
          data={trends}
          grain={grain}
          onGrain={(g) => {
            setGrain(g);
            pull(`trends:${g}`, `/api/trends?grain=${g}`, (v: any) => setTrends(v));
          }}
        />
      </Collapse>

      {/* ── Google AI roster ─────────────────────────────────────────────── */}
      <Collapse id="s19" head={<><span>Google AI org{people?.roster?.length ? ` · ${people.roster.length}` : ""}</span><Refresh onClick={() => pull("people", "/api/people", (v: any) => setPeople(v), true)} at={at.people ?? null} source={people?.cachedAt ?? null} busy={!!busy.people} /></>}>
        <Roster roster={people?.roster ?? []} />
      </Collapse>

      {/* ── Correlation ──────────────────────────────────────────────────── */}
      <Collapse id="s18" head={<><span>Did it move anything?</span><Refresh onClick={() => pull("corr", "/api/correlate", (v: any) => setCorr(v), true)} at={at.corr ?? null} busy={!!busy.corr} /></>}>
        <Correlate data={corr} />
      </Collapse>

      {/* ── Plugin catalog ───────────────────────────────────────────────── */}
      <Collapse id="s9" head={<><span>
          The portfolio{catalog?.plugins?.length ? ` · ${catalog.plugins.length} packages` : ""}
        </span><Refresh onClick={() => pull("catalog", "/api/plugins", (v: any) => setCatalog(v), true)} at={at.catalog ?? null} busy={!!busy.catalog} /></>}>
        {catalog ? <PluginCatalog plugins={catalog.plugins ?? []} /> : <Skel rows={6} />}
      </Collapse>

      {/* ── Plugin FP/FN ─────────────────────────────────────────────────── */}
      <Collapse id="s10" head={<><span>
          Plugin findings {sources?.plugins?.findings?.length ? `· ${sources.plugins.findings.length}` : ""}
        </span><Refresh onClick={() => pull("sources", "/api/sources", (v: any) => setSources(v), true)} at={at.sources ?? null} source={sources?.asOf ?? null} busy={!!busy.sources} /></>}>
        {sources ? <Plugins findings={sources.plugins?.findings ?? []} /> : <Skel rows={5} />}
      </Collapse>

      {/* ── Site health (PostHog) ────────────────────────────────────────── */}
      <Collapse id="s11" head={<>
          Site health {sources?.errors?.rows?.length ? `· ${sources.errors.rows.length} issues` : ""}
        </>}>
        {sources ? (
          <SiteHealth
            vitals={sources.vitals ?? { rows: [], error: null }}
            errors={sources.errors ?? { rows: [], error: null }}
          />
        ) : (
          <Skel rows={5} />
        )}
      </Collapse>
      <Collapse id="s12" head={<><span>Founders &amp; Google AI{people?.people?.length ? ` · ${people.people.filter((p: any) => p.latest?.reactable).length} reactable` : ""}</span><Refresh onClick={() => pull("people", "/api/people", (v: any) => setPeople(v), true)} at={at.people ?? null} source={people?.cachedAt ?? null} busy={!!busy.people} /></>}>
        {people ? <People people={people.people ?? []} /> : <Skel rows={5} />}
      </Collapse>

      <Collapse id="s13" head={<><span>PR board{board?.prs?.length ? ` · ${board.prs.filter((p: any) => p.actionRequired).length} need you` : ""}</span><Refresh onClick={() => pull("board", "/api/board", (v: any) => setBoard(v), true)} at={at.board ?? null} source={board?.cachedAt ?? null} busy={!!busy.board} /></>}>
        {board ? <Board prs={board.prs ?? []} /> : <Skel rows={5} />}
      </Collapse>

      <Collapse id="s14" head={<><span>Ecosystem</span><Refresh onClick={() => pull("eco", "/api/ecosystem", (v: any) => setEco(v), true)} at={at.eco ?? null} busy={!!busy.eco} /></>}>
        {eco ? <Ecosystem totals={eco.totals ?? null} /> : <Skel rows={2} />}
      </Collapse>

      <Collapse id="s15" head={<><span>Article web{web?.nodes?.length ? ` · ${web.nodes.length}` : ""}</span><Refresh onClick={() => pull("web", "/api/articles", (v: any) => setWeb(v), true)} at={at.web ?? null} busy={!!busy.web} /></>}>
        {web ? <ArticleWeb nodes={web.nodes ?? []} /> : <Skel rows={4} />}
      </Collapse>

      {/* ── Audience clock ───────────────────────────────────────────────── */}
      <Collapse id="s16" head={<>
          <span>
            Audience clock
            {audience?.zones?.length ? ` · ${audience.zones.length} zones` : ""}
          </span>
          <Refresh
            onClick={() => pull("audience", "/api/audience", (v: any) => setAudience(v), true)}
            at={at.audience ?? null}
            busy={!!busy.audience}
          />
        </>}>
        {audience ? (
          <AudienceClock
            hours={audience.hours ?? []}
            zones={audience.zones ?? []}
            error={audience.error ?? null}
          />
        ) : (
          <Skel rows={4} />
        )}
      </Collapse>

      {/* The old single-chart Trends panel lived here. It read history.jsonl,
          which starts today — one point, and it looked broken because it was.
          Replaced by the trend grid above, over the 159-day Supabase series.
          Its `/api/history` fetch outlived it by several releases: the response
          was still requested on every mount and assigned to state nothing read.
          The route stays — /raw links it — but the control room no longer pays
          for it. */}

    </main>
  );
}
