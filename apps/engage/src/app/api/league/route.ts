import { NextResponse } from "next/server";
import { cachedAsync } from "@/lib/cache";
import { fetchJson } from "@/lib/throttle";
import { ME } from "@/lib/me";
import { HOME_TAGS, PAGES, aggregate, arenaSummary, type TagTable } from "@/lib/league";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** The 30-day top-300 per home tag, aggregated by author. Cached 24 h; `?refresh=1`. */
async function crawl(): Promise<{ tables: TagTable[]; fetchedAt: string }> {
  const tables: TagTable[] = [];
  for (const tag of HOME_TAGS) {
    const arts: any[] = [];
    for (let page = 1; page <= PAGES; page++) {
      const batch = await fetchJson(`https://dev.to/api/articles?tag=${tag}&top=30&per_page=100&page=${page}`);
      if (!Array.isArray(batch) || batch.length === 0) break;
      arts.push(...batch);
      await new Promise((r) => setTimeout(r, 250));
    }
    tables.push(aggregate(tag, arts, ME));
  }
  return { tables, fetchedAt: new Date().toISOString() };
}

export async function GET(req: Request) {
  const force = new URL(req.url).searchParams.get("refresh") === "1";
  const hit = await cachedAsync("league", 24 * 3_600_000, force, crawl);
  return NextResponse.json({ ...hit.value, arena: arenaSummary(hit.value.tables), cachedAt: hit.at, cached: !hit.fresh });
}
