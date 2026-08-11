"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Callout } from "@/components/ui/callout";
import { RankedBarList } from "@/components/ui/meter";
import { Skeleton } from "@/components/ui/skeleton";
import { StatStrip } from "@/components/ui/stat-strip";
import { Delta } from "@/components/ui/charts/delta";
import type { Point } from "@/components/ui/charts/scale";
import { Sparkline } from "@/components/ui/charts/sparkline";
import { TimeSeries } from "@/components/ui/charts/time-series";
import {
  DataTable,
  sortRows,
  type DataTableSort,
} from "@/components/ui/patterns/data-table";

const card =
  "rounded-xl border border-[var(--border)] bg-[var(--card)]";
const h2 =
  "border-b border-[var(--border)] pb-2 font-mono text-[12px] uppercase tracking-[0.12em] text-[var(--muted-foreground)]";

export function Section({
  title,
  children,
  right,
}: {
  title: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className={`${h2} flex items-center justify-between`}>
        <span>{title}</span>
        {right}
      </h2>
      {children}
    </section>
  );
}

/**
 * The panel-level loading state.
 *
 * Now a thin wrapper over the DS `<Skeleton count>` — which is what makes it
 * announce itself (`role="status"`, `aria-busy`, `aria-live="polite"` and a
 * "Loading…" label). The hand-rolled version was a silent div: a screen reader
 * heard nothing at all while a panel was fetching.
 */
export function Skel({ rows = 4 }: { rows?: number }) {
  return (
    <div className={`${card} p-4`}>
      <Skeleton count={rows} className="h-8 w-full" />
    </div>
  );
}

/* ── Collapsible section ────────────────────────────────────────────────── */

/**
 * A section you can fold away, remembered across reloads.
 *
 * Seventeen panels on one page is a long scroll, and which ones are noise
 * depends on what you are doing today — replies matter in the morning, the
 * portfolio matters when writing. Collapsing is the cheap fix.
 *
 * Only the chevron toggles, not the whole header: the header also carries the
 * per-section refresh button, and a click target that both refreshes and folds
 * is a click target you stop trusting.
 *
 * State is keyed by `id` in localStorage, read in an effect rather than during
 * render — reading storage during render makes the server and client disagree
 * and React discards the tree.
 */
export function Collapse({
  id,
  head,
  children,
}: {
  id: string;
  head: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setOpen(localStorage.getItem(`collapse:${id}`) !== "0");
    } catch {
      /* private mode / storage disabled — default open is correct */
    }
    setReady(true);
  }, [id]);

  const toggle = () => {
    setOpen((v) => {
      try {
        localStorage.setItem(`collapse:${id}`, v ? "0" : "1");
      } catch {
        /* nothing to persist to; the toggle still works for this session */
      }
      return !v;
    });
  };

  return (
    <section className="flex flex-col gap-3">
      <h2 className={`${h2} flex items-center gap-2`}>
        <button
          onClick={toggle}
          aria-expanded={open}
          title={open ? "Collapse" : "Expand"}
          className="shrink-0 text-[var(--muted-foreground)] hover:text-[var(--primary)]"
        >
          {open ? "▾" : "▸"}
        </button>
        <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
          {head}
        </span>
      </h2>
      {/* Until the stored value is read, render open — a panel that flickers
          shut on every load reads as a bug. */}
      {(!ready || open) && children}
    </section>
  );
}

/* ── Dictation ──────────────────────────────────────────────────────────── */

/**
 * Speech-to-text on the built-in Web Speech API — no dependency, no upload, no
 * API key. Chrome routes it through Google's recogniser, so this is not local
 * processing; that is fine for a public reply, and it is the only reason it
 * costs nothing.
 *
 * `interimResults` is off deliberately. Interim text rewrites itself mid-flight,
 * which fights the cursor when you are editing an existing draft — the point
 * here is to add a sentence to an agent's draft by voice, not to dictate from
 * scratch.
 *
 * Renders nothing where the API is absent (Firefox, Safari <16.4). A button that
 * silently does nothing is worse than no button.
 */
export function Dictate({ onText }: { onText: (t: string) => void }) {
  const [on, setOn] = useState(false);
  const [supported, setSupported] = useState(false);
  const ref = useRef<any>(null);

  useEffect(() => {
    const Ctor =
      (window as any).SpeechRecognition ??
      (window as any).webkitSpeechRecognition;
    if (!Ctor) return;
    setSupported(true);
    const r = new Ctor();
    r.continuous = true;
    r.interimResults = false;
    r.lang = "en-US";
    r.onresult = (e: any) => {
      let out = "";
      for (let i = e.resultIndex; i < e.results.length; i++)
        if (e.results[i].isFinal) out += e.results[i][0].transcript;
      if (out.trim()) onText(out.trim());
    };
    r.onend = () => setOn(false);
    r.onerror = () => setOn(false);
    ref.current = r;
    return () => {
      try {
        r.stop();
      } catch {
        /* already stopped */
      }
    };
  }, [onText]);

  if (!supported) return null;
  return (
    <button
      type="button"
      onClick={() => {
        const r = ref.current;
        if (!r) return;
        if (on) r.stop();
        else {
          try {
            r.start();
            setOn(true);
          } catch {
            /* start() throws if already running */
          }
        }
      }}
      title={on ? "Stop dictating" : "Dictate — appends to the draft"}
      className={`rounded-lg border px-3 py-2.5 text-sm ${
        on
          ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]"
          : "border-[var(--border)] text-[var(--muted-foreground)]"
      }`}
    >
      {on ? "◉ listening" : "🎙 dictate"}
    </button>
  );
}

/* ── Reply inbox ────────────────────────────────────────────────────────── */

export interface Thread {
  commentId: string;
  /** Pre-written by engage-replies.ts. Null means the batch job has not drafted it yet. */
  draft?: string | null;
  drafted?: boolean;
  author: string;
  body: string;
  at: string;
  articleTitle: string;
  articleUrl: string;
}

/**
 * Same shape as the "Up next" card, deliberately: one item at a time, the text
 * already written and editable, then copy-and-open. The old inbox listed every
 * thread and only drafted on click, which put a 20s agent round-trip *between*
 * the decision and the tab — the one gap this app exists to remove. The draft
 * now arrives with the card, so the button does what the queue's button does.
 */
