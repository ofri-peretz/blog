import "server-only";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { FOOTPRINT } from "@/lib/footprint";
import { registerLoader, registerSeries, type Point, type SeriesDef } from "@/lib/series";

/**
 * Adoption as a series — conquest step 6, built at the depth the data actually
 * supports rather than the depth the plan assumed.
 *
 * THE MEASUREMENT THAT CHANGED THIS ITEM. `repos.json` holds 23 nodes and
 * exactly TWO carry a date (`mergedOn`: 2026-08-02, 2026-08-03). The other four
 * merged/approved outcomes have none. Reconstructing `adoption.held` from that
 * yields a two-point step function, and putting two points on the same axis as
 * a 90-point download curve does not read as "we have two observations" — it
 * reads as a history. The chart would be the most confident thing on the page
 * and the least supported.
 *
 * So this file does not reconstruct history. It ACCUMULATES it: one snapshot
 * line per day in `adoption/history.jsonl`, seeded with the dated outcomes we
 * do have. The series is honestly sparse today and gets denser on its own, and
 * detect.ts already reports `insufficient` rather than drawing a trend through
 * too few points — that path is load-bearing here, not a fallback.
 *
 * The alternative was backfilling dates by reading git or PR timestamps. That
 * would produce a fuller chart of numbers nobody measured, which is the same
 * defect wearing better clothes.
 */

const DIR = join(FOOTPRINT, "adoption");
const REPOS = join(DIR, "repos.json");
const HISTORY = join(DIR, "history.jsonl");

/**
 * Adoption depth, weighted.
 *
 * The ecosystem map learned this the hard way and the weights encode it: a
 * config that CONFIGURES the plugins runs our rules on every install, while an
 * awesome-list entry is discovery and nothing more. Counting nodes equally
 * would rank a 13,090-star listing above the 469-star config that is the only
 * real adoption in the footprint.
 *
 * These are judgements, not measurements. They are here — visible and in one
 * place — rather than folded into a single "reach" number whose composition
 * cannot be seen.
 */
const DEPTH_WEIGHT: Record<string, number> = {
  configures: 10,
  depends: 4,
  lists: 1,
  mentions: 0.25,
};

/** States that count as territory held, versus still being contested. */
const HELD = new Set(["merged"]);
const INFLIGHT = new Set(["open", "approved", "staged"]);

interface Snapshot {
  t: string;
  held: number;
  reach: number;
  inflight: number;
}

const base = {
  group: "Adoption",
  unit: "count",
  kind: "cumulative",
  goodDirection: "up",
  staleAfterHours: 72,
} satisfies Omit<SeriesDef, "id" | "label" | "source">;

const SPARSE_CAVEAT =
  "accumulated from daily snapshots since 2026-08-11, seeded with the only two dated outcomes in repos.json — expect 'insufficient' from trend detection until this has real depth";

export const ADOPTION_CATALOG: SeriesDef[] = [
  {
    ...base,
    id: "adoption.held",
    label: "repos held (merged)",
    source: "adoption/history.jsonl",
    caveat: SPARSE_CAVEAT,
  },
  {
    ...base,
    id: "adoption.reach",
    label: "adoption reach (depth-weighted)",
    source: "adoption/history.jsonl",
    caveat: `depth-weighted: configures=10, depends=4, lists=1, mentions=0.25 — a judgement, not a measurement. ${SPARSE_CAVEAT}`,
  },
  {
    ...base,
    id: "adoption.inflight",
    label: "PRs in flight (open + approved + staged)",
    source: "adoption/history.jsonl",
    // Not cumulative: in-flight goes DOWN when a PR merges, which is the good
    // outcome. Typed as a rate so trend detection does not difference it.
    kind: "rate",
    caveat: SPARSE_CAVEAT,
  },
];

