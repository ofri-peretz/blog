import { NextResponse } from "next/server";
import { cachedAsync } from "@/lib/cache";
import { fetchJson } from "@/lib/throttle";
import { ME } from "@/lib/me";
import { HOME_TAGS, PAGES, aggregate, arenaSummary, mergeLeague, type TagTable, type Climb } from "@/lib/league";
import { writeLeague } from "@/lib/store";
import { todayCST } from "@/lib/footprint";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** The 30-day top-300 per home tag, aggregated by author. Cached 24 h; `?refresh=1`. */
const PLATFORM_PAGES = 5;

/**
 * Two samples in one crawl: the platform-wide top 500 of the last 30 days and
 * the top 300 in each home tag. The tag tables feed the arena pillar; the
 * merged league feeds the climb. 17 pages, cached 24 h.
 */
async function crawl(): Promise<{ tables: TagTable[]; climb: Climb; fetchedAt: string }> {
  const tables: TagTable[] = [];
  const samples: any[][] = [];
  const platform: any[] = [];
  for (let page = 1; page <= PLATFORM_PAGES; page++) {
    const batch = await fetchJson(`https://dev.to/api/articles?top=30&per_page=100&page=${page}`);
    if (!Array.isArray(batch) || batch.length === 0) break;
    platform.push(...batch);
    await new Promise((r) => setTimeout(r, 250));
  }
  samples.push(platform);
  for (const tag of HOME_TAGS) {
    const arts: any[] = [];
    for (let page = 1; page <= PAGES; page++) {
      const batch = await fetchJson(`https://dev.to/api/articles?tag=${tag}&top=30&per_page=100&page=${page}`);
      if (!Array.isArray(batch) || batch.length === 0) break;
      arts.push(...batch);
      await new Promise((r) => setTimeout(r, 250));
    }
    tables.push(aggregate(tag, arts, ME));
    samples.push(arts);
  }
  const climb = mergeLeague(samples, ME);
  try { writeLeague(todayCST(), climb); } catch { /* the series is a convenience; the page must not fail on it */ }
  return { tables, climb, fetchedAt: new Date().toISOString() };
}

export async function GET(req: Request) {
  const force = new URL(req.url).searchParams.get("refresh") === "1";
  const hit = await cachedAsync("league", 24 * 3_600_000, force, crawl);
  return NextResponse.json({ ...hit.value, arena: arenaSummary(hit.value.tables), cachedAt: hit.at, cached: !hit.fresh });
}