export function Threads({
  threads,
  i,
  reply,
  setReply,
  drafting,
  error,
  onAct,
  onRetry,
  focused = true,
  onFocus,
}: {
  threads: Thread[];
  i: number;
  reply: string;
  setReply: (v: string) => void;
  drafting: boolean;
  error: string | null;
  onAct: (action: "done" | "skip") => void;
  onRetry: () => void;
  /** Whether Enter/s/r currently drive THIS stepper rather than the queue. */
  focused?: boolean;
  onFocus?: () => void;
}) {
  const t = threads[i];
  if (!t)
    return (
      <div className={`${card} p-6 text-center text-[var(--muted-foreground)]`}>
        {/* "Nothing to do" and "you have been through everything loaded" are
            different states and used to render the same sentence — which reads
            as a bug the moment the header still shows a count. */}
        {threads.length ? (
          <>
            <b className="block text-[var(--success)]">
              Worked through all {threads.length}
            </b>
            <p className="mt-1 text-sm">
              Refresh to pick up replies that arrived since this page loaded.
            </p>
            <button
              onClick={onRetry}
              className="mt-3 rounded-lg border border-[var(--border)] px-3.5 py-2 text-[13px] text-[var(--muted-foreground)]"
            >
              Refresh replies
            </button>
          </>
        ) : (
          "No unanswered replies."
        )}
      </div>
    );
  return (
    <article
      onMouseDown={onFocus}
      onFocusCapture={onFocus}
      className={`rounded-xl border bg-[var(--card)] p-6 ${focused ? "border-[var(--primary)]" : "border-[var(--border)]"}`}
    >
      <div className="flex flex-wrap items-baseline gap-2">
        <a
          href={`https://dev.to/${t.author}`}
          target="_blank"
          rel="noopener"
          className="font-mono text-[12px] text-[var(--primary)]"
        >
          @{t.author}
        </a>
        <span className="font-mono text-[11px] text-[var(--muted-foreground)]">
          {new Date(t.at).toLocaleDateString()}
        </span>
        <span className="truncate text-[12px] text-[var(--muted-foreground)]">
          on “{t.articleTitle}”
        </span>
      </div>
      <p className="mt-2 border-l-2 border-[var(--border)] pl-3 text-[14px] text-[var(--muted-foreground)]">
        {t.body}
      </p>

      {error ? (
        <p className="mt-4 rounded-lg border border-[var(--warning)] p-3 text-[13px] text-[var(--warning)]">
          Draft agent failed: {error}. Nothing was written — the agent never ran,
          which is different from it writing a bad reply. Write the reply below
          or retry.
        </p>
      ) : null}

      <textarea
        value={reply}
        onChange={(e) => setReply(e.target.value)}
        placeholder={drafting ? "Drafting…" : "No draft — write the reply here."}
        className="mt-4 min-h-40 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] p-3 text-[14.5px] leading-relaxed"
      />

      <div className="mt-4 flex flex-wrap items-center gap-2.5">
        <button
          onClick={() => onAct("done")}
          disabled={drafting || !reply.trim()}
          className="rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] disabled:opacity-50"
        >
          Copy &amp; open →
        </button>
        <button
          onClick={() => onAct("skip")}
          className="rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm text-[var(--muted-foreground)]"
        >
          Skip
        </button>
        <Dictate
          onText={(t) => setReply(reply ? `${reply.trimEnd()} ${t}` : t)}
        />
        {error && (
          <button
            onClick={onRetry}
            disabled={drafting}
            className="rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm text-[var(--muted-foreground)] disabled:opacity-50"
          >
            Retry draft
          </button>
        )}
        <span className="ml-auto font-mono text-[12px] text-[var(--muted-foreground)]">
          {i + 1} of {threads.length}
        </span>
      </div>
      <p className="mt-2.5 text-[12.5px] text-[var(--muted-foreground)]">
        {focused
          ? "Enter next · s skip · r refresh"
          : "Keys are on Up next — click this card to take them."}
      </p>
    </article>
  );
}

/* ── Impact sparkline ───────────────────────────────────────────────────── */

export function Impact({
  rows,
}: {
  rows: Record<string, string | number | null>[];
}) {
  const points = useMemo<Point[]>(
    () =>
      rows
        .filter((r) => r.platform === "devto")
        .map((r) => ({
          t: String(r.observed_on),
          // `null` is a day we did not observe, and the DS treats it as a gap
          // rather than a zero. The hand-rolled version coerced it with
          // `Number(x ?? 0)`, which drew a real follower count crashing to the
          // floor on every missing snapshot.
          v: r.followers == null ? null : Number(r.followers),
        }))
        .sort((a, b) => a.t.localeCompare(b.t)),
    [rows],
  );

  const last = [...points].reverse().find((p) => p.v !== null);

  return (
    <div className={`${card} overflow-hidden`}>
      <div className="flex flex-wrap items-baseline gap-4 border-b border-[var(--border)] px-4 py-3">
        <span className="text-2xl font-semibold tabular-nums">
          {last?.v == null ? "—" : last.v.toLocaleString()}
        </span>
        <Delta points={points} unit="followers" className="font-mono text-[13px]" />
        <span className="ml-auto font-mono text-[11px] text-[var(--muted-foreground)]">
          dev.to followers
        </span>
      </div>
      <div className="p-4">
        <TimeSeries
          points={points}
          label="dev.to followers"
          unit="followers"
          height={160}
        />
      </div>
    </div>
  );
}

/* ── Plugin FP/FN inbox ─────────────────────────────────────────────────── */

export function Plugins({
  findings,
}: {
  findings: { rule: string; file: string; line: number; message: string }[];
}) {
  const byRule = useMemo(() => {
    const m = new Map<string, { rule: string; count: number; sample: string }>();
    for (const f of findings) {
      const e = m.get(f.rule) ?? { rule: f.rule, count: 0, sample: f.message };
      e.count++;
      m.set(f.rule, e);
    }
    return [...m.values()].sort((a, b) => b.count - a.count);
  }, [findings]);

  const [sort, setSort] = useState<DataTableSort | null>({
    columnId: "count",
    direction: "desc",
  });

  // `<DataTable>` is deliberately presentational about sort: it renders
  // `aria-sort` and emits `onSortChange`, but never reorders. The reorder is
  // the caller's, via the exported `sortRows` helper.
  const sorted = useMemo(
    () => sortRows(byRule, sort, (r, id) => (id === "count" ? r.count : r.rule)),
    [byRule, sort],
  );

  return (
    <div className={card}>
      {/*
        `<DataTable>` brings what all nine hand-rolled tables lacked: a real
        `<caption>`, `scope` on every header, `aria-sort`, a keyboard-reachable
        scroll region, and sortable columns. The `max-h` cap moved onto the
        component's own scroll container.
      */}
      <DataTable
        caption="Plugin findings by rule"
        captionHidden
        dense
        rows={sorted}
        rowKey={(r) => r.rule}
        sort={sort}
        onSortChange={setSort}
        empty="No findings — our plugins are clean over our own scripts."
        className="[&_[data-slot=data-table-scroll]]:max-h-[460px]"
        columns={[
          {
            id: "rule",
            header: "Rule",
            sortable: true,
            cell: (r) => <span className="font-mono text-[12px]">{r.rule}</span>,
          },
          {
            id: "count",
            header: "Hits",
            align: "end",
            sortable: true,
            cell: (r) => r.count,
          },
          {
            id: "sample",
            header: "Sample",
            cell: (r) => (
              <span className="text-[var(--muted-foreground)]">{r.sample}</span>
            ),
          },
        ]}
      />
      <p className="border-t border-[var(--border)] p-3 text-[12.5px] text-[var(--muted-foreground)]">
        Our own plugins over our own scripts. A rule with a very high hit count on
        trusted local code is an FP candidate, not a finding —{" "}
        <code>detect-object-injection</code> is the classic example.
      </p>
    </div>
  );
}

/* ── Benchmark ──────────────────────────────────────────────────────────── */

/**
 * Relative strength: are we beating the tag, or just participating in it?
 *
 * The comparison is **zero-reaction share**, not medians. In these tags the
 * median article earns 0 and so does ours — a median-vs-median test can only
 * ever return "tied", which reads as "we learned nothing" when in fact we are
 * measurably ahead. The share of articles that earn *anything* separates them.
 */
