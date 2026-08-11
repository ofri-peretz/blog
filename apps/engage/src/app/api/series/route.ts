import { NextResponse } from "next/server";
import {
  CATALOG,
  definition,
  loadAll,
  bucket,
  rebase100,
  toDelta,
  ratio,
  type Grain,
  type Point,
  type SeriesDef,
} from "@/lib/series-all";
import { trend, correlate, divergence } from "@/lib/detect";

export const dynamic = "force-dynamic";

/**
 * One endpoint for every chartable number.
 *
 *   /api/series                              → the catalog
 *   /api/series?ids=devto.views,github.stars → those two, plus detection
 *   /api/series?ids=…&grain=week&transform=rebase100|delta
 *   /api/series?ids=ratio(devto.reactions,devto.views)
 *
 * Detection travels WITH the data rather than being a second call, because
 * every consumer wants both and a split invites the two to disagree about the
 * window they were computed over.
 */

const RATIO = /^ratio\(([^,]+),([^)]+)\)$/;

/**
 * Split on commas that are NOT inside parentheses.
 *
 * `ratio(a,b)` contains the same delimiter the id list uses, so a plain
 * `split(",")` tears every ratio into two unknown series — which is exactly
 * what it did: the response came back with ids `ratio(devto.reactions` and
 * `devto.views)`.
 */
