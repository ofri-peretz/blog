/**
 * Comment yield and outreach as series — see lib/yield.ts and /api/prs.
 * Source: engage.db, one row per day, written by /api/yield and /api/prs.
 */
import "server-only";
import { registerSeries, registerLoader, type SeriesDef, type Point } from "./series";
import { yieldHistory, outreachHistory } from "./store";

const base = { unit: "count" as const, kind: "gauge" as const, staleAfterHours: 36 };
export const YIELD_CATALOG: SeriesDef[] = [
  { id: "yield.mean14d_30d", label: "comments in first 14d, mean (articles of last 30d)", group: "Standing", goodDirection: "up", ...base, source: "sqlite:engage.db.comment_yield", caveat: "only articles whose 14-day window has closed" },
  { id: "yield.with_any_30d", label: "articles with any comment in 14d (last 30d)", group: "Standing", goodDirection: "up", ...base, source: "sqlite:engage.db.comment_yield" },
  { id: "outreach.our_move", label: "outreach PRs waiting on us", group: "Adoption", goodDirection: "down", ...base, source: "sqlite:engage.db.outreach" },
  { id: "outreach.behind_base", label: "outreach PRs behind their base", group: "Adoption", goodDirection: "down", ...base, source: "sqlite:engage.db.outreach" },
];

async function load(): Promise<Map<string, Point[]>> {
  const out = new Map<string, Point[]>();
  const put = (id: string, rows: Record<string, number | string | null>[], field: string) => {
    const pts: Point[] = [];
    for (const r of rows) { const v = r[field]; if (typeof v === "number" && Number.isFinite(v)) pts.push({ t: String(r.day), v }); }
    if (pts.length) out.set(id, pts);
  };
  const y = yieldHistory(); const o = outreachHistory();
  put("yield.mean14d_30d", y, "mean14d_30d"); put("yield.with_any_30d", y, "with_any_30d");
  put("outreach.our_move", o, "our_move"); put("outreach.behind_base", o, "behind_base");
  return out;
}
registerSeries(YIELD_CATALOG);
registerLoader("yield", load);
