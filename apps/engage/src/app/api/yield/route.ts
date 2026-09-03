import { NextResponse } from "next/server";
import { todayCST } from "@/lib/footprint";
import { cachedAsync } from "@/lib/cache";
import { fetchJson } from "@/lib/throttle";
import { ME } from "@/lib/threads";
import { yieldOf, summarize, type YieldRow } from "@/lib/yield";
import { writeYield, yieldHistory } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

/**
 * First-14-day comment yield per article, from dev.to's own timestamps.
 *
 * Intent: docs/sdlc/intents/2026-09-03-engage-comment-yield. Only articles
 * with any comment are crawled (15 of 85 today), paced through the shared
 * throttle, cached 12 h on disk, `?refresh=1` past it. Today's summary row is
 * written to engage.db so the terminal has a series.
 */
async function crawl(): Promise<{ rows: YieldRow[]; crawled: number; failed: number }> {
  const articles: any[] = [];
  for (let page = 1; page <= 5; page++) {
    const batch = await fetchJson(`https://dev.to/api/articles?username=${ME}&per_page=100&page=${page}`);
    if (!Array.isArray(batch) || batch.length === 0) break;
    articles.push(...batch);
    if (batch.length < 100) break;
  }
  const rows: YieldRow[] = [];
  let crawled = 0;
  let failed = 0;
  for (const a of articles) {
    let tree: any[] = [];
    if (a.comments_count > 0) {
      try {
        tree = await fetchJson(`https://dev.to/api/comments?a_id=${a.id}`);
        crawled++;
        await new Promise((r) => setTimeout(r, 150));
      } catch {
        // A tree we could not read is a FLOOR for that article, and is counted
        // so the caller can say "incomplete" instead of presenting a low number.
        failed++;
      }
    }
    rows.push(yieldOf({ id: a.id, title: a.title, url: a.url, published_at: a.published_at }, tree, ME));
  }
  return { rows, crawled, failed };
}

export async function GET(req: Request) {
  const force = new URL(req.url).searchParams.get("refresh") === "1";
  const hit = await cachedAsync("yield", 12 * 3_600_000, force, crawl);
  const summary = summarize(hit.value.rows);
  const day = todayCST();
  if (hit.value.failed === 0) writeYield(day, summary);
  return NextResponse.json({
    day,
    summary,
    rows: [...hit.value.rows].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)),
    crawled: hit.value.crawled,
    failed: hit.value.failed,
    cachedAt: hit.at,
    cached: !hit.fresh,
    history: yieldHistory(),
    hint: hit.value.failed ? `${hit.value.failed} comment tree(s) could not be read — counts are a floor; press refresh` : null,
  });
}
