import "server-only";
import { CATALOG, bucket, definition, loadAll, type Point } from "@/lib/series-all";
import { trend } from "@/lib/detect";

/**
 * Stall alerts, as a rule over the series spine — next-ten #7.
 *
 * THE CASE THAT MOTIVATED IT, and the one every rule here is calibrated
 * against: the blog stopped sending client-side PostHog events on 2026-08-02.
 * Server-side `/go/` tracking kept firing, so the property never looked dead —
 * `short_link_click` arrived every day. Nine days passed. It was found by hand,
 * while building something else.
 *
 * Nothing in the stack was watching, because "no events" is indistinguishable
 * from "a quiet day" unless you compare against what the series used to do.
 * That comparison is the whole feature, and the trend engine already does the
 * hard half of it.
 *
 * The design constraint is entirely about FALSE ALARMS. An alert that cries
 * wolf on a quiet weekend gets muted, and a muted alert is worse than none —
 * it converts a silent failure into a silent failure you believe is monitored.
 * So every rule below has to survive a genuinely quiet Sunday on a low-traffic
 * property without firing.
 */

export type AlertKind = "went-quiet" | "stale" | "stalled";

export interface Alert {
  id: string;
  label: string;
  kind: AlertKind;
  severity: "high" | "medium";
  /** Plain sentence, with the numbers in it. Never a bare "check X". */
  message: string;
  /** What the number was before it broke, so the alert can be judged. */
  was: number | null;
  now: number | null;
  ageHours: number | null;
}

const DAY_MS = 86_400_000;

/** Consecutive zero buckets at the END of a series. */
function trailingZeros(points: Point[]): number {
  let n = 0;
  for (let i = points.length - 1; i >= 0 && points[i].v === 0; i--) n++;
  return n;
}

/** Mean of the last `n` non-trailing values, for "what it used to do". */
function baseline(points: Point[], skip: number, n = 14): number | null {
  const end = points.length - skip;
  const slice = points.slice(Math.max(0, end - n), end);
  if (!slice.length) return null;
  return slice.reduce((s, p) => s + p.v, 0) / slice.length;
}

export async function evaluateAlerts(): Promise<{
  alerts: Alert[];
  evaluated: number;
}> {
  const { series, asOfById } = await loadAll();
  const out: Alert[] = [];
  let evaluated = 0;

  for (const def of CATALOG) {
    const points = series.get(def.id);
    if (!points || points.length < 14) continue;
    evaluated++;

    const asOf = asOfById.get(def.id) ?? null;
    const ageHours = asOf
      ? Math.round((Date.now() - new Date(asOf + "T00:00:00Z").getTime()) / 3_600_000)
      : null;
    const last = points.at(-1)?.v ?? null;

    /*
     * RULE 1 — went quiet. A rate series that used to have traffic and now
     * reads zero for three or more consecutive days.
     *
     * Three days, not one: a low-traffic property legitimately records zero on
     * a weekend, and `ds_storybook` (27 events in 90 days) would fire daily on
     * a one-day rule. Three consecutive zeros against a non-trivial baseline is
     * not a quiet spell, it is a stopped feed.
     *
     * The baseline guard is what stops this firing on a property that has
     * always been near-zero: there has to have been something to lose.
     */
    if (def.kind === "rate") {
      const zeros = trailingZeros(points);
      const before = baseline(points, zeros);
      if (zeros >= 3 && before !== null && before >= 1) {
        out.push({
          id: def.id,
          label: def.label,
          kind: "went-quiet",
          severity: "high",
          message: `${def.label} has read zero for ${zeros} straight days, after averaging ${before.toFixed(1)}/day before that. A feed that stops looks exactly like a quiet week — this is the difference.`,
          was: Number(before.toFixed(1)),
          now: 0,
          ageHours,
        });
        continue;
      }
    }

    /*
     * RULE 2 — stale. The series' own freshness budget, already declared per
     * series in the catalog, applied rather than merely displayed.
     */
    if (def.staleAfterHours && ageHours !== null && ageHours > def.staleAfterHours) {
      out.push({
        id: def.id,
        label: def.label,
        kind: "stale",
        severity: ageHours > def.staleAfterHours * 4 ? "high" : "medium",
        message: `${def.label} last reported ${Math.round(ageHours / 24)} days ago (budget ${Math.round(def.staleAfterHours / 24)}d). Its source stopped writing; the chart will keep rendering the old shape.`,
        was: null,
        now: last,
        ageHours,
      });
      continue;
    }

    /*
     * RULE 3 — stalled. A cumulative metric that should climb and has gone
     * flat. This is the one the trend engine exists for: fitted to the LEVEL a
     * cumulative series reads "rising" forever, so `trend()` differences first
     * and a dead metric shows up as `flat` on its daily gain.
     *
     * Weekly buckets over the window, because daily gains on follower counts
     * are noisy enough to flip flat/rising on any given pair of days.
     */
    if (def.kind === "cumulative" && def.goodDirection === "up") {
      const weekly = bucket(points.slice(-56), "week", "cumulative");
      if (weekly.length >= 4) {
        const t = trend(weekly);
        const gained = (weekly.at(-1)!.v ?? 0) - (weekly[0].v ?? 0);
        if (t.direction === "flat" && !t.insufficient && gained === 0) {
          out.push({
            id: def.id,
            label: def.label,
            kind: "stalled",
            severity: "medium",
            message: `${def.label} has not moved in ${weekly.length} weeks — still ${last}. Flat on a metric that only goes up means the source stopped, not that growth paused.`,
            was: weekly[0].v,
            now: last,
            ageHours,
          });
        }
      }
    }
  }

  // Highest severity first, then oldest — the February problem outranks today's.
  const rank = { high: 0, medium: 1 };
  out.sort(
    (a, b) => rank[a.severity] - rank[b.severity] || (b.ageHours ?? 0) - (a.ageHours ?? 0),
  );
  return { alerts: out, evaluated };
}

/** Unused elsewhere; exported so the self-check can drive the rules directly. */
export const _internals = { trailingZeros, baseline, DAY_MS, definition };
