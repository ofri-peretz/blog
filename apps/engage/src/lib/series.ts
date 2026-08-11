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
   * Cumulative totals (followers, downloads) versus rates (exceptions/day).
   * This drives whether trend detection differences first — get it wrong and a
   * dead metric reads as "rising" forever. See detect.ts.
   */
  kind: "cumulative" | "rate";
  /** Higher is better, except where it very much is not (exceptions). */
  goodDirection: "up" | "down";
  /** Hours after which this series should be treated as stale on screen. */
  staleAfterHours: number;
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
export const CATALOG: SeriesDef[] = [
  // ── Audience ──────────────────────────────────────────────────────────────
  { id: "devto.followers", label: "dev.to followers", group: "Audience", unit: "count", kind: "cumulative", goodDirection: "up", staleAfterHours: 36 },
  { id: "devto.views", label: "dev.to views", group: "Audience", unit: "count", kind: "cumulative", goodDirection: "up", staleAfterHours: 36 },
  { id: "devto.reactions", label: "dev.to reactions", group: "Audience", unit: "count", kind: "cumulative", goodDirection: "up", staleAfterHours: 36 },
  { id: "devto.comments", label: "dev.to comments", group: "Audience", unit: "count", kind: "cumulative", goodDirection: "up", staleAfterHours: 36 },
  { id: "devto.posts", label: "articles published", group: "Audience", unit: "count", kind: "cumulative", goodDirection: "up", staleAfterHours: 36 },
  { id: "github.followers", label: "GitHub followers", group: "Audience", unit: "count", kind: "cumulative", goodDirection: "up", staleAfterHours: 36 },
  {
    id: "github.stars",
    label: "GitHub stars",
    group: "Audience",
    unit: "count",
    kind: "cumulative",
    goodDirection: "up",
    staleAfterHours: 36,
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
  if (!r.ok) return [];
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
 * A cumulative series takes the LAST value in the bucket; a rate takes the SUM.
 * Averaging a cumulative total produces a number that is not a total of
 * anything, and summing one double-counts every prior day.
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
    v: kind === "cumulative" ? ps[ps.length - 1].v : ps.reduce((s, p) => s + p.v, 0),
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

/** Every catalogued series, fetched in ONE round trip and pivoted here. */
export async function loadAll(): Promise<{ series: Map<string, Point[]>; asOf: string | null }> {
  const rows = await sb("creator_daily_metrics?select=*&order=observed_on.asc&limit=2000");
  const out = new Map<string, Point[]>();
  let asOf: string | null = null;

  for (const def of CATALOG) {
    const mapping = SOURCE_COLUMN[def.id];
    if (!mapping) continue;
    const [platform, column] = mapping;
    const pts: Point[] = [];
    for (const r of rows) {
      if (r.platform !== platform) continue;
      const v = Number(r[column]);
      if (!Number.isFinite(v)) continue;
      const t = String(r.observed_on).slice(0, 10);
      pts.push({ t, v });
      if (!asOf || t > asOf) asOf = t;
    }
    out.set(def.id, pts);
  }
  return { series: out, asOf };
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
