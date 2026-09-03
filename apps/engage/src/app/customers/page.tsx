"use client";

/** Untouched this long and a PR needs a nudge rather than more patience. */
const STALE_PR_DAYS = 21;
/**
 * Rows a sector shows before you ask for the rest. The board grew from 534
 * candidates to over 4,000 between the first draft and this port; rendering
 * every row as a button made the page a 40k-node wall that scrolled like one.
 * The ranking is what matters, and the top of a ranked list is the ranking.
 */
const SECTOR_FOLD = 40;

import { useMemo, useState } from "react";
import Link from "next/link";
import { useCachedSection } from "@/lib/client-cache";
import { Collapse, Refresh, Skel } from "@/components/panels";
import { Badge } from "@/components/ui/badge";
import { Callout } from "@/components/ui/callout";
import { Skeleton } from "@/components/ui/skeleton";
import { StatStrip } from "@/components/ui/stat-strip";

/**
 * The customer monitor.
 *
 * `/conquest` asks where the next PR should go. This asks the question that
 * comes after a merge and otherwise never gets asked: is the consumer still
 * there, and is it being shown false positives.
 *
 * Drawn as a bipartite graph — what we publish on the left, who installs it on
 * the right — because here the shape IS the information, unlike the conquest
 * map. Two things are legible at a glance that a table cannot show: a package
 * with no edge at all has downloads but no discoverable consumer, and a thick
 * edge is a config aggregator whose own consumers inherit our rules.
 *
 * Findings are what that repository's maintainers see when they run the
 * PUBLISHED plugins. Not a local build — a stranger runs what is on npm.
 */

interface Customer {
  slug: string;
  depth: string;
  stars: number;
  kloc: number;
  findings: number;
  verifiedFalse: number;
  unread: number;
  perKloc: number | null;
  idleDays: number | null;
  churn: "live" | "aging" | "dormant" | "unknown";
  plugins: string[];
  note?: string;
  via?: number;
  /** The package it publishes, where it publishes one. */
  npm?: string;
  /** Weekly installs of the consumer itself, where it is a published package. */
  reach?: number | null;
  /** False when its semver range cannot resolve to what we publish today. */
  receives?: boolean;
  approachable?: boolean;
  tpCount?: number;
  fpCount?: number;
  fpOpen?: number;
  truePositives?: any[];
  falsePositives?: any[];
  repoUrl?: string;
  branch?: string;
  measuredOn?: string;
  measuredUrl?: string;
}

/**
 * Churn as a colour. `dormant` was the brand accent in the pre-DS draft; on
 * the DS the brand colour is `--primary` and means "ours / act here", so a
 * repository at risk is `--destructive` instead — the same token the PR list
 * uses for "our move", because both are the thing to look at first.
 */
const CHURN_TONE: Record<string, string> = {
  live: "var(--success)",
  aging: "var(--warning)",
  dormant: "var(--destructive)",
  unknown: "var(--muted-foreground)",
};

/**
 * These describe REPOSITORY MAINTENANCE — days since the last push — and nothing
 * about the health of our relationship with it. A dormant repo is still worth a
 * try; it is just a slower door and a merge is less likely to be noticed.
 */
const CHURN_WORD: Record<string, string> = {
  live: "active",
  aging: "slowing",
  dormant: "stale",
  unknown: "unknown",
};

const CHURN_MEANING: Record<string, string> = {
  live: "pushed within 30 days",
  aging: "30–90 days since a push",
  dormant: "no push in over 90 days",
  unknown: "no push date",
};

const short = (slug: string) => {
  const [owner, name] = slug.split("/");
  return name && name.length > 26 ? `${owner}/${name.slice(0, 24)}…` : slug;
};

const repoUrlOf = (c: { slug: string; repoUrl?: string }) =>
  c.repoUrl ?? `https://github.com/${c.slug}`;

const card = "rounded-xl border border-[var(--border)] bg-[var(--card)]";
const subhead =
  "border-b border-[var(--border)] px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]";
const meta =
  "font-mono text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]";
const linkBtn =
  "rounded-md border border-[var(--border)] px-2 py-1 font-mono text-[10.5px] uppercase tracking-wide hover:border-[var(--primary)] hover:text-[var(--primary)]";
const th =
  "border-b border-[var(--border)] px-3 py-2 text-left font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--muted-foreground)]";
const td = "border-b border-[var(--border)] px-3 py-2.5";

/**
 * A reading the sweep did not take. Rendered as a word rather than a 0 or a
 * dash: three quarters of the candidate board has no outside-merge count at
 * all, and `?? 0` had been printing "0 merges" on every one of them — a
 * number that looked measured and was not.
 */
function Unmeasured({ what }: { what: string }) {
  return (
    <span
      className="font-mono text-[10px] uppercase tracking-wide text-[var(--muted-foreground)] opacity-70"
      title={`${what} — not measured by the sweep`}
    >
      {what} unmeasured
    </span>
  );
}

/** A section's lead paragraph, under the Collapse head. */
function Lead({ children, dim }: { children: React.ReactNode; dim?: boolean }) {
  return (
    <p
      className={`max-w-[74ch] text-[13px] ${dim ? "text-[var(--muted-foreground)]" : "text-[var(--foreground)]"}`}
    >
      {children}
    </p>
  );
}

