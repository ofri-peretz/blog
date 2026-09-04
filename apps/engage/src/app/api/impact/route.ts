import { NextResponse } from "next/server";
import { sb } from "@/lib/series";
import { devtoReach } from "@/lib/sources";
import { cachedAsync } from "@/lib/cache";
import { todayCST } from "@/lib/footprint";
import { scoreImpact, type Inputs } from "@/lib/impact-score";
import { writeImpact, impactHistory, writeLeague } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

const local = (path: string) =>
  fetch(`http://localhost:${process.env.PORT ?? 7777}${path}`, {
    cache: "no-store",
  }).then((r) => r.json());
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length
    ? s.length % 2
      ? s[(s.length - 1) / 2]
      : (s[s.length / 2 - 1] + s[s.length / 2]) / 2
    : null;
};

/**
 * Assemble the 14 inputs from the routes and tables that own them, score,
 * store today's row. Every input names its source in the catalog; a source
 * that fails leaves its metric unmeasured (scored 0), never guessed.
 */
async function build() {
  const [profile, standing, yld, league, lift, reach] = await Promise.all([
    local("/api/profile").catch(() => null),
    local("/api/standing").catch(() => null),
    local("/api/yield").catch(() => null),
    local("/api/league").catch(() => null),
    // The view carries slug and lift only; the payload has the scope (which
    // plugin, or the ecosystem) and the two means, which the panel prints.
    sb(
      "metric_snapshots?select=dimension,value,observed_on,payload&source=eq.computed&kind=eq.article_download_lift_pct&order=observed_on.desc&limit=400",
    ).catch(() => null),
    devtoReach().catch(() => null),
  ]);
  // Latest row per article, then the 30-day median. "30 days" is the article's
  // publish date, not the row's: the writer re-observes old articles daily.
  const cutoff = Date.now() - 30 * 86_400_000;
  const latest = new Map<string, any>();
  for (const r of (lift ?? []) as any[])
    if (!latest.has(r.dimension)) latest.set(r.dimension, r);
  const lifts = [...latest.values()]
    .map((r) => ({
      slug: r.dimension,
      lift: Number(r.value),
      scope: String(r.payload?.scope ?? "ecosystem").replace(
        /^eslint-plugin-/,
        "",
      ),
      pre: r.payload?.pre ?? null,
      post: r.payload?.post ?? null,
      publishedOn: r.payload?.published_on ?? null,
    }))
    .sort((a, b) => String(b.publishedOn).localeCompare(String(a.publishedOn)));
  const recent = lifts
    .filter((l) => l.publishedOn && Date.parse(l.publishedOn) >= cutoff)
    .map((l) => l.lift)
    .filter(Number.isFinite);
  const inputs: Inputs = {
    views_per_day_7d: profile?.readers?.viewsPerDay7 ?? null,
    read_time_avg_s_7d: profile?.readers?.readTimeAvgS7 ?? null,
    comments_per_100_views_30d:
      profile?.resonance?.commentsPer100Views30 ?? null,
    reactions_per_100_views_30d:
      profile?.resonance?.reactionsPer100Views30 ?? null,
    yield_mean14d_30d: yld?.summary?.mean14d30d ?? null,
    mutual_ties: standing?.today?.mutual ?? null,
    in_authors_90d: standing?.today?.in_authors ?? null,
    core_reach: standing?.today?.core_reach ?? null,
    reply_latency_h: standing?.today?.reply_latency_h ?? null,
    arena_percentile: league?.arena?.percentile ?? null,
    arena_tags_present: league?.arena?.present ?? null,
    npm_lift_median_30d: lift ? (recent.length ? median(recent) : null) : null,
    blog_sessions_from_devto_30d: reach?.sessions ?? null,
    followers_who_commented: profile?.followers?.commentersWhoFollow ?? null,
  };
  const result = scoreImpact(inputs);
  const day = todayCST();
  writeImpact(day, result);
  if (league?.climb)
    try {
      writeLeague(day, league.climb);
    } catch {
      /* the series is a convenience */
    }
  const downstream = {
    lifts: lifts.slice(0, 12),
    liftsInWindow: recent.length,
    reach:
      // devtoReach() never throws; both queries failing is the "unreachable" case.
      reach && (reach.sessions != null || reach.clicks)
        ? {
            sessions: reach.sessions,
            clicks: reach.clicks,
            classifiedSince: "2026-09-04",
          }
        : null,
    followers: profile?.followers
      ? {
          commented: profile.followers.commentersWhoFollow ?? null,
          commenters: profile.followers.distinctCommenters ?? null,
          total: profile.followers.total ?? null,
        }
      : null,
  };
  return {
    day,
    ...result,
    downstream,
    climb: league?.climb
      ? {
          rank: league.climb.rank,
          authors: league.climb.authors,
          next: league.climb.next,
          plan: league.climb.plan,
        }
      : null,
    league:
      league?.tables?.map((t: any) => ({
        tag: t.tag,
        rank: t.rank,
        authors: t.authors,
        above: t.above,
        ours: t.ours,
      })) ?? [],
    history: impactHistory(),
  };
}

export async function GET(req: Request) {
  const force = new URL(req.url).searchParams.get("refresh") === "1";
  const hit = await cachedAsync("impact", 6 * 3_600_000, force, build);
  return NextResponse.json({
    ...hit.value,
    cachedAt: hit.at,
    cached: !hit.fresh,
  });
}
