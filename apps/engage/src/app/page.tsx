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
}
interface State {
  date: string;
  items: Item[];
  acted: Acted[];
  release: { queue?: unknown[]; nextFire?: string; minDays?: number } | null;
  totals: { open: number; everActed: number; everDrafted: number };
}
interface Insights {
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
  green: "text-[var(--color-good)] border-[var(--color-good)]",
  amber: "text-[var(--color-warn)] border-[var(--color-warn)]",
  red: "text-[var(--color-accent)] border-[var(--color-accent)]",
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
        window.open(t.articleUrl, "_blank", "noopener");
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

  const acted = useMemo(
    () => [...(state?.acted ?? []), ...session],
    [state, session],
  );
  const gs = useMemo(() => gauges(acted), [acted]);
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
          action,
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
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--color-ink-3)]">
          Interlace · control room
        </span>
        <div className="flex flex-wrap items-baseline gap-4">
          <h1 className="text-[28px] font-semibold tracking-tight">Engage</h1>
          <Link href="/queue" className="font-mono text-[11px] uppercase tracking-wider text-[var(--color-ink-3)] hover:text-[var(--color-accent)]">
            queue
          </Link>
          <Link href="/journeys" className="font-mono text-[11px] uppercase tracking-wider text-[var(--color-ink-3)] hover:text-[var(--color-accent)]">
            journeys
          </Link>
          <Link href="/calendar" className="font-mono text-[11px] uppercase tracking-wider text-[var(--color-ink-3)] hover:text-[var(--color-accent)]">
            calendar
          </Link>
          <Link href="/raw" className="font-mono text-[11px] uppercase tracking-wider text-[var(--color-ink-3)] hover:text-[var(--color-accent)]">
            raw data →
          </Link>
          <Link href="/releases" className="font-mono text-[11px] uppercase tracking-wider text-[var(--color-ink-3)] hover:text-[var(--color-accent)]">
            releases →
          </Link>
        </div>
      </header>

      {/* Pace meter. Deliberately not a cap — it reports, and only the one
          server-enforced limit can disable the button. */}
      <section>
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-line)] sm:grid-cols-4">
          {state
            ? gs.map((g) => (
                <div
                  key={g.label}
                  className="bg-[var(--color-panel)] p-4"
                  title={g.hint}
                >
                  <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--color-ink-3)]">
                    {g.label}
                    {g.hard ? " ·  enforced" : ""}
                  </div>
                  <div
                    className={`mt-1 text-2xl font-semibold tabular-nums ${LEVEL[g.level].split(" ")[0]}`}
                  >
                    {g.value}
                  </div>
                </div>
              ))
            : Array.from({ length: 4 }).map((_, n) => (
                <div key={n} className="bg-[var(--color-panel)] p-4">
                  <div className="skeleton h-3 w-24" />
                  <div className="skeleton mt-2 h-7 w-12" />
                </div>
              ))}
        </div>
        {actErr && (
          <p className="mt-3 rounded-lg border border-[var(--color-accent)] bg-[color-mix(in_srgb,var(--color-accent)_8%,transparent)] p-3 text-sm">
            <b>Not recorded</b> — {actErr}
          </p>
        )}
        {hardBlock && (
          <p className="mt-3 rounded-lg border border-[var(--color-accent)] bg-[color-mix(in_srgb,var(--color-accent)_8%,transparent)] p-3 text-sm">
            <b>{hardBlock.label}</b> — {hardBlock.hint} Waiting is the only fix;
            Dev.to rejects the write, not us.
          </p>
        )}
      </section>

      <Collapse id="s1" head={<>
          Up next
        </>}>

        {!state ? (
          <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] p-6">
            <div className="skeleton h-3 w-28" />
            <div className="skeleton mt-3 h-6 w-3/4" />
            <div className="skeleton mt-4 h-32 w-full" />
          </div>
        ) : item ? (
          <article
            onMouseDown={() => setFocus("queue")}
            onFocusCapture={() => setFocus("queue")}
            className={`rounded-xl border bg-[var(--color-panel)] p-6 ${focus === "queue" ? "border-[var(--color-accent)]" : "border-[var(--color-line)]"}`}
          >
            {item.kind === "reaction" && (
              <div className="mb-3 inline-block rounded-md border border-[var(--color-warn)] px-2.5 py-1 font-mono text-[13px] text-[var(--color-warn)]">
                React: {(item.category ?? "").replace(/_/g, " ").toUpperCase()}
              </div>
            )}
            <div className="font-mono text-[12px] text-[var(--color-accent)]">
              @{item.article.author}
            </div>
            <h3 className="mt-1.5 text-[19px] font-semibold leading-snug">
              {item.article.title}
            </h3>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {item.article.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-[var(--color-line)] px-2 py-0.5 font-mono text-[10px] text-[var(--color-ink-2)]"
                >
                  #{t}
                </span>
              ))}
            </div>
            {item.tldr && (
              <p className="mt-3 border-l-2 border-[var(--color-line)] pl-3 text-sm text-[var(--color-ink-2)]">
                {item.tldr}
              </p>
            )}
            {item.kind === "comment" && (
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="mt-4 min-h-40 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-ground)] p-3 text-[14.5px] leading-relaxed"
              />
            )}
            <div className="mt-4 flex flex-wrap items-center gap-2.5">
              <button
                onClick={() => act("done")}
                className="rounded-lg bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-white"
              >
                {item.kind === "comment" ? "Copy & open →" : "Open →"}
              </button>
              <button
                onClick={() => act("skip")}
                className="rounded-lg border border-[var(--color-line)] px-4 py-2.5 text-sm text-[var(--color-ink-2)]"
              >
                Skip
              </button>
              <span className="ml-auto font-mono text-[12px] text-[var(--color-ink-3)]">
                {i + 1} of {items.length}
              </span>
            </div>
            <p className="mt-2.5 text-[12.5px] text-[var(--color-ink-3)]">
              {focus === "queue"
                ? "Enter next · s skip · r refresh"
                : "Keys are on Replies — click this card to take them back."}
            </p>
          </article>
        ) : (
          <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] p-8 text-center">
            <b className="block text-[var(--color-good)]">Stream drained</b>
            <p className="mt-1 text-sm text-[var(--color-ink-2)]">
              {items.length === 0
                ? "No open items on disk. Generate more with engage-daily."
                : "You cleared every open item — including earlier days."}
            </p>
          </div>
        )}
      </Collapse>

      {/* ── Platform metrics ─────────────────────────────────────────────── */}
      <Collapse id="s2" head={<><span>
          Reach
        </span><Refresh onClick={() => pull("insights", "/api/insights", (v: any) => setInsights(v), true)} at={at.insights ?? null} busy={!!busy.insights} /></>}>
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-line)] sm:grid-cols-5">
          {(
            [
              ["Followers", "followers"],
              ["Articles", "articles"],
              ["Reactions", "reactions"],
              ["Comments", "comments"],
              ["Views", "views"],
            ] as const
          ).map(([label, k]) => (
            <div key={k} className="bg-[var(--color-panel)] p-4">
              <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--color-ink-3)]">
                {label}
              </div>
              {insights ? (
                <div className="mt-1 text-2xl font-semibold tabular-nums">
                  {insights.metrics[k]?.toLocaleString() ?? "—"}
                </div>
              ) : (
                <div className="skeleton mt-2 h-7 w-14" />
              )}
            </div>
          ))}
        </div>
        {insights?.metricsError && (
          <p className="text-[12.5px] text-[var(--color-warn)]">
            Platform metrics unavailable ({insights.metricsError}). Showing dashes
            rather than a stale cached number — a wrong figure here would be worse
            than none.
          </p>
        )}
      </Collapse>

      {/* ── DEV community network ────────────────────────────────────────── */}
      <Collapse id="s3" head={<><span>
          DEV community network
        </span><Refresh onClick={() => pull("network", "/api/network", (v: any) => setGraph(v), true)} at={at.network ?? null} busy={!!busy.network} /></>}>
        {graph ? (
          <NetworkGraph graph={graph} onOpenPerson={openPerson} />
        ) : (
          <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] p-4">
            <div className="skeleton h-3 w-56" />
            <div className="skeleton mt-3 h-[420px] w-full" />
            <p className="mt-3 text-[12px] text-[var(--color-ink-3)]">
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
        </span><Refresh onClick={() => pull("insights", "/api/insights", (v: any) => setInsights(v), true)} at={at.insights ?? null} busy={!!busy.insights} /></>}>
        <div className="overflow-x-auto rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)]">
          {insights ? (
            <table className="w-full text-[13.5px]">
              <thead>
                <tr className="border-b border-[var(--color-line)] text-left font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--color-ink-3)]">
                  <th className="p-3 font-medium">Author</th>
                  <th className="p-3 font-medium" title="Replies they wrote back to us / how many we have answered">
                    Talked back
                  </th>
                  <th className="p-3 font-medium">Drafted</th>
                  <th className="p-3 font-medium">Sent</th>
                  <th className="p-3 font-medium">Conversion</th>
                  <th className="p-3 font-medium">Topics</th>
                  <th className="p-3 font-medium">Last</th>
                </tr>
              </thead>
              <tbody>
                {insights.authors.slice(0, 20).map((a) => (
                  <tr key={a.author} className="border-b border-[var(--color-line)] last:border-0">
                    <td className="p-3">
                      <a
                        href={`https://dev.to/${a.author}`}
                        target="_blank"
                        rel="noopener"
                        className="text-[var(--color-accent)]"
                      >
                        @{a.author}
                      </a>
                    </td>
                    <td className="whitespace-nowrap p-3 tabular-nums">
                      {a.repliedToUs ? (
                        <span
                          className={
                            a.weAnswered < a.repliedToUs
                              ? "text-[var(--color-warn)]"
                              : "text-[var(--color-good)]"
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
                        <span className="text-[var(--color-ink-3)]">—</span>
                      )}
                    </td>
                    <td className="p-3 tabular-nums">{a.drafted}</td>
                    <td className="p-3 tabular-nums">{a.sent}</td>
                    <td className="whitespace-nowrap p-3 tabular-nums">
                      <span className="mr-2 inline-block h-1.5 w-[70px] overflow-hidden rounded bg-[var(--color-line)] align-middle">
                        <span
                          className="block h-full bg-[var(--color-good)]"
                          style={{ width: `${a.conversion}%` }}
                        />
                      </span>
                      {a.conversion}%
                    </td>
                    <td className="p-3">
                      <span className="flex flex-wrap gap-1">
                        {a.tags.map((t) => (
                          <span
                            key={t}
                            className="rounded-full border border-[var(--color-line)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-ink-2)]"
                          >
                            #{t}
                          </span>
                        ))}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-[12px] text-[var(--color-ink-3)]">
                      {a.last}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-4">
              {Array.from({ length: 6 }).map((_, n) => (
                <div key={n} className="skeleton mb-2 h-8 w-full" />
              ))}
            </div>
          )}
        </div>
        <p className="text-[12.5px] text-[var(--color-ink-3)]">
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
        </span><Refresh onClick={() => refreshThreads()} at={at.threads ?? null} busy={!!busy.threads} /></>}>
        {threadHint && (
          <p className="rounded-lg border border-[var(--color-warn)] p-3 text-[13px] text-[var(--color-warn)]">
            {threadHint}
          </p>
        )}
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
          />
        ) : (
          <Skel rows={3} />
        )}
      </Collapse>

      {/* ── Impact ───────────────────────────────────────────────────────── */}
      <Collapse id="s7" head={<><span>
          Impact
        </span><Refresh onClick={() => pull("sources", "/api/sources", (v: any) => setSources(v), true)} at={at.sources ?? null} busy={!!busy.sources} /></>}>
        {sources ? (
          sources.impact?.error ? (
            <p className="text-[13px] text-[var(--color-warn)]">
              {sources.impact.error}
            </p>
          ) : (
            <Impact rows={sources.impact?.rows ?? []} />
          )
        ) : (
          <Skel rows={2} />
        )}
      </Collapse>

      {/* ── Promotion ────────────────────────────────────────────────────── */}
      <Collapse id="s8" head={<><span>
          Plugin promotion {sources?.promotion?.prs?.length ? `· ${sources.promotion.prs.length} PRs` : ""}
        </span><Refresh onClick={() => pull("sources", "/api/sources", (v: any) => setSources(v), true)} at={at.sources ?? null} busy={!!busy.sources} /></>}>
        {sources ? <Promotion prs={sources.promotion?.prs ?? []} /> : <Skel rows={4} />}
      </Collapse>

      {/* ── Benchmark ────────────────────────────────────────────────────── */}
      <Collapse id="s21" head={<><span>Beating the index?{bench?.daysCollected ? ` · ${bench.daysCollected}d sampled` : ""}</span><Refresh onClick={() => pull("bench", "/api/benchmark", (v: any) => setBench(v), true)} at={at.bench ?? null} busy={!!busy.bench} /></>}>
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
      <Collapse id="s19" head={<><span>Google AI org{people?.roster?.length ? ` · ${people.roster.length}` : ""}</span><Refresh onClick={() => pull("people", "/api/people", (v: any) => setPeople(v), true)} at={at.people ?? null} busy={!!busy.people} /></>}>
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
        </span><Refresh onClick={() => pull("sources", "/api/sources", (v: any) => setSources(v), true)} at={at.sources ?? null} busy={!!busy.sources} /></>}>
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
      <Collapse id="s12" head={<><span>Founders &amp; Google AI{people?.people?.length ? ` · ${people.people.filter((p: any) => p.latest?.reactable).length} reactable` : ""}</span><Refresh onClick={() => pull("people", "/api/people", (v: any) => setPeople(v), true)} at={at.people ?? null} busy={!!busy.people} /></>}>
        {people ? <People people={people.people ?? []} /> : <Skel rows={5} />}
      </Collapse>

      <Collapse id="s13" head={<><span>PR board{board?.prs?.length ? ` · ${board.prs.filter((p: any) => p.actionRequired).length} need you` : ""}</span><Refresh onClick={() => pull("board", "/api/board", (v: any) => setBoard(v), true)} at={at.board ?? null} busy={!!busy.board} /></>}>
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
