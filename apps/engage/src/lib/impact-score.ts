/**
 * The Author Impact Score — one definition of "more impactful", as data.
 *
 * Intent: docs/sdlc/intents/2026-09-04-engage-impact-score. Five pillars of
 * 20 points; each pillar the mean of its metrics; each metric scored linearly
 * between a floor and a target and clamped. Targets are hypotheses from the
 * leaders in our tags and the shipped intents, and they live HERE and nowhere
 * else. Followers, lifetime totals and badges are excluded on purpose.
 *
 * Pure. The selfcheck pins the arithmetic; /api/impact feeds it.
 */
export type Direction = "up" | "down";

export interface MetricDef {
  id: string;
  pillar: PillarId;
  label: string;
  source: string;
  unit: string;
  floor: number;
  target: number;
  direction: Direction;
  why: string;
}

export type PillarId = "readers" | "resonance" | "standing" | "arena" | "downstream";
export const PILLARS: { id: PillarId; label: string; question: string }[] = [
  { id: "readers", label: "Readers", question: "Do people read us?" },
  { id: "resonance", label: "Resonance", question: "Do they respond?" },
  { id: "standing", label: "Standing", question: "Are we in the conversation?" },
  { id: "arena", label: "Arena", question: "Where do we rank in our tags?" },
  { id: "downstream", label: "Downstream", question: "Does it reach the work?" },
];
export const PILLAR_POINTS = 20;

export const CATALOG: MetricDef[] = [
  { id: "views_per_day_7d", pillar: "readers", label: "views per day (7d)", source: "devto_daily_analytics", unit: "/day", floor: 20, target: 200, direction: "up", why: "a top-300 author's article alone draws ~200/day in its first days" },
  { id: "read_time_avg_s_7d", pillar: "readers", label: "average read time (7d)", source: "devto_daily_analytics", unit: "s", floor: 30, target: 120, direction: "up", why: "lifetime average is 250 s; 120 s is half a real read" },
  { id: "comments_per_100_views_30d", pillar: "resonance", label: "comments per 100 views (30d)", source: "devto_daily_analytics", unit: "", floor: 0, target: 2.0, direction: "up", why: "leaders' comments are a third of reactions" },
  { id: "reactions_per_100_views_30d", pillar: "resonance", label: "reactions per 100 views (30d)", source: "devto_daily_analytics", unit: "", floor: 0.5, target: 4.0, direction: "up", why: "leaders' articles earn 4–8 per 100" },
  { id: "yield_mean14d_30d", pillar: "resonance", label: "first-14-day comment yield (30d)", source: "comment_yield", unit: "/article", floor: 0, target: 1.5, direction: "up", why: "comment-yield intent target" },
  { id: "mutual_ties", pillar: "standing", label: "mutual ties", source: "standing", unit: "", floor: 0, target: 15, direction: "up", why: "standing intent target" },
  { id: "in_authors_90d", pillar: "standing", label: "distinct inbound authors (90d)", source: "standing", unit: "", floor: 5, target: 40, direction: "up", why: "standing intent target" },
  { id: "core_reach", pillar: "standing", label: "mutual ties with the core 40", source: "standing", unit: "", floor: 0, target: 5, direction: "up", why: "standing intent target" },
  { id: "reply_latency_h", pillar: "standing", label: "reply latency, median", source: "standing", unit: "h", floor: 168, target: 24, direction: "down", why: "reply-latency intent target" },
  { id: "arena_percentile", pillar: "arena", label: "rank percentile in home tags (30d top-300)", source: "league", unit: "", floor: 0, target: 0.95, direction: "up", why: "top 5% = the top ten names in a tag" },
  { id: "arena_tags_present", pillar: "arena", label: "home tags where we appear in the top 300", source: "league", unit: "/4", floor: 0, target: 4, direction: "up", why: "absence is the strongest signal we have" },
  { id: "npm_lift_median_30d", pillar: "downstream", label: "article → npm download lift, median (30d)", source: "v_article_download_lift", unit: "%", floor: 0, target: 20, direction: "up", why: "the north star's own view" },
  { id: "blog_sessions_from_devto_30d", pillar: "downstream", label: "blog sessions referred by dev.to (30d)", source: "journeys", unit: "", floor: 0, target: 50, direction: "up", why: "dev.to sends nothing today; any is progress" },
  { id: "followers_who_commented", pillar: "downstream", label: "followers who ever commented", source: "devto_followers × devto_comments", unit: "", floor: 2, target: 20, direction: "up", why: "the honest proxy for followers who read" },
];

export type Inputs = Partial<Record<string, number | null>>;

export interface MetricScore extends MetricDef {
  value: number | null;
  /** 0..1 */
  unitScore: number;
  measured: boolean;
}
export interface PillarScore {
  id: PillarId;
  label: string;
  question: string;
  points: number;
  max: number;
  metrics: MetricScore[];
}
export interface ImpactScore {
  score: number;
  pillars: PillarScore[];
  measured: number;
  total: number;
}

export function scoreMetric(def: MetricDef, value: number | null | undefined): number {
  // Unmeasured is zero, never a guess: a pillar with a missing input reads low,
  // which is the truth about our instrumentation, not about the author.
  if (value == null || !Number.isFinite(value)) return 0;
  // A "down" metric's floor is the BAD end (168 h) and its target the good one
  // (24 h); an "up" metric's floor is below its target. A catalog entry that
  // gets this backwards would score silently in reverse, so it throws instead.
  const span = def.direction === "up" ? def.target - def.floor : def.floor - def.target;
  if (!(span > 0)) throw new Error(`impact catalog: ${def.id} has floor ${def.floor} and target ${def.target} for direction "${def.direction}"`);
  const distance = def.direction === "up" ? value - def.floor : def.floor - value;
  return Math.max(0, Math.min(1, distance / span));
}

export function scoreImpact(inputs: Inputs): ImpactScore {
  const pillars: PillarScore[] = PILLARS.map((p) => {
    const metrics = CATALOG.filter((m) => m.pillar === p.id).map((m) => {
      const v = inputs[m.id];
      const value = v == null || !Number.isFinite(v) ? null : v;
      return { ...m, value, unitScore: scoreMetric(m, value), measured: value !== null };
    });
    const mean = metrics.reduce((s, m) => s + m.unitScore, 0) / metrics.length;
    return { ...p, points: Math.round(mean * PILLAR_POINTS * 10) / 10, max: PILLAR_POINTS, metrics };
  });
  const score = Math.round(pillars.reduce((s, p) => s + p.points, 0) * 10) / 10;
  const all = pillars.flatMap((p) => p.metrics);
  return { score, pillars, measured: all.filter((m) => m.measured).length, total: all.length };
}
