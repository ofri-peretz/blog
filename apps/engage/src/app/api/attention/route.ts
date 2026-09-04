import { NextResponse } from "next/server";
import { cachedAsync } from "@/lib/cache";
import { sb } from "@/lib/series";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Attention — what the platform's staff publish and whom they feature and
 * engage, who stars us and when, and the days something outside dev.to sent
 * readers. Read from the warehouse the ingest fills daily
 * (impact-ingest devto-attention.ts). Intent 2026-09-04-engage-attention.
 */
const OWN = "ofri-peretz";
const iso = (d: number) =>
  new Date(Date.now() - d * 86_400_000).toISOString().slice(0, 10);

async function build() {
  const [posts, features, staffComments, events, stars] = await Promise.all([
    sb(
      `v_devto_staff_posts?select=*&published_at=gte.${iso(60)}&order=published_at.desc&limit=200`,
    ),
    sb(
      `v_devto_features?select=*&published_at=gte.${iso(120)}&order=published_at.desc&limit=500`,
    ),
    sb(
      `v_devto_staff_comments?select=*&created_at=gte.${iso(60)}&order=created_at.desc&limit=500`,
    ),
    sb(
      `v_devto_attention_events?select=*&observed_on=gte.${iso(120)}&order=observed_on.desc&limit=200`,
    ),
    sb(
      `v_github_stars_daily?select=*&observed_on=gte.${iso(120)}&order=observed_on.desc&limit=400`,
    ),
  ]);

  // Features by person: who gets picked, how often, and whether we ever were.
  const byAuthor = new Map<
    string,
    { author: string; times: number; programs: Set<string>; last: string }
  >();
  for (const f of features as any[]) {
    const e = byAuthor.get(f.featured_username) ?? {
      author: f.featured_username,
      times: 0,
      programs: new Set<string>(),
      last: "",
    };
    e.times += 1;
    e.programs.add(f.program);
    if (f.published_at > e.last) e.last = f.published_at;
    byAuthor.set(f.featured_username, e);
  }
  const featured = [...byAuthor.values()]
    .map((e) => ({ ...e, programs: [...e.programs] }))
    .sort((a, b) => b.times - a.times || b.last.localeCompare(a.last));

  // Staff comments by the author they went to: whom the founders engage.
  const engaged = new Map<
    string,
    { author: string; comments: number; staff: Set<string>; last: string }
  >();
  for (const c of staffComments as any[]) {
    const e = engaged.get(c.article_author) ?? {
      author: c.article_author,
      comments: 0,
      staff: new Set<string>(),
      last: "",
    };
    e.comments += 1;
    e.staff.add(c.staff);
    if (c.created_at > e.last) e.last = c.created_at;
    engaged.set(c.article_author, e);
  }
  const engagedRows = [...engaged.values()]
    .map((e) => ({ ...e, staff: [...e.staff] }))
    .sort((a, b) => b.comments - a.comments);

  const programs = new Map<string, number>();
  for (const p of posts as any[])
    if (p.program) programs.set(p.program, (programs.get(p.program) ?? 0) + 1);

  return {
    posts: (posts as any[]).slice(0, 60),
    programs: [...programs].map(([program, n]) => ({ program, n })),
    featured: featured.slice(0, 40),
    featuredUs: byAuthor.get(OWN)
      ? { times: byAuthor.get(OWN)!.times, last: byAuthor.get(OWN)!.last }
      : null,
    engaged: engagedRows.slice(0, 40),
    engagedUs: engaged.get(OWN)
      ? {
          comments: engaged.get(OWN)!.comments,
          staff: [...engaged.get(OWN)!.staff],
        }
      : null,
    events,
    stars: (stars as any[]).reduce((s, r) => s + Number(r.stars ?? 0), 0),
    caveat:
      "Public posts and comments by the verified staff list; features are the dev.to links a feature post embeds. Events are derived: a promotion domain's daily delta above its 28-day mean plus two sigma, or more than three stars in a day.",
  };
}

export async function GET(req: Request) {
  const force = new URL(req.url).searchParams.get("refresh") === "1";
  const hit = await cachedAsync("attention", 3_600_000, force, build);
  return NextResponse.json({
    ...hit.value,
    cachedAt: hit.at,
    cached: !hit.fresh,
  });
}
