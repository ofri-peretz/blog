/** The Author Impact Score and its five pillars as series — see lib/impact-score.ts. */
import "server-only";
import { registerSeries, registerLoader, type SeriesDef, type Point } from "./series";
import { impactHistory } from "./store";
const base = { group: "Standing", unit: "count" as const, kind: "gauge" as const, staleAfterHours: 36, source: "sqlite:engage.db.impact_score", goodDirection: "up" as const };
export const IMPACT_CATALOG: SeriesDef[] = [
  { id: "impact.score", label: "author impact score (0–100)", ...base },
  { id: "impact.readers", label: "impact · readers (of 20)", ...base },
  { id: "impact.resonance", label: "impact · resonance (of 20)", ...base },
  { id: "impact.standing", label: "impact · standing (of 20)", ...base },
  { id: "impact.arena", label: "impact · arena (of 20)", ...base },
  { id: "impact.downstream", label: "impact · downstream (of 20)", ...base },
];
async function load(): Promise<Map<string, Point[]>> {
  const out = new Map<string, Point[]>();
  const rows = impactHistory();
  for (const def of IMPACT_CATALOG) {
    const f = def.id.replace("impact.", "");
    const pts: Point[] = [];
    for (const r of rows) { const v = r[f]; if (typeof v === "number" && Number.isFinite(v)) pts.push({ t: String(r.day), v }); }
    if (pts.length) out.set(def.id, pts);
  }
  return out;
}
registerSeries(IMPACT_CATALOG);
registerLoader("impact", load);
