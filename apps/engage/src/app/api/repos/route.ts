import { NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync, appendFileSync, renameSync } from "node:fs";
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

type ReadResult = { ok: true; data: any } | { ok: false; why: "missing" | "corrupt"; detail?: string };

/**
 * Missing and corrupt are different problems with different fixes.
 *
 * Collapsing both to `null` told you to run gh-signals.ts when the file was
 * present and unparseable — the wrong instruction, and one that would
 * regenerate signals.json while leaving the actually-broken file alone.
 */
const read = (p: string): ReadResult => {
  if (!existsSync(p)) return { ok: false, why: "missing" };
  try {
    return { ok: true, data: JSON.parse(readFileSync(p, "utf8")) };
  } catch (e) {
    return { ok: false, why: "corrupt", detail: String(e).slice(0, 160) };
  }
};

export async function GET() {
  const nodesR = read(NODES);
  const signalsR = read(SIGNALS);
  const oddsR = read(ODDS);

  if (!nodesR.ok) {
    return NextResponse.json({
      repos: [],
      edges: [],
      error:
        nodesR.why === "missing"
          ? "adoption/repos.json missing"
          : `adoption/repos.json is not valid JSON — ${nodesR.detail}`,
      hint:
        nodesR.why === "missing"
          ? "run `tsx scripts/gh-signals.ts && tsx scripts/gh-odds.ts` in agents/footprint"
          : "repair the file by hand; regenerating signals will not fix it",
    });
  }

  const nodes = nodesR.data;
  const signals = signalsR.ok ? signalsR.data : null;
  const odds = oddsR.ok ? oddsR.data : null;

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
      signals: !signalsR.ok ? signalsR.why : null,
      odds: !oddsR.ok ? oddsR.why : null,
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

  const nodesR = read(NODES);
  if (!nodesR.ok)
    return NextResponse.json(
      {
        ok: false,
        error:
          nodesR.why === "missing"
            ? "repos.json missing"
            : `repos.json is not valid JSON — ${nodesR.detail}`,
      },
      // A corrupt file is a server-side problem, not "you asked for something
      // that is not here".
      { status: nodesR.why === "missing" ? 404 : 500 },
    );
  const nodes = nodesR.data;

  const hit = (nodes.repos ?? []).find((r: any) => r.slug === slug);
  if (!hit) return NextResponse.json({ ok: false, error: "unknown repo" }, { status: 404 });

  const from = hit.state;
  hit.state = state;
  hit.stateChangedAt = new Date().toISOString();
  if (note) hit.stateNote = note;
  if (state === "merged" && !hit.mergedOn) hit.mergedOn = hit.stateChangedAt.slice(0, 10);

  // Write to a sibling and rename. A crash midway through a direct write
  // leaves repos.json half-serialised, and since it is the judgement file —
  // hand-authored, not regenerable — the map would be down until someone
  // restored it from git. rename() within a directory is atomic.
  try {
    const tmp = `${NODES}.tmp`;
    writeFileSync(tmp, JSON.stringify(nodes, null, 2) + "\n");
    renameSync(tmp, NODES);
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
