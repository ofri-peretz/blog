import "server-only";
import { secret } from "@/lib/footprint";

/**
 * The series spine: one catalog, one shape, one place that knows where a
 * number comes from.
 *
 * Every panel in this app used to own its route AND its response shape, which
 * is precisely why nothing could be plotted against anything else. A ratio, a
 * comparison and a funnel are all the same operation — line up two series on a
 * shared time axis — and none of them were expressible.
 *
 * So: a series has an id, a source, points, and an `asOf`. Anything that can
 * produce that is chartable, including a series computed from two others.
 */

export type Point = { t: string; v: number };
export type Grain = "day" | "week" | "month";

export interface SeriesDef {
  id: string;
  label: string;
  group: string;
  unit: "count" | "ratio" | "ms" | "percent";
  /**
   * Cumulative totals (followers, downloads), rates (exceptions/day), and
   * gauges (a p75 latency) behave differently under BOTH bucketing and trend
   * detection, and getting it wrong is silent in both directions:
   *
   * - cumulative summed into a week double-counts every prior day;
   * - a gauge summed into a week reports ~7x the real p75 as if it were latency;
   * - a cumulative series fitted to its level reads "rising" forever, including
   *   when it has been dead for a month.
   *
   * Only `cumulative` is differenced before trend detection. See detect.ts.
   */
  kind: "cumulative" | "rate" | "gauge";
  /** Higher is better, except where it very much is not (exceptions, latency). */
  goodDirection: "up" | "down";
  /** Hours after which this series should be treated as stale on screen. */
  staleAfterHours: number;
  /**
   * Where the number comes from, per series rather than per response.
   *
   * This was one hardcoded string on the route ("supabase:creator_daily_metrics")
   * printed against every series regardless of origin. That was survivable only
   * while every series really did come from that table; the moment PostHog and
   * npm series exist it is a false provenance label on two thirds of the catalog.
   */
  source: string;
  /** Known caveat, surfaced next to the chart rather than buried in a doc. */
  caveat?: string;
}

/**
 * The catalog.
 *
 * Deliberately data, not code: the picker, the API validation and the docs all
 * read this one list, so a series cannot exist in the UI without declaring its
 * source and its staleness budget.
 */
const SB_CREATOR = "supabase:creator_daily_metrics";

export const CATALOG: SeriesDef[] = [
  // ── Audience ──────────────────────────────────────────────────────────────
  { id: "devto.followers", label: "dev.to followers", group: "Audience", unit: "count", kind: "cumulative", goodDirection: "up", staleAfterHours: 36, source: SB_CREATOR },
  { id: "devto.views", label: "dev.to views", group: "Audience", unit: "count", kind: "cumulative", goodDirection: "up", staleAfterHours: 36, source: SB_CREATOR },
  { id: "devto.reactions", label: "dev.to reactions", group: "Audience", unit: "count", kind: "cumulative", goodDirection: "up", staleAfterHours: 36, source: SB_CREATOR },
  { id: "devto.comments", label: "dev.to comments", group: "Audience", unit: "count", kind: "cumulative", goodDirection: "up", staleAfterHours: 36, source: SB_CREATOR },
  { id: "devto.posts", label: "articles published", group: "Audience", unit: "count", kind: "cumulative", goodDirection: "up", staleAfterHours: 36, source: SB_CREATOR },
  { id: "github.followers", label: "GitHub followers", group: "Audience", unit: "count", kind: "cumulative", goodDirection: "up", staleAfterHours: 36, source: SB_CREATOR },
  {
    id: "github.stars",
    label: "GitHub stars",
    group: "Audience",
    unit: "count",
    kind: "cumulative",
    goodDirection: "up",
    staleAfterHours: 36,
    source: SB_CREATOR,
    // The number lives under a column named for something else; the obvious
    // column (plugin_daily_metrics.github_stars) is never populated by the
    // ingest and would render a flat zero line that looks like a fact.
    caveat: "read from creator_daily_metrics github-repo.followers, not plugin_daily_metrics.github_stars",
  },
];

const byId = new Map(CATALOG.map((d) => [d.id, d]));
export const definition = (id: string): SeriesDef | undefined => byId.get(id);

async function sb(path: string): Promise<any[]> {
  const url = secret("SUPABASE_URL");
  const key = secret("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return [];
  const r = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    cache: "no-store",
  });
  // A revoked key, an RLS change and a Supabase outage all land here, and all
  // three are indistinguishable from an empty table downstream: the route would
  // answer 200 with "insufficient data" and nothing anywhere would say why.
  if (!r.ok) {
    console.error(
      `[series] supabase ${r.status} for ${path}: ${(await r.text()).slice(0, 200)}`,
    );
    return [];
  }
  const j = await r.json();
  return Array.isArray(j) ? j : [];
}