export default function Customers() {
  const { data, at, busy, refresh } = useCachedSection<any>(
    "customers",
    "/api/customers",
    () => ({ customers: [], packages: [], error: "unreachable" }),
  );

  /**
   * PR state is fetched separately and on its own refresh, because it is the
   * one thing here that changes without us doing anything: a maintainer
   * replies, a check goes red, a review lands. A copy stored alongside the
   * pipeline would be wrong from the moment it was written.
   */
  const {
    data: prData,
    at: prAt,
    busy: prBusy,
    refresh: refreshPrs,
  } = useCachedSection<any>("customer-prs", "/api/prs", () => ({
    prs: [],
    totals: null,
    error: "unreachable",
  }));
  const [updating, setUpdating] = useState<string | null>(null);
  const [updateResult, setUpdateResult] = useState<Record<string, { ok: boolean; message: string }>>({});
  /** One click, one PR: the always-safe move, reported verbatim from GitHub. */
  const updateBranch = async (p: any) => {
    setUpdating(p.url);
    try {
      const r = await fetch("/api/prs/update", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ owner: p.owner, repo: p.repo, number: p.number }),
      });
      const j = await r.json().catch(() => ({ ok: false, message: `HTTP ${r.status}` }));
      setUpdateResult((m) => ({ ...m, [p.url]: { ok: !!j.ok, message: j.message ?? j.error ?? "no answer" } }));
      if (j.ok) setTimeout(() => refreshPrs(), 45_000);
    } catch (e: any) {
      setUpdateResult((m) => ({ ...m, [p.url]: { ok: false, message: String(e?.message ?? e).slice(0, 80) } }));
    } finally {
      setUpdating(null);
    }
  };

  const customers: Customer[] = data?.customers ?? [];
  const candidateCount: number = data?.candidateCount ?? 0;
  const sectors: any[] = data?.sectors ?? [];
  const packages: any[] = data?.packages ?? [];
  const totals = data?.totals ?? null;
  const pipeline: any[] = data?.pipeline ?? [];
  const pt = data?.pipelineTotals ?? null;
  const upsells: any[] = data?.upsells ?? [];
  const ledger: any = data?.ledger ?? null;

  /** Which candidate is expanded. One at a time — this is a board, not a wall. */
  const [focus, setFocus] = useState<string | null>(null);
  const [q, setQ] = useState("");
  /** Sectors the reader has asked to see past the fold. */
  const [unfolded, setUnfolded] = useState<Set<string>>(() => new Set());
  /** PR list controls: what to hide, and what to lead with. */
  const [prSort, setPrSort] = useState<"phase" | "newest" | "oldest">("phase");
  const [hideStale, setHideStale] = useState(false);

  /**
   * The PR list defaults to whose-move order, because that is what it is for.
   * Newest exists because a list led by things nobody has touched in three
   * weeks reads as "we have not opened a PR in a month" even when we have.
   */
  const shownPrs = useMemo(() => {
    const all = prData?.prs ?? [];
    const kept = hideStale
      ? all.filter((p: any) => (p.idleDays ?? 0) < STALE_PR_DAYS)
      : all;
    if (prSort === "phase") return kept;
    const dir = prSort === "newest" ? -1 : 1;
    return [...kept].sort(
      (a: any, b: any) =>
        dir * (Date.parse(b.openedAt ?? 0) - Date.parse(a.openedAt ?? 0)),
    );
  }, [prData, prSort, hideStale]);

  const [readyOnly, setReadyOnly] = useState(false);

  /**
   * 534 candidates in eleven panels is a list, not a board. The filter is what
   * makes it one: 212 public-sector rows are unusable until you can ask them a
   * question.
   */
  const shownSectors = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle && !readyOnly) return sectors;
    return sectors
      .map((sec: any) => ({
        ...sec,
        items: sec.items.filter(
          (c: any) =>
            (!needle || c.slug.toLowerCase().includes(needle)) &&
            // "dormant" is the churn value; the first draft tested "stale",
            // which is only the WORD for it, so the box filtered on clean alone.
            (!readyOnly || (c.clean && c.churn !== "dormant")),
        ),
      }))
      .filter((sec: any) => sec.items.length);
  }, [sectors, q, readyOnly]);

  const shownCount = shownSectors.reduce(
    (n: number, s: any) => n + s.items.length,
    0,
  );

  /**
   * Node placement.
   *
   * Hand-placed rather than force-directed: with eight consumers a force layout
   * only adds jitter, and the vertical order carries meaning a simulation would
   * scramble — consumers are sorted by churn so anything at risk sits together
   * at the bottom.
   */
  const layout = useMemo(() => {
    const order = { live: 0, aging: 1, dormant: 2, unknown: 3 } as Record<
      string,
      number
    >;
    const sorted = [...customers].sort(
      (a, b) =>
        (order[a.churn] ?? 9) - (order[b.churn] ?? 9) ||
        b.findings - a.findings,
    );
    const H = 54;
    const top = 52;
    const pkgY = new Map<string, number>();
    packages.forEach((p, i) =>
      pkgY.set(p.name.replace(/^eslint-plugin-/, ""), top + i * H),
    );
    const custY = new Map<string, number>();
    sorted.forEach((c, i) => custY.set(c.slug, top + i * H));
    return {
      sorted,
      pkgY,
      custY,
      height: top + Math.max(packages.length, sorted.length) * H + 20,
    };
  }, [customers, packages]);

  const maxDl = Math.max(1, ...packages.map((p) => p.weeklyDownloads ?? 0));

  const phaseTone = (p: any) =>
    p.phase.startsWith("our move")
      ? "text-[var(--destructive)]"
      : p.phase === "stalled"
        ? "text-[var(--warning)]"
        : p.phase === "waiting on them"
          ? "text-[var(--success)]"
          : "text-[var(--muted-foreground)]";

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-10 px-5 py-10 pb-24">
      <header className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/"
            className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--muted-foreground)] hover:text-[var(--primary)]"
          >
            ← control room
          </Link>
          <Refresh
            at={at}
            busy={busy || prBusy}
            onClick={() => {
              refresh();
              refreshPrs();
            }}
          />
        </div>
        <h1 className="text-[28px] font-semibold tracking-tight">Customers</h1>
        <p className="max-w-[66ch] text-[14px] text-[var(--muted-foreground)]">
          Downloads measure curiosity. This measures the two things that decide
          impact: which repositories genuinely execute our rules, and whether
          those repositories are being shown false positives. A customer seeing
          noise is a churn event that has not happened yet.
        </p>
        {data?.asOf ? (
          <span className={meta}>sweep as of {data.asOf}</span>
        ) : null}
      </header>

      {data?.error ? (
        <Callout tone="danger" title={data.error}>
          {data.hint ?? null}
        </Callout>
      ) : null}

      {/*
        `<StatStrip>` reserves the strip's real geometry while loading and
        announces it; a `null` total renders as unmeasured rather than as 0.
      */}
      <StatStrip
        cols={6}
        loading={!data}
        state={{ empty: Boolean(data && !totals) }}
        announce={{ noun: "adoption totals" }}
        items={[
          {
            key: "dl",
            label: "downloads / wk",
            value: totals?.weeklyDownloads ?? null,
            note: `${packages.length} packages`,
          },
          {
            key: "running",
            label: "running rules",
            value: totals?.customers ?? null,
            note: totals ? `${totals.configures} configure` : undefined,
          },
          {
            key: "clean",
            label: "clean",
            value: totals ? `${totals.clean} / ${totals.customers}` : null,
            note: "no findings",
          },
          {
            key: "exposed",
            label: "exposed",
            value: totals?.exposed ?? null,
            note:
              totals?.exposed > 0 ? (
                <span className="text-[var(--destructive)]">
                  see findings today
                </span>
              ) : (
                "see findings today"
              ),
          },
          {
            key: "dormant",
            label: "dormant",
            value: totals?.dormant ?? null,
            note:
              totals?.dormant > 0 ? (
                <span className="text-[var(--warning)]">&gt; 90d idle</span>
              ) : (
                "> 90d idle"
              ),
          },
          {
            key: "ready",
            label: "ready to pitch",
            value: totals?.candidatesClean ?? null,
            note: "scan clean, reachable",
          },
          {
            key: "stranded",
            label: "stranded installs",
            value: totals?.strandedInstalls ?? null,
            note:
              (totals?.strandedInstalls ?? 0) > 0 ? (
                <span className="text-[var(--destructive)]">
                  pinned below current major
                </span>
              ) : (
                "pinned below current major"
              ),
          },
        ]}
      />

      {/* ---- open PRs ---- */}
      <Collapse
        id="cust-prs"
        head={
          <>
            <span>
              Open pull requests
              {prData?.totals ? ` · ${prData.totals.open}` : ""}
            </span>
            <Refresh at={prAt} busy={prBusy} onClick={refreshPrs} />
          </>
        }
      >
        <Lead>
          Live from GitHub, not from a file — a PR&rsquo;s state changes without
          us touching it. Sorted by whose move it is, because that is the only
          part of a pipeline anyone can act on, and the delay that is ours is
          the only one we can remove alone.
        </Lead>

        {!prData ? (
          <Skel rows={3} />
        ) : prData.error && !prData.prs?.length ? (
          <Callout tone="warn" title="GitHub unreachable">
            {prData.error}. Nothing is shown rather than a stale list presented
            as live.
          </Callout>
        ) : (
          <>
            {prData.error ? (
              <Callout tone="note" title="Showing the last successful sweep">
                GitHub failed just now ({prData.error}); this is the cached
                answer, not a live one.
              </Callout>
            ) : null}

            <StatStrip
              cols={6}
              announce={{ noun: "pull request phases" }}
              items={[
                { key: "open", label: "open", value: prData.totals?.open ?? null },
                {
                  key: "blocked",
                  label: "blocked",
                  value: prData.totals?.blocked ?? null,
                  note: prData.totals?.blocked ? (
                    <span className="text-[var(--destructive)]">needs you</span>
                  ) : undefined,
                },
                {
                  key: "ours",
                  label: "our move",
                  value: prData.totals?.ourMove ?? null,
                  note: prData.totals?.ourMove ? (
                    <span className="text-[var(--destructive)]">
                      they are waiting
                    </span>
                  ) : undefined,
                },
                {
                  key: "stalled",
                  label: "stalled",
                  value: prData.totals?.stalled ?? null,
                  note: prData.totals?.stalled ? (
                    <span className="text-[var(--warning)]">nudge</span>
                  ) : undefined,
                },
                {
                  key: "silent",
                  label: "no reply yet",
                  value: prData.totals?.silent ?? null,
                },
                {
                  key: "theirs",
                  label: "waiting on them",
                  value: prData.totals?.waiting ?? null,
                  note: prData.totals?.waiting ? (
                    <span className="text-[var(--success)]">ball is theirs</span>
                  ) : undefined,
                },
              ]}
            />

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex overflow-hidden rounded-lg border border-[var(--border)]">
                {(
                  [
                    ["phase", "whose move"],
                    ["newest", "newest"],
                    ["oldest", "oldest"],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setPrSort(k)}
                    aria-pressed={prSort === k}
                    className={`px-2.5 py-1.5 font-mono text-[10.5px] uppercase tracking-wide ${
                      prSort === k
                        ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                        : "bg-[var(--card)] hover:text-[var(--primary)]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5 font-mono text-[10.5px] uppercase tracking-wide">
                <input
                  type="checkbox"
                  checked={hideStale}
                  onChange={(e) => setHideStale(e.target.checked)}
                  className="accent-[var(--primary)]"
                />
                hide stale ({STALE_PR_DAYS}d+ untouched)
              </label>
              <span className={`${meta} tabular-nums`}>
                {shownPrs.length} of {(prData?.prs ?? []).length} shown
                {prData.cachedAt
                  ? ` · swept ${new Date(prData.cachedAt).toLocaleTimeString()}`
                  : ""}
              </span>
            </div>

            {!shownPrs.length ? (
              <Callout tone="note" title="No open outbound PRs">
                {(prData.prs ?? []).length
                  ? "Everything open is older than the stale cut-off."
                  : "GitHub reports nothing open from us on anyone else's repository."}
              </Callout>
            ) : null}

            <div className="flex flex-col gap-2">
              {shownPrs.map((p: any) => (
                <div
                  key={p.url}
                  className={`flex flex-col gap-1.5 rounded-xl border bg-[var(--card)] p-3 ${
                    p.blockers?.length || p.phase.startsWith("our move")
                      ? "border-[var(--destructive)]"
                      : p.phase === "stalled"
                        ? "border-[var(--warning)]"
                        : "border-[var(--border)]"
                  }`}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noreferrer"
                      className="break-all font-mono text-[12px] hover:text-[var(--primary)]"
                    >
                      {p.slug}#{p.number} ↗
                    </a>
                    <span
                      className={`font-mono text-[10px] uppercase tracking-[0.12em] ${phaseTone(p)}`}
                    >
                      {p.phase}
                    </span>
                  </div>

                  <p className="text-[12.5px] leading-snug text-[var(--foreground)]">
                    {p.title}
                  </p>

                  <div className={`flex flex-wrap gap-x-3 gap-y-0.5 ${meta}`}>
                    <span>opened {p.openedAt}</span>
                    <span>{p.idleDays}d since activity</span>
                    <span>
                      {p.humanComments} human{" "}
                      {p.humanComments === 1 ? "comment" : "comments"}
                    </span>
                    {p.additions != null ? (
                      <span>
                        +{p.additions}/&minus;{p.deletions}
                      </span>
                    ) : null}
                    {p.approved ? (
                      <span className="text-[var(--success)]">approved</span>
                    ) : null}
                    {p.changesRequested ? (
                      <span className="text-[var(--warning)]">
                        changes requested
                      </span>
                    ) : null}
                    {p.botWaiting ? <span>bot analysis pending</span> : null}
                    {p.sector ? <span>{p.sector}</span> : null}
                    {p.weeklyDownloads ? (
                      <span>{p.weeklyDownloads.toLocaleString()} dl/wk</span>
                    ) : null}
                  </div>

                  {p.behindBase ? (
                    <div className="flex flex-wrap items-center gap-2 font-mono text-[10.5px]">
                      <span className="text-[var(--warning)]">· our branch is behind the base</span>
                      <button
                        type="button"
                        disabled={updating === p.url}
                        onClick={() => updateBranch(p)}
                        className="rounded border border-[var(--border)] px-1.5 py-0.5 text-[var(--primary)] hover:bg-[var(--muted)]/40 disabled:opacity-50"
                        title="PUT update-branch on our fork through GitHub — no clone, no force-push; a conflict is reported, never forced"
                      >
                        {updating === p.url ? "updating…" : "update branch"}
                      </button>
                      {updateResult[p.url] ? (
                        <span className={updateResult[p.url].ok ? "text-[var(--success)]" : "text-[var(--destructive)]"}>
                          {updateResult[p.url].message}
                        </span>
                      ) : null}
                    </div>
                  ) : null}

                  {p.blockers?.length ? (
                    <ul className="flex flex-col gap-0.5">
                      {p.blockers.map((b: string) => (
                        <li
                          key={b}
                          className="font-mono text-[10.5px] text-[var(--destructive)]"
                        >
                          · {b}
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  {p.failingChecks?.length ? (
                    <p className="font-mono text-[10.5px] text-[var(--destructive)]">
                      red: {p.failingChecks.join(" · ")}
                    </p>
                  ) : null}

                  {p.lastHuman ? (
                    <p className="border-l-2 border-[var(--border)] pl-2 text-[11.5px] leading-snug text-[var(--muted-foreground)]">
                      <b className="font-mono text-[10.5px] uppercase tracking-wide">
                        {p.lastHuman.who}
                      </b>{" "}
                      <span className="font-mono text-[10px]">
                        {p.lastHuman.at}
                      </span>{" "}
                      — {p.lastHuman.body.slice(0, 220)}
                      {p.lastHuman.body.length > 220 ? "…" : ""}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </>
        )}
      </Collapse>

      {/* ---- vulnerability ledger ---- */}
      <Collapse
        id="cust-ledger"
        head={
          <span>
            Vulnerability ledger
            {ledger?.totals ? ` · ${ledger.totals.findings} findings` : ""}
          </span>
        }
      >
        <Lead>
          Every finding we have shown a repository, kept with its CWE, its CVSS
          score and the exact line. This is what turns &ldquo;our rules find
          real problems&rdquo; from a claim into a query — and it is the same
          evidence a security team asks for before adopting anything.
        </Lead>

        {!data ? (
          <Skel rows={3} />
        ) : !ledger ? (
          <Callout tone="note" title="Ledger unmeasured">
            <code className="font-mono text-[12px]">adoption/findings.json</code>{" "}
            is missing or unreadable. The ledger is evidence, not state — it
            only exists once a sweep has written it, and nothing here is
            inferred from the customer file in its absence.
          </Callout>
        ) : (
          <>
            <StatStrip
              cols={4}
              announce={{ noun: "ledger totals" }}
              caption={ledger.asOf ? `as of ${ledger.asOf}` : undefined}
              items={[
                {
                  key: "repos",
                  label: "repositories scanned",
                  value: ledger.totals?.repos ?? null,
                },
                {
                  key: "kloc",
                  label: "thousand lines read",
                  value: ledger.totals?.kloc ?? null,
                },
                {
                  key: "findings",
                  label: "findings on record",
                  value: ledger.totals?.findings ?? null,
                },
                {
                  key: "clean",
                  label: "scanned clean",
                  value: ledger.cleanRepos ?? null,
                },
              ]}
            />

            <div className="grid gap-3 lg:grid-cols-2">
              <div className={`overflow-hidden ${card}`}>
                <h3 className={subhead}>by severity</h3>
                <div className="flex flex-col gap-1.5 p-3">
                  {!ledger.totals?.bySeverity ? (
                    <Unmeasured what="severity split" />
                  ) : (
                    ["critical", "high", "medium", "low", "unscored"]
                      .filter((k) => ledger.totals.bySeverity?.[k])
                      .map((k) => {
                        const n = ledger.totals.bySeverity[k];
                        const pct = Math.round(
                          (n / ledger.totals.findings) * 100,
                        );
                        return (
                          <div key={k} className="flex items-center gap-2">
                            <span className={`w-16 shrink-0 ${meta}`}>{k}</span>
                            <span className="h-[6px] flex-1 overflow-hidden rounded-full bg-[var(--border)]">
                              <span
                                className={`block h-full rounded-full ${
                                  k === "critical" || k === "high"
                                    ? "bg-[var(--destructive)]"
                                    : k === "medium"
                                      ? "bg-[var(--warning)]"
                                      : "bg-[var(--muted-foreground)]"
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </span>
                            <span className="w-8 shrink-0 text-right font-mono text-[11px] tabular-nums">
                              {n}
                            </span>
                          </div>
                        );
                      })
                  )}
                </div>
              </div>

              <div className={`overflow-hidden ${card}`}>
                <h3 className={subhead}>by weakness (CWE)</h3>
                <div className="max-h-52 overflow-y-auto p-3">
                  {!ledger.totals?.byCwe ? (
                    <Unmeasured what="CWE split" />
                  ) : (
                    <table className="w-full text-[12px]">
                      <tbody>
                        {Object.entries(ledger.totals.byCwe).map(
                          ([cwe, n]: any) => (
                            <tr key={cwe}>
                              <td className="py-0.5">
                                <a
                                  href={`https://cwe.mitre.org/data/definitions/${String(cwe).replace("CWE-", "")}.html`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="font-mono text-[11px] hover:text-[var(--primary)]"
                                >
                                  {cwe}
                                </a>
                              </td>
                              <td className="py-0.5 text-right font-mono text-[11px] tabular-nums">
                                {n}
                              </td>
                            </tr>
                          ),
                        )}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>

            <div className={`overflow-hidden ${card}`}>
              <h3 className={subhead}>where they are — worst first</h3>
              <div className="max-h-[28rem] overflow-y-auto">
                {(ledger.repos ?? []).map((r: any) => (
                  <div
                    key={r.slug}
                    className="border-b border-[var(--border)] px-3 py-2 last:border-0"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <a
                        href={`https://github.com/${r.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="break-all font-mono text-[11.5px] hover:text-[var(--primary)]"
                      >
                        {r.slug}
                      </a>
                      <span className={meta}>
                        {r.findings.length} findings · {r.kloc} kloc · worst
                        CVSS {r.worst || "—"}
                      </span>
                    </div>
                    <ul className="mt-1 flex flex-col gap-0.5">
                      {r.findings
                        .slice()
                        .sort(
                          (a: any, b: any) => (b.cvss ?? 0) - (a.cvss ?? 0),
                        )
                        .slice(0, 6)
                        .map((f: any, i: number) => (
                          <li
                            key={i}
                            className="flex flex-wrap items-baseline gap-x-2 font-mono text-[10.5px]"
                          >
                            <span
                              className={
                                (f.cvss ?? 0) >= 7
                                  ? "text-[var(--destructive)]"
                                  : "text-[var(--warning)]"
                              }
                            >
                              {f.cwe ?? "—"} {f.cvss ? `· ${f.cvss}` : ""}
                            </span>
                            <a
                              href={`https://github.com/${r.slug}/blob/HEAD/${f.file}#L${f.line}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[var(--muted-foreground)] underline decoration-[var(--border)] underline-offset-2 hover:text-[var(--primary)]"
                            >
                              {f.file}:{f.line}
                            </a>
                            <span className="text-[var(--muted-foreground)]">
                              {String(f.rule ?? "").split("/").pop()}
                            </span>
                          </li>
                        ))}
                      {r.findings.length > 6 ? (
                        <li className="font-mono text-[10px] text-[var(--muted-foreground)]">
                          … {r.findings.length - 6} more
                        </li>
                      ) : null}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </Collapse>

      {/* ---- glossary ---- */}
      <Collapse id="cust-glossary" head={<span>What these words mean</span>}>
        <Lead>
          Every term on this page, defined once. Most of them are deliberately
          narrower than they sound — <b>clean</b> in particular means measured
          clean, never assumed clean.
        </Lead>
        <dl className="grid gap-px overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--border)] sm:grid-cols-2 lg:grid-cols-3">
          {[
            [
              "active",
              "Pushed within 30 days. Someone is working on it now, so a PR gets seen.",
            ],
            [
              "slowing",
              "Last push 30–90 days ago. Still maintained, but a PR may sit for weeks. Worth trying — just not worth waiting on.",
            ],
            [
              "stale",
              "No push in over 90 days. Treat as unmaintained: a merge here reaches nobody, and the PR may never be read.",
            ],
            [
              "clean",
              "We linted it with the published plugins and it produced zero findings. Not 'we assume it is fine' — measured.",
            ],
            [
              "unread",
              "It produced findings and no human has read them yet. Counts against us exactly as hard as a known false positive: not knowing is not the same as being clean.",
            ],
            [
              "merges",
              "Outside merges — merged PRs from someone who is not an owner, member, collaborator or bot. Shown where the sweep measured it; the door score itself counts STRANGER merges (no prior tie to the repository), because a returning contributor and a staff engineer look identical to GitHub.",
            ],
            [
              "score",
              "Clean gate (0.40) + door opens (0.20) + someone home (0.12) + how far it travels (0.28). Clean dominates because it decides whether a PR can be written at all; the others only decide how fast it lands and how far one merge carries.",
            ],
            [
              "dl / wk",
              "Weekly npm downloads for the package this repository publishes, when it publishes one. How far coverage travels from a single merge.",
            ],
            [
              "configures",
              "The deepest kind of adoption: the repository turns our rules on. Below it, in order: depends, lists, mentions.",
            ],
            [
              "our move",
              "A maintainer replied and is waiting on us. The only delay on this page that is entirely ours to remove.",
            ],
            [
              "stalled",
              "An open PR with no activity from anyone for over 21 days. Needs a nudge, not more waiting.",
            ],
            [
              "stranded installs",
              "Installs pinned below our current major. A caret range never crosses a major, so these receive nothing we ship however many fixes land.",
            ],
            [
              "unmeasured",
              "The sweep took no reading. Never shown as 0 — a zero it did not measure is a lie with a decimal point.",
            ],
          ].map(([term, meaning]) => (
            <div key={term} className="bg-[var(--card)] p-3">
              <dt className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-[var(--primary)]">
                {term}
              </dt>
              <dd className="mt-1 text-[12px] leading-snug text-[var(--muted-foreground)]">
                {meaning}
              </dd>
            </div>
          ))}
        </dl>
      </Collapse>

      {/* ---- candidates, by sector ---- */}
      <Collapse
        id="cust-sectors"
        head={
          <span>
            Candidates by sector
            {data ? ` · ${candidateCount}` : ""}
          </span>
        }
      >
        <Lead>
          Sector is the axis that predicts adoption, and it was found by
          profiling the consumers we already have rather than by guessing:
          config aggregators and public-sector bodies, and not one product
          company. An aggregator&rsquo;s product <em>is</em> curating plugins,
          so one more is cheap. A public-sector team has security review
          mandated rather than optional, and CWE/OWASP metadata is what an
          audit asks for.
        </Lead>
        <Lead dim>
          Within each sector a <b className="text-[var(--success)]">clean</b>{" "}
          scan ranks first: the ask becomes &ldquo;keep it clean&rdquo; rather
          than &ldquo;you have bugs&rdquo;, which needs no finding to be
          defensible and cannot be lost by arguing about one. <b>Merges</b>{" "}
          counts outside merges, not stars — a 5,000-star repository that never
          merges an outsider is a worse door than a 9-star one that merges 48.
        </Lead>

        {!data ? (
          <Skel rows={6} />
        ) : !sectors.length ? (
          <Callout tone="note" title="No candidates scanned">
            The sweep has not written any candidates yet, so there is no board
            to rank.
          </Callout>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex min-w-[16rem] flex-1 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5">
                <span className={meta}>find</span>
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="org or repo name"
                  className="w-full bg-transparent font-mono text-[12px] outline-none placeholder:text-[var(--muted-foreground)]"
                />
              </label>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5 font-mono text-[10.5px] uppercase tracking-wide">
                <input
                  type="checkbox"
                  checked={readyOnly}
                  onChange={(e) => setReadyOnly(e.target.checked)}
                  className="accent-[var(--primary)]"
                />
                ready to pitch only
              </label>
              <span className={`${meta} tabular-nums`}>
                {shownCount} of {candidateCount} shown
              </span>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              {shownSectors.map((s: any) => {
                const all: any[] = s.items;
                const open = unfolded.has(s.sector) || q.trim().length > 0;
                const rows = open ? all : all.slice(0, SECTOR_FOLD);
                return (
                  <div
                    key={s.sector}
                    className={`flex flex-col overflow-hidden ${card}`}
                  >
                    <div className="flex items-baseline justify-between gap-3 border-b border-[var(--border)] px-3 py-2">
                      <h3 className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                        {s.sector}
                      </h3>
                      <span className={meta}>
                        <b className="text-[var(--success)]">{s.ready}</b>{" "}
                        ready · {all.length} scanned
                      </span>
                    </div>

                    <div className="max-h-[30rem] overflow-y-auto">
                      <ul className="flex flex-col">
                        {rows.map((c: any) => {
                          const isOpen = focus === c.slug;
                          return (
                            <li
                              key={c.slug}
                              className="border-b border-[var(--border)] last:border-0"
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  setFocus(isOpen ? null : c.slug)
                                }
                                aria-expanded={isOpen}
                                className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-[var(--muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--primary)]"
                              >
                                {/* Colour never carries this alone — the word is on the next line. */}
                                <span
                                  className={`mt-1 block h-3.5 w-[3px] shrink-0 rounded-full ${
                                    c.clean
                                      ? "bg-[var(--success)]"
                                      : "bg-[var(--warning)]"
                                  }`}
                                />
                                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                                  {/* Full name, wrapped rather than truncated — a slug you
                                      cannot read is not an identifier. */}
                                  <span className="break-all font-mono text-[11.5px] leading-tight">
                                    {c.slug}
                                  </span>
                                  <span className={`flex flex-wrap gap-x-2 ${meta}`}>
                                    <span
                                      className={
                                        c.clean
                                          ? "text-[var(--success)]"
                                          : "text-[var(--warning)]"
                                      }
                                    >
                                      {c.clean
                                        ? "clean"
                                        : `${c.findings} unread`}
                                    </span>
                                    <span>
                                      {c.kloc == null ? "? " : c.kloc} kloc
                                    </span>
                                    {c.outsideMerges == null ? (
                                      <Unmeasured what="merges" />
                                    ) : (
                                      <span>{c.outsideMerges} merges</span>
                                    )}
                                    <span>{CHURN_WORD[c.churn] ?? c.churn}</span>
                                    {c.institution ? (
                                      <span className="text-[var(--primary)]">
                                        {c.institution}
                                      </span>
                                    ) : null}
                                    {c.weeklyDownloads ? (
                                      <span className="text-[var(--foreground)]">
                                        {c.weeklyDownloads.toLocaleString()}{" "}
                                        dl/wk
                                      </span>
                                    ) : c.stars ? (
                                      <span>
                                        {c.stars.toLocaleString()}&#9733;
                                      </span>
                                    ) : null}
                                  </span>
                                </span>
                                <span className="shrink-0 font-mono text-[11px] tabular-nums text-[var(--muted-foreground)]">
                                  {c.score.toFixed(2)}
                                </span>
                              </button>

                              {isOpen ? (
                                <div className="flex flex-col gap-2 border-t border-[var(--border)] bg-[var(--background)] px-3 py-2.5">
                                  {c.description ? (
                                    <p className="text-[12px] leading-snug text-[var(--foreground)]">
                                      {c.description}
                                    </p>
                                  ) : null}
                                  {c.note ? (
                                    <p className="text-[12px] leading-snug text-[var(--muted-foreground)]">
                                      {c.note}
                                    </p>
                                  ) : null}
                                  {c.topRules ? (
                                    <p className="font-mono text-[11px] text-[var(--warning)]">
                                      {c.topRules}
                                    </p>
                                  ) : null}
                                  <dl
                                    className={`grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4 ${meta}`}
                                  >
                                    {[
                                      ["stars", c.stars ?? "—"],
                                      [
                                        "outside merges",
                                        c.outsideMerges == null ? (
                                          <Unmeasured what="outside merges" />
                                        ) : (
                                          c.outsideMerges
                                        ),
                                      ],
                                      [
                                        "stranger merges",
                                        c.strangerMerges == null ? (
                                          <Unmeasured what="stranger merges" />
                                        ) : (
                                          c.strangerMerges
                                        ),
                                      ],
                                      [
                                        "idle",
                                        c.idleDays == null
                                          ? "—"
                                          : `${c.idleDays}d`,
                                      ],
                                      [
                                        "findings / kloc",
                                        c.perKloc == null ? (
                                          <Unmeasured what="density" />
                                        ) : (
                                          c.perKloc
                                        ),
                                      ],
                                      [
                                        "npm reach",
                                        c.weeklyDownloads
                                          ? `${c.weeklyDownloads.toLocaleString()} / wk`
                                          : "not published",
                                      ],
                                    ].map(([k, v], i) => (
                                      <div key={i} className="flex flex-col">
                                        <dt>{k as string}</dt>
                                        <dd className="text-[13px] normal-case tabular-nums text-[var(--foreground)]">
                                          {v as React.ReactNode}
                                        </dd>
                                      </div>
                                    ))}
                                  </dl>
                                  {c.why ? (
                                    <div className="flex flex-col gap-1">
                                      <span className={meta}>
                                        why it ranks {c.score.toFixed(2)}
                                      </span>
                                      {[
                                        [
                                          "clean gate",
                                          c.why.clean ? 0.4 : 0.1,
                                          0.4,
                                          c.why.clean
                                            ? "scans clean"
                                            : "findings unread",
                                        ],
                                        [
                                          "door opens",
                                          0.2 * c.why.reach,
                                          0.2,
                                          c.strangerMerges == null
                                            ? "stranger merges unmeasured"
                                            : `${c.why.strangers} stranger merges`,
                                        ],
                                        [
                                          "someone home",
                                          0.12 * c.why.fresh,
                                          0.12,
                                          c.idleDays == null
                                            ? "push date unknown"
                                            : `${c.idleDays}d since last push`,
                                        ],
                                        [
                                          "how far it travels",
                                          0.28 * c.why.impact,
                                          0.28,
                                          c.why.impactFrom,
                                        ],
                                      ].map(([label, got, max, detail]: any) => (
                                        <div
                                          key={label}
                                          className="flex items-center gap-2"
                                        >
                                          <span className="w-[8.5rem] shrink-0 font-mono text-[10px] text-[var(--muted-foreground)]">
                                            {label}
                                          </span>
                                          <span className="h-[3px] w-16 shrink-0 overflow-hidden rounded-full bg-[var(--border)]">
                                            <span
                                              className="block h-full rounded-full bg-[var(--primary)]"
                                              style={{
                                                width: `${Math.round((got / max) * 100)}%`,
                                              }}
                                            />
                                          </span>
                                          <span className="truncate font-mono text-[10px] text-[var(--muted-foreground)]">
                                            {detail}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  ) : null}
                                  {c.blockers?.length ? (
                                    <ul className="flex flex-col gap-0.5">
                                      {c.blockers.map((b: string) => (
                                        <li
                                          key={b}
                                          className="font-mono text-[10.5px] text-[var(--warning)]"
                                        >
                                          · {b}
                                        </li>
                                      ))}
                                    </ul>
                                  ) : null}
                                  <div className="flex flex-wrap gap-2">
                                    <a
                                      href={repoUrlOf(c)}
                                      target="_blank"
                                      rel="noreferrer"
                                      className={linkBtn}
                                    >
                                      Open on GitHub ↗
                                    </a>
                                    {c.npm ? (
                                      <a
                                        href={`https://www.npmjs.com/package/${c.npm}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className={linkBtn}
                                      >
                                        {c.npm} on npm ↗
                                      </a>
                                    ) : null}
                                  </div>
                                </div>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                    {all.length > SECTOR_FOLD && !q.trim() ? (
                      <button
                        type="button"
                        onClick={() =>
                          setUnfolded((prev) => {
                            const next = new Set(prev);
                            if (next.has(s.sector)) next.delete(s.sector);
                            else next.add(s.sector);
                            return next;
                          })
                        }
                        className={`border-t border-[var(--border)] px-3 py-2 text-left ${meta} hover:text-[var(--primary)]`}
                      >
                        {open
                          ? `show the top ${SECTOR_FOLD} only`
                          : `show all ${all.length} — ${all.length - SECTOR_FOLD} more below the fold`}
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Collapse>

      {/* ---- pipeline ---- */}
      <Collapse
        id="cust-pipeline"
        head={
          <span>
            Pipeline
            {pt ? ` · ${pt.open} open` : ""}
          </span>
        }
      >
        <Lead>
          Every PR we have open on someone else&rsquo;s repository, ordered by
          who is blocking.{" "}
          <span className="text-[var(--primary)]">Our move</span> means a
          maintainer has already answered and is now waiting on us — the only
          delay on this page that is entirely ours to remove. Bot reviews do
          not count as a reply; a CodeRabbit pass is work for us, not a signal
          from them.
        </Lead>

        {!data ? (
          <Skel rows={3} />
        ) : !pipeline.length ? (
          <Callout tone="note" title="No outreach recorded">
            <code className="font-mono text-[12px]">customers.json</code>{" "}
            carries no <code className="font-mono text-[12px]">outreach</code>{" "}
            entries. The live tracker above is the only view of PR state until
            the outreach sweep writes one.
          </Callout>
        ) : (
          <>
            {pt ? (
              <StatStrip
                cols={6}
                announce={{ noun: "pipeline totals" }}
                items={[
                  {
                    key: "ours",
                    label: "our move",
                    value: pt.ourMove ?? null,
                    note:
                      pt.ourMove > 0 ? (
                        <span className="text-[var(--destructive)]">
                          they replied, we have not
                        </span>
                      ) : (
                        "they replied, we have not"
                      ),
                  },
                  {
                    key: "awaiting",
                    label: "awaiting reply",
                    value: pt.awaitingFirstReply ?? null,
                    note: "no human has answered",
                  },
                  {
                    key: "review",
                    label: "in review",
                    value: pt.inReview ?? null,
                    note: "conversation is live",
                  },
                  {
                    key: "merged",
                    label: "merged",
                    value: pt.merged ?? null,
                    note: "landed",
                  },
                  {
                    // `null` when nobody has replied yet: StatStrip says
                    // "empty" rather than printing 0%, which would read as a
                    // measured reply rate of zero.
                    key: "rate",
                    label: "reply rate",
                    value:
                      pt.replyRate == null
                        ? null
                        : `${Math.round(pt.replyRate * 100)}%`,
                    note:
                      pt.medianReplyDays == null
                        ? "no replies yet"
                        : `median ${pt.medianReplyDays}d to first reply`,
                  },
                  {
                    key: "stalled",
                    label: "stalled",
                    value: pt.stalled ?? null,
                    note:
                      pt.stalled > 0 ? (
                        <span className="text-[var(--warning)]">
                          &gt; 21d silent — nudge
                        </span>
                      ) : (
                        "> 21d silent — nudge"
                      ),
                  },
                ]}
              />
            ) : null}

            <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
              <table className="w-full min-w-[720px] border-collapse text-[13px]">
                <thead>
                  <tr className="text-left">
                    <th className={th}>Stage</th>
                    <th className={th}>Repository</th>
                    <th className={th}>Pull request</th>
                    <th className={`${th} text-right`}>Age</th>
                    <th className={`${th} text-right`}>Quiet</th>
                    <th className={th}>First reply</th>
                  </tr>
                </thead>
                <tbody>
                  {pipeline.map((o: any) => {
                    const mine = o.waitingOn === "us";
                    return (
                      <tr key={o.pr} className="align-top last:[&>td]:border-0">
                        <td className={td}>
                          <Badge
                            variant="outline"
                            className={`font-mono text-[10px] uppercase tracking-[0.1em] ${
                              mine
                                ? "border-[var(--primary)] text-[var(--primary)]"
                                : "text-[var(--muted-foreground)]"
                            }`}
                          >
                            {o.stage}
                          </Badge>
                        </td>
                        <td className={td}>
                          <a
                            className="hover:text-[var(--primary)]"
                            href={`https://github.com/${o.slug}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {o.slug}
                          </a>
                          {o.sector ? (
                            <div className="text-[11px] text-[var(--muted-foreground)]">
                              {o.sector}
                            </div>
                          ) : null}
                        </td>
                        <td className={`max-w-[280px] ${td}`}>
                          <a
                            className="hover:text-[var(--primary)]"
                            href={o.pr}
                            target="_blank"
                            rel="noreferrer"
                          >
                            #{String(o.pr).split("/").pop()} {o.title ?? ""}
                          </a>
                          {o.changesRequested ? (
                            <div className="text-[11px] text-[var(--warning)]">
                              changes requested
                            </div>
                          ) : null}
                        </td>
                        <td className={`${td} text-right tabular-nums`}>
                          {o.ageDays ?? "—"}d
                        </td>
                        <td
                          className={`${td} text-right tabular-nums ${
                            (o.quietDays ?? 0) > 21
                              ? "text-[var(--warning)]"
                              : ""
                          }`}
                        >
                          {o.quietDays ?? "—"}d
                        </td>
                        <td className={`${td} text-[12px] text-[var(--muted-foreground)]`}>
                          {o.respondedAt ? (
                            <>
                              {o.responseDays}d &middot; {o.responder}
                            </>
                          ) : (
                            <span>none yet</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {pt?.checkedAt ? (
              <div className="font-mono text-[10px] text-[var(--muted-foreground)]">
                stored state as of{" "}
                {String(pt.checkedAt).slice(0, 16).replace("T", " ")} UTC
                &middot; refresh with{" "}
                <span className="text-[var(--foreground)]">
                  node scripts/track-outreach.mjs --write
                </span>
              </div>
            ) : null}
          </>
        )}
      </Collapse>

      {/* ---- upsell ---- */}
      <Collapse
        id="cust-upsell"
        head={
          <span>
            Upsell
            {data ? ` · ${upsells.length}` : ""}
          </span>
        }
      >
        <Lead>
          What each repository could take that it does not have yet. A{" "}
          <span className="font-mono text-[12px]">version</span> gap outranks
          everything else: a consumer pinned below our current major receives
          none of the fixes we ship, so bumping the range is worth more to them
          than any new plugin — and it is the easiest PR to say yes to.
          Applications get a <span className="font-mono text-[12px]">stack</span>{" "}
          match against what they actually import; presets get{" "}
          <span className="font-mono text-[12px]">breadth</span>, because a
          stack match would mean nothing to a config that ships to other
          people.
        </Lead>
        {!data ? (
          <Skel rows={3} />
        ) : !upsells.length ? (
          <Callout tone="note" title="Nothing to offer yet">
            No consumer has a version gap, and none carries a{" "}
            <code className="font-mono text-[12px]">stack</code> or{" "}
            <code className="font-mono text-[12px]">kind</code> the sweep could
            match a plugin to.
          </Callout>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {upsells.map((u: any) => (
              <div key={u.slug} className={`flex flex-col gap-2 p-3.5 ${card}`}>
                <div className="flex items-baseline justify-between gap-2">
                  <a
                    className="text-[14px] font-medium hover:text-[var(--primary)]"
                    href={u.repoUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {u.slug}
                  </a>
                  <span className={meta}>{u.kind ?? "—"}</span>
                </div>
                <ul className="flex flex-col gap-1.5">
                  {u.items.map((i: any) => (
                    <li
                      key={`${i.kind}-${i.pkg}`}
                      className="flex flex-col gap-0.5"
                    >
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={`font-mono text-[9px] uppercase tracking-[0.1em] ${
                            i.kind === "version"
                              ? "border-[var(--primary)] text-[var(--primary)]"
                              : "text-[var(--muted-foreground)]"
                          }`}
                        >
                          {i.kind}
                        </Badge>
                        <span className="font-mono text-[12px]">
                          {i.pkg}
                          {i.from ? (
                            <span className="text-[var(--muted-foreground)]">
                              {" "}
                              {i.from} → {i.to}
                            </span>
                          ) : null}
                        </span>
                      </div>
                      <div className="pl-1 text-[11px] text-[var(--muted-foreground)]">
                        {i.why}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Collapse>

      {/* ---- the graph ---- */}
      <Collapse id="cust-graph" head={<span>Dependency graph</span>}>
        <Lead dim>
          Left: what we publish, sized by weekly downloads. Right: who installs
          it, ordered so anything at risk sits together at the bottom. A thick
          edge means the consumer <em>configures</em> the plugin, so its own
          consumers run our rules too — that edge outweighs any number of
          listings.
        </Lead>
        {!data ? (
          <Skeleton variant="chart" label="Loading the dependency graph" />
        ) : !customers.length ? (
          <Callout tone="note" title="No consumers recorded">
            The sweep found nothing running our rules, so there is nothing to
            draw an edge to.
          </Callout>
        ) : (
          <div className={`overflow-x-auto p-2 ${card}`}>
            <svg
              viewBox={`0 0 900 ${layout.height}`}
              className="block h-auto w-full min-w-[700px]"
              role="img"
              aria-label={`Bipartite graph: ${packages.length} published plugins on the left connect to ${customers.length} consuming repositories on the right.`}
            >
              <text
                x="18"
                y="26"
                className="fill-[var(--muted-foreground)] font-mono text-[10px] uppercase tracking-[0.13em]"
              >
                Published
              </text>
              <text
                x="500"
                y="26"
                className="fill-[var(--muted-foreground)] font-mono text-[10px] uppercase tracking-[0.13em]"
              >
                Running our rules
              </text>

              {/* edges first so nodes sit above them */}
              {layout.sorted.flatMap((c) =>
                (c.plugins ?? []).map((p) => {
                  const y1 = layout.pkgY.get(p);
                  const y2 = layout.custY.get(c.slug);
                  if (y1 == null || y2 == null) return null;
                  const strong = c.depth === "configures";
                  return (
                    <path
                      key={`${c.slug}-${p}`}
                      d={`M 250 ${y1} C 370 ${y1}, 380 ${y2}, 490 ${y2}`}
                      fill="none"
                      stroke={strong ? "var(--primary)" : "var(--border)"}
                      strokeWidth={strong ? 2 : 1.25}
                    />
                  );
                }),
              )}

              {/* packages */}
              {packages.map((p) => {
                const nm = p.name.replace(/^eslint-plugin-/, "");
                const y = layout.pkgY.get(nm) ?? 0;
                const used = customers.some((c) =>
                  (c.plugins ?? []).includes(nm),
                );
                const r = 6 + 9 * ((p.weeklyDownloads ?? 0) / maxDl);
                return (
                  <g key={p.name}>
                    <circle
                      cx="240"
                      cy={y}
                      r={r}
                      fill={used ? "var(--foreground)" : "none"}
                      stroke={used ? "none" : "var(--primary)"}
                      strokeWidth={used ? 0 : 2}
                      strokeDasharray={used ? undefined : "3 3"}
                    />
                    <text
                      x="220"
                      y={y - 3}
                      textAnchor="end"
                      className="fill-[var(--foreground)] font-mono text-[11px]"
                    >
                      {nm}
                    </text>
                    <text
                      x="220"
                      y={y + 10}
                      textAnchor="end"
                      className="font-mono text-[9.5px]"
                      fill={used ? "var(--muted-foreground)" : "var(--primary)"}
                    >
                      {(p.weeklyDownloads ?? 0).toLocaleString()} / wk
                      {used ? "" : " · no consumer"}
                    </text>
                  </g>
                );
              })}

              {/* consumers */}
              {layout.sorted.map((c) => {
                const y = layout.custY.get(c.slug) ?? 0;
                const tone = CHURN_TONE[c.churn];
                return (
                  <g key={c.slug}>
                    <rect
                      x="490"
                      y={y - 9}
                      width="11"
                      height="18"
                      fill={tone}
                      rx="1"
                    />
                    <text
                      x="512"
                      y={y - 1}
                      className="fill-[var(--foreground)] font-mono text-[11px]"
                    >
                      {short(c.slug)}
                    </text>
                    <text
                      x="512"
                      y={y + 11}
                      className="fill-[var(--muted-foreground)] font-mono text-[9.5px]"
                    >
                      {c.depth}
                      {" · "}
                      {c.findings === 0
                        ? "0 findings"
                        : `${c.findings} findings`}
                      {c.verifiedFalse ? ` · ${c.verifiedFalse} false` : ""}
                      {c.idleDays != null ? ` · ${c.idleDays}d idle` : ""}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        )}
      </Collapse>

      {/* ---- monitor ---- */}
      <Collapse
        id="cust-monitor"
        head={
          <span>
            Monitor
            {data ? ` · ${customers.length} consumers` : ""}
          </span>
        }
      >
        <Lead dim>
          <b>
            We approach a customer only when we expose it to no false
            positives.
          </b>{" "}
          That means every finding read, each landed as TP or FP, and every FP
          fixed and shipped.{" "}
          <b>
            Unread counts against the gate exactly as hard as a known false
            positive
          </b>{" "}
          — not knowing is not the same as being clean, and treating them as
          the same is what produced this problem.
        </Lead>
        {!data ? (
          <Skeleton variant="data-table" label="Loading the monitor" />
        ) : !customers.length ? (
          <Callout tone="note" title="No consumers recorded">
            Nothing in <code className="font-mono text-[12px]">customers.json</code>{" "}
            runs our rules yet.
          </Callout>
        ) : (
          <>
            <div className={`overflow-x-auto ${card}`}>
              <table className="w-full min-w-[720px] border-collapse">
                <thead>
                  <tr>
                    {[
                      "Repository",
                      "Depth",
                      "Idle",
                      "Shown",
                      "TP",
                      "FP",
                      "Unread",
                      "Approach",
                    ].map((h) => (
                      <th key={h} className={th}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {layout.sorted.map((c) => {
                    const repo = repoUrlOf(c);
                    return (
                      <tr key={c.slug} className="align-top">
                        <td
                          className={td}
                          style={{
                            boxShadow: `inset 3px 0 0 ${CHURN_TONE[c.churn]}`,
                          }}
                        >
                          <a
                            href={repo}
                            target="_blank"
                            rel="noreferrer"
                            className="font-mono text-[12px] underline decoration-[var(--border)] underline-offset-2 hover:text-[var(--primary)]"
                          >
                            {c.slug}
                          </a>
                          {c.measuredUrl ? (
                            <a
                              href={c.measuredUrl}
                              target="_blank"
                              rel="noreferrer"
                              className={`ml-2 ${meta} hover:text-[var(--primary)]`}
                              title={`Findings measured on ${c.measuredOn}`}
                            >
                              measured on {c.measuredOn?.split("/")[1]}
                            </a>
                          ) : null}
                          {c.npm ? (
                            <a
                              href={`https://www.npmjs.com/package/${c.npm}`}
                              target="_blank"
                              rel="noreferrer"
                              className={`ml-2 ${meta} hover:text-[var(--primary)]`}
                            >
                              npm
                            </a>
                          ) : null}
                          {c.via ? (
                            <a
                              href={`${repo}/pull/${c.via}`}
                              target="_blank"
                              rel="noreferrer"
                              className={`ml-2 ${meta} hover:text-[var(--primary)]`}
                              title="The PR that made this a customer"
                            >
                              via #{c.via}
                            </a>
                          ) : null}
                          {c.reach ? (
                            <span className={`ml-2 ${meta}`}>
                              {c.reach.toLocaleString()} installs / wk
                            </span>
                          ) : null}
                          {c.receives === false ? (
                            <span
                              className="ml-2 font-mono text-[10px] uppercase tracking-wide text-[var(--destructive)]"
                              title="Its semver range cannot resolve to what we publish today"
                            >
                              · cannot receive fixes
                            </span>
                          ) : null}
                          {c.note ? (
                            <div className="mt-1 max-w-[58ch] text-[11.5px] leading-snug text-[var(--muted-foreground)]">
                              {c.note}
                            </div>
                          ) : null}
                          {c.falsePositives?.length ? (
                            <div className="mt-1.5 flex flex-col gap-1">
                              {c.falsePositives.map((f: any) => (
                                <div
                                  key={f.rule}
                                  className="max-w-[58ch] text-[11px] leading-snug"
                                >
                                  <span className="font-mono text-[var(--primary)]">
                                    {f.count}× {f.rule}
                                  </span>{" "}
                                  {f.fixShipped ? (
                                    <a
                                      href={`https://github.com/ofri-peretz/eslint/pull/${f.fixPr}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="font-mono text-[var(--success)]"
                                    >
                                      fixed #{f.fixPr}
                                    </a>
                                  ) : (
                                    <span className="font-mono text-[var(--warning)]">
                                      no fix yet
                                    </span>
                                  )}
                                  <div className="text-[var(--muted-foreground)]">
                                    {f.why}
                                  </div>
                                  {f.files?.length ? (
                                    <div className="mt-0.5 flex flex-wrap gap-x-3">
                                      {f.files.flatMap((file: any) =>
                                        (file.lines ?? []).map((ln: number) => (
                                          <a
                                            key={`${file.path}:${ln}`}
                                            href={`${repo}/blob/${c.branch ?? "HEAD"}/${file.path}#L${ln}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="font-mono text-[10px] text-[var(--muted-foreground)] underline decoration-[var(--border)] underline-offset-2 hover:text-[var(--primary)]"
                                          >
                                            {file.path.split("/").pop()}:{ln}
                                          </a>
                                        )),
                                      )}
                                    </div>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </td>
                        <td className={td}>
                          <span
                            className={`font-mono text-[10px] uppercase tracking-wide ${
                              c.depth === "configures"
                                ? "text-[var(--primary)]"
                                : "text-[var(--muted-foreground)]"
                            }`}
                          >
                            {c.depth}
                          </span>
                        </td>
                        <td className={`${td} font-mono text-[12px] tabular-nums`}>
                          {c.idleDays != null ? `${c.idleDays}d` : "—"}
                        </td>
                        <td className={`${td} font-mono text-[12px] tabular-nums`}>
                          {c.findings}
                        </td>
                        <td
                          className={`${td} font-mono text-[12px] tabular-nums ${
                            c.tpCount ? "text-[var(--success)]" : ""
                          }`}
                        >
                          {c.tpCount || "—"}
                        </td>
                        <td
                          className={`${td} font-mono text-[12px] tabular-nums ${
                            c.fpCount ? "text-[var(--primary)]" : ""
                          }`}
                        >
                          {c.fpCount || "—"}
                          {c.fpOpen ? (
                            <div className="mt-0.5 text-[9.5px] uppercase tracking-wide text-[var(--destructive)]">
                              {c.fpOpen} unfixed
                            </div>
                          ) : null}
                        </td>
                        <td
                          className={`${td} font-mono text-[12px] tabular-nums ${
                            c.unread ? "text-[var(--warning)]" : ""
                          }`}
                        >
                          {c.unread || "—"}
                        </td>
                        <td className={td}>
                          <span
                            className={`font-mono text-[10px] uppercase tracking-wide ${
                              c.approachable
                                ? "text-[var(--success)]"
                                : "text-[var(--destructive)]"
                            }`}
                          >
                            {c.approachable ? "clear" : "hold"}
                          </span>
                          <div
                            className="mt-0.5 font-mono text-[9.5px] uppercase tracking-wide"
                            style={{ color: CHURN_TONE[c.churn] }}
                            title={CHURN_MEANING[c.churn]}
                          >
                            {CHURN_WORD[c.churn]}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11.5px] text-[var(--muted-foreground)]">
              <span>
                <b className="text-[var(--foreground)]">Approach</b> — clear
                means every finding is read and every false positive shipped a
                fix; hold means it is not.
              </span>
              <span>
                <b className="text-[var(--foreground)]">Activity</b> measures
                the repository, not the relationship:{" "}
                <span className="text-[var(--success)]">active</span> pushed
                within 30d ·{" "}
                <span className="text-[var(--warning)]">slowing</span> 30–90d ·{" "}
                <span className="text-[var(--destructive)]">stale</span> over
                90d. A stale repo is still worth a try — it is a slower door,
                not a closed one.
              </span>
            </div>
            <p className="text-[11.5px] text-[var(--muted-foreground)]">
              Measured against the published packages, never a local build — a
              stranger runs what is on npm. Consumers are found by code search
              over <span className="font-mono">package.json</span>, so private
              and vendored consumers are invisible and the count is a floor.
            </p>
          </>
        )}
      </Collapse>
    </main>
  );
}
