import { NextResponse } from "next/server";
import { sb } from "@/lib/series";
import { cachedAsync } from "@/lib/cache";
import { todayCST } from "@/lib/footprint";
import { scoreImpact, type Inputs } from "@/lib/impact-score";
import { writeImpact, impactHistory } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

const local = (path: string) => fetch(`http://localhost:${process.env.PORT ?? 7777}${path}`, { cache: "no-store" }).then((r) => r.json());
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null; };

/**
 * Assemble the 14 inputs from the routes and tables that own them, score,
 * store today's row. Every input names its source in the catalog; a source
 * that fails leaves its metric unmeasured (scored 0), never guessed.
 */
async function build() {
  const [profile, standing, yld, league, lift, journeys] = await Promise.all([
    local("/api/profile").catch(() => null),
    local("/api/standing").catch(() => null),
    local("/api/yield").catch(() => null),
    local("/api/league").catch(() => null),
    sb("v_article_download_lift?select=lift_pct,observed_on&order=observed_on.desc&limit=400").catch(() => []),
    local("/api/journeys").catch(() => null),
  ]);
  const cutoff = Date.now() - 30 * 86_400_000;
  const lifts = (lift as any[]).filter((r) => Date.parse(r.observed_on) >= cutoff).map((r) => Number(r.lift_pct)).filter(Number.isFinite);
  const devtoSessions = (journeys?.referrers ?? []).filter((r: any) => /dev\.to/.test(String(r.source))).reduce((s: number, r: any) => s + Number(r.n ?? 0), 0);
  const inputs: Inputs = {
    views_per_day_7d: profile?.readers?.viewsPerDay7 ?? null,
    read_time_avg_s_7d: profile?.readers?.readTimeAvgS7 ?? null,
    comments_per_100_views_30d: profile?.resonance?.commentsPer100Views30 ?? null,
    reactions_per_100_views_30d: profile?.resonance?.reactionsPer100Views30 ?? null,
    yield_mean14d_30d: yld?.summary?.mean14d30d ?? null,
    mutual_ties: standing?.today?.mutual ?? null,
    in_authors_90d: standing?.today?.in_authors ?? null,
    core_reach: standing?.today?.core_reach ?? null,
    reply_latency_h: standing?.today?.reply_latency_h ?? null,
    arena_percentile: league?.arena?.percentile ?? null,
    arena_tags_present: league?.arena?.present ?? null,
    npm_lift_median_30d: lifts.length ? median(lifts) : null,
    blog_sessions_from_devto_30d: journeys?.referrers ? devtoSessions : null,
    followers_who_commented: profile?.followers?.commentersWhoFollow ?? null,
  };
  const result = scoreImpact(inputs);
  const day = todayCST();
  writeImpact(day, result);
  return { day, ...result, climb: league?.climb ? { rank: league.climb.rank, authors: league.climb.authors, next: league.climb.next, plan: league.climb.plan } : null, league: league?.tables?.map((t: any) => ({ tag: t.tag, rank: t.rank, authors: t.authors, above: t.above, ours: t.ours })) ?? [], history: impactHistory() };
}

export async function GET(req: Request) {
  const force = new URL(req.url).searchParams.get("refresh") === "1";
  const hit = await cachedAsync("impact", 6 * 3_600_000, force, build);
  return NextResponse.json({ ...hit.value, cachedAt: hit.at, cached: !hit.fresh });
}