/** ISO week key, e.g. 2026-W32. */
function weekKey(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThu = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week =
    1 +
    Math.round(
      ((d.getTime() - firstThu.getTime()) / 86_400_000 - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7,
    );
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/**
 * Roll up to week/month.
 *
 * Each kind aggregates differently, and every wrong pairing produces a number
 * that renders perfectly:
 *
 * - cumulative → LAST. Summing double-counts every prior day; averaging yields
 *   a total of nothing.
 * - rate → SUM. Seven daily exception counts really do make a weekly count.
 * - gauge → MEAN. A p75 latency is not additive; summing seven days of "p75
 *   LCP" reports ~7x the real figure in milliseconds, which looks like a
 *   catastrophic regression rather than an aggregation bug.
 *
 * The weekly mean of seven daily p75s is not itself the weekly p75 — that would
 * need the raw distribution, which we do not hold. It is an approximation, and
 * it is the reason gauges carry their own kind rather than borrowing `rate`.
 */
export function bucket(points: Point[], grain: Grain, kind: SeriesDef["kind"]): Point[] {
  if (grain === "day") return points;
  const key = (t: string) => (grain === "week" ? weekKey(t) : t.slice(0, 7));
  const groups = new Map<string, Point[]>();
  for (const p of points) {
    const k = key(p.t);
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(p);
  }
  return [...groups.entries()].map(([k, ps]) => ({
    t: k,
    v:
      kind === "cumulative"
        ? ps[ps.length - 1].v
        : kind === "gauge"
          ? ps.reduce((s, p) => s + p.v, 0) / ps.length
          : ps.reduce((s, p) => s + p.v, 0),
  }));
}

/**
 * Series id → [platform, column] in `creator_daily_metrics`.
 *
 * The discriminator column is `platform`, not `source`. Getting that wrong
 * yields zero rows for every series and an API that answers "no data" with
 * complete confidence — which is why the loader below asserts nothing and the
 * detection layer reports insufficiency instead of drawing a flat line.
 */
const SOURCE_COLUMN: Record<string, [string, string]> = {
  "devto.followers": ["devto", "followers"],
  "devto.views": ["devto", "total_views"],
  "devto.reactions": ["devto", "total_reactions"],
  "devto.comments": ["devto", "total_comments"],
  "devto.posts": ["devto", "posts"],
  "github.followers": ["github", "followers"],
  "github.stars": ["github-repo", "followers"],
};

/**
 * A loader turns one upstream into `id → points`. Registering a loader is the
 * only way to add a source, so a series cannot reach the catalog without one
 * place that knows how to fetch it.
 */
export type Loader = () => Promise<Map<string, Point[]>>;

const LOADERS: Loader[] = [loadCreatorDaily];

/** Register an additional upstream. Called at module load by each source file. */
export function registerLoader(l: Loader): void {
  LOADERS.push(l);
}

/** The seven Supabase series — ONE round trip, pivoted here. */
async function loadCreatorDaily(): Promise<Map<string, Point[]>> {
  const rows = await sb("creator_daily_metrics?select=*&order=observed_on.asc&limit=2000");
  const out = new Map<string, Point[]>();
  for (const def of CATALOG) {
    const mapping = SOURCE_COLUMN[def.id];
    if (!mapping) continue;
    const [platform, column] = mapping;
    const pts: Point[] = [];
    for (const r of rows) {
      if (r.platform !== platform) continue;
      const v = Number(r[column]);
      if (!Number.isFinite(v)) continue;
      pts.push({ t: String(r.observed_on).slice(0, 10), v });
    }
    out.set(def.id, pts);
  }
  return out;
}

/**
 * Every catalogued series from every registered source, in parallel.
 *
 * `asOf` is computed PER SERIES, from that series' own last point. The previous
 * global `asOf` took the maximum observation date across every row in the
 * table, which meant a series whose ingest had stopped days ago inherited a
 * fresh timestamp from a healthy neighbour and reported `stale: false`. That is
 * precisely the documented failure mode — schedulers go stale silently — dressed
 * up as a freshness guarantee. One source failing entirely must not make the
 * rest look stale either, which is why a rejected loader contributes nothing
 * rather than poisoning the merge.
 */
export async function loadAll(): Promise<{
  series: Map<string, Point[]>;
  asOfById: Map<string, string | null>;
  asOf: string | null;
}> {
  const results = await Promise.allSettled(LOADERS.map((l) => l()));
  const out = new Map<string, Point[]>();
  for (const r of results) {
    if (r.status !== "fulfilled") {
      console.error("[series] loader failed:", r.reason);
      continue;
    }
    for (const [id, pts] of r.value) out.set(id, pts);
  }

  const asOfById = new Map<string, string | null>();
  let asOf: string | null = null;
  for (const [id, pts] of out) {
    // Points arrive ordered, but a merged source need not be; take the max
    // rather than trusting arrival order.
    let last: string | null = null;
    for (const p of pts) if (!last || p.t > last) last = p.t;
    asOfById.set(id, last);
    if (last && (!asOf || last > asOf)) asOf = last;
  }
  return { series: out, asOfById, asOf };
}

/**
 * Rebase to 100 at the first point.
 *
 * The whole reason comparison works in a financial terminal: two series three
 * orders of magnitude apart are unreadable on one axis, and a dual axis lets
 * you imply any relationship you like by choosing the scales. Rebasing removes
 * the choice.
 */
export function rebase100(points: Point[]): Point[] {
  const base = points.find((p) => p.v !== 0)?.v;
  if (!base) return points.map((p) => ({ ...p, v: 0 }));
  return points.map((p) => ({ t: p.t, v: (p.v / base) * 100 }));
}

/** Per-bucket change — the "volume" view that exposes a stall. */
export function toDelta(points: Point[]): Point[] {
  const out: Point[] = [];
  for (let i = 1; i < points.length; i++)
    out.push({ t: points[i].t, v: points[i].v - points[i - 1].v });
  return out;
}

/** A/B aligned by timestamp. Division by zero yields no point, never Infinity. */
export function ratio(a: Point[], b: Point[]): Point[] {
  const mb = new Map(b.map((p) => [p.t, p.v]));
  const out: Point[] = [];
  for (const p of a) {
    const d = mb.get(p.t);
    if (d === undefined || d === 0 || !Number.isFinite(d)) continue;
    out.push({ t: p.t, v: p.v / d });
  }
  return out;
}
