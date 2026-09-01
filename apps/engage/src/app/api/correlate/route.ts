import { NextResponse } from "next/server";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { FOOTPRINT } from "@/lib/footprint";
import { DatabaseSync } from "node:sqlite";

export const dynamic = "force-dynamic";

const HISTORY = join(FOOTPRINT, "engagement", "history.jsonl");
const DB = join(FOOTPRINT, "engagement", "engage.db");

/** Minimum paired days before a coefficient is reported at all. */
const MIN_PAIRS = 14;

interface Day {
  day: string;
  followers: number | null;
  views: number | null;
  reactions: number | null;
  npmD7: number | null;
}

function history(): Day[] {
  if (!existsSync(HISTORY)) return [];
  const byDay = new Map<string, Day>();
  for (const line of readFileSync(HISTORY, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const r = JSON.parse(line);
      // Last write wins. The writer is idempotent now, but the file is
      // append-only and already carries rows from before it was.
      byDay.set(r.day, {
        day: r.day,
        followers: r.devto?.followers ?? null,
        views: r.devto?.views ?? null,
        reactions: r.devto?.reactions ?? null,
        npmD7: r.npm?.d7 ?? null,
      });
    } catch {
      /* one corrupt line costs one day, by design */
    }
  }
  return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
}

/** Actions per local day, from the ledger. */
function actionsByDay(): Map<string, number> {
  const m = new Map<string, number>();
  if (!existsSync(DB)) return m;
  try {
    const db = new DatabaseSync(DB, { readOnly: true });
    for (const r of db.prepare("select at, action from actions").all() as any[]) {
      if (r.action !== "done") continue;
      const day = new Date(r.at).toLocaleDateString("en-CA", {
        timeZone: "America/Chicago",
      });
      m.set(day, (m.get(day) ?? 0) + 1);
    }
    db.close();
  } catch {
    /* an unreadable ledger means no actions, not zero actions everywhere */
  }
  return m;
}

/**
 * Pearson correlation over paired samples.
 *
 * Returns null rather than a number when the sample is too small or either
 * series is flat — a coefficient computed over 3 points, or over a constant,
 * is noise wearing a decimal point, and this panel exists precisely because
 * confident-looking numbers have been wrong here before.
 */
function pearson(xs: number[], ys: number[]): number | null {
  const n = xs.length;
  if (n < MIN_PAIRS) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx;
    const b = ys[i] - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  if (dx === 0 || dy === 0) return null;
  return num / Math.sqrt(dx * dy);
}

/**
 * Did what we did move anything?
 *
 * Pairs daily action counts against next-day *deltas* in each metric, at lags
 * 0..3. Deltas, not levels: followers only ever go up, so correlating actions
 * against the raw total would find a strong relationship between "we did things"
 * and "time passed". Lags, because a comment posted today cannot plausibly move
 * an npm number the same afternoon.
 *
 * This is correlation, and it is reported as correlation. There is no control
 * group here and never will be — a single creator cannot run a holdout on their
 * own audience. The honest use is to rank hypotheses worth testing, not to
 * declare causes.
 */
export async function GET() {
  const days = history();
  const acts = actionsByDay();

  const metrics: { key: keyof Day; label: string }[] = [
    { key: "followers", label: "dev.to followers" },
    { key: "views", label: "dev.to views" },
    { key: "reactions", label: "dev.to reactions" },
    { key: "npmD7", label: "npm downloads (7d)" },
  ];

  const results: any[] = [];
  for (const m of metrics) {
    for (const lag of [0, 1, 2, 3]) {
      const xs: number[] = [];
      const ys: number[] = [];
      for (let i = 1; i < days.length; i++) {
        const prev = days[i - 1][m.key];
        const cur = days[i][m.key];
        if (prev == null || cur == null) continue;
        // The action day is `lag` days before the day whose delta we measure.
        const srcIdx = i - lag;
        if (srcIdx < 0) continue;
        xs.push(acts.get(days[srcIdx].day) ?? 0);
        ys.push((cur as number) - (prev as number));
      }
      const r = pearson(xs, ys);
      if (r !== null)
        results.push({ metric: m.label, lag, r: Number(r.toFixed(3)), n: xs.length });
    }
  }

  results.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));

  const actionDays = [...acts.values()].reduce((a, b) => a + b, 0);

  return NextResponse.json({
    results,
    days: days.length,
    actions: actionDays,
    minPairs: MIN_PAIRS,
    // The reason there is nothing to show is the single most important thing
    // this endpoint can say, so it says it explicitly rather than returning [].
    blocked:
      days.length < MIN_PAIRS + 1
        ? `${days.length} day(s) of history; needs ${MIN_PAIRS + 1}. This is missing time, not a missing feature — the daily snapshot is running and cannot be back-filled, because no API returns yesterday's totals.`
        : results.length === 0
          ? "Enough days, but every series is flat or incomplete — no coefficient is defensible yet."
          : null,
  });
}