function splitIds(param: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of param) {
    if (ch === "(") depth++;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    if (ch === "," && depth === 0) {
      if (cur.trim()) out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}


function resolve(id: string, all: Map<string, Point[]>): Point[] | null {
  const m = RATIO.exec(id.trim());
  if (m) {
    const a = all.get(m[1].trim());
    const b = all.get(m[2].trim());
    return a && b ? ratio(a, b) : null;
  }
  return all.get(id) ?? null;
}

/** A ratio is a rate: it is already normalised, so it must not be differenced. */
const kindOf = (id: string): SeriesDef["kind"] =>
  RATIO.test(id.trim()) ? "rate" : (definition(id)?.kind ?? "cumulative");

/**
 * The staleness budget for any id, including computed ones.
 *
 * `definition()` returns undefined for `ratio(a,b)` because it is not in the
 * catalog, so keying staleness off it reported `stale: false` for every ratio
 * no matter how old the data was. A ratio is exactly as stale as its stalest
 * input.
 */
function staleAfterHours(id: string): number | null {
  const m = RATIO.exec(id.trim());
  if (!m) return definition(id)?.staleAfterHours ?? null;
  const a = definition(m[1].trim())?.staleAfterHours;
  const b = definition(m[2].trim())?.staleAfterHours;
  if (a == null && b == null) return null;
  return Math.max(a ?? 0, b ?? 0);
}

const labelOf = (id: string): string => {
  const m = RATIO.exec(id.trim());
  if (!m) return definition(id)?.label ?? id;
  return `${definition(m[1].trim())?.label ?? m[1]} / ${definition(m[2].trim())?.label ?? m[2]}`;
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const idsParam = url.searchParams.get("ids");
  // An unvalidated grain is not a harmless typo: `grain=year` falls through
  // bucket()'s else-branch and silently produces MONTHLY buckets labelled as
  // whatever was asked for.
  const grainParam = url.searchParams.get("grain") ?? "day";
  const grain: Grain = (["day", "week", "month"] as const).includes(
    grainParam as Grain,
  )
    ? (grainParam as Grain)
    : "day";
  const transform = url.searchParams.get("transform");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  if (!idsParam) {
    return NextResponse.json({
      catalog: CATALOG,
      groups: [...new Set(CATALOG.map((d) => d.group))],
      transforms: ["rebase100", "delta"],
      note: "ids= accepts catalog ids and ratio(a,b)",
    });
  }

  const { series: all, asOfById, asOf } = await loadAll();
  const ids = splitIds(idsParam).slice(0, 12);

  /** A computed series is exactly as fresh as its STALEST input. */
  const asOfFor = (id: string): string | null => {
    const m = RATIO.exec(id.trim());
    if (!m) return asOfById.get(id) ?? null;
    const a = asOfById.get(m[1].trim()) ?? null;
    const b = asOfById.get(m[2].trim()) ?? null;
    if (!a) return b;
    if (!b) return a;
    return a < b ? a : b;
  };

  const sourceFor = (id: string): string => {
    const m = RATIO.exec(id.trim());
    if (!m) return definition(id)?.source ?? "unknown";
    const a = definition(m[1].trim())?.source ?? "unknown";
    const b = definition(m[2].trim())?.source ?? "unknown";
    return a === b ? a : `${a} + ${b}`;
  };

  const resolved = ids.map((id) => {
    const raw = resolve(id, all);
    if (!raw) return { id, label: labelOf(id), error: "unknown series" as const };

    const kind = kindOf(id);
    // Window first, then bucket, then transform. Any other order changes the
    // numbers: rebasing before windowing anchors to a point outside the view.
    const bucketed = bucket(
      raw.filter((p) => (!from || p.t >= from) && (!to || p.t <= to)),
      grain,
      kind,
    );
    let pts = bucketed;
    if (transform === "delta") pts = toDelta(pts);
    else if (transform === "rebase100") pts = rebase100(pts);

    // Detection runs on the WINDOWED, BUCKETED series but before rebasing —
    // rebasing is a display concern and must not change whether a trend exists.
    const detectOn = transform === "delta" ? pts : bucketed;
    // Only a cumulative series needs differencing; rates and gauges are already
    // normalised, and differencing them twice reports a stable metric as flat.
    const t = trend(detectOn, {
      isRate: kind !== "cumulative" || transform === "delta",
    });

    const def = definition(id);
    const seriesAsOf = asOfFor(id);
    return {
      id,
      label: labelOf(id),
      unit: def?.unit ?? "ratio",
      kind,
      goodDirection: def?.goodDirection ?? "up",
      caveat: def?.caveat ?? null,
      points: pts,
      first: pts[0]?.v ?? null,
      last: pts.at(-1)?.v ?? null,
      trend: t,
      source: sourceFor(id),
      asOf: seriesAsOf,
      staleAfterHours: staleAfterHours(id),
      /**
       * Age in hours of THIS series, so the UI can render "6h" or "9d" without
       * recomputing the rule and reaching a different verdict than the API.
       */
      ageHours: seriesAsOf
        ? Math.round(
            (Date.now() - new Date(seriesAsOf + "T00:00:00Z").getTime()) / 3_600_000,
          )
        : null,
      stale: (() => {
        const budget = staleAfterHours(id);
        if (budget == null) return false;
        // No data at all is the most stale a series can be — not "fresh".
        // Returning false here is how a dead ingest renders as a healthy
        // empty chart.
        if (!seriesAsOf) return true;
        return (
          Date.now() - new Date(seriesAsOf + "T00:00:00Z").getTime() >
          budget * 3_600_000
        );
      })(),
    };
  });

  // Pairwise detection, on the raw windowed series so a display transform
  // cannot change a correlation.
  const usable = ids.filter((id) => resolve(id, all));
  const pairs: unknown[] = [];
  for (let i = 0; i < usable.length; i++) {
    for (let j = i + 1; j < usable.length; j++) {
      const a = resolve(usable[i], all)!.filter((p) => (!from || p.t >= from) && (!to || p.t <= to));
      const b = resolve(usable[j], all)!.filter((p) => (!from || p.t >= from) && (!to || p.t <= to));
      const isRateA = kindOf(usable[i]) === "rate";
      const isRateB = kindOf(usable[j]) === "rate";
      const c = correlate(a, b, { isRateA, isRateB });
      const d = divergence(a, b, { isRateA, isRateB });
      pairs.push({ a: usable[i], b: usable[j], correlation: c, divergence: d });
    }
  }

  return NextResponse.json({ grain, transform, asOf, series: resolved, pairs });
}
