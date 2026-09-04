import { NextResponse } from "next/server";
import { cachedAsync } from "@/lib/cache";
import { sbPaged } from "@/lib/series";
import { fetchJson } from "@/lib/throttle";
import { devtoKey } from "@/lib/footprint";
import { levers, type ArticleIn, type Snap } from "@/lib/levers";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Rank correlation between article shape and outcome, over our own articles. Cached 6 h. */
async function build() {
  const key = devtoKey();
  const articles: ArticleIn[] = [];
  for (let page = 1; page <= 3; page++) {
    const batch = await fetchJson(`https://dev.to/api/articles/me/published?per_page=100&page=${page}`, { headers: key ? { "api-key": key } : {} });
    if (!Array.isArray(batch) || batch.length === 0) break;
    articles.push(...batch);
    if (batch.length < 100) break;
  }
  const snaps = (await sbPaged("article_daily_snapshots?select=external_id,observed_on,views,comments&source=eq.devto&order=observed_on.asc")) as Snap[];
  const all = levers(articles, snaps);
  const windows = articles.filter((a) => snaps.some((s) => s.external_id === a.slug)).length;
  return {
    articles: articles.length,
    withSnapshots: windows,
    // Visibility threshold: n ≥ 20 and |r| ≥ 0.2. Below that a coefficient over
    // this many articles is noise wearing a decimal.
    levers: all.filter((l) => l.n >= 20 && Math.abs(l.r) >= 0.2),
    all,
    caveat: "Spearman rank correlation over our own articles. Correlation, not cause; n is printed on every row.",
  };
}

export async function GET(req: Request) {
  const force = new URL(req.url).searchParams.get("refresh") === "1";
  const hit = await cachedAsync("levers", 6 * 3_600_000, force, build);
  return NextResponse.json({ ...hit.value, cachedAt: hit.at, cached: !hit.fresh });
}
