"use client";

import Link from "next/link";
import { useCachedSection } from "@/lib/client-cache";
import { Refresh } from "@/components/panels";
import { Callout } from "@/components/ui/callout";
import { RankedBarList, type RankedBarRow } from "@/components/ui/meter";
import { Skeleton } from "@/components/ui/skeleton";

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * A measured slot as a `<RankedBarList>` row.
 *
 * The hand-rolled `<Bar>` drew an untrusted slot as a 45%-opacity fill — a
 * dimmer version of a real value, which is the one thing an unmeasured cell
 * must never look like. `variant: "hatch"` is the DS's vocabulary for exactly
 * this: "no measurement was taken; this is not a small number".
 *
 * `max` is 4× — the scale ceiling the old component hardcoded inside its own
 * percentage maths, where nothing named it.
 */
const LIFT_CEILING = 4;

function liftRow(s: any): RankedBarRow {
  const measured = s.lift != null && s.trusted;
  return {
    key: s.label,
    label: s.label,
    value: measured ? s.lift : null,
    variant: measured ? "default" : "hatch",
    tone: !measured ? "neutral" : s.lift >= 2 ? "positive" : s.lift < 0.8 ? "negative" : "neutral",
    display: s.lift != null ? `${s.lift}×` : undefined,
    note: `n=${s.n}`,
    state: measured ? undefined : { notCounted: !s.trusted },
  };
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
        <Skeleton variant="meter" count={7} label="Loading the publishing calendar" />
      </main>
    );

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-7 px-5 py-10 pb-24">
      <header className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/"
            className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--muted-foreground)] hover:text-[var(--primary)]"
          >
            ← control room
          </Link>
          <Refresh onClick={refresh} at={at} busy={busy} />
        </div>
        <h1 className="text-[28px] font-semibold tracking-tight">
          Publishing calendar
        </h1>
        <p className="max-w-[72ch] text-[14px] text-[var(--muted-foreground)]">
          When each queued article ships, and whether that slot is one we have
          evidence for.
        </p>
      </header>

      {/* Upcoming */}
      <section className="flex flex-col gap-3">
        <h2 className="border-b border-[var(--border)] pb-2 font-mono text-[12px] uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
          Next {d.calendar?.length ?? 0} slots · every {d.schedule?.minDays} days
        </h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {(d.calendar ?? []).map((c: any, i: number) => (
            <div
              key={c.at}
              className={`rounded-xl border p-3 ${
                i === 0
                  ? "border-[var(--primary)]"
                  : "border-[var(--border)]"
              } bg-[var(--card)]`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-[12.5px]">
                  {c.dow}{" "}
                  {new Date(c.at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                <span className="font-mono text-[11px] text-[var(--muted-foreground)]">
                  {String(c.hourUtc).padStart(2, "0")}:00 UTC
                </span>
              </div>
              <p className="mt-1.5 min-h-[2.4em] text-[13px] text-[var(--muted-foreground)]">
                {c.article?.title ?? (
                  <span className="text-[var(--warning)]">
                    nothing queued for this slot
                  </span>
                )}
              </p>
              <div className="mt-2 font-mono text-[11px]">
                {c.lift != null ? (
                  <span className="text-[var(--success)]">
                    {c.lift}× median · n={c.n}
                  </span>
                ) : (
                  <span className="text-[var(--muted-foreground)]">
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
        <h2 className="border-b border-[var(--border)] pb-2 font-mono text-[12px] uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
          What the data says to change
        </h2>
        <div className="flex flex-col gap-2">
          {(d.recommendations ?? []).map((r: any) => (
            <div
              key={r.title}
              className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"
            >
              <div className="flex flex-wrap items-baseline gap-2">
                <h3 className="text-[14.5px] font-semibold">{r.title}</h3>
                <span
                  className={`rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase ${
                    r.confidence.startsWith("moderate")
                      ? "border-[var(--success)] text-[var(--success)]"
                      : "border-[var(--warning)] text-[var(--warning)]"
                  }`}
                >
                  {r.confidence}
                </span>
              </div>
              <p className="mt-1.5 max-w-[80ch] text-[13.5px] leading-relaxed text-[var(--muted-foreground)]">
                {r.detail}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Measured slots */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <RankedBarList
          caption="By weekday (UTC)"
          order="given"
          size="sm"
          max={LIFT_CEILING}
          rows={(d.byDow ?? []).map(liftRow)}
        />
        <RankedBarList
          caption="By hour (UTC)"
          order="given"
          size="sm"
          max={LIFT_CEILING}
          rows={(d.byHour ?? []).map(liftRow)}
        />
      </section>

      <Callout tone="note" title="Method" className="max-w-[80ch]">
        {d.caveat} Base rate {d.base} views/day across {d.counts?.solo} solo
        publishes ({d.counts?.burst} of {d.counts?.total} articles shipped in
        bursts and are excluded — they compete with each other and are a
        different regime from the current cadence).
      </Callout>
    </main>
  );
}
