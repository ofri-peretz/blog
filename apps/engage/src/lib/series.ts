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

let byId = new Map(CATALOG.map((d) => [d.id, d]));
export const definition = (id: string): SeriesDef | undefined => byId.get(id);

/**
 * Add catalog entries from a source module.
 *
 * Sources register themselves rather than being listed here, because the
 * alternative is a circular import: a source needs `SeriesDef` and
 * `registerLoader` from this file, so this file cannot import the source back.
 * Import the barrel (`series-all.ts`) rather than this module directly, or the
 * catalog you read will be whichever subset happened to be loaded.
 *
 * Registration is IDEMPOTENT, which is not a nicety: Next re-evaluates modules
 * on hot reload, so a naive "throw on duplicate" guard turns the first edit to
 * any source file into a 500 on every subsequent request until the server is
 * restarted. Re-registering the same id from the same source replaces it.
 *
 * Two DIFFERENT sources claiming one id still throws. That is not a hot-reload
 * artifact — it is two different numbers under one label, with the winner
 * decided by module evaluation order.
 */
export function registerSeries(defs: SeriesDef[]): void {
  for (const d of defs) {
    const existing = byId.get(d.id);
    if (existing && existing.source !== d.source)
      throw new Error(
        `[series] duplicate catalog id "${d.id}" — claimed by both ${existing.source} and ${d.source}`,
      );
    if (existing) {
      CATALOG[CATALOG.indexOf(existing)] = d;
    } else {
      CATALOG.push(d);
    }
  }
  byId = new Map(CATALOG.map((d) => [d.id, d]));
}

/**
 * Page through a PostgREST collection until it is exhausted.
 *
 * PostgREST enforces a server-side max rows (1,000 on this project) and silently
 * ignores a larger `limit=`. Measured: a 36-package x 90-day query asking for
 * 10,000 rows returned 1,000 — the earliest ~28 days — and the terminal charted
 * June numbers under an August label. Nothing in the response says it was cut;
 * the giveaway was `npm.downloads.total` equalling `npm.downloads.excl_devkit`,
 * because the devkit's rows fell beyond the cut.
 *
 * `order=` in the caller's path is what makes paging deterministic. Without a
 * stable sort, PostgREST may return overlapping or missing rows across pages.
 */
export async function sbPaged(path: string, pageSize = 1000): Promise<any[]> {
  const out: any[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const sep = path.includes("?") ? "&" : "?";
    const page = await sb(`${path}${sep}offset=${offset}&limit=${pageSize}`);
    out.push(...page);
    if (page.length < pageSize) return out;
    // A runaway guard, not an expected exit: 50k rows is far beyond any window
    // this app charts, so reaching it means the filter is wrong.
    if (out.length >= 50_000) {
      console.error(`[series] sbPaged stopped at ${out.length} rows for ${path}`);
      return out;
    }
  }
}

/** Shared by every Supabase-backed source module. */
export async function sb(path: string): Promise<any[]> {
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

/**
 * Keyed by name, for the same hot-reload reason as `registerSeries`: an array
 * would accumulate a fresh closure on every module re-evaluation, so after
 * three edits the PostHog loader runs three times per request — triple the
 * upstream queries, for identical results.
 */
const LOADERS = new Map<string, Loader>([["supabase:creator_daily", loadCreatorDaily]]);

/** Register an additional upstream. Called at module load by each source file. */
export function registerLoader(name: string, l: Loader): void {
  LOADERS.set(name, l);
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
  const names = [...LOADERS.keys()];
  const results = await Promise.allSettled([...LOADERS.values()].map((l) => l()));
  const out = new Map<string, Point[]>();
  results.forEach((r, i) => {
    if (r.status !== "fulfilled") {
      console.error(`[series] loader "${names[i]}" failed:`, r.reason);
      return;
    }
    for (const [id, pts] of r.value) out.set(id, pts);
  });

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