export function Benchmark({ data }: { data: any }) {
  if (!data) return <Skel rows={4} />;
  const o = data.ours ?? {};
  return (
    <div className="flex flex-col gap-3">
      <StatStrip
        caption="us"
        cols={5}
        items={[
          { key: "n", label: "Articles", value: o.n ?? null },
          { key: "rx", label: "Median rx", value: o.rxMedian ?? null },
          { key: "p90", label: "p90 rx", value: o.rxP90 ?? null },
          {
            key: "zero",
            label: "Earn zero",
            value: o.rxZeroShare == null ? null : Math.round(o.rxZeroShare * 100),
            unit: "%",
          },
          { key: "views", label: "Median views", value: o.viewsMedian ?? null },
        ]}
      />

      <div className={card}>
        <DataTable
          caption="Tag feed depth and our zero-reaction edge"
          captionHidden
          dense
          rows={(data.tags ?? []) as any[]}
          rowKey={(t: any) => t.tag}
          empty="No tag baseline sampled yet."
          columns={[
            {
              id: "tag",
              header: "Tag",
              cell: (t: any) => <span className="font-mono text-[12px]">#{t.tag}</span>,
            },
            {
              id: "depth",
              header: "Feed depth",
              align: "end",
              className: "text-[var(--muted-foreground)]",
              cell: (t: any) => `${t.oldestDays}d`,
            },
            {
              id: "perDay",
              header: "Posts/day",
              align: "end",
              className: "text-[var(--muted-foreground)]",
              cell: (t: any) => `~${t.perDay}`,
            },
            {
              id: "zero",
              header: "Tag zero-rate",
              align: "end",
              cell: (t: any) => `${Math.round((t.rxZeroShare ?? 0) * 100)}%`,
            },
            {
              id: "edge",
              header: "Our edge",
              align: "end",
              cell: (t: any) => {
                const edge = t.zeroShareEdge ?? 0;
                return (
                  <span
                    className={`font-semibold ${
                      edge > 0 ? "text-[var(--success)]" : "text-[var(--warning)]"
                    }`}
                  >
                    {edge > 0 ? "+" : ""}
                    {Math.round(edge * 100)}pp
                  </span>
                );
              },
            },
          ]}
        />
        <p className="border-t border-[var(--border)] p-3 text-[12.5px] leading-relaxed text-[var(--muted-foreground)]">
          <b className="text-[var(--muted-foreground)]">Edge</b> = how much smaller our
          zero-reaction share is than the tag&apos;s. Positive means a larger
          fraction of our articles earn <em>something</em>. <b>Feed depth</b> is
          how far back 100 articles reaches — the window an article is visible
          in at all. It is under 6 days everywhere, which is why this baseline
          is sampled daily and can never be back-filled.
          {data.note && (
            <>
              {" "}
              <span className="text-[var(--warning)]">{data.note}</span>
            </>
          )}
        </p>
      </div>

      {data.drawdown?.alarm && (
        <Callout
          tone="warn"
          title={`Flat line — ${data.drawdown.flatDays} days without follower growth`}
        >
          25 such days passed unnoticed in June. Publishing is what restarts the
          wave.
        </Callout>
      )}

      {data.curve?.length > 0 && (
        <div className={`${card} p-3`}>
          <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
            Where the views actually land
          </div>
          <div className="flex flex-wrap gap-4 font-mono text-[12px]">
            {data.curve.map((c: any) => (
              <span key={c.ageBucket}>
                <span className="text-[var(--muted-foreground)]">{c.ageBucket}</span>{" "}
                <b>{c.medianDailyViews}</b>/day
                <span className="text-[var(--muted-foreground)]"> (n={c.n})</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Trends ─────────────────────────────────────────────────────────────── */

/**
 * Every tracked metric, at a chosen granularity — not one chart.
 *
 * Week/month buckets take the LAST value, never the mean: these are cumulative
 * totals, and averaging them produces a number that was never true on any day.
 *
 * Both changes are shown. "Up 40 this month" and "up 0 this week" are different
 * stories, and showing only the first is how a stall stays invisible.
 */
export function TrendGrid({
  data,
  grain,
  onGrain,
}: {
  data: any;
  grain: "day" | "week" | "month";
  onGrain: (g: "day" | "week" | "month") => void;
}) {
  if (!data) return <Skel rows={4} />;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-1.5 font-mono text-[11px]">
        {(["day", "week", "month"] as const).map((g) => (
          <button
            key={g}
            onClick={() => onGrain(g)}
            className={`border px-2 py-0.5 ${
              grain === g
                ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--card)]"
                : "border-[var(--border)] text-[var(--muted-foreground)]"
            }`}
          >
            {g}
          </button>
        ))}
        <span className="ml-2 text-[var(--muted-foreground)]">
          {data.days} days · {data.source}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(data.metrics ?? []).map((m: any) => (
          <div key={m.key} className={`${card} p-3`}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--muted-foreground)]">
                {m.label}
              </span>
              <span className="text-[17px] font-semibold tabular-nums">
                {m.last?.toLocaleString() ?? "—"}
              </span>
            </div>
            {/*
              `<Sparkline>` is fixed-aspect and centred rather than stretched to
              the card width — the hand-rolled one used
              `preserveAspectRatio="none"`, which distorted the slope of every
              series differently depending on how wide its card happened to be.
            */}
            <div className="my-1.5">
              <Sparkline
                points={m.points}
                label={m.label}
                width={260}
                height={40}
                className="h-10 w-full"
              />
            </div>
            <div className="flex justify-between gap-2 font-mono text-[11px]">
              <Delta points={m.points} unit={m.label} />
              <span className="text-[var(--muted-foreground)]">
                last {grain}:{" "}
                {m.lastChange == null
                  ? "—"
                  : `${m.lastChange > 0 ? "+" : ""}${m.lastChange}`}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Google AI roster ───────────────────────────────────────────────────── */

/**
 * The Google AI org on DEV, ranked by what their own bios say they do.
 *
 * Fetched live rather than hardcoded — Google rotates people through this
 * programme, and a checked-in list is wrong the first time someone joins, in a
 * way that looks identical to "they just did not post".
 */
export function Roster({ roster }: { roster: any[] }) {
  const [all, setAll] = useState(false);
  if (!roster?.length)
    return (
      <div className={`${card} p-4 text-[13px] text-[var(--muted-foreground)]`}>
        Roster unavailable — the DEV organisation endpoint did not answer.
      </div>
    );
  const shown = all ? roster : roster.slice(0, 12);
  return (
    <div className={card}>
      <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2 font-mono text-[11px] text-[var(--muted-foreground)]">
        <span>{roster.length} people in the googleai org</span>
        <button onClick={() => setAll((v) => !v)} className="border border-[var(--border)] px-2 py-0.5">
          {all ? "top 12" : `all ${roster.length}`}
        </button>
      </div>
      <div className="divide-y divide-[var(--border)]">
        {shown.map((m) => (
          <div key={m.username} className="flex flex-wrap items-center gap-2.5 p-2.5">
            <span
              className={`rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase ${
                m.rank <= 2
                  ? "border-[var(--primary)] text-[var(--primary)]"
                  : "border-[var(--border)] text-[var(--muted-foreground)]"
              }`}
            >
              {m.role}
            </span>
            <a
              href={`https://dev.to/${m.username}`}
              target="_blank"
              rel="noopener"
              className="font-mono text-[12px] text-[var(--primary)]"
            >
              @{m.username}
            </a>
            <span className="text-[12.5px] text-[var(--muted-foreground)]">{m.name}</span>
            <span className="min-w-0 flex-1 truncate text-[12px] text-[var(--muted-foreground)]">
              {m.summary}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Correlation ────────────────────────────────────────────────────────── */

/**
 * Ranked hypotheses, not verdicts.
 *
 * Every row is |r| over paired days at some lag. The wording is deliberate:
 * "moves with", never "causes". There is no control group and there cannot be
 * one — you cannot run a holdout against your own audience — so the honest use
 * of this panel is to decide what to try next, not to declare what worked.
 */
export function Correlate({ data }: { data: any }) {
  if (!data) return <Skel rows={3} />;
  if (data.blocked)
    return (
      <Callout tone="note" title="Not yet answerable">
        <p className="max-w-[70ch]">{data.blocked}</p>
        <p className="mt-2 font-mono text-[11.5px] text-[var(--muted-foreground)]">
          {data.days} day(s) recorded · {data.actions} logged actions
        </p>
      </Callout>
    );
  return (
    <div className={card}>
      <DataTable
        caption="Actions correlated against next-day metric deltas"
        captionHidden
        dense
        rows={data.results as any[]}
        rowKey={(r: any) => `${r.metric}-${r.lag}`}
        empty="No correlations computed yet."
        columns={[
          { id: "metric", header: "Metric delta", cell: (r: any) => r.metric },
          {
            id: "lag",
            header: "Lag",
            className: "font-mono text-[12px] text-[var(--muted-foreground)]",
            cell: (r: any) => (r.lag === 0 ? "same day" : `+${r.lag}d`),
          },
          {
            id: "r",
            header: "r",
            align: "end",
            cell: (r: any) => (
              <span className={Math.abs(r.r) >= 0.5 ? "text-[var(--success)]" : undefined}>
                {r.r > 0 ? "+" : ""}
                {r.r}
              </span>
            ),
          },
          {
            id: "n",
            header: "n",
            align: "end",
            className: "text-[var(--muted-foreground)]",
            cell: (r: any) => r.n,
          },
        ]}
      />
      <p className="border-t border-[var(--border)] p-3 text-[12.5px] text-[var(--muted-foreground)]">
        Actions vs next-day <b>deltas</b>, not levels — followers only go up, so
        correlating against the total would just rediscover that time passes.
        These rank hypotheses worth testing. They are not causes.
      </p>
    </div>
  );
}

/* ── Plugin catalog ─────────────────────────────────────────────────────── */

export interface PluginRow {
  id: number;
  name: string;
  slug: string;
  category: string | null;
  description: string | null;
  deprecated: boolean;
  d1: number | null;
  weeklyDownloads: number | null;
  monthlyDownloads: number | null;
  version: string | null;
  stars: number | null;
  rules: number | null;
  published: boolean;
  coveragePct: number | null;
  totalLines: number | null;
  status: string | null;
  npm: string;
  github: string;
  docs: string;
}

const SORTS = [
  { key: "weeklyDownloads", label: "weekly" },
  { key: "monthlyDownloads", label: "monthly" },
  { key: "coveragePct", label: "coverage" },
  { key: "name", label: "name" },
] as const;

const num = (n: number | null | undefined) =>
  n == null ? "—" : n.toLocaleString();

/**
 * The portfolio, addressable.
 *
 * The point is not the numbers — those exist elsewhere. It is that every plugin
 * is two clicks from its npm page, its source folder and its docs, so answering
 * "what is the version / where does this live" stops being a search each time.
 *
 * `rules` renders as "—" rather than 0 when the pipeline has not populated
 * `rule_count`: a plugin with zero rules and a plugin we failed to measure are
 * different facts, and collapsing them is how a broken pipeline stays invisible.
 */
export function PluginCatalog({ plugins }: { plugins: PluginRow[] }) {
  const [sort, setSort] = useState<(typeof SORTS)[number]["key"]>(
    "weeklyDownloads",
  );
  const [sel, setSel] = useState<number | null>(null);
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = needle
      ? plugins.filter(
          (p) =>
            p.name.toLowerCase().includes(needle) ||
            (p.category ?? "").toLowerCase().includes(needle),
        )
      : plugins;
    return [...filtered].sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name)
        : ((b[sort] as number) ?? -1) - ((a[sort] as number) ?? -1),
    );
  }, [plugins, sort, q]);

  const totalWeekly = useMemo(
    () => plugins.reduce((s, p) => s + (p.weeklyDownloads ?? 0), 0),
    [plugins],
  );

  return (
    <div className={card}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-3 py-2.5 font-mono text-[11px] text-[var(--muted-foreground)]">
        <span>
          {plugins.length} packages · {num(totalWeekly)}/wk combined
        </span>
        <span className="flex items-center gap-1.5">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="filter…"
            className="w-24 rounded border border-[var(--border)] bg-[var(--background)] px-1.5 py-0.5 font-mono text-[11px]"
          />
          {SORTS.map((s) => (
            <button
              key={s.key}
              onClick={() => setSort(s.key)}
              className={`border px-1.5 py-0.5 ${
                sort === s.key
                  ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--card)]"
                  : "border-[var(--border)]"
              }`}
            >
              {s.label}
            </button>
          ))}
        </span>
      </div>

      <div className="max-h-[520px] overflow-auto">
        <table className="w-full text-[13px]">
          <thead className="sticky top-0 bg-[var(--card)]">
            <tr className="border-b border-[var(--border)] text-left font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--muted-foreground)]">
              <th className="p-2.5 font-medium">Package</th>
              <th className="p-2.5 text-right font-medium">Weekly</th>
              <th className="p-2.5 text-right font-medium">Rules</th>
              <th className="p-2.5 text-right font-medium">Cov</th>
              <th className="p-2.5 font-medium">Links</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const open = sel === p.id;
              return (
                <Fragment key={p.id}>
                  <tr
                    onClick={() => setSel(open ? null : p.id)}
                    className={`cursor-pointer border-b border-[var(--border)] last:border-0 ${
                      open ? "bg-[var(--background)]" : ""
                    }`}
                  >
                    <td className="p-2.5">
                      <span className="font-mono text-[12px]">
                        {p.name.replace(/^eslint-plugin-/, "")}
                      </span>
                      {p.deprecated && (
                        <span className="ml-1.5 font-mono text-[10px] uppercase text-[var(--warning)]">
                          deprecated
                        </span>
                      )}
                      {!p.published && (
                        <span className="ml-1.5 font-mono text-[10px] uppercase text-[var(--muted-foreground)]">
                          unpublished
                        </span>
                      )}
                    </td>
                    <td className="p-2.5 text-right tabular-nums">
                      {num(p.weeklyDownloads)}
                    </td>
                    <td className="p-2.5 text-right tabular-nums text-[var(--muted-foreground)]">
                      {num(p.rules)}
                    </td>
                    <td className="p-2.5 text-right tabular-nums">
                      {p.coveragePct == null ? (
                        "—"
                      ) : (
                        <span
                          className={
                            p.coveragePct >= 100
                              ? "text-[var(--success)]"
                              : p.coveragePct >= 80
                                ? ""
                                : "text-[var(--warning)]"
                          }
                        >
                          {p.coveragePct}%
                        </span>
                      )}
                    </td>
                    <td className="p-2.5">
                      <span className="flex gap-1.5 font-mono text-[10px] uppercase">
                        {(
                          [
                            ["npm", p.npm],
                            ["src", p.github],
                            ["docs", p.docs],
                          ] as const
                        ).map(([label, href]) => (
                          <a
                            key={label}
                            href={href}
                            target="_blank"
                            rel="noopener"
                            onClick={(e) => e.stopPropagation()}
                            className="rounded border border-[var(--border)] px-1.5 py-0.5 text-[var(--muted-foreground)] hover:border-[var(--primary)] hover:text-[var(--primary)]"
                          >
                            {label}
                          </a>
                        ))}
                      </span>
                    </td>
                  </tr>
                  {open && (
                    <tr className="border-b border-[var(--border)]">
                      <td colSpan={5} className="bg-[var(--background)] p-3">
                        <p className="mb-2 max-w-[76ch] text-[13px] text-[var(--muted-foreground)]">
                          {p.description ?? "No description recorded."}
                        </p>
                        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 font-mono text-[11.5px] text-[var(--muted-foreground)] sm:grid-cols-4">
                          {(
                            [
                              ["version", p.version ?? "—"],
                              ["category", p.category ?? "—"],
                              ["status", p.status ?? "—"],
                              ["stars", num(p.stars)],
                              ["d1", num(p.d1)],
                              ["d30", num(p.monthlyDownloads)],
                              ["lines", num(p.totalLines)],
                              ["slug", p.slug],
                            ] as const
                          ).map(([k, v]) => (
                            <div key={k} className="flex justify-between gap-2">
                              <dt className="text-[var(--muted-foreground)]">{k}</dt>
                              <dd className="truncate">{v}</dd>
                            </div>
                          ))}
                        </dl>
                        <button
                          onClick={() =>
                            navigator.clipboard?.writeText(
                              `npm i -D ${p.name}`,
                            )
                          }
                          className="mt-3 rounded border border-[var(--border)] px-2 py-1 font-mono text-[10px] uppercase hover:border-[var(--primary)] hover:text-[var(--primary)]"
                        >
                          copy install
                        </button>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Promotion ──────────────────────────────────────────────────────────── */

export function Promotion({
  prs,
}: {
  prs: { title: string; url: string; repo: string; state: string; updated: string }[];
}) {
  const tone: Record<string, string> = {
    merged: "text-[var(--success)] border-[var(--success)]",
    open: "text-[var(--warning)] border-[var(--warning)]",
    closed: "text-[var(--muted-foreground)] border-[var(--border)]",
  };
  const [state, setState] = useState<string>("all");
  const [q, setQ] = useState("");

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: prs.length };
    for (const p of prs) c[p.state] = (c[p.state] ?? 0) + 1;
    return c;
  }, [prs]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return prs
      .filter((p) => state === "all" || p.state === state)
      .filter(
        (p) =>
          !needle ||
          p.repo.toLowerCase().includes(needle) ||
          p.title.toLowerCase().includes(needle),
      )
      // Open first: those are the ones still winning or still waiting on
      // someone. Merged is history, closed is a decision already made.
      .sort((a, b) => {
        const rank = (x: string) => (x === "open" ? 0 : x === "merged" ? 1 : 2);
        return rank(a.state) - rank(b.state) || b.updated.localeCompare(a.updated);
      });
  }, [prs, state, q]);

  return (
    <div className={card}>
      <div className="flex flex-wrap items-center gap-1.5 border-b border-[var(--border)] px-3 py-2 font-mono text-[11px]">
        {["all", "open", "merged", "closed"].map((s) =>
          counts[s] ? (
            <button
              key={s}
              onClick={() => setState(s)}
              className={`border px-2 py-0.5 ${
                state === s
                  ? "border-[var(--primary)] text-[var(--primary)]"
                  : "border-[var(--border)] text-[var(--muted-foreground)]"
              }`}
            >
              {s} {counts[s]}
            </button>
          ) : null,
        )}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="filter repo or title…"
          className="ml-auto min-w-[150px] flex-1 rounded border border-[var(--border)] bg-[var(--background)] px-2 py-0.5 font-mono text-[11px]"
        />
        <span className="text-[var(--muted-foreground)]">{rows.length} shown</span>
      </div>

      {/* Scrolls rather than truncating. The previous version rendered
          `prs.slice(0, 12)` while the section header counted all 23 — eleven
          promotion PRs were simply invisible, and nothing on screen said so.
          A capped list that does not admit its cap is a lie about coverage. */}
      <div className="max-h-[420px] divide-y divide-[var(--border)] overflow-y-auto">
        {rows.map((p) => (
          <a
            key={p.url}
            href={p.url}
            target="_blank"
            rel="noopener"
            className="flex flex-wrap items-center gap-3 p-3 hover:bg-[color-mix(in_srgb,var(--foreground)_4%,transparent)]"
          >
            <span
              className={`rounded border px-2 py-0.5 font-mono text-[10px] uppercase ${tone[p.state] ?? tone.closed}`}
            >
              {p.state}
            </span>
            <span className="font-mono text-[12px] text-[var(--muted-foreground)]">
              {p.repo}
            </span>
            <span className="min-w-0 flex-1 truncate text-[13.5px]">{p.title}</span>
            <span className="font-mono text-[10.5px] text-[var(--muted-foreground)]">
              {p.updated?.slice(0, 10)}
            </span>
          </a>
        ))}
        {rows.length === 0 && (
          <p className="p-3 text-[13px] text-[var(--muted-foreground)]">
            Nothing matches that filter.
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Site health — real-browser performance and errors from PostHog.
 *
 * Sits next to the plugin findings on purpose: that panel is what static
 * analysis caught before ship, this one is what actually broke afterwards.
 *
 * Every row is per-app because one PostHog project serves every property; an
 * aggregate row here would read like a single site's health and be wrong for
 * all of them.
 */
export function SiteHealth({
  vitals,
  errors,
}: {
  vitals: {
    rows: {
      app: string;
      samples: number;
      lcp: number | null;
      inp: number | null;
      cls: number | null;
      verdict: "good" | "needs-improvement" | "poor";
    }[];
    error: string | null;
  };
  errors: {
    rows: {
      app: string;
      type: string;
      message: string;
      count: number;
      users: number;
    }[];
    error: string | null;
  };
}) {
  // ms for LCP/INP, unitless-to-3dp for CLS — showing CLS as "0ms" was the
  // first thing that made this table look broken.
  const ms = (v: number | null) => (v === null ? "—" : `${Math.round(v)}ms`);
  const cls = (v: number | null) => (v === null ? "—" : v.toFixed(3));

  return (
    <div className={card}>
      {/*
        The verdict used to be carried by colour alone, on two hex literals
        (`#3fb950` / `#f85149`) sitting behind `var(--success)` /
        `var(--destructive)` fallbacks for tokens that were never defined — so
        this panel was the one surface that ignored the palette entirely, in
        both schemes. It is now a `<Badge>` with a token tone: shape AND colour.
      */}
      <DataTable
        caption="Core Web Vitals, p75 over 7 days"
        captionHidden
        dense
        rows={vitals.rows}
        rowKey={(r) => r.app}
        error={vitals.error ? `Web vitals unavailable — ${vitals.error}` : undefined}
        empty="No vitals samples yet."
        columns={[
          {
            id: "app",
            header: "App",
            cell: (r) => <span className="font-mono text-[12px]">{r.app}</span>,
          },
          {
            id: "verdict",
            header: "Verdict",
            cell: (r) => (
              <Badge
                variant={r.verdict === "poor" ? "destructive" : "outline"}
                className={
                  r.verdict === "good"
                    ? "text-[var(--success)]"
                    : r.verdict === "needs-improvement"
                      ? "text-[var(--warning)]"
                      : undefined
                }
              >
                {r.verdict}
              </Badge>
            ),
          },
          { id: "lcp", header: "p75 LCP", align: "end", cell: (r) => ms(r.lcp) },
          { id: "inp", header: "p75 INP", align: "end", cell: (r) => ms(r.inp) },
          { id: "cls", header: "p75 CLS", align: "end", cell: (r) => cls(r.cls) },
          {
            id: "samples",
            header: "Samples",
            align: "end",
            className: "text-[var(--muted-foreground)]",
            cell: (r) => r.samples,
          },
        ]}
      />

      <div className="border-t border-[var(--border)]">
        <DataTable
          caption="Exceptions over 30 days, ranked by people affected"
          captionHidden
          dense
          rows={errors.rows.slice(0, 10)}
          rowKey={(e) => `${e.app}:${e.message}`}
          error={errors.error ? `Errors unavailable — ${errors.error}` : undefined}
          empty="No exceptions in the last 30 days."
          columns={[
            {
              id: "app",
              header: "App",
              cell: (e) => <span className="font-mono text-[12px]">{e.app}</span>,
            },
            { id: "users", header: "People", align: "end", cell: (e) => e.users },
            {
              id: "count",
              header: "Hits",
              align: "end",
              className: "text-[var(--muted-foreground)]",
              cell: (e) => e.count,
            },
            {
              id: "message",
              header: "Exception",
              className: "text-[var(--muted-foreground)]",
              cell: (e) => e.message,
            },
          ]}
        />
      </div>

      <p className="border-t border-[var(--border)] p-3 text-[12.5px] text-[var(--muted-foreground)]">
        p75, the statistic Google ranks on. Vitals over 7 days, exceptions over
        30 — errors are rare enough here that a weekly window reads empty and
        looks like health. Ranked by people affected, not hit count.
      </p>
    </div>
  );
}

/* ── Founders & Google AI ───────────────────────────────────────────────── */

export function People({ people }: { people: any[] }) {
  return (
    <div className={`${card} divide-y divide-[var(--border)]`}>
      {people.map((p) => (
        <div key={p.username} className="flex flex-wrap items-center gap-3 p-3">
          <a href={`https://dev.to/${p.username}`} target="_blank" rel="noopener"
             className="font-mono text-[12.5px] text-[var(--primary)]">@{p.username}</a>
          <span className="rounded border border-[var(--border)] px-1.5 py-0.5 font-mono text-[10px] uppercase text-[var(--muted-foreground)]">
            {p.cohort}
          </span>
          {!p.verified && (
            <span className="font-mono text-[10px] text-[var(--warning)]" title="Membership not confirmed — verify before acting">
              unverified
            </span>
          )}
          {p.latest ? (
            <>
              <a href={p.latest.url} target="_blank" rel="noopener"
                 className="min-w-0 flex-1 truncate text-[13px]">{p.latest.title}</a>
              <span className="font-mono text-[11px] text-[var(--muted-foreground)]">
                {p.latest.ageDays}d · {p.latest.reactions} rx
              </span>
              {p.latest.reactable && (
                <a href={p.latest.url} target="_blank" rel="noopener"
                   className="rounded-md bg-[var(--success)] px-2.5 py-1 font-mono text-[10px] uppercase text-[var(--success-foreground)]"
                   title="Inside the 7-day window where reacting can bank a x1.5 reputation multiplier if they take Top 7">
                  react now
                </a>
              )}
            </>
          ) : (
            <span className="flex-1 text-[12.5px] text-[var(--muted-foreground)]">no recent article found</span>
          )}
        </div>
      ))}
      <p className="p-3 text-[12.5px] text-[var(--muted-foreground)]">
        <b>react now</b> marks an article still inside the 7-day window. If that
        author takes Top 7 that week, a positive reaction banks a permanent
        <b> x1.5</b> on your reputation_modifier (cap 4.0), which multiplies reach
        on everything you publish afterwards.
      </p>
    </div>
  );
}

/* ── PR board ───────────────────────────────────────────────────────────── */

export function Board({ prs }: { prs: any[] }) {
  const mine = prs.filter((p) => p.actionRequired);
  const theirs = prs.filter((p) => !p.actionRequired);
  const [spawned, setSpawned] = useState<Record<string, string>>({});

  /**
   * Hand the PR to an agent. The prompt is always copied even when the spawn
   * fails, so the button degrades to "paste this somewhere" rather than dying.
   */
  const spawn = async (p: any) => {
    setSpawned((s) => ({ ...s, [p.url]: "…" }));
    try {
      const r = await fetch("/api/spawn", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          repo: p.repo,
          number: p.number,
          title: p.title,
          reason: p.reason,
        }),
      });
      const j = await r.json();
      if (j.prompt) {
        try {
          await navigator.clipboard.writeText(j.prompt);
        } catch {
          /* no clipboard permission; the terminal still opened */
        }
      }
      setSpawned((s) => ({
        ...s,
        [p.url]: j.ok ? "opened + copied" : `failed: ${j.error} (copied)`,
      }));
    } catch (e) {
      setSpawned((s) => ({ ...s, [p.url]: "unreachable" }));
    }
  };

  const Row = ({ p, act }: { p: any; act: boolean }) => (
    <div className="flex flex-wrap items-center gap-3 p-3 hover:bg-[color-mix(in_srgb,var(--foreground)_4%,transparent)]">
      <span className={`rounded border px-2 py-0.5 font-mono text-[10px] uppercase ${
        act ? "border-[var(--primary)] text-[var(--primary)]"
            : "border-[var(--border)] text-[var(--muted-foreground)]"}`}>
        {act ? "you" : "them"}
      </span>
      <a href={p.url} target="_blank" rel="noopener"
         className="font-mono text-[11.5px] text-[var(--muted-foreground)] hover:text-[var(--primary)]">
        {p.repo}#{p.number}
      </a>
      <a href={p.url} target="_blank" rel="noopener"
         className="min-w-0 flex-1 truncate text-[13.5px] hover:text-[var(--primary)]">
        {p.title}
      </a>
      <span className="font-mono text-[11px] text-[var(--muted-foreground)]">{p.reason}</span>
      {act && (
        <button
          onClick={() => spawn(p)}
          title="Open a Claude session in the right repo, prompt pre-filled"
          className="rounded border border-[var(--primary)] px-2 py-0.5 font-mono text-[10px] uppercase text-[var(--primary)]"
        >
          {spawned[p.url] ?? "fix it"}
        </button>
      )}
    </div>
  );

  return (
    <div className={card}>
      <div className="border-b border-[var(--border)] px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-[var(--primary)]">
        Action required · {mine.length}
      </div>
      <div className="divide-y divide-[var(--border)]">
        {mine.length ? mine.map((p) => <Row key={p.url} p={p} act />)
          : <p className="p-3 text-[13px] text-[var(--muted-foreground)]">Nothing blocked on you.</p>}
      </div>
      <div className="border-y border-[var(--border)] px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-[var(--muted-foreground)]">
        Waiting on maintainers · {theirs.length}
      </div>
      {/* Scrolls instead of slicing. The header counts every PR, so a capped
          list made the two disagree with nothing on screen to explain it. */}
      <div className="max-h-[360px] divide-y divide-[var(--border)] overflow-y-auto">
        {theirs.map((p) => <Row key={p.url} p={p} act={false} />)}
      </div>
    </div>
  );
}

/* ── Ecosystem ──────────────────────────────────────────────────────────── */

export function Ecosystem({ totals }: { totals: Record<string, any> | null }) {
  // `StatStrip` distinguishes "we have no snapshot" (empty) from "the snapshot
  // says zero" — and prints a `not counted` badge for a null cell rather than a
  // bare em-dash that reads as a value.
  return (
    <StatStrip
      cols={5}
      state={{ empty: !totals }}
      announce={{ noun: "ecosystem snapshot" }}
      items={[
        { key: "plugins", label: "Plugins", value: totals?.total_plugins ?? null },
        { key: "rules", label: "Rules", value: totals?.total_rules ?? null },
        { key: "npm-total", label: "npm total", value: totals?.total_npm_downloads ?? null },
        { key: "npm-day", label: "npm / day", value: totals?.daily_npm_downloads ?? null },
        { key: "cov", label: "Test cov", value: totals?.test_coverage ?? null, unit: "%" },
      ]}
    />
  );
}

/* ── Article web ────────────────────────────────────────────────────────── */

const TIER_ORDER = ["T0", "T1", "T2", "T3", "TOPIC", "TUTORIAL"];

export function ArticleWeb({ nodes }: { nodes: any[] }) {
  const [sel, setSel] = useState<string | null>(null);

  const { pos, edges, W, H, lanes } = useMemo(() => {
    const W = 900, H = 420;
    const lanes = TIER_ORDER.filter((t) => nodes.some((n) => n.tier === t));
    const pos = new Map<string, { x: number; y: number; tier: string; status: string; title: string }>();
    lanes.forEach((tier, li) => {
      const inLane = nodes.filter((n) => n.tier === tier);
      const y = 40 + (li / Math.max(1, lanes.length - 1)) * (H - 80);
      inLane.forEach((n, i) => {
        pos.set(n.slug, {
          x: 40 + ((i + 0.5) / inLane.length) * (W - 80),
          y, tier, status: n.status, title: n.title ?? n.slug,
        });
      });
    });
    const edges: { from: string; to: string; x1: number; y1: number; x2: number; y2: number }[] = [];
    for (const n of nodes)
      for (const l of n.links ?? []) {
        const a = pos.get(n.slug), b = pos.get(l);
        if (a && b) edges.push({ from: n.slug, to: l, x1: a.x, y1: a.y, x2: b.x, y2: b.y });
      }
    return { pos, edges, W, H, lanes };
  }, [nodes]);

  const node = sel ? nodes.find((n) => n.slug === sel) : null;
  const outLinks = node?.links ?? [];
  // Inbound is the interesting direction: a node nothing cites is an orphan, and
  // that is invisible from the node's own frontmatter.
  const inLinks = useMemo(
    () => (sel ? nodes.filter((n) => (n.links ?? []).includes(sel)).map((n) => n.slug) : []),
    [sel, nodes],
  );
  const related = new Set<string>([...outLinks, ...inLinks]);

  const color = (s: string) =>
    s === "ready" ? "var(--primary)"
      : String(s).startsWith("publish") || String(s).startsWith("retrofit") ? "var(--success)"
      : "var(--muted-foreground)";

  return (
    <div className={`${card} overflow-hidden`}>
      <div className="border-b border-[var(--border)] px-4 py-2.5 font-mono text-[11px] text-[var(--muted-foreground)]">
        {nodes.length} articles · {edges.length} internal links · lanes are tiers
      </div>
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_270px]">
        <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img"
             aria-label="Article link web by tier">
          {lanes.map((t, li) => {
            const y = 40 + (li / Math.max(1, lanes.length - 1)) * (H - 80);
            return (
              <g key={t}>
                <line x1={20} y1={y} x2={W - 20} y2={y} stroke="var(--border)" strokeWidth={1} />
          <defs>
            {/* Arrowheads, so direction survives a greyscale screenshot and a
                reader who cannot separate orange from green. */}
            <marker id="arrow-out" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto">
              <path d="M0,0 L8,4 L0,8 z" fill="var(--primary)" />
            </marker>
            <marker id="arrow-in" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto">
              <path d="M0,0 L8,4 L0,8 z" fill="var(--success)" />
            </marker>
          </defs>
                <text x={4} y={y - 6} className="fill-[var(--muted-foreground)]"
                      style={{ fontSize: 9, fontFamily: "monospace" }}>{t}</text>
              </g>
            );
          })}
          {edges.map((e, i) => {
            // Direction is the meaning, so it gets the colour. Orange leaves the
            // selected node (authority it spends), green arrives (authority it
            // receives). Unselected edges stay neutral — colouring all 300 at
            // once is noise, not information.
            const out = sel != null && e.from === sel;
            const inc = sel != null && e.to === sel;
            const lit = out || inc;
            return (
              <path key={i}
                    d={`M${e.x1},${e.y1} C${e.x1},${(e.y1 + e.y2) / 2} ${e.x2},${(e.y1 + e.y2) / 2} ${e.x2},${e.y2}`}
                    fill="none"
                    stroke={out ? "var(--primary)" : inc ? "var(--success)" : "var(--muted-foreground)"}
                    strokeWidth={lit ? 1.6 : 0.5}
                    markerEnd={out ? "url(#arrow-out)" : inc ? "url(#arrow-in)" : undefined}
                    opacity={sel ? (lit ? 0.95 : 0.04) : 0.16} />
            );
          })}
          {[...pos.entries()].map(([slug, p]) => {
            const dim = sel && slug !== sel && !related.has(slug);
            return (
              <circle key={slug} cx={p.x} cy={p.y} r={slug === sel ? 5.5 : 3.4}
                      fill={color(p.status)} stroke="var(--card)" strokeWidth={1}
                      opacity={dim ? 0.15 : 1} className="cursor-pointer"
                      onClick={() => setSel(slug === sel ? null : slug)}>
                <title>{slug} · {p.tier} · {p.status}</title>
              </circle>
            );
          })}
        </svg>

        <aside className="border-t border-[var(--border)] p-4 text-[13px] md:border-l md:border-t-0">
          {node ? (
            <>
              <div className="font-semibold leading-snug">{node.title ?? node.slug}</div>
              <div className="mt-1 font-mono text-[10.5px] text-[var(--muted-foreground)]">{node.slug}</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="rounded border border-[var(--border)] px-1.5 py-0.5 font-mono text-[10px]">{node.tier}</span>
                <span className="rounded border border-[var(--border)] px-1.5 py-0.5 font-mono text-[10px]">{node.status}</span>
                {node.domain && <span className="rounded border border-[var(--border)] px-1.5 py-0.5 font-mono text-[10px]">{node.domain}</span>}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <a href={`https://ofriperetz.dev/articles/${node.slug}`} target="_blank" rel="noopener"
                   className="rounded-md border border-[var(--primary)] px-2 py-1 font-mono text-[10px] uppercase text-[var(--primary)]">
                  live →
                </a>
                <a href={`https://github.com/ofri-peretz/blog/blob/main/apps/blog/content/articles/${node.slug}.md`}
                   target="_blank" rel="noopener"
                   className="rounded-md border border-[var(--border)] px-2 py-1 font-mono text-[10px] uppercase text-[var(--muted-foreground)]">
                  source →
                </a>
              </div>
              {/* Two directions, two colours, two arrow glyphs.
                  A single "→" for both made the panel unreadable: which way a
                  citation points is the entire meaning. Outbound is what THIS
                  article spends its authority on; inbound is what it receives.
                  Colour carries it at a glance, the glyph carries it for anyone
                  who cannot separate the hues. */}
              <p className="mt-3 font-mono text-[10px] uppercase tracking-wider text-[var(--primary)]">
                ↗ Links out · {outLinks.length}
                <span className="ml-1.5 normal-case tracking-normal text-[var(--muted-foreground)]">
                  authority this one spends
                </span>
              </p>
              <ul className="mt-1 flex max-h-56 flex-col gap-0.5 overflow-y-auto border-l-2 border-[var(--primary)] pl-2">
                {outLinks.map((l: string) => (
                  <li key={l}>
                    <button onClick={() => setSel(l)} className="text-left text-[12px] text-[var(--muted-foreground)] hover:text-[var(--primary)]">
                      <span className="text-[var(--primary)]">↗</span> {l}
                    </button>
                  </li>
                ))}
              </ul>
              <p className="mt-3 font-mono text-[10px] uppercase tracking-wider text-[var(--success)]">
                ↙ Cited by · {inLinks.length}
                <span className="ml-1.5 normal-case tracking-normal text-[var(--muted-foreground)]">
                  authority it receives
                </span>
              </p>
              {inLinks.length ? (
                <ul className="mt-1 flex max-h-56 flex-col gap-0.5 overflow-y-auto border-l-2 border-[var(--success)] pl-2">
                  {inLinks.map((l: string) => (
                    <li key={l}>
                      <button onClick={() => setSel(l)} className="text-left text-[12px] text-[var(--muted-foreground)] hover:text-[var(--success)]">
                        <span className="text-[var(--success)]">↙</span> {l}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-[12px] text-[var(--warning)]">
                  Orphan — nothing links here. In a tiered corpus that means it
                  earns no authority from the rest of the web.
                </p>
              )}
            </>
          ) : (
            <p className="text-[var(--muted-foreground)]">
              Click a node to trace its links. Lanes are tiers; curves are internal
              citations.
            </p>
          )}
        </aside>
      </div>
      <p className="border-t border-[var(--border)] px-4 py-2.5 text-[12px] text-[var(--muted-foreground)]">
        <span className="text-[var(--success)]">green</span> published ·{" "}
        <span className="text-[var(--primary)]">orange</span> queued · grey planned.
      </p>
    </div>
  );
}

/* ── Per-section refresh ────────────────────────────────────────────────── */

/**
 * One section's cache miss, not the page's.
 *
 * A whole-page reload re-crawls the DEV network (~17s) and re-runs eslint just
 * to see a new follower count, which is why nobody would press it. Each section
 * owns its own refetch and its own "as of" stamp, so a refresh is cheap enough
 * to actually use — and every panel records WHEN its number was read, so a
 * figure copied out of here can be dated the way every published claim has to be.
 */
export function Refresh({
  onClick,
  at,
  busy,
}: {
  onClick: () => void;
  at: number | null;
  busy: boolean;
}) {
  const ago = at ? Math.round((Date.now() - at) / 1000) : null;
  return (
    <span className="flex items-center gap-2 font-mono text-[10px] normal-case tracking-normal text-[var(--muted-foreground)]">
      {at && (
        <span title={new Date(at).toISOString()}>
          {ago! < 60 ? `${ago}s ago` : `${Math.round(ago! / 60)}m ago`}
        </span>
      )}
      <button
        onClick={onClick}
        disabled={busy}
        aria-label="Refresh this section"
        className="rounded border border-[var(--border)] px-2 py-0.5 hover:border-[var(--primary)] hover:text-[var(--primary)] disabled:opacity-40"
      >
        {busy ? "…" : "↻"}
      </button>
    </span>
  );
}

/* ── Person drill-down ──────────────────────────────────────────────────── */

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function Person({
  data,
  onClose,
}: {
  data: any;
  onClose: () => void;
}) {
  const s = data?.stats ?? {};
  const maxDow = Math.max(1, ...(s.dow ?? [1]));
  return (
    <div className={`${card} p-5`}>
      <div className="flex flex-wrap items-center gap-3">
        <a
          href={data.profile}
          target="_blank"
          rel="noopener"
          className="font-mono text-[14px] text-[var(--primary)]"
        >
          @{data.username}
        </a>
        {data.cached && (
          <span className="font-mono text-[10px] text-[var(--muted-foreground)]">
            cached
          </span>
        )}
        <button
          onClick={onClose}
          className="ml-auto rounded border border-[var(--border)] px-2 py-0.5 font-mono text-[11px] text-[var(--muted-foreground)]"
        >
          close
        </button>
      </div>

      {data.error ? (
        <p className="mt-3 text-[13px] text-[var(--warning)]">{data.error}</p>
      ) : (
        <>
          {/* Classified actions first — the reason to open this at all. */}
          {!!data.actions?.length && (
            <ul className="mt-4 flex flex-col gap-2">
              {data.actions.map((a: any, i: number) => (
                <li
                  key={i}
                  className="rounded-lg border border-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_7%,transparent)] p-3 text-[13px]"
                >
                  <b className="font-mono text-[11px] uppercase tracking-wider text-[var(--primary)]">
                    {a.kind}
                  </b>
                  <span className="ml-2 text-[var(--muted-foreground)]">{a.why}</span>
                  {a.url && (
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noopener"
                      className="ml-2 text-[var(--primary)] underline"
                    >
                      open →
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4">
            <StatStrip
              cols={4}
              items={[
                { key: "posts", label: "Posts", value: s.postCount ?? null },
                {
                  key: "gap",
                  label: "Median gap",
                  value: s.medianGapDays != null ? s.medianGapDays.toFixed(1) : null,
                  unit: "d",
                },
                { key: "rx", label: "Median rx", value: s.medianReactions ?? null },
                {
                  key: "ours",
                  label: "Our sent/drafted",
                  value: `${data.ours?.sent ?? 0}/${data.ours?.drafted ?? 0}`,
                },
              ]}
            />
          </div>

          {/*
            Publish-day histogram — "they ship Tue/Thu" is actionable.
            `<RankedBarList order="given">` keeps calendar order and swaps the
            vertical bars for horizontal ones. That is a deliberate trade: the
            old bars encoded count as HEIGHT with no axis and no accessible
            value at all; each row here is a `role="meter"` with a real
            `aria-valuenow`, and a day with no posts renders the hatch rather
            than a 20%-opacity stub that reads as "a small number".
          */}
          <div className="mt-4">
            <RankedBarList
              caption="Posts by weekday"
              order="given"
              size="sm"
              max={maxDow || null}
              rows={(s.dow ?? []).map((n: number, i: number) => ({
                key: DOW[i],
                label: DOW[i],
                value: n,
              }))}
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {(s.topTags ?? []).map((t: any) => (
              <span
                key={t.tag}
                className="rounded-full border border-[var(--border)] px-2 py-0.5 font-mono text-[10px] text-[var(--muted-foreground)]"
              >
                #{t.tag} · {t.n}
              </span>
            ))}
          </div>

          <details className="mt-4">
            <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-wider text-[var(--muted-foreground)]">
              Recent posts ({data.posts?.length ?? 0})
            </summary>
            <div className="mt-2 divide-y divide-[var(--border)]">
              {(data.posts ?? []).slice(0, 12).map((p: any) => (
                <a
                  key={p.id}
                  href={p.url}
                  target="_blank"
                  rel="noopener"
                  className="flex items-center gap-3 py-2 text-[13px] hover:text-[var(--primary)]"
                >
                  <span className="font-mono text-[11px] text-[var(--muted-foreground)]">
                    {p.ageDays}d
                  </span>
                  <span className="min-w-0 flex-1 truncate">{p.title}</span>
                  <span className="font-mono text-[11px] text-[var(--muted-foreground)]">
                    {p.reactions} rx
                  </span>
                </a>
              ))}
            </div>
          </details>

          <p className="mt-3 text-[11.5px] text-[var(--muted-foreground)]">
            Their follower count is absent on purpose — Dev.to exposes followers
            only for your own account, so any number here would be invented.
          </p>
        </>
      )}
    </div>
  );
}

/* ── Trends ─────────────────────────────────────────────────────────────── */

const SERIES: { key: string; label: string; pick: (d: any) => number | null }[] = [
  { key: "followers", label: "Dev.to followers", pick: (d) => d.devto?.followers ?? null },
  { key: "views", label: "Article views", pick: (d) => d.devto?.views ?? null },
  { key: "reactions", label: "Article reactions", pick: (d) => d.devto?.reactions ?? null },
  { key: "comments", label: "Article comments", pick: (d) => d.devto?.comments ?? null },
  { key: "npmAllTime", label: "npm downloads (all-time)", pick: (d) => d.npm?.allTime ?? null },
  { key: "npmD7", label: "npm downloads (7-day)", pick: (d) => d.npm?.d7 ?? null },
  { key: "stars", label: "GitHub stars", pick: (d) => d.github?.stars ?? null },
];

/**
 * The roic.ai shape: one row per metric across time, sparkline + delta, and a
 * click promotes that row into the plot above. Density is the product — the
 * value is reading ten metrics at once, not one beautifully.
 */
export function Trends({
  data,
  metric,
  onMetric,
}: {
  data: { days: any[]; annotations?: any[]; hint?: string | null };
  metric: string;
  onMetric: (k: string) => void;
}) {
  const days = data?.days ?? [];
  const rows = useMemo(
    () =>
      SERIES.map((s) => ({
        ...s,
        points: days.map((d) => ({ t: d.day, v: s.pick(d) })),
      })),
    [days],
  );
  const active = rows.find((r) => r.key === metric) ?? rows[0];
  const pts = (active?.points ?? []).filter((p) => typeof p.v === "number");

  if (!days.length)
    return (
      <div className={`${card} p-6 text-[14px] text-[var(--muted-foreground)]`}>
        <b className="block text-[var(--foreground)]">No history yet.</b>
        {data?.hint ??
          "Run `npm run engage:snapshot` in agents/footprint. Series need days and cannot be back-filled — that is the one thing here money and compute cannot buy."}
      </div>
    );

  const W = 900, H = 200;
  const vals = pts.map((p) => p.v as number);
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = max - min || 1;
  const X = (i: number) => (pts.length > 1 ? (i / (pts.length - 1)) * W : W / 2);
  const Y = (v: number) => (max === min ? H / 2 : H - 14 - ((v - min) / span) * (H - 28));
  const line = pts.map((p, i) => `${i ? "L" : "M"}${X(i)},${Y(p.v as number)}`).join("");
  const annDays = new Set((data.annotations ?? []).map((a: any) => String(a.t).slice(0, 10)));

  return (
    <div className="flex flex-col gap-3">
      <div className={`${card} overflow-hidden`}>
        <div className="flex flex-wrap items-baseline gap-3 border-b border-[var(--border)] px-4 py-2.5">
          <span className="text-[13px] font-semibold">{active?.label}</span>
          <span className="font-mono text-[11px] text-[var(--muted-foreground)]">
            {days.length} day{days.length === 1 ? "" : "s"} of history
          </span>
        </div>
        {pts.length < 2 ? (
          <p className="p-6 text-[13px] text-[var(--muted-foreground)]">
            {pts.length} point so far. A line needs two — check back tomorrow.
          </p>
        ) : (
          <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img">
            <path d={`${line}L${X(pts.length - 1)},${H}L${X(0)},${H}Z`}
                  fill="var(--success)" opacity={0.08} />
            <path d={line} fill="none" stroke="var(--success)" strokeWidth={2} />
            {pts.map((p, i) =>
              annDays.has(String(p.t).slice(0, 10)) ? (
                <line key={i} x1={X(i)} y1={0} x2={X(i)} y2={H}
                      stroke="var(--primary)" strokeWidth={1}
                      strokeDasharray="3 3" opacity={0.6} />
              ) : null,
            )}
          </svg>
        )}
        <p className="border-t border-[var(--border)] px-4 py-2 text-[11.5px] text-[var(--muted-foreground)]">
          Dashed lines are days you took an action. Once there are weeks of
          history, this is where &quot;we did things&quot; becomes &quot;this
          produced that&quot;.
        </p>
      </div>

      <div className={`${card} overflow-x-auto`}>
        <table className="w-full text-[13px]">
          <tbody>
            {rows.map((r) => {
              const p = r.points.filter((x) => typeof x.v === "number");
              const first = p[0]?.v as number | undefined;
              const last = p[p.length - 1]?.v as number | undefined;
              const delta = first != null && last != null ? last - first : null;
              return (
                <tr key={r.key} onClick={() => onMetric(r.key)}
                    className={`cursor-pointer border-t border-[var(--border)] ${
                      metric === r.key ? "bg-[color-mix(in_srgb,var(--primary)_10%,transparent)]" : ""}`}>
                  <td className="p-2.5">{r.label}</td>
                  <td className="p-2.5 text-right font-mono tabular-nums">
                    {last?.toLocaleString() ?? "—"}
                  </td>
                  <td className={`p-2.5 text-right font-mono tabular-nums ${
                    delta == null ? "text-[var(--muted-foreground)]"
                      : delta >= 0 ? "text-[var(--success)]" : "text-[var(--primary)]"}`}>
                    {delta == null ? "—" : `${delta >= 0 ? "+" : ""}${delta.toLocaleString()}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
