import { NextResponse } from "next/server";
import { cachedAsync } from "@/lib/cache";
import { sb } from "@/lib/series";
import { fetchJson } from "@/lib/throttle";
import { HOME_TAGS } from "@/lib/league";
import { rank, type RadarIn } from "@/lib/radar";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Rising and fresh per home tag, deduped and ranked. Cached 15 minutes: velocity is the point. */
async function build() {
  const articles: RadarIn[] = [];
  const errors: string[] = [];
  for (const tag of HOME_TAGS) {
    for (const state of ["rising", "fresh"]) {
      try {
        const batch = await fetchJson(
          `https://dev.to/api/articles?tag=${tag}&state=${state}&per_page=30`,
        );
        if (Array.isArray(batch)) articles.push(...batch);
      } catch (e) {
        errors.push(
          `${tag}/${state}: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }
  }
  // The warehouse knows which articles we already commented on.
  const out = await sb(
    "devto_comments?select=article_id&direction=eq.out&limit=1000",
  ).catch(() => []);
  const commented = new Set<number>(
    (out as any[]).map((r) => Number(r.article_id)),
  );
  return {
    rows: rank(articles, commented),
    pulled: articles.length,
    tags: HOME_TAGS,
    errors,
    caveat:
      "Reactions per hour since publish, times one plus the subject hits. dev.to's own rising and fresh feeds; nothing here posts.",
  };
}

export async function GET(req: Request) {
  const force = new URL(req.url).searchParams.get("refresh") === "1";
  const hit = await cachedAsync("radar", 15 * 60_000, force, build);
  return NextResponse.json({
    ...hit.value,
    cachedAt: hit.at,
    cached: !hit.fresh,
  });
}
