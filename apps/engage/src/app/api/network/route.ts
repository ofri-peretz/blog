import { NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { allItems, FOOTPRINT } from "@/lib/footprint";
import { buildGraph, expandTwoHop, pruneMissingAuthors, platformSeeds, ME, type Graph } from "@/lib/network";

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

  /*
   * Widen: the platform's own leading authors, not just our neighbourhood.
   *
   * Without this the graph is a closed loop — seeded from what we already
   * touched, expanded from who that surfaced, so it can never contain anyone
   * new. Measured before adding it: 20% of the platform's top 250 by
   * engagement, and @jess (~22.7k engagement, the largest in the sample) absent
   * entirely.
   *
   * Discovery failing is not fatal. It widens the map; the map still works
   * without it, so a dead feed degrades to the old behaviour rather than
   * failing the request.
   */
  let discovered: string[] = [];
  let platform: [number, string][] = [];
  try {
    const d = await platformSeeds();
    platform = d.seeds;
    discovered = d.discovered;
  } catch (e) {
    console.warn("[network] platform discovery failed, continuing with our own seeds:", e);
  }

  const extra = await expandTwoHop(hop1);
  const built = await buildGraph([...seeds, ...platform, ...extra]);

  /*
   * Drop authors dev.to has removed.
   *
   * Their comments stay on the articles, so they keep earning edges on every
   * crawl and read as real, quiet participants indefinitely. Measured: 7 of 663
   * were gone, and the handles are dev.to's auto-generated signup pattern —
   * purged spam sitting in the network looking like reach.
   *
   * `removedAuthors` rides along in the response so the pruning is visible
   * rather than a silent shrink between two refreshes.
   */
  const { graph, removed } = await pruneMissingAuthors(built);
  if (removed.length)
    console.log(`[network] pruned ${removed.length} removed author(s): ${removed.join(", ")}`);
  (graph as Graph & { removedAuthors?: string[] }).removedAuthors = removed;

  /*
   * Mark who is NEW TERRITORY: a leading author on the platform that we have no
   * edge with in either direction. That is the actionable half of widening the
   * map — being in the graph is not the point, having a reason to reach them
   * is.
   */
  const reached = new Set<string>();
  for (const e of graph.edges) {
    if (e.from === ME) reached.add(e.to);
    if (e.to === ME) reached.add(e.from);
  }
  const targets = discovered.filter((u) => !reached.has(u));
  (graph as Graph & { discovered?: string[]; targets?: string[] }).discovered = discovered;
  (graph as Graph & { targets?: string[] }).targets = targets;
  console.log(`[network] discovered ${discovered.length} leading author(s), ${targets.length} not yet reached`);

  try {
    mkdirSync(join(FOOTPRINT, "engagement"), { recursive: true });
    writeFileSync(CACHE, JSON.stringify(graph));
  } catch {
    /* caching is an optimisation; failing to write must not fail the response */
  }
  return NextResponse.json({ ...graph, cached: false });
}
