/**
 * Standing as series — see lib/standing.ts for what the numbers are.
 *
 * Source is the local `engage.db` `standing` table, one row per day, written
 * by /api/standing. Ranks and waiting counts are gauges; mutual ties and
 * inbound authors are cumulative in spirit but are re-measured, not summed,
 * so they are gauges here too — differencing them would invent a "daily gain"
 * that a re-crawl can make negative.
 */
import "server-only";
import { registerSeries, registerLoader, type SeriesDef, type Point } from "./series";
import { standingHistory } from "./store";

const SRC = "sqlite:engage.db.standing";
const base = { group: "Standing", unit: "count" as const, kind: "gauge" as const, staleAfterHours: 36, source: SRC };

export const STANDING_CATALOG: SeriesDef[] = [
  { id: "standing.degree", label: "authors tied to us", goodDirection: "up", ...base, caveat: "sample-bound: compare only within one crawl policy" },
  { id: "standing.in_authors", label: "authors who commented on us", goodDirection: "up", ...base },
  { id: "standing.mutual", label: "mutual ties", goodDirection: "up", ...base },
  { id: "standing.core_reach", label: "mutual ties with the core 40", goodDirection: "up", ...base },
  { id: "standing.rank_nonstaff", label: "rank among non-staff", goodDirection: "down", ...base, caveat: "1 is the top; staff accounts are excluded from the ranking" },
  { id: "standing.rank_pct", label: "percentile among non-staff", goodDirection: "up", ...base, unit: "percent" },
  { id: "standing.replies_waiting", label: "replies waiting", goodDirection: "down", ...base },
  { id: "standing.reply_latency_h", label: "reply latency, median hours", goodDirection: "down", ...base, caveat: "hours; a median over answered threads" },
  { id: "standing.sample_size", label: "articles sampled by the crawl", goodDirection: "up", ...base, caveat: "the denominator behind every other standing series" },
];

async function loadStanding(): Promise<Map<string, Point[]>> {
  const rows = standingHistory();
  const out = new Map<string, Point[]>();
  for (const def of STANDING_CATALOG) {
    const field = def.id.replace("standing.", "");
    const pts: Point[] = [];
    for (const r of rows) {
      const v = r[field];
      if (typeof v === "number" && Number.isFinite(v)) pts.push({ t: String(r.day), v });
    }
    if (pts.length) out.set(def.id, pts);
  }
  return out;
}

registerSeries(STANDING_CATALOG);
registerLoader("standing", loadStanding);
