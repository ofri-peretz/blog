import { NextResponse } from "next/server";
import { cachedAsync } from "@/lib/cache";
import { sbPaged } from "@/lib/series";
import {
  fold,
  followerSplit,
  goingCold,
  owed,
  type CommentRow,
  type FollowerRow,
} from "@/lib/ties";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** The comment ledger folded by person, and the follower split. Cached 1 h. */
async function build() {
  const [comments, followers] = await Promise.all([
    sbPaged(
      "devto_comments?select=author,article_author,direction,created_at&order=created_at.asc",
    ) as Promise<CommentRow[]>,
    sbPaged("devto_followers?select=onboarding&order=user_id.asc") as Promise<
      FollowerRow[]
    >,
  ]);
  const ties = fold(comments);
  return {
    ties: ties.length,
    mutual: ties.filter((t) => t.mutual).length,
    goingCold: goingCold(ties).slice(0, 12),
    owed: owed(ties).slice(0, 12),
    followers: followerSplit(followers),
    caveat:
      "Outbound rows record the article's author, so a reply left in someone else's thread counts toward the article's author. Warm within 14 days, cooling within 45, cold after. Nothing here posts.",
  };
}

export async function GET(req: Request) {
  const force = new URL(req.url).searchParams.get("refresh") === "1";
  const hit = await cachedAsync("ties", 3_600_000, force, build);
  return NextResponse.json({
    ...hit.value,
    cachedAt: hit.at,
    cached: !hit.fresh,
  });
}
