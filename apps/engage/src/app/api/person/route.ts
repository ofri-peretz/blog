import { NextResponse } from "next/server";
import { devtoKey, allItems } from "@/lib/footprint";
import { fetchJson } from "@/lib/throttle";
import { cachedAuthor, cacheAuthor } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

const DAY = 86_400_000;

async function dev(path: string) {
  const key = devtoKey();
  return fetchJson(`https://dev.to/api${path}`, {
    headers: key ? { "api-key": key } : {},
  });
}

/**
 * Everything we can observe about one author, plus the classified actions.
 *
 * Cached per author for 6h — this is the narrow cache-miss the whole store was
 * built for. Acting on someone invalidates only their row; everybody else stays
 * warm, so opening a profile costs one crawl, not a full refresh.
 *
 * Their follower count is deliberately absent: Dev.to exposes followers only for
 * your own account. A panel showing it would be inventing the number.
 */
export async function GET(req: Request) {
  const username = new URL(req.url).searchParams.get("u")?.trim();
  if (!username)
    return NextResponse.json({ error: "missing ?u=username" }, { status: 400 });

  const cached = cachedAuthor<any>(username, 6 * 3600_000);
  if (cached) return NextResponse.json({ ...cached, cached: true });

  let articles: any[] = [];
  try {
    articles = await dev(
      `/articles?username=${encodeURIComponent(username)}&per_page=60`,
    );
  } catch (e) {
    return NextResponse.json({
      username,
      error: e instanceof Error ? e.message : String(e),
      articles: [],
    });
  }
  if (!Array.isArray(articles)) articles = [];

  const posts = articles.map((a) => ({
    id: a.id,
    title: a.title,
    url: a.url,
    at: a.published_at,
    reactions: a.public_reactions_count ?? 0,
    comments: a.comments_count ?? 0,
    tags: a.tag_list ?? [],
    ageDays: Math.floor((Date.now() - Date.parse(a.published_at)) / DAY),
  }));

  // Cadence from real gaps between consecutive posts. Median, not mean: one
  // two-year-old first post would drag a mean into nonsense.
  const times = posts.map((p) => Date.parse(p.at)).sort((a, b) => a - b);
  const gaps: number[] = [];
  for (let i = 1; i < times.length; i++) gaps.push((times[i] - times[i - 1]) / DAY);
  gaps.sort((a, b) => a - b);
  const medianGap = gaps.length ? gaps[Math.floor(gaps.length / 2)] : null;

  const reactionCounts = posts.map((p) => p.reactions).sort((a, b) => a - b);
  const medianReactions = reactionCounts.length
    ? reactionCounts[Math.floor(reactionCounts.length / 2)]
    : 0;

  // Publish-day histogram — "they ship Tue/Thu" is actionable; a mean is not.
  const dow = [0, 0, 0, 0, 0, 0, 0];
  for (const t of times) dow[new Date(t).getUTCDay()]++;

  const tagCounts = new Map<string, number>();
  for (const p of posts)
    for (const t of p.tags) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);

  // Our own history with them.
  const ours = allItems().filter((i) => i.article.author === username);
  const sent = ours.filter((i) => i.status === "posted");
  const lastTouch = ours.map((i) => i.date).sort().pop() ?? null;

  const fresh = posts.filter((p) => p.ageDays <= 7);
  const actions: { kind: string; why: string; url?: string }[] = [];

  if (fresh.length)
    actions.push({
      kind: "react now",
      why: `${fresh.length} article(s) inside the 7-day window — a positive reaction banks a permanent x1.5 reputation multiplier if they take Top 7 this week.`,
      url: fresh[0].url,
    });
  if (ours.length && sent.length === 0)
    actions.push({
      kind: "commit or drop",
      why: `Drafted at ${ours.length} time(s), sent 0. The queue keeps proposing them and nobody ever completes it.`,
    });
  if (medianReactions > 5)
    actions.push({
      kind: "study",
      why: `Median ${medianReactions} reactions/post — above our own corpus median of 0. Worth reading what they do that we don't.`,
    });
  if (medianGap != null && medianGap < 4)
    actions.push({
      kind: "high cadence",
      why: `Ships every ~${medianGap.toFixed(1)} days. Frequent flyers are reliably in the fresh-article window.`,
    });

  const payload = {
    username,
    profile: `https://dev.to/${username}`,
    posts: posts.slice(0, 30),
    stats: {
      postCount: posts.length,
      medianGapDays: medianGap,
      medianReactions,
      totalReactions: posts.reduce((s, p) => s + p.reactions, 0),
      totalComments: posts.reduce((s, p) => s + p.comments, 0),
      dow,
      topTags: [...tagCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([t, n]) => ({ tag: t, n })),
    },
    ours: { drafted: ours.length, sent: sent.length, lastTouch },
    actions,
    error: null,
  };

  try {
    cacheAuthor(username, payload);
  } catch {
    /* cache is an optimisation; a failure here must not fail the read */
  }
  return NextResponse.json({ ...payload, cached: false });
}
