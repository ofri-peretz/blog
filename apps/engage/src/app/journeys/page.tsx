"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { cachedFetch } from "@/lib/client-cache";

const APP_TONE: Record<string, string> = {
  eslint_docs: "var(--color-accent)",
  blog: "var(--color-good)",
  ds: "var(--color-warn)",
};

function fmt(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h${m % 60}m`;
}

/**
 * Who came, where from, and what they actually read.
 *
 * The reason this page exists rather than another chart: aggregates say "the
 * docs homepage got 68 views", which cannot tell you whether that was 68 people
 * glancing or one person reading. A path can. The single most useful row here so
 * far was one visitor from npm reading ten rule pages over five minutes — a
 * fact no bar chart would ever have shown.
 *
 * Bounces are counted, never hidden. 90% of sessions are one page, and a page
 * that quietly dropped them would make every other number look better than it is.
 */
export default function Journeys() {
  const [d, setD] = useState<any>(null);
  const [days, setDays] = useState(30);
  const [app, setApp] = useState<string>("all");

  useEffect(() => {
    setD(null);
    // Reset the property filter with the window. A property present in 30 days
    // may have no sessions in 7, and a filter that silently survives leaves you
    // staring at an empty list with no clue why.
    setApp("all");
    cachedFetch(`journeys:${days}`, `/api/journeys?days=${days}`)
      .then(setD)
      .catch(() => setD({ error: "unreachable", sessions: [] }));
  }, [days]);

  const apps = useMemo(
    () => [...new Set((d?.sessions ?? []).map((s: any) => s.app))] as string[],
    [d],
  );
  const rows = useMemo(
    () =>
      (d?.sessions ?? []).filter((s: any) => app === "all" || s.app === app),
    [d, app],
  );

  const s = d?.summary ?? {};

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 pb-24">
      <header className="flex flex-col gap-1">
        <Link
          href="/"
          className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--color-ink-3)] hover:text-[var(--color-accent)]"
        >
          ← control room
        </Link>
        <h1 className="text-[28px] font-semibold tracking-tight">Journeys</h1>
        <p className="max-w-[74ch] text-[14px] text-[var(--color-ink-2)]">
          Individual sessions as ordered paths. Aggregates cannot tell you
          whether 68 views were 68 glances or one person reading — a path can.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
        {[7, 14, 30].map((n) => (
          <button
            key={n}
            onClick={() => setDays(n)}
            className={`border px-2 py-0.5 ${
              days === n
                ? "border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-panel)]"
                : "border-[var(--color-line)] text-[var(--color-ink-2)]"
            }`}
          >
            {n}d
          </button>
        ))}
        <span className="mx-1 text-[var(--color-line)]">|</span>
        {["all", ...apps].map((a) => (
          <button
            key={a}
            onClick={() => setApp(a)}
            className={`border px-2 py-0.5 ${
              app === a
                ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                : "border-[var(--color-line)] text-[var(--color-ink-2)]"
            }`}
          >
            {a}
          </button>
        ))}
      </div>

      {!d ? (
        <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] p-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton mb-2 h-7 w-full" />
          ))}
        </div>
      ) : d.error ? (
        <p className="text-[13px] text-[var(--color-warn)]">{d.error}</p>
      ) : (
        <>
          {/* These four come from a server-side aggregate over EVERY session.
              The property filter below only narrows the LIST, so with a filter
              active the two describe different populations — exactly the
              denominator mismatch that made this endpoint report "0 bounced".
              Label it rather than letting the numbers imply a scope they do
              not have. */}
          {app !== "all" && (
            <p className="-mb-1 font-mono text-[11px] text-[var(--color-warn)]">
              Totals below cover <b>all properties</b>; the session list is
              filtered to <b>{app}</b>.
            </p>
          )}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["sessions", s.sessions],
              ["read more than one page", s.multiStep],
              [
                "bounced",
                s.bounceRate != null ? `${Math.round(s.bounceRate * 100)}%` : "—",
              ],
              [
                "median time (multi-page)",
                s.medianSeconds != null ? fmt(s.medianSeconds) : "—",
              ],
            ].map(([label, v]) => (
              <div
                key={String(label)}
                className="rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] p-4"
              >
                <div className="text-2xl font-semibold tabular-nums">
                  {v ?? "—"}
                </div>
                <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-ink-3)]">
                  {label}
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <section className="flex flex-col gap-2">
              <h2 className="border-b border-[var(--color-line)] pb-2 font-mono text-[12px] uppercase tracking-[0.12em] text-[var(--color-ink-3)]">
                Where they come from
              </h2>
              {(d.referrers ?? []).map((r: any) => (
                <div
                  key={r.source}
                  className="flex items-center justify-between gap-3 text-[13px]"
                >
                  <span className="truncate font-mono text-[12px]">
                    {r.source === "$direct" ? "direct / unknown" : r.source}
                  </span>
                  <span className="tabular-nums text-[var(--color-ink-3)]">
                    {r.n}
                  </span>
                </div>
              ))}
              <p className="mt-1 text-[12px] text-[var(--color-ink-3)]">
                Scope differs from &ldquo;doors&rdquo; on purpose: referrers are
                counted over the <b>deep sessions listed below</b> (a one-page
                bounce&apos;s referrer says little about intent), while doors are a
                server-side aggregate over <b>every</b> session.
              </p>
            </section>

            <section className="flex flex-col gap-2">
              <h2 className="border-b border-[var(--color-line)] pb-2 font-mono text-[12px] uppercase tracking-[0.12em] text-[var(--color-ink-3)]">
                The doors people come through
              </h2>
              {(d.doors ?? []).slice(0, 10).map((x: any) => (
                <div
                  key={`${x.app}${x.landing}`}
                  className="flex items-center justify-between gap-3 text-[13px]"
                >
                  <span className="min-w-0 truncate">
                    <span
                      className="mr-1.5 font-mono text-[10px] uppercase"
                      style={{ color: APP_TONE[x.app] ?? "var(--color-ink-3)" }}
                    >
                      {x.app}
                    </span>
                    <span className="font-mono text-[11.5px] text-[var(--color-ink-2)]">
                      {x.landing || "/"}
                    </span>
                  </span>
                  <span className="tabular-nums text-[var(--color-ink-3)]">
                    {x.n}
                  </span>
                </div>
              ))}
            </section>
          </div>

          <section className="flex flex-col gap-3">
            <h2 className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--color-line)] pb-2 font-mono text-[12px] uppercase tracking-[0.12em] text-[var(--color-ink-3)]">
              <span>Deepest sessions · {rows.length}</span>
              {d.note && (
                <span className="normal-case tracking-normal text-[var(--color-ink-3)]">
                  {d.note}
                </span>
              )}
            </h2>
            <div className="flex flex-col gap-2">
              {rows.map((x: any) => (
                <div
                  key={x.sid + x.started}
                  className="rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] p-3"
                >
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono text-[11px] text-[var(--color-ink-3)]">
                    <span
                      className="uppercase"
                      style={{ color: APP_TONE[x.app] ?? "var(--color-ink-3)" }}
                    >
                      {x.app}
                    </span>
                    <span className="text-[var(--color-ink-2)]">
                      {x.steps} pages · {fmt(x.seconds)}
                    </span>
                    <span>{x.country}</span>
                    <span>{x.device}</span>
                    <span className="truncate">
                      via{" "}
                      {x.referrer === "$direct" ? "direct" : x.referrer}
                    </span>
                    <span className="ml-auto">
                      {new Date(x.started).toLocaleDateString()}
                    </span>
                  </div>
                  {/* The path is the point. Steps are separated so a long one
                      wraps into readable chunks rather than one wide line the
                      page has to scroll sideways for. */}
                  <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1">
                    {x.path.split(" → ").map((step: string, i: number) => (
                      <span key={i} className="flex items-center gap-1.5">
                        {i > 0 && (
                          <span className="text-[var(--color-ink-3)]">→</span>
                        )}
                        <span className="rounded bg-[var(--color-ground)] px-1.5 py-0.5 font-mono text-[11.5px] text-[var(--color-ink-2)]">
                          {step}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
