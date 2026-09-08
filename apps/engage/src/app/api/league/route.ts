import { NextResponse } from "next/server";
import { cachedAsync } from "@/lib/cache";
import { fetchJson } from "@/lib/throttle";
import { ME } from "@/lib/me";
import {
  HOME_TAGS,
  PAGES,
  aggregate,
  arenaSummary,
  mergeLeague,
  type TagTable,
  type Climb,
} from "@/lib/league";

import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { FOOTPRINT } from "@/lib/footprint";
import { goalFrom, type PassLine } from "@/lib/league";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** The 30-day top-300 per home tag, aggregated by author. Cached 24 h; `?refresh=1`. */
const PLATFORM_PAGES = 5;

/**
 * Two samples in one crawl: the platform-wide top 500 of the last 30 days and
 * the top 300 in each home tag. The tag tables feed the arena pillar; the
 * merged league feeds the climb. 17 pages, cached 24 h.
 */
async function crawl(): Promise<{
  tables: TagTable[];
  climb: Climb;
  fetchedAt: string;
}> {
  const tables: TagTable[] = [];
  const samples: any[][] = [];
  const platform: any[] = [];
  for (let page = 1; page <= PLATFORM_PAGES; page++) {
    const batch = await fetchJson(
      `https://dev.to/api/articles?top=30&per_page=100&page=${page}`,
    );
    if (!Array.isArray(batch) || batch.length === 0) break;
    platform.push(...batch);
    await new Promise((r) => setTimeout(r, 250));
  }
  samples.push(platform);
  for (const tag of HOME_TAGS) {
    const arts: any[] = [];
    for (let page = 1; page <= PAGES; page++) {
      const batch = await fetchJson(
        `https://dev.to/api/articles?tag=${tag}&top=30&per_page=100&page=${page}`,
      );
      if (!Array.isArray(batch) || batch.length === 0) break;
      arts.push(...batch);
      await new Promise((r) => setTimeout(r, 250));
    }
    tables.push(aggregate(tag, arts, ME));
    samples.push(arts);
  }
  // The daily league row is written by /api/impact, which already owns the
  // daily rows and loads the store; this chunk cannot load node:sqlite.
  const climb = mergeLeague(samples, ME);
  return { tables, climb, fetchedAt: new Date().toISOString() };
}

/**
 * The exact league, when the loop has written it: every member's own window
 * from their profile feed (engage-league.ts, daily), so an author with nine
 * articles this month counts nine, not the four the top pages showed. The
 * same merge runs over those articles; only the input is complete.
 */
const EXACT = join(FOOTPRINT, "engagement", "league.json");
const EXACT_MAX_AGE_H = 36;
const PASSES = join(FOOTPRINT, "engagement", "league-passes.jsonl");

/** Last line per day from the loop's pass ledger. */
function passLines(): PassLine[] {
  if (!existsSync(PASSES)) return [];
  const byDay = new Map<string, PassLine>();
  for (const line of readFileSync(PASSES, "utf8").split("\n").filter(Boolean)) {
    try {
      const p = JSON.parse(line) as PassLine;
      byDay.set(p.day, p);
    } catch {
      /* a torn line is skipped, not fatal */
    }
  }
  return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
}

function exact(): {
  tables: TagTable[];
  climb: Climb;
  fetchedAt: string;
  members: any[];
  ladder: any[];
  goal: any;
  source: "exact";
} | null {
  if (!existsSync(EXACT)) return null;
  if (Date.now() - statSync(EXACT).mtimeMs > EXACT_MAX_AGE_H * 3_600_000)
    return null;
  let file: any;
  try {
    file = JSON.parse(readFileSync(EXACT, "utf8"));
  } catch {
    return null;
  }
  const members: any[] = file.members ?? [];
  const arts = members.flatMap((m) =>
    m.articles.map((a: any) => ({
      id: a.id,
      user: { username: m.author },
      public_reactions_count: a.reactions,
      comments_count: a.comments,
      tag_list: a.tags,
      title: a.title,
      url: a.url,
      published_at: a.published_at,
    })),
  );
  const tables = HOME_TAGS.map((tag) =>
    aggregate(
      tag,
      arts.filter((a) => a.tag_list.includes(tag)),
      ME,
    ),
  );
  const climb = mergeLeague([arts], ME);
  const idx = members.findIndex((m) => m.author === ME);
  // Absent from the file means no neighbours, not the top thirty.
  const ladder =
    idx === -1
      ? []
      : members.slice(Math.max(0, idx - 30), idx + 31).map((m, i) => ({
          author: m.author,
          rank: Math.max(0, idx - 30) + i + 1,
          reactions: m.reactions,
        }));
  const goal = goalFrom(
    passLines(),
    climb.rank,
    new Date().toISOString().slice(0, 10),
  );
  return {
    tables,
    climb,
    fetchedAt: file.fetchedAt,
    source: "exact",
    ladder,
    goal,
    members: members.map((m) => ({
      author: m.author,
      name: m.name,
      reactions: m.reactions,
      comments: m.comments,
      via: m.via,
      exact: m.exact !== false,
      articles: m.articles,
    })),
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const force = url.searchParams.get("refresh") === "1";
  // ?lite=1 strips the article lists: the home page needs the ladder and the goal, not 5,000 rows.
  const lite = url.searchParams.get("lite") === "1";
  // The exact file wins whenever it exists, refresh or not: the loop rewrites
  // it daily and a request-time crawl could only produce the poorer sample.
  const e = exact();
  if (e)
    return NextResponse.json({
      ...e,
      members: lite ? [] : e.members,
      arena: arenaSummary(e.tables),
      cachedAt: e.fetchedAt,
      cached: !force,
    });
  const hit = await cachedAsync("league", 24 * 3_600_000, force, crawl);
  return NextResponse.json({
    ...hit.value,
    source: "sample",
    members: [],
    arena: arenaSummary(hit.value.tables),
    cachedAt: hit.at,
    cached: !hit.fresh,
  });
}
