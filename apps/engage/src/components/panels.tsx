"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";

const card =
  "rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)]";
const h2 =
  "border-b border-[var(--color-line)] pb-2 font-mono text-[12px] uppercase tracking-[0.12em] text-[var(--color-ink-3)]";

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

export function Skel({ rows = 4 }: { rows?: number }) {
  return (
    <div className={`${card} p-4`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton mb-2 h-8 w-full" />
      ))}
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
          className="shrink-0 text-[var(--color-ink-3)] hover:text-[var(--color-accent)]"
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
          ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-white"
          : "border-[var(--color-line)] text-[var(--color-ink-2)]"
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
      <div className={`${card} p-6 text-center text-[var(--color-ink-2)]`}>
        {/* "Nothing to do" and "you have been through everything loaded" are
            different states and used to render the same sentence — which reads
            as a bug the moment the header still shows a count. */}
        {threads.length ? (
          <>
            <b className="block text-[var(--color-good)]">
              Worked through all {threads.length}
            </b>
            <p className="mt-1 text-sm">
              Refresh to pick up replies that arrived since this page loaded.
            </p>
            <button
              onClick={onRetry}
              className="mt-3 rounded-lg border border-[var(--color-line)] px-3.5 py-2 text-[13px] text-[var(--color-ink-2)]"
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
      className={`rounded-xl border bg-[var(--color-panel)] p-6 ${focused ? "border-[var(--color-accent)]" : "border-[var(--color-line)]"}`}
    >
      <div className="flex flex-wrap items-baseline gap-2">
        <a
          href={`https://dev.to/${t.author}`}
          target="_blank"
          rel="noopener"
          className="font-mono text-[12px] text-[var(--color-accent)]"
        >
          @{t.author}
        </a>
        <span className="font-mono text-[11px] text-[var(--color-ink-3)]">
          {new Date(t.at).toLocaleDateString()}
        </span>
        <span className="truncate text-[12px] text-[var(--color-ink-3)]">
          on “{t.articleTitle}”
        </span>
      </div>
      <p className="mt-2 border-l-2 border-[var(--color-line)] pl-3 text-[14px] text-[var(--color-ink-2)]">
        {t.body}
      </p>

      {error ? (
        <p className="mt-4 rounded-lg border border-[var(--color-warn)] p-3 text-[13px] text-[var(--color-warn)]">
          Draft agent failed: {error}. Nothing was written — the agent never ran,
          which is different from it writing a bad reply. Write the reply below
          or retry.
        </p>
      ) : null}

      <textarea
        value={reply}
        onChange={(e) => setReply(e.target.value)}
        placeholder={drafting ? "Drafting…" : "No draft — write the reply here."}
        className="mt-4 min-h-40 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-ground)] p-3 text-[14.5px] leading-relaxed"
      />

      <div className="mt-4 flex flex-wrap items-center gap-2.5">
        <button
          onClick={() => onAct("done")}
          disabled={drafting || !reply.trim()}
          className="rounded-lg bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          Copy &amp; open →
        </button>
        <button
          onClick={() => onAct("skip")}
          className="rounded-lg border border-[var(--color-line)] px-4 py-2.5 text-sm text-[var(--color-ink-2)]"
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
            className="rounded-lg border border-[var(--color-line)] px-4 py-2.5 text-sm text-[var(--color-ink-2)] disabled:opacity-50"
          >
            Retry draft
          </button>
        )}
        <span className="ml-auto font-mono text-[12px] text-[var(--color-ink-3)]">
          {i + 1} of {threads.length}
        </span>
      </div>
      <p className="mt-2.5 text-[12.5px] text-[var(--color-ink-3)]">
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
  const series = useMemo(() => {
    const devto = rows
      .filter((r) => r.platform === "devto")
      .map((r) => ({
        day: String(r.observed_on),
        followers: Number(r.followers ?? 0),
        views: Number(r.total_views ?? 0),
      }))
      .sort((a, b) => a.day.localeCompare(b.day));
    return devto;
  }, [rows]);

  if (series.length < 2)
    return (
      <div className={`${card} p-6 text-[var(--color-ink-2)]`}>
        Not enough history to plot yet ({series.length} day
        {series.length === 1 ? "" : "s"}).
      </div>
    );

  const W = 900;
  const H = 160;
  const max = Math.max(...series.map((d) => d.followers));
  const min = Math.min(...series.map((d) => d.followers));
  const span = max - min || 1;
  const pt = (i: number, v: number) =>
    `${(i / (series.length - 1)) * W},${H - ((v - min) / span) * (H - 20) - 10}`;
  const path = series.map((d, i) => pt(i, d.followers)).join(" ");
  const first = series[0];
  const last = series[series.length - 1];
  const delta = last.followers - first.followers;

  return (
    <div className={`${card} overflow-hidden`}>
      <div className="flex flex-wrap items-baseline gap-4 border-b border-[var(--color-line)] px-4 py-3">
        <span className="text-2xl font-semibold tabular-nums">
          {last.followers.toLocaleString()}
        </span>
        <span
          className={`font-mono text-[13px] ${delta >= 0 ? "text-[var(--color-good)]" : "text-[var(--color-accent)]"}`}
        >
          {delta >= 0 ? "+" : ""}
          {delta} over {series.length} days
        </span>
        <span className="ml-auto font-mono text-[11px] text-[var(--color-ink-3)]">
          dev.to followers · {first.day} → {last.day}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img">
        <polyline
          points={path}
          fill="none"
          stroke="var(--color-good)"
          strokeWidth={2}
        />
      </svg>
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

  return (
    <div className={`${card} overflow-x-auto`}>
      <table className="w-full text-[13.5px]">
        <thead>
          <tr className="border-b border-[var(--color-line)] text-left font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--color-ink-3)]">
            <th className="p-3 font-medium">Rule</th>
            <th className="p-3 font-medium">Hits</th>
            <th className="p-3 font-medium">Sample</th>
          </tr>
        </thead>
        <tbody>
          {byRule.slice(0, 15).map((r) => (
            <tr
              key={r.rule}
              className="border-b border-[var(--color-line)] last:border-0"
            >
              <td className="p-3 font-mono text-[12px]">{r.rule}</td>
              <td className="p-3 tabular-nums">{r.count}</td>
              <td className="p-3 text-[var(--color-ink-2)]">{r.sample}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-[var(--color-line)] p-3 text-[12.5px] text-[var(--color-ink-3)]">
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
      <div className={`${card} p-4`}>
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
          <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--color-ink-3)]">
            us
          </span>
          <span className="text-[13.5px]">
            {o.n} articles · median <b>{o.rxMedian}</b> reactions · p90{" "}
            <b>{o.rxP90}</b> · <b>{Math.round((o.rxZeroShare ?? 0) * 100)}%</b>{" "}
            earn zero · median <b>{o.viewsMedian}</b> views
          </span>
        </div>
      </div>

      <div className={`${card} overflow-x-auto`}>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-[var(--color-line)] text-left font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--color-ink-3)]">
              <th className="p-2.5 font-medium">Tag</th>
              <th className="p-2.5 text-right font-medium">Feed depth</th>
              <th className="p-2.5 text-right font-medium">Posts/day</th>
              <th className="p-2.5 text-right font-medium">Tag zero-rate</th>
              <th className="p-2.5 text-right font-medium">Our edge</th>
            </tr>
          </thead>
          <tbody>
            {(data.tags ?? []).map((t: any) => {
              const edge = t.zeroShareEdge ?? 0;
              return (
                <tr key={t.tag} className="border-b border-[var(--color-line)] last:border-0">
                  <td className="p-2.5 font-mono text-[12px]">#{t.tag}</td>
                  <td className="p-2.5 text-right tabular-nums text-[var(--color-ink-3)]">
                    {t.oldestDays}d
                  </td>
                  <td className="p-2.5 text-right tabular-nums text-[var(--color-ink-3)]">
                    ~{t.perDay}
                  </td>
                  <td className="p-2.5 text-right tabular-nums">
                    {Math.round((t.rxZeroShare ?? 0) * 100)}%
                  </td>
                  <td
                    className={`p-2.5 text-right tabular-nums font-semibold ${
                      edge > 0 ? "text-[var(--color-good)]" : "text-[var(--color-warn)]"
                    }`}
                  >
                    {edge > 0 ? "+" : ""}
                    {Math.round(edge * 100)}pp
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="border-t border-[var(--color-line)] p-3 text-[12.5px] leading-relaxed text-[var(--color-ink-3)]">
          <b className="text-[var(--color-ink-2)]">Edge</b> = how much smaller our
          zero-reaction share is than the tag&apos;s. Positive means a larger
          fraction of our articles earn <em>something</em>. <b>Feed depth</b> is
          how far back 100 articles reaches — the window an article is visible
          in at all. It is under 6 days everywhere, which is why this baseline
          is sampled daily and can never be back-filled.
          {data.note && (
            <>
              {" "}
              <span className="text-[var(--color-warn)]">{data.note}</span>
            </>
          )}
        </p>
      </div>

      {data.drawdown?.alarm && (
        <div className="rounded-xl border border-[var(--color-warn)] p-3 text-[13px] text-[var(--color-warn)]">
          <b>Flat line — {data.drawdown.flatDays} days without follower growth.</b>{" "}
          25 such days passed unnoticed in June. Publishing is what restarts the
          wave.
        </div>
      )}

      {data.curve?.length > 0 && (
        <div className={`${card} p-3`}>
          <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-[var(--color-ink-3)]">
            Where the views actually land
          </div>
          <div className="flex flex-wrap gap-4 font-mono text-[12px]">
            {data.curve.map((c: any) => (
              <span key={c.ageBucket}>
                <span className="text-[var(--color-ink-3)]">{c.ageBucket}</span>{" "}
                <b>{c.medianDailyViews}</b>/day
                <span className="text-[var(--color-ink-3)]"> (n={c.n})</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Trends ─────────────────────────────────────────────────────────────── */

function Spark({ points, tone }: { points: { t: string; v: number }[]; tone: string }) {
  if (points.length < 2)
    return <div className="h-10 text-[11px] text-[var(--color-ink-3)]">one point</div>;
  const W = 260, H = 40;
  const vs = points.map((p) => p.v);
  const min = Math.min(...vs), max = Math.max(...vs);
  const span = max - min || 1;
  const d = points
    .map((p, i) => `${(i / (points.length - 1)) * W},${H - ((p.v - min) / span) * (H - 6) - 3}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-10 w-full" preserveAspectRatio="none" role="img">
      <polyline points={d} fill="none" stroke={tone} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

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
                ? "border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-panel)]"
                : "border-[var(--color-line)] text-[var(--color-ink-2)]"
            }`}
          >
            {g}
          </button>
        ))}
        <span className="ml-2 text-[var(--color-ink-3)]">
          {data.days} days · {data.source}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(data.metrics ?? []).map((m: any) => {
          const up = (m.change ?? 0) >= 0;
          const tone = up ? "var(--color-good)" : "var(--color-accent)";
          return (
            <div key={m.key} className={`${card} p-3`}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--color-ink-3)]">
                  {m.label}
                </span>
                <span className="text-[17px] font-semibold tabular-nums">
                  {m.last?.toLocaleString() ?? "—"}
                </span>
              </div>
              <Spark points={m.points} tone={tone} />
              <div className="flex justify-between font-mono text-[11px]">
                <span style={{ color: tone }}>
                  {m.change == null ? "—" : `${up ? "+" : ""}${m.change.toLocaleString()}`}
                  {m.pct != null && ` (${m.pct > 0 ? "+" : ""}${m.pct}%)`}
                </span>
                <span className="text-[var(--color-ink-3)]">
                  last {grain}:{" "}
                  {m.lastChange == null
                    ? "—"
                    : `${m.lastChange > 0 ? "+" : ""}${m.lastChange}`}
                </span>
              </div>
            </div>
          );
        })}
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
      <div className={`${card} p-4 text-[13px] text-[var(--color-ink-2)]`}>
        Roster unavailable — the DEV organisation endpoint did not answer.
      </div>
    );
  const shown = all ? roster : roster.slice(0, 12);
  return (
    <div className={card}>
      <div className="flex items-center justify-between border-b border-[var(--color-line)] px-3 py-2 font-mono text-[11px] text-[var(--color-ink-3)]">
        <span>{roster.length} people in the googleai org</span>
        <button onClick={() => setAll((v) => !v)} className="border border-[var(--color-line)] px-2 py-0.5">
          {all ? "top 12" : `all ${roster.length}`}
        </button>
      </div>
      <div className="divide-y divide-[var(--color-line)]">
        {shown.map((m) => (
          <div key={m.username} className="flex flex-wrap items-center gap-2.5 p-2.5">
            <span
              className={`rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase ${
                m.rank <= 2
                  ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                  : "border-[var(--color-line)] text-[var(--color-ink-3)]"
              }`}
            >
              {m.role}
            </span>
            <a
              href={`https://dev.to/${m.username}`}
              target="_blank"
              rel="noopener"
              className="font-mono text-[12px] text-[var(--color-accent)]"
            >
              @{m.username}
            </a>
            <span className="text-[12.5px] text-[var(--color-ink-2)]">{m.name}</span>
            <span className="min-w-0 flex-1 truncate text-[12px] text-[var(--color-ink-3)]">
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
      <div className={`${card} p-5 text-[13.5px] text-[var(--color-ink-2)]`}>
        <p className="mb-2 font-mono text-[11px] uppercase tracking-wider text-[var(--color-ink-3)]">
          Not yet answerable
        </p>
        <p className="max-w-[70ch]">{data.blocked}</p>
        <p className="mt-2 font-mono text-[11.5px] text-[var(--color-ink-3)]">
          {data.days} day(s) recorded · {data.actions} logged actions
        </p>
      </div>
    );
  return (
    <div className={card}>
      <table className="w-full text-[13.5px]">
        <thead>
          <tr className="border-b border-[var(--color-line)] text-left font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--color-ink-3)]">
            <th className="p-3 font-medium">Metric delta</th>
            <th className="p-3 font-medium">Lag</th>
            <th className="p-3 text-right font-medium">r</th>
            <th className="p-3 text-right font-medium">n</th>
          </tr>
        </thead>
        <tbody>
          {data.results.map((r: any) => (
            <tr key={`${r.metric}-${r.lag}`} className="border-b border-[var(--color-line)] last:border-0">
              <td className="p-3">{r.metric}</td>
              <td className="p-3 font-mono text-[12px] text-[var(--color-ink-3)]">
                {r.lag === 0 ? "same day" : `+${r.lag}d`}
              </td>
              <td
                className={`p-3 text-right tabular-nums ${
                  Math.abs(r.r) >= 0.5 ? "text-[var(--color-good)]" : ""
                }`}
              >
                {r.r > 0 ? "+" : ""}
                {r.r}
              </td>
              <td className="p-3 text-right tabular-nums text-[var(--color-ink-3)]">{r.n}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-[var(--color-line)] p-3 text-[12.5px] text-[var(--color-ink-3)]">
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
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-line)] px-3 py-2.5 font-mono text-[11px] text-[var(--color-ink-3)]">
        <span>
          {plugins.length} packages · {num(totalWeekly)}/wk combined
        </span>
        <span className="flex items-center gap-1.5">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="filter…"
            className="w-24 rounded border border-[var(--color-line)] bg-[var(--color-ground)] px-1.5 py-0.5 font-mono text-[11px]"
          />
          {SORTS.map((s) => (
            <button
              key={s.key}
              onClick={() => setSort(s.key)}
              className={`border px-1.5 py-0.5 ${
                sort === s.key
                  ? "border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-panel)]"
                  : "border-[var(--color-line)]"
              }`}
            >
              {s.label}
            </button>
          ))}
        </span>
      </div>

      <div className="max-h-[520px] overflow-auto">
        <table className="w-full text-[13px]">
          <thead className="sticky top-0 bg-[var(--color-panel)]">
            <tr className="border-b border-[var(--color-line)] text-left font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--color-ink-3)]">
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
                    className={`cursor-pointer border-b border-[var(--color-line)] last:border-0 ${
                      open ? "bg-[var(--color-ground)]" : ""
                    }`}
                  >
                    <td className="p-2.5">
                      <span className="font-mono text-[12px]">
                        {p.name.replace(/^eslint-plugin-/, "")}
                      </span>
                      {p.deprecated && (
                        <span className="ml-1.5 font-mono text-[10px] uppercase text-[var(--color-warn)]">
                          deprecated
                        </span>
                      )}
                      {!p.published && (
                        <span className="ml-1.5 font-mono text-[10px] uppercase text-[var(--color-ink-3)]">
                          unpublished
                        </span>
                      )}
                    </td>
                    <td className="p-2.5 text-right tabular-nums">
                      {num(p.weeklyDownloads)}
                    </td>
                    <td className="p-2.5 text-right tabular-nums text-[var(--color-ink-3)]">
                      {num(p.rules)}
                    </td>
                    <td className="p-2.5 text-right tabular-nums">
                      {p.coveragePct == null ? (
                        "—"
                      ) : (
                        <span
                          className={
                            p.coveragePct >= 100
                              ? "text-[var(--color-good)]"
                              : p.coveragePct >= 80
                                ? ""
                                : "text-[var(--color-warn)]"
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
                            className="rounded border border-[var(--color-line)] px-1.5 py-0.5 text-[var(--color-ink-2)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
                          >
                            {label}
                          </a>
                        ))}
                      </span>
                    </td>
                  </tr>
                  {open && (
                    <tr className="border-b border-[var(--color-line)]">
                      <td colSpan={5} className="bg-[var(--color-ground)] p-3">
                        <p className="mb-2 max-w-[76ch] text-[13px] text-[var(--color-ink-2)]">
                          {p.description ?? "No description recorded."}
                        </p>
                        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 font-mono text-[11.5px] text-[var(--color-ink-2)] sm:grid-cols-4">
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
                              <dt className="text-[var(--color-ink-3)]">{k}</dt>
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
                          className="mt-3 rounded border border-[var(--color-line)] px-2 py-1 font-mono text-[10px] uppercase hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
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
    merged: "text-[var(--color-good)] border-[var(--color-good)]",
    open: "text-[var(--color-warn)] border-[var(--color-warn)]",
    closed: "text-[var(--color-ink-3)] border-[var(--color-line)]",
  };
  return (
    <div className={`${card} divide-y divide-[var(--color-line)]`}>
      {prs.slice(0, 12).map((p) => (
        <a
          key={p.url}
          href={p.url}
          target="_blank"
          rel="noopener"
          className="flex flex-wrap items-center gap-3 p-3 hover:bg-[color-mix(in_srgb,var(--color-ink)_4%,transparent)]"
        >
          <span
            className={`rounded border px-2 py-0.5 font-mono text-[10px] uppercase ${tone[p.state] ?? tone.closed}`}
          >
            {p.state}
          </span>
          <span className="font-mono text-[12px] text-[var(--color-ink-3)]">
            {p.repo}
          </span>
          <span className="min-w-0 flex-1 truncate text-[13.5px]">{p.title}</span>
        </a>
      ))}
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
  const tint = {
    good: "text-[var(--color-ok,#3fb950)]",
    "needs-improvement": "text-[var(--color-warn,#d29922)]",
    poor: "text-[var(--color-bad,#f85149)]",
  } as const;

  // ms for LCP/INP, unitless-to-3dp for CLS — showing CLS as "0ms" was the
  // first thing that made this table look broken.
  const ms = (v: number | null) => (v === null ? "—" : `${Math.round(v)}ms`);
  const cls = (v: number | null) => (v === null ? "—" : v.toFixed(3));

  return (
    <div className={`${card} overflow-x-auto`}>
      {vitals.error ? (
        <p className="p-3 text-[13px] text-[var(--color-ink-3)]">
          Web vitals unavailable — {vitals.error}
        </p>
      ) : (
        <table className="w-full text-[13.5px]">
          <thead>
            <tr className="border-b border-[var(--color-line)] text-left font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--color-ink-3)]">
              <th className="p-3 font-medium">App</th>
              <th className="p-3 font-medium">p75 LCP</th>
              <th className="p-3 font-medium">p75 INP</th>
              <th className="p-3 font-medium">p75 CLS</th>
              <th className="p-3 font-medium">Samples</th>
            </tr>
          </thead>
          <tbody>
            {vitals.rows.map((r) => (
              <tr
                key={r.app}
                className="border-b border-[var(--color-line)] last:border-0"
              >
                <td className={`p-3 font-mono text-[12px] ${tint[r.verdict]}`}>
                  {r.app}
                </td>
                <td className="p-3 tabular-nums">{ms(r.lcp)}</td>
                <td className="p-3 tabular-nums">{ms(r.inp)}</td>
                <td className="p-3 tabular-nums">{cls(r.cls)}</td>
                <td className="p-3 tabular-nums text-[var(--color-ink-3)]">
                  {r.samples}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="border-t border-[var(--color-line)]">
        {errors.error ? (
          <p className="p-3 text-[13px] text-[var(--color-ink-3)]">
            Errors unavailable — {errors.error}
          </p>
        ) : errors.rows.length === 0 ? (
          <p className="p-3 text-[13px] text-[var(--color-ink-3)]">
            No exceptions in the last 30 days.
          </p>
        ) : (
          <table className="w-full text-[13.5px]">
            <thead>
              <tr className="border-b border-[var(--color-line)] text-left font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--color-ink-3)]">
                <th className="p-3 font-medium">App</th>
                <th className="p-3 font-medium">People</th>
                <th className="p-3 font-medium">Hits</th>
                <th className="p-3 font-medium">Exception</th>
              </tr>
            </thead>
            <tbody>
              {errors.rows.slice(0, 10).map((e, i) => (
                <tr
                  key={`${e.app}:${e.message}:${i}`}
                  className="border-b border-[var(--color-line)] last:border-0"
                >
                  <td className="p-3 font-mono text-[12px]">{e.app}</td>
                  <td className="p-3 tabular-nums">{e.users}</td>
                  <td className="p-3 tabular-nums text-[var(--color-ink-3)]">
                    {e.count}
                  </td>
                  <td className="p-3 text-[var(--color-ink-2)]">{e.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="border-t border-[var(--color-line)] p-3 text-[12.5px] text-[var(--color-ink-3)]">
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
    <div className={`${card} divide-y divide-[var(--color-line)]`}>
      {people.map((p) => (
        <div key={p.username} className="flex flex-wrap items-center gap-3 p-3">
          <a href={`https://dev.to/${p.username}`} target="_blank" rel="noopener"
             className="font-mono text-[12.5px] text-[var(--color-accent)]">@{p.username}</a>
          <span className="rounded border border-[var(--color-line)] px-1.5 py-0.5 font-mono text-[10px] uppercase text-[var(--color-ink-3)]">
            {p.cohort}
          </span>
          {!p.verified && (
            <span className="font-mono text-[10px] text-[var(--color-warn)]" title="Membership not confirmed — verify before acting">
              unverified
            </span>
          )}
          {p.latest ? (
            <>
              <a href={p.latest.url} target="_blank" rel="noopener"
                 className="min-w-0 flex-1 truncate text-[13px]">{p.latest.title}</a>
              <span className="font-mono text-[11px] text-[var(--color-ink-3)]">
                {p.latest.ageDays}d · {p.latest.reactions} rx
              </span>
              {p.latest.reactable && (
                <a href={p.latest.url} target="_blank" rel="noopener"
                   className="rounded-md bg-[var(--color-good)] px-2.5 py-1 font-mono text-[10px] uppercase text-white"
                   title="Inside the 7-day window where reacting can bank a x1.5 reputation multiplier if they take Top 7">
                  react now
                </a>
              )}
            </>
          ) : (
            <span className="flex-1 text-[12.5px] text-[var(--color-ink-3)]">no recent article found</span>
          )}
        </div>
      ))}
      <p className="p-3 text-[12.5px] text-[var(--color-ink-3)]">
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
    <div className="flex flex-wrap items-center gap-3 p-3 hover:bg-[color-mix(in_srgb,var(--color-ink)_4%,transparent)]">
      <span className={`rounded border px-2 py-0.5 font-mono text-[10px] uppercase ${
        act ? "border-[var(--color-accent)] text-[var(--color-accent)]"
            : "border-[var(--color-line)] text-[var(--color-ink-3)]"}`}>
        {act ? "you" : "them"}
      </span>
      <a href={p.url} target="_blank" rel="noopener"
         className="font-mono text-[11.5px] text-[var(--color-ink-3)] hover:text-[var(--color-accent)]">
        {p.repo}#{p.number}
      </a>
      <a href={p.url} target="_blank" rel="noopener"
         className="min-w-0 flex-1 truncate text-[13.5px] hover:text-[var(--color-accent)]">
        {p.title}
      </a>
      <span className="font-mono text-[11px] text-[var(--color-ink-2)]">{p.reason}</span>
      {act && (
        <button
          onClick={() => spawn(p)}
          title="Open a Claude session in the right repo, prompt pre-filled"
          className="rounded border border-[var(--color-accent)] px-2 py-0.5 font-mono text-[10px] uppercase text-[var(--color-accent)]"
        >
          {spawned[p.url] ?? "fix it"}
        </button>
      )}
    </div>
  );

  return (
    <div className={card}>
      <div className="border-b border-[var(--color-line)] px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-[var(--color-accent)]">
        Action required · {mine.length}
      </div>
      <div className="divide-y divide-[var(--color-line)]">
        {mine.length ? mine.map((p) => <Row key={p.url} p={p} act />)
          : <p className="p-3 text-[13px] text-[var(--color-ink-3)]">Nothing blocked on you.</p>}
      </div>
      <div className="border-y border-[var(--color-line)] px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-[var(--color-ink-3)]">
        Waiting on maintainers · {theirs.length}
      </div>
      <div className="divide-y divide-[var(--color-line)]">
        {theirs.slice(0, 10).map((p) => <Row key={p.url} p={p} act={false} />)}
      </div>
    </div>
  );
}

/* ── Ecosystem ──────────────────────────────────────────────────────────── */

export function Ecosystem({ totals }: { totals: Record<string, any> | null }) {
  if (!totals) return <div className={`${card} p-6 text-[var(--color-ink-2)]`}>No ecosystem snapshot.</div>;
  const cells: [string, any][] = [
    ["Plugins", totals.total_plugins],
    ["Rules", totals.total_rules],
    ["npm total", totals.total_npm_downloads?.toLocaleString?.() ?? totals.total_npm_downloads],
    ["npm / day", totals.daily_npm_downloads?.toLocaleString?.() ?? totals.daily_npm_downloads],
    ["Test cov", totals.test_coverage != null ? `${totals.test_coverage}%` : null],
  ];
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-line)] sm:grid-cols-5">
      {cells.map(([k, v]) => (
        <div key={k} className="bg-[var(--color-panel)] p-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--color-ink-3)]">{k}</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{v ?? "—"}</div>
        </div>
      ))}
    </div>
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
    s === "ready" ? "var(--color-accent)"
      : String(s).startsWith("publish") || String(s).startsWith("retrofit") ? "var(--color-good)"
      : "var(--color-ink-3)";

  return (
    <div className={`${card} overflow-hidden`}>
      <div className="border-b border-[var(--color-line)] px-4 py-2.5 font-mono text-[11px] text-[var(--color-ink-3)]">
        {nodes.length} articles · {edges.length} internal links · lanes are tiers
      </div>
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_270px]">
        <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img"
             aria-label="Article link web by tier">
          {lanes.map((t, li) => {
            const y = 40 + (li / Math.max(1, lanes.length - 1)) * (H - 80);
            return (
              <g key={t}>
                <line x1={20} y1={y} x2={W - 20} y2={y} stroke="var(--color-line)" strokeWidth={1} />
                <text x={4} y={y - 6} className="fill-[var(--color-ink-3)]"
                      style={{ fontSize: 9, fontFamily: "monospace" }}>{t}</text>
              </g>
            );
          })}
          {edges.map((e, i) => {
            const lit = sel && (e.from === sel || e.to === sel);
            return (
              <path key={i}
                    d={`M${e.x1},${e.y1} C${e.x1},${(e.y1 + e.y2) / 2} ${e.x2},${(e.y1 + e.y2) / 2} ${e.x2},${e.y2}`}
                    fill="none"
                    stroke={lit ? "var(--color-accent)" : "var(--color-ink-3)"}
                    strokeWidth={lit ? 1.4 : 0.5}
                    opacity={sel ? (lit ? 0.9 : 0.04) : 0.16} />
            );
          })}
          {[...pos.entries()].map(([slug, p]) => {
            const dim = sel && slug !== sel && !related.has(slug);
            return (
              <circle key={slug} cx={p.x} cy={p.y} r={slug === sel ? 5.5 : 3.4}
                      fill={color(p.status)} stroke="var(--color-panel)" strokeWidth={1}
                      opacity={dim ? 0.15 : 1} className="cursor-pointer"
                      onClick={() => setSel(slug === sel ? null : slug)}>
                <title>{slug} · {p.tier} · {p.status}</title>
              </circle>
            );
          })}
        </svg>

        <aside className="border-t border-[var(--color-line)] p-4 text-[13px] md:border-l md:border-t-0">
          {node ? (
            <>
              <div className="font-semibold leading-snug">{node.title ?? node.slug}</div>
              <div className="mt-1 font-mono text-[10.5px] text-[var(--color-ink-3)]">{node.slug}</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="rounded border border-[var(--color-line)] px-1.5 py-0.5 font-mono text-[10px]">{node.tier}</span>
                <span className="rounded border border-[var(--color-line)] px-1.5 py-0.5 font-mono text-[10px]">{node.status}</span>
                {node.domain && <span className="rounded border border-[var(--color-line)] px-1.5 py-0.5 font-mono text-[10px]">{node.domain}</span>}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <a href={`https://ofriperetz.dev/articles/${node.slug}`} target="_blank" rel="noopener"
                   className="rounded-md border border-[var(--color-accent)] px-2 py-1 font-mono text-[10px] uppercase text-[var(--color-accent)]">
                  live →
                </a>
                <a href={`https://github.com/ofri-peretz/blog/blob/main/apps/blog/content/articles/${node.slug}.md`}
                   target="_blank" rel="noopener"
                   className="rounded-md border border-[var(--color-line)] px-2 py-1 font-mono text-[10px] uppercase text-[var(--color-ink-2)]">
                  source →
                </a>
              </div>
              <p className="mt-3 font-mono text-[10px] uppercase tracking-wider text-[var(--color-ink-3)]">
                Links out · {outLinks.length}
              </p>
              <ul className="mt-1 flex flex-col gap-0.5">
                {outLinks.slice(0, 8).map((l: string) => (
                  <li key={l}>
                    <button onClick={() => setSel(l)} className="text-left text-[12px] text-[var(--color-ink-2)] hover:text-[var(--color-accent)]">
                      → {l}
                    </button>
                  </li>
                ))}
              </ul>
              <p className="mt-3 font-mono text-[10px] uppercase tracking-wider text-[var(--color-ink-3)]">
                Cited by · {inLinks.length}
              </p>
              {inLinks.length ? (
                <ul className="mt-1 flex flex-col gap-0.5">
                  {inLinks.slice(0, 8).map((l: string) => (
                    <li key={l}>
                      <button onClick={() => setSel(l)} className="text-left text-[12px] text-[var(--color-ink-2)] hover:text-[var(--color-accent)]">
                        ← {l}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-[12px] text-[var(--color-warn)]">
                  Orphan — nothing links here. In a tiered corpus that means it
                  earns no authority from the rest of the web.
                </p>
              )}
            </>
          ) : (
            <p className="text-[var(--color-ink-3)]">
              Click a node to trace its links. Lanes are tiers; curves are internal
              citations.
            </p>
          )}
        </aside>
      </div>
      <p className="border-t border-[var(--color-line)] px-4 py-2.5 text-[12px] text-[var(--color-ink-3)]">
        <span className="text-[var(--color-good)]">green</span> published ·{" "}
        <span className="text-[var(--color-accent)]">orange</span> queued · grey planned.
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
    <span className="flex items-center gap-2 font-mono text-[10px] normal-case tracking-normal text-[var(--color-ink-3)]">
      {at && (
        <span title={new Date(at).toISOString()}>
          {ago! < 60 ? `${ago}s ago` : `${Math.round(ago! / 60)}m ago`}
        </span>
      )}
      <button
        onClick={onClick}
        disabled={busy}
        aria-label="Refresh this section"
        className="rounded border border-[var(--color-line)] px-2 py-0.5 hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] disabled:opacity-40"
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
          className="font-mono text-[14px] text-[var(--color-accent)]"
        >
          @{data.username}
        </a>
        {data.cached && (
          <span className="font-mono text-[10px] text-[var(--color-ink-3)]">
            cached
          </span>
        )}
        <button
          onClick={onClose}
          className="ml-auto rounded border border-[var(--color-line)] px-2 py-0.5 font-mono text-[11px] text-[var(--color-ink-3)]"
        >
          close
        </button>
      </div>

      {data.error ? (
        <p className="mt-3 text-[13px] text-[var(--color-warn)]">{data.error}</p>
      ) : (
        <>
          {/* Classified actions first — the reason to open this at all. */}
          {!!data.actions?.length && (
            <ul className="mt-4 flex flex-col gap-2">
              {data.actions.map((a: any, i: number) => (
                <li
                  key={i}
                  className="rounded-lg border border-[var(--color-accent)] bg-[color-mix(in_srgb,var(--color-accent)_7%,transparent)] p-3 text-[13px]"
                >
                  <b className="font-mono text-[11px] uppercase tracking-wider text-[var(--color-accent)]">
                    {a.kind}
                  </b>
                  <span className="ml-2 text-[var(--color-ink-2)]">{a.why}</span>
                  {a.url && (
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noopener"
                      className="ml-2 text-[var(--color-accent)] underline"
                    >
                      open →
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-[var(--color-line)] bg-[var(--color-line)] sm:grid-cols-4">
            {[
              ["Posts", s.postCount],
              ["Median gap", s.medianGapDays != null ? `${s.medianGapDays.toFixed(1)}d` : "—"],
              ["Median rx", s.medianReactions],
              ["Our sent/drafted", `${data.ours?.sent ?? 0}/${data.ours?.drafted ?? 0}`],
            ].map(([k, v]) => (
              <div key={String(k)} className="bg-[var(--color-panel)] p-3">
                <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-ink-3)]">
                  {k}
                </div>
                <div className="mt-0.5 text-lg font-semibold tabular-nums">{String(v)}</div>
              </div>
            ))}
          </div>

          {/* Publish-day histogram — "they ship Tue/Thu" is actionable. */}
          <div className="mt-4 flex items-end gap-1.5">
            {(s.dow ?? []).map((n: number, i: number) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-sm bg-[var(--color-good)]"
                  style={{ height: `${8 + (n / maxDow) * 44}px`, opacity: n ? 1 : 0.2 }}
                  title={`${n} post(s)`}
                />
                <span className="font-mono text-[9px] text-[var(--color-ink-3)]">
                  {DOW[i]}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {(s.topTags ?? []).map((t: any) => (
              <span
                key={t.tag}
                className="rounded-full border border-[var(--color-line)] px-2 py-0.5 font-mono text-[10px] text-[var(--color-ink-2)]"
              >
                #{t.tag} · {t.n}
              </span>
            ))}
          </div>

          <details className="mt-4">
            <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-wider text-[var(--color-ink-3)]">
              Recent posts ({data.posts?.length ?? 0})
            </summary>
            <div className="mt-2 divide-y divide-[var(--color-line)]">
              {(data.posts ?? []).slice(0, 12).map((p: any) => (
                <a
                  key={p.id}
                  href={p.url}
                  target="_blank"
                  rel="noopener"
                  className="flex items-center gap-3 py-2 text-[13px] hover:text-[var(--color-accent)]"
                >
                  <span className="font-mono text-[11px] text-[var(--color-ink-3)]">
                    {p.ageDays}d
                  </span>
                  <span className="min-w-0 flex-1 truncate">{p.title}</span>
                  <span className="font-mono text-[11px] text-[var(--color-ink-2)]">
                    {p.reactions} rx
                  </span>
                </a>
              ))}
            </div>
          </details>

          <p className="mt-3 text-[11.5px] text-[var(--color-ink-3)]">
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
      <div className={`${card} p-6 text-[14px] text-[var(--color-ink-2)]`}>
        <b className="block text-[var(--color-ink)]">No history yet.</b>
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
        <div className="flex flex-wrap items-baseline gap-3 border-b border-[var(--color-line)] px-4 py-2.5">
          <span className="text-[13px] font-semibold">{active?.label}</span>
          <span className="font-mono text-[11px] text-[var(--color-ink-3)]">
            {days.length} day{days.length === 1 ? "" : "s"} of history
          </span>
        </div>
        {pts.length < 2 ? (
          <p className="p-6 text-[13px] text-[var(--color-ink-2)]">
            {pts.length} point so far. A line needs two — check back tomorrow.
          </p>
        ) : (
          <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img">
            <path d={`${line}L${X(pts.length - 1)},${H}L${X(0)},${H}Z`}
                  fill="var(--color-good)" opacity={0.08} />
            <path d={line} fill="none" stroke="var(--color-good)" strokeWidth={2} />
            {pts.map((p, i) =>
              annDays.has(String(p.t).slice(0, 10)) ? (
                <line key={i} x1={X(i)} y1={0} x2={X(i)} y2={H}
                      stroke="var(--color-accent)" strokeWidth={1}
                      strokeDasharray="3 3" opacity={0.6} />
              ) : null,
            )}
          </svg>
        )}
        <p className="border-t border-[var(--color-line)] px-4 py-2 text-[11.5px] text-[var(--color-ink-3)]">
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
                    className={`cursor-pointer border-t border-[var(--color-line)] ${
                      metric === r.key ? "bg-[color-mix(in_srgb,var(--color-accent)_10%,transparent)]" : ""}`}>
                  <td className="p-2.5">{r.label}</td>
                  <td className="p-2.5 text-right font-mono tabular-nums">
                    {last?.toLocaleString() ?? "—"}
                  </td>
                  <td className={`p-2.5 text-right font-mono tabular-nums ${
                    delta == null ? "text-[var(--color-ink-3)]"
                      : delta >= 0 ? "text-[var(--color-good)]" : "text-[var(--color-accent)]"}`}>
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