function readRepos(): any[] {
  if (!existsSync(REPOS)) return [];
  try {
    const j = JSON.parse(readFileSync(REPOS, "utf8"));
    const arr = j.repos ?? j.nodes ?? j;
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    console.error("[series-adoption] repos.json is not valid JSON:", e);
    return [];
  }
}

/** Today's counts, from the node table's current state. */
function snapshotNow(repos: any[]): Omit<Snapshot, "t"> {
  let held = 0;
  let reach = 0;
  let inflight = 0;
  for (const r of repos) {
    if (HELD.has(r.state)) {
      held++;
      reach += DEPTH_WEIGHT[r.depth] ?? 0;
    } else if (INFLIGHT.has(r.state)) {
      inflight++;
    }
  }
  return { held, reach, inflight };
}

/**
 * The two dated outcomes, as the earliest points in the series.
 *
 * Deliberately only the merges we can date. Undated merged nodes are NOT given
 * a guessed date — they show up in today's snapshot and simply have no history
 * before it, which is the truth.
 */
function seedFromDates(repos: any[]): Snapshot[] {
  const dated = repos
    .filter((r) => HELD.has(r.state) && typeof r.mergedOn === "string")
    .sort((a, b) => a.mergedOn.localeCompare(b.mergedOn));
  const out: Snapshot[] = [];
  let held = 0;
  let reach = 0;
  for (const r of dated) {
    held++;
    reach += DEPTH_WEIGHT[r.depth] ?? 0;
    out.push({ t: r.mergedOn, held, reach, inflight: 0 });
  }
  return out;
}

function readHistory(): Snapshot[] {
  if (!existsSync(HISTORY)) return [];
  const out: Snapshot[] = [];
  for (const line of readFileSync(HISTORY, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const s = JSON.parse(line);
      if (s && typeof s.t === "string") out.push(s);
    } catch {
      // One malformed line must not discard the rest of the history.
      console.warn("[series-adoption] skipping unparseable history line");
    }
  }
  return out;
}

/**
 * Append today's snapshot, at most once per day.
 *
 * ponytail: a write on the read path, because the control room is a local
 * instrument that gets opened most days and this needs no new cron, no new
 * secret and no new deploy. The ceiling is explicit — if the room stops being
 * opened daily the series simply has gaps, which honestly records "nobody
 * looked" rather than inventing a value. Move it to the footprint scheduler if
 * that stops being acceptable.
 */
function appendToday(now: Omit<Snapshot, "t">, history: Snapshot[]): void {
  const t = new Date().toISOString().slice(0, 10);
  if (history.some((s) => s.t === t)) return;
  try {
    mkdirSync(DIR, { recursive: true });
    appendFileSync(HISTORY, JSON.stringify({ t, ...now }) + "\n");
    history.push({ t, ...now });
  } catch (e) {
    // A read-only checkout must not break the series.
    console.warn("[series-adoption] could not append snapshot:", e);
  }
}

async function loadAdoption(): Promise<Map<string, Point[]>> {
  const out = new Map<string, Point[]>();
  const repos = readRepos();
  if (!repos.length) return out;

  const history = readHistory();
  appendToday(snapshotNow(repos), history);

  // Seed points only fill the range BEFORE the history starts; a recorded
  // snapshot always wins over a reconstruction for the same day.
  const byDay = new Map<string, Snapshot>();
  for (const s of seedFromDates(repos)) byDay.set(s.t, s);
  for (const s of history) byDay.set(s.t, s);

  const ordered = [...byDay.values()].sort((a, b) => a.t.localeCompare(b.t));
  out.set("adoption.held", ordered.map((s) => ({ t: s.t, v: s.held })));
  out.set("adoption.reach", ordered.map((s) => ({ t: s.t, v: s.reach })));
  out.set("adoption.inflight", ordered.map((s) => ({ t: s.t, v: s.inflight })));
  return out;
}

registerSeries(ADOPTION_CATALOG);
registerLoader("adoption", loadAdoption);
