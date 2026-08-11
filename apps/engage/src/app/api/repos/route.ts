import { NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { FOOTPRINT } from "@/lib/footprint";

export const dynamic = "force-dynamic";

/**
 * The conquest map.
 *
 * Reads the three files the footprint scripts own and joins them:
 *   repos.json    judgements and outcomes  (hand-authored)
 *   signals.json  measured from the GitHub API (scripts/gh-signals.ts)
 *   odds.json     the scorecard            (scripts/gh-odds.ts)
 *
 * The app never computes odds. It reads them, exactly like the reply queue
 * reads drafts: the batch job owns the expensive, rate-limited work and the
 * page load owns none of it. Recomputing here would put ~70 GitHub API calls
 * behind a tab.
 */

const DIR = join(FOOTPRINT, "adoption");
const NODES = join(DIR, "repos.json");
const SIGNALS = join(DIR, "signals.json");
const ODDS = join(DIR, "odds.json");
const HISTORY = join(DIR, "history.jsonl");

const read = (p: string): any | null => {
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return null;
  }
};

export async function GET() {
  const nodes = read(NODES);
  const signals = read(SIGNALS);
  const odds = read(ODDS);

  if (!nodes) {
    return NextResponse.json({
      repos: [],
      edges: [],
      error: "adoption/repos.json missing",
      hint: "run `tsx scripts/gh-signals.ts && tsx scripts/gh-odds.ts` in agents/footprint",
    });
  }

  const sig = new Map<string, any>((signals?.signals ?? []).map((s: any) => [s.slug, s]));
  const odd = new Map<string, any>((odds?.odds ?? []).map((o: any) => [o.slug, o]));

  const repos = (nodes.repos ?? []).map((n: any) => ({
    ...n,
    signals: sig.get(n.slug) ?? null,
    odds: odd.get(n.slug) ?? null,
  }));

  // Staleness is the whole reason this is a batch job — say how old it is
  // rather than letting a three-week-old measurement read as today's.
  const measuredAt = signals?.measuredAt ?? null;
  const ageHours = measuredAt
    ? Math.round((Date.now() - Date.parse(measuredAt)) / 3_600_000)
    : null;

  return NextResponse.json({
    repos,
    edges: nodes.edges ?? [],
    measuredAt,
    ageHours,
    stale: ageHours != null && ageHours > 24 * 7,
    computedAt: odds?.computedAt ?? null,
    missing: {
      signals: !signals,
      odds: !odds,
    },
    counts: {
      held: repos.filter((r: any) => r.odds?.band === "held").length,
      likely: repos.filter((r: any) => r.odds?.band === "likely").length,
      dead: repos.filter((r: any) => r.odds?.band === "dead").length,
      total: repos.length,
    },
  });
}

/**
 * Record an outcome.
 *
 * Writes the new state back to repos.json — the judgement file — and logs the
 * transition to the action ledger so the map has a history rather than only a
 * present. It deliberately does NOT recompute odds: the score depends on
 * measured signals, and re-measuring is `gh-signals.ts`'s job. Writing a state
 * here and a score there keeps the two honest about which is which.
 */
export async function POST(req: Request) {
  const { slug, state, note } = await req.json().catch(() => ({}) as any);

  const ALLOWED = new Set(["merged", "approved", "open", "rejected", "staged", "target", "dead"]);
  if (typeof slug !== "string" || !ALLOWED.has(state))
    return NextResponse.json(
      { ok: false, error: `slug required; state must be one of ${[...ALLOWED].join(", ")}` },
      { status: 400 },
    );

  const nodes = read(NODES);
  if (!nodes) return NextResponse.json({ ok: false, error: "repos.json missing" }, { status: 404 });

  const hit = (nodes.repos ?? []).find((r: any) => r.slug === slug);
  if (!hit) return NextResponse.json({ ok: false, error: "unknown repo" }, { status: 404 });

  const from = hit.state;
  hit.state = state;
  hit.stateChangedAt = new Date().toISOString();
  if (note) hit.stateNote = note;
  if (state === "merged" && !hit.mergedOn) hit.mergedOn = hit.stateChangedAt.slice(0, 10);

  try {
    writeFileSync(NODES, JSON.stringify(nodes, null, 2) + "\n");
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: `write failed: ${String(e).slice(0, 160)}` },
      { status: 500 },
    );
  }

  // Its own history, not the engagement ledger. `recordAction` is shaped for
  // Dev.to — it requires an author and an articleId — and bending an adoption
  // transition into those fields would put fiction in the one table that is
  // supposed to be the record of what we actually did.
  //
  // This append is what makes "odds moved because we landed hardcore" sayable
  // later; without it the map only ever shows a present with no past.
  try {
    appendFileSync(
      HISTORY,
      JSON.stringify({ at: new Date().toISOString(), slug, from, to: state, note: note ?? null }) +
        "\n",
    );
  } catch {
    /* a bookkeeping failure must not undo the state change just recorded */
  }

  return NextResponse.json({
    ok: true,
    slug,
    from,
    to: state,
    hint:
      state === "merged"
        ? "re-run `tsx scripts/gh-odds.ts` in agents/footprint to propagate this to neighbours"
        : null,
  });
}
