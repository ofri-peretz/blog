import { NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { allItems, FOOTPRINT } from "@/lib/footprint";
import { buildGraph, expandTwoHop } from "@/lib/network";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const CACHE = join(FOOTPRINT, "engagement", "network-graph.json");
const MAX_AGE_MS = 12 * 3600_000;

/**
 * The 2-hop crawl costs ~130 Dev.to requests and ~40s. Running it on every page
 * view is both a bad experience and a waste of a public API's goodwill — the
 * community graph does not meaningfully change hour to hour.
 *
 * So it is cached to disk for 12h and refreshed with `?refresh=1`. One creator,
 * finite quota: pay for the crawl deliberately, not as a side effect of opening
 * a tab.
 */
export async function GET(req: Request) {
  const url0 = new URL(req.url);
  const force = url0.searchParams.has("refresh");
  if (!force && existsSync(CACHE)) {
    try {
      const cached = JSON.parse(readFileSync(CACHE, "utf8"));
      if (Date.now() - Date.parse(cached.fetchedAt) < MAX_AGE_MS)
        return NextResponse.json({ ...cached, cached: true });
    } catch {
      /* a corrupt cache must fall through to a live crawl, never fail the page */
    }
  }
  // Seeded from articles we have actually engaged with — the graph we can
  // observe, not a crawl of all of Dev.to.
  const seen = new Map<number, string>();
  for (const i of allItems()) seen.set(i.article.id, i.article.author);
  const seeds: [number, string][] = [...seen.entries()].slice(0, 60);
  const hop1 = await buildGraph(seeds);

  // Second hop unless explicitly skipped. Without it `clusters` is always 0 —
  // one hop cannot observe reciprocity, only who showed up on our own picks.
  if (url0.searchParams.get("hops") === "1") return NextResponse.json(hop1);

  const extra = await expandTwoHop(hop1);
  const graph = await buildGraph([...seeds, ...extra]);
  try {
    mkdirSync(join(FOOTPRINT, "engagement"), { recursive: true });
    writeFileSync(CACHE, JSON.stringify(graph));
  } catch {
    /* caching is an optimisation; failing to write must not fail the response */
  }
  return NextResponse.json({ ...graph, cached: false });
}
