/**
 * dev.to daily analytics as series — the owner analytics API, stored by the
 * ingest in devto_daily_analytics (own-the-data intent). These are TRUE daily
 * rates from the platform, not differences of cumulative totals, and they
 * carry the two numbers no other source has: read time, and follows split
 * by whether the account was created the same day (onboarding suggestions).
 */
import "server-only";
import { registerSeries, registerLoader, sb, type SeriesDef, type Point } from "./series";

const SRC = "supabase:devto_daily_analytics";
const rate = { group: "Audience", unit: "count" as const, kind: "rate" as const, staleAfterHours: 36 };
export const DEVTO_CATALOG: SeriesDef[] = [
  { id: "devto.daily_views", label: "dev.to views / day", goodDirection: "up", ...rate, source: SRC },
  { id: "devto.daily_reactions", label: "dev.to reactions / day", goodDirection: "up", ...rate, source: SRC },
  { id: "devto.daily_comments", label: "dev.to comments / day", goodDirection: "up", ...rate, source: SRC },
  { id: "devto.daily_follows", label: "dev.to follows / day", goodDirection: "up", ...rate, source: SRC, caveat: "includes onboarding suggestions — see onboarding follows" },
  { id: "devto.onboarding_follows", label: "follows from same-day accounts / day", goodDirection: "down", ...rate, source: "supabase:devto_followers", caveat: "accounts created the day they followed: dev.to onboarding, not readers" },
  { id: "devto.read_time_avg_s", label: "average read time, seconds", group: "Audience", unit: "count", kind: "gauge", goodDirection: "up", staleAfterHours: 36, source: SRC },
];

async function load(): Promise<Map<string, Point[]>> {
  const out = new Map<string, Point[]>();
  const rows = await sb("v_devto_daily_analytics?select=*&order=observed_on.asc&limit=2000");
  const pts = (f: string): Point[] => rows.filter((r) => r[f] != null).map((r) => ({ t: String(r.observed_on), v: Number(r[f]) }));
  if (rows.length) {
    out.set("devto.daily_views", pts("views"));
    out.set("devto.daily_reactions", pts("reactions_total"));
    out.set("devto.daily_comments", pts("comments"));
    out.set("devto.daily_follows", pts("follows"));
    out.set("devto.read_time_avg_s", pts("read_time_avg_s"));
  }
  const fol = await sb("v_devto_followers_daily?select=*&order=observed_on.asc&limit=2000").catch(() => []);
  if (fol.length) out.set("devto.onboarding_follows", fol.map((r) => ({ t: String(r.observed_on), v: Number(r.onboarding_follows ?? 0) })));
  return out;
}
registerSeries(DEVTO_CATALOG);
registerLoader("devto-analytics", load);
