import { NextResponse } from "next/server";
import { cachedAsync } from "@/lib/cache";
import { sbPaged } from "@/lib/series";
import { fetchJson } from "@/lib/throttle";
import { devtoKey } from "@/lib/footprint";
import { decay, summarize, type Snap } from "@/lib/decay";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Three points on every article's view curve. Cached 6 h. */
async function build() {
  const key = devtoKey();
  const articles: any[] = [];
  for (let page = 1; page <= 3; page++) {
    const batch = await fetchJson(
      `https://dev.to/api/articles/me/published?per_page=100&page=${page}`,
      { headers: key ? { "api-key": key } : {} },
    );
    if (!Array.isArray(batch) || batch.length === 0) break;
    articles.push(...batch);
    if (batch.length < 100) break;
  }
  const snaps = (await sbPaged(
    "article_daily_snapshots?select=external_id,observed_on,views&source=eq.devto&order=observed_on.asc",
  )) as Snap[];
  const rows = articles.map((a) =>
    decay(
      {
        slug: a.slug,
        title: a.title,
        published_at: a.published_at,
        url: a.url,
      },
      snaps,
    ),
  );
  return {
    articles: rows.length,
    summary: summarize(rows),
    rows: rows.sort((a, b) => b.publishedOn.localeCompare(a.publishedOn)),
    caveat:
      "Feed: 70% of views by day three. Search: 40% after day fourteen. Rate: views per day over the last fourteen days. Windows must start within two days of publish.",
  };
}

export async function GET(req: Request) {
  const force = new URL(req.url).searchParams.get("refresh") === "1";
  const hit = await cachedAsync("decay", 6 * 3_600_000, force, build);
  return NextResponse.json({
    ...hit.value,
    cachedAt: hit.at,
    cached: !hit.fresh,
  });
}
