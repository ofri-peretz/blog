/** The climb as series — our league rank (down is good) and 30-day reactions. See lib/league.ts. */
import "server-only";
import { registerSeries, registerLoader, type SeriesDef, type Point } from "./series";
import { leagueHistory } from "./store";
const base = { group: "Standing", unit: "count" as const, kind: "gauge" as const, staleAfterHours: 36, source: "sqlite:engage.db.league_daily" };
export const LEAGUE_CATALOG: SeriesDef[] = [
  { id: "league.rank", label: "league rank, 30-day top authors", goodDirection: "down", ...base, caveat: "1 is the top; sample = platform top 500 + top 300 per home tag" },
  { id: "league.reactions30", label: "our reactions in the league window", goodDirection: "up", ...base },
  { id: "league.t100", label: "top-100 threshold, reactions", goodDirection: "down", ...base, caveat: "what the 100th author has; the bar we are climbing" },
];
async function load(): Promise<Map<string, Point[]>> {
  const out = new Map<string, Point[]>(); const rows = leagueHistory();
  const pts = (f: string): Point[] => rows.filter((r) => typeof r[f] === "number").map((r) => ({ t: String(r.day), v: Number(r[f]) }));
  if (rows.length) { out.set("league.rank", pts("rank")); out.set("league.reactions30", pts("reactions")); out.set("league.t100", pts("t100")); }
  return out;
}
registerSeries(LEAGUE_CATALOG); registerLoader("league", load);
