import { NextResponse } from "next/server";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { FOOTPRINT, devtoKey } from "@/lib/footprint";
import { fetchJson } from "@/lib/throttle";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const BASELINE = join(FOOTPRINT, "engagement", "tag-baseline.jsonl");
const ACCRUAL = join(FOOTPRINT, "engagement", "article-accrual.jsonl");

function jsonl(path: string): any[] {
  if (!existsSync(path)) return [];
  const out: any[] = [];
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      out.push(JSON.parse(line));
    } catch {
      /* one bad line costs one day */
    }
  }
  return out;
}

/**
 * Are we beating the index?
 *
 * The honest framing for a market where the median participant earns nothing.
 * Measured 2026-08-09: **71-89% of all articles in our tags get zero
 * reactions**, and the tag feed retains under 6 days — so a comparable set
 * cannot be reconstructed after the fact. `tag-baseline.jsonl` is the only path
 * to this question and it starts the day it started.
 *
 * Two separate things are reported and must not be merged:
 *   - **Relative strength** — our distribution vs the tag distribution.
 *   - **Drawdown** — consecutive days with no follower growth. 25 such days
 *     passed unnoticed in June because nothing was watching for a flat line.
 */
export async function GET() {
  const baseline = jsonl(BASELINE);
  const accrual = jsonl(ACCRUAL);
  const latest = baseline[baseline.length - 1] ?? null;

  // Our own distribution, live.
  let ours: { rx: number[]; views: number[] } = { rx: [], views: [] };
  try {
    const key = devtoKey();
    const arts = await fetchJson(
      "https://dev.to/api/articles/me/published?per_page=100",
      { headers: key ? { "api-key": key } : {} },
    );
    if (Array.isArray(arts))
      ours = {
        rx: arts.map((a: any) => a.public_reactions_count ?? 0).sort((a, b) => a - b),
        views: arts
          .map((a: any) => a.page_views_count ?? 0)
          .sort((a: number, b: number) => a - b),
      };
  } catch {
    /* fall through to whatever the baseline can say alone */
  }

  const q = (xs: number[], p: number) =>
    xs.length ? xs[Math.min(xs.length - 1, Math.floor(xs.length * p))] : null;
  const zeroShare = (xs: number[]) =>
    xs.length ? Number((xs.filter((x) => x === 0).length / xs.length).toFixed(3)) : null;

  const tags = (latest?.tags ?? []).map((t: any) => ({
    ...t,
    // Positive = we have a smaller share of zero-reaction articles than the
    // tag does. This is the comparison that survives a market where both
    // medians are 0 — a median-vs-median test can only ever return "tied".
    zeroShareEdge:
      zeroShare(ours.rx) != null && t.rxZeroShare != null
        ? Number((t.rxZeroShare - zeroShare(ours.rx)!).toFixed(3))
        : null,
    p90Edge:
      q(ours.rx, 0.9) != null && t.rxP90 != null
        ? Number((q(ours.rx, 0.9)! - t.rxP90).toFixed(2))
        : null,
  }));

  // ── Accrual: when does an article stop earning? ──────────────────────────
  // Needs two days minimum. Stated rather than silently returning nothing.
  const curve: { ageBucket: string; n: number; medianDailyViews: number }[] = [];
  if (accrual.length >= 2) {
    const prev = new Map<string, any>();
    for (const a of accrual[accrual.length - 2].articles) prev.set(a.slug, a);
    const deltas: { age: number; d: number }[] = [];
    for (const a of accrual[accrual.length - 1].articles) {
      const p = prev.get(a.slug);
      if (!p || a.views == null || p.views == null) continue;
      deltas.push({ age: a.ageDays, d: a.views - p.views });
    }
    const buckets: [string, number, number][] = [
      ["0-3d", 0, 3],
      ["3-7d", 3, 7],
      ["7-30d", 7, 30],
      ["30-90d", 30, 90],
      ["90d+", 90, 1e9],
    ];
    for (const [label, lo, hi] of buckets) {
      const g = deltas.filter((x) => x.age >= lo && x.age < hi).map((x) => x.d).sort((a, b) => a - b);
      if (g.length)
        curve.push({
          ageBucket: label,
          n: g.length,
          medianDailyViews: g[Math.floor(g.length / 2)],
        });
    }
  }

  // ── Drawdown ─────────────────────────────────────────────────────────────
  const hist = jsonl(join(FOOTPRINT, "engagement", "history.jsonl"));
  let flatDays = 0;
  for (let i = hist.length - 1; i > 0; i--) {
    const a = hist[i]?.devto?.followers;
    const b = hist[i - 1]?.devto?.followers;
    if (a == null || b == null || a > b) break;
    flatDays++;
  }

  return NextResponse.json({
    day: latest?.day ?? null,
    daysCollected: baseline.length,
    tags,
    ours: {
      n: ours.rx.length,
      rxMedian: q(ours.rx, 0.5),
      rxP90: q(ours.rx, 0.9),
      rxZeroShare: zeroShare(ours.rx),
      viewsMedian: q(ours.views, 0.5),
      viewsP90: q(ours.views, 0.9),
    },
    curve,
    drawdown: {
      flatDays,
      // 25 consecutive zero-growth days ran unnoticed in June. The alarm exists
      // so a flat line is an event rather than an absence of events.
      alarm: flatDays >= 5,
    },
    note:
      baseline.length < 2
        ? `Baseline started today — ${baseline.length} day(s). Relative strength is computed against today's snapshot; the trend of the edge needs a few more days. This series cannot be back-filled: the tag feed retains under 6 days.`
        : null,
  });
}
