"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCachedSection } from "@/lib/client-cache";
import { Refresh } from "@/components/panels";

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Colour a measured lift, but only once the cell has enough samples. */
function liftTone(lift: number | null, trusted: boolean) {
  if (lift == null || !trusted) return "text-[var(--color-ink-3)]";
  if (lift >= 2) return "text-[var(--color-good)]";
  if (lift < 0.8) return "text-[var(--color-warn)]";
  return "text-[var(--color-ink-2)]";
}

function Bar({ lift, trusted }: { lift: number | null; trusted: boolean }) {
  const pct = lift == null ? 0 : Math.min(100, (lift / 4) * 100);
  return (
    <div className="h-1.5 w-full rounded bg-[var(--color-line)]">
      <div
        className="h-1.5 rounded"
        style={{
          width: `${pct}%`,
          background: trusted
            ? "var(--color-good)"
            : "var(--color-ink-3)",
          opacity: trusted ? 1 : 0.45,
        }}
      />
    </div>
  );
}

/**
 * The publishing calendar, and whether the schedule is aimed at the right slots.
 *
 * Every number here is measured from our own articles, age-normalised, median,
 * solo publishes only. Cells that have not earned a sample size are drawn
 * greyed rather than hidden — an empty cell is a real answer ("we have never
 * tried this slot"), and hiding it would make the grid look more decided than
 * the evidence is.
 */
export default function Calendar() {
  const { data: d, at, busy, refresh } = useCachedSection<any>(
    "schedule",
    "/api/schedule",
    () => ({ error: "unreachable" }),
  );

  if (!d)
    return (
      <main className="mx-auto max-w-5xl px-5 py-10">
        <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] p-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="skeleton mb-2 h-9 w-full" />
          ))}
        </div>
      </main>
    );

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-7 px-5 py-10 pb-24">
      <header className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/"
            className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--color-ink-3)] hover:text-[var(--color-accent)]"
          >
            ← control room
          </Link>
          <Refresh onClick={refresh} at={at} busy={busy} />
        </div>
        <h1 className="text-[28px] font-semibold tracking-tight">
          Publishing calendar
        </h1>
        <p className="max-w-[72ch] text-[14px] text-[var(--color-ink-2)]">
          When each queued article ships, and whether that slot is one we have
          evidence for.
        </p>
      </header>

      {/* Upcoming */}
      <section className="flex flex-col gap-3">
        <h2 className="border-b border-[var(--color-line)] pb-2 font-mono text-[12px] uppercase tracking-[0.12em] text-[var(--color-ink-3)]">
          Next {d.calendar?.length ?? 0} slots · every {d.schedule?.minDays} days
        </h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {(d.calendar ?? []).map((c: any, i: number) => (
            <div
              key={c.at}
              className={`rounded-xl border p-3 ${
                i === 0
                  ? "border-[var(--color-accent)]"
                  : "border-[var(--color-line)]"
              } bg-[var(--color-panel)]`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-[12.5px]">
                  {c.dow}{" "}
                  {new Date(c.at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                <span className="font-mono text-[11px] text-[var(--color-ink-3)]">
                  {String(c.hourUtc).padStart(2, "0")}:00 UTC
                </span>
              </div>
              <p className="mt-1.5 min-h-[2.4em] text-[13px] text-[var(--color-ink-2)]">
                {c.article?.title ?? (
                  <span className="text-[var(--color-warn)]">
                    nothing queued for this slot
                  </span>
                )}
              </p>
              <div className="mt-2 font-mono text-[11px]">
                {c.lift != null ? (
                  <span className="text-[var(--color-good)]">
                    {c.lift}× median · n={c.n}
                  </span>
                ) : (
                  <span className="text-[var(--color-ink-3)]">
                    no trusted measurement (n={c.n})
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Recommendations */}
      <section className="flex flex-col gap-3">
        <h2 className="border-b border-[var(--color-line)] pb-2 font-mono text-[12px] uppercase tracking-[0.12em] text-[var(--color-ink-3)]">
          What the data says to change
        </h2>
        <div className="flex flex-col gap-2">
          {(d.recommendations ?? []).map((r: any) => (
            <div
              key={r.title}
              className="rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] p-4"
            >
              <div className="flex flex-wrap items-baseline gap-2">
                <h3 className="text-[14.5px] font-semibold">{r.title}</h3>
                <span
                  className={`rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase ${
                    r.confidence.startsWith("moderate")
                      ? "border-[var(--color-good)] text-[var(--color-good)]"
                      : "border-[var(--color-warn)] text-[var(--color-warn)]"
                  }`}
                >
                  {r.confidence}
                </span>
              </div>
              <p className="mt-1.5 max-w-[80ch] text-[13.5px] leading-relaxed text-[var(--color-ink-2)]">
                {r.detail}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Measured slots */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <h2 className="border-b border-[var(--color-line)] pb-2 font-mono text-[12px] uppercase tracking-[0.12em] text-[var(--color-ink-3)]">
            By weekday (UTC)
          </h2>
          <div className="flex flex-col gap-2">
            {(d.byDow ?? []).map((s: any) => (
              <div key={s.label} className="flex items-center gap-3">
                <span className="w-9 font-mono text-[12px]">{s.label}</span>
                <div className="flex-1">
                  <Bar lift={s.lift} trusted={s.trusted} />
                </div>
                <span
                  className={`w-24 text-right font-mono text-[11.5px] ${liftTone(s.lift, s.trusted)}`}
                >
                  {s.lift != null ? `${s.lift}×` : "—"} n={s.n}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="border-b border-[var(--color-line)] pb-2 font-mono text-[12px] uppercase tracking-[0.12em] text-[var(--color-ink-3)]">
            By hour (UTC)
          </h2>
          <div className="flex flex-col gap-2">
            {(d.byHour ?? []).map((s: any) => (
              <div key={s.label} className="flex items-center gap-3">
                <span className="w-14 font-mono text-[12px]">{s.label}</span>
                <div className="flex-1">
                  <Bar lift={s.lift} trusted={s.trusted} />
                </div>
                <span
                  className={`w-24 text-right font-mono text-[11.5px] ${liftTone(s.lift, s.trusted)}`}
                >
                  {s.lift != null ? `${s.lift}×` : "—"} n={s.n}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <p className="max-w-[80ch] rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] p-4 text-[12.5px] leading-relaxed text-[var(--color-ink-3)]">
        <b className="text-[var(--color-ink-2)]">Method.</b> {d.caveat} Base rate{" "}
        {d.base} views/day across {d.counts?.solo} solo publishes ({d.counts?.burst}{" "}
        of {d.counts?.total} articles shipped in bursts and are excluded — they
        compete with each other and are a different regime from the current
        cadence).
      </p>
    </main>
  );
}
