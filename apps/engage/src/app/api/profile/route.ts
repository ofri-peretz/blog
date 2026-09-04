import { NextResponse } from "next/server";
import { sb, sbPaged } from "@/lib/series";
import { cachedAsync } from "@/lib/cache";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * How is the profile doing — readers, resonance, standing — read off the
 * dev.to warehouse rather than the follower count. Own-the-data intent.
 *
 * Every number here names its window. "Followers who ever commented" is the
 * one honest proxy for "followers who read": dev.to exposes no per-reader
 * views, but a follower who left a comment on us certainly read.
 */
const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
const r1 = (x: number | null) => (x == null ? null : Math.round(x * 10) / 10);

async function build() {
  const days = await sb("v_devto_daily_analytics?select=*&order=observed_on.desc&limit=30");
  const d7 = days.slice(0, 7);
  const d30 = days;
  const views30 = d30.reduce((s, r) => s + Number(r.views ?? 0), 0);
  const fol = await sb("v_devto_followers_daily?select=*&order=observed_on.desc&limit=30").catch(() => []);
  const follows30 = fol.reduce((s, r) => s + Number(r.follows ?? 0), 0);
  const onboarding30 = fol.reduce((s, r) => s + Number(r.onboarding_follows ?? 0), 0);
  const [followers, commenters, refs] = await Promise.all([
    // PostgREST caps a page at 1,000 rows; there are 1,884 followers. Page, or the total lies.
    sbPaged("devto_followers?select=username,onboarding&order=user_id.asc").catch(() => []),
    sbPaged("v_devto_comments?select=author,direction,created_at,our_reply_at&direction=eq.in&order=comment_id.asc").catch(() => []),
    sb("v_devto_referrers_daily?select=domain,views,observed_on&order=observed_on.desc,views.desc&limit=40").catch(() => []),
  ]);
  const followerSet = new Set(followers.map((f) => f.username));
  const commentAuthors = new Set(commenters.map((c) => c.author));
  const commentersWhoFollow = [...commentAuthors].filter((a) => followerSet.has(a)).length;
  const latestRefDay = refs[0]?.observed_on ?? null;
  const referrers = refs.filter((r) => r.observed_on === latestRefDay && r.domain).slice(0, 6).map((r) => ({ domain: r.domain, views: Number(r.views) }));
  return {
    asOf: days[0]?.observed_on ?? null,
    days: days.length,
    readers: {
      viewsPerDay7: r1(mean(d7.map((r) => Number(r.views ?? 0)))),
      readTimeAvgS7: r1(mean(d7.filter((r) => r.read_time_avg_s != null).map((r) => Number(r.read_time_avg_s)))),
      views30,
    },
    resonance: {
      reactionsPer100Views30: views30 ? r1((100 * d30.reduce((s, r) => s + Number(r.reactions_total ?? 0), 0)) / views30) : null,
      commentsPer100Views30: views30 ? r1((100 * d30.reduce((s, r) => s + Number(r.comments ?? 0), 0)) / views30) : null,
    },
    followers: {
      total: followers.length || null,
      followsPerDay7: r1(mean(fol.slice(0, 7).map((r) => Number(r.follows ?? 0)))),
      onboardingShare30: follows30 ? Math.round((100 * onboarding30) / follows30) : null,
      onboardingTotal: followers.filter((f) => f.onboarding === true).length,
      commentersWhoFollow,
      distinctCommenters: commentAuthors.size,
    },
    referrers,
    hint: days.length ? null : "no warehouse rows yet — run the dev.to warehouse ingest (impact-ingest: npm run devto:backfill)",
  };
}

export async function GET(req: Request) {
  const force = new URL(req.url).searchParams.get("refresh") === "1";
  const hit = await cachedAsync("profile", 60 * 60_000, force, build);
  return NextResponse.json({ ...hit.value, cachedAt: hit.at, cached: !hit.fresh });
}
