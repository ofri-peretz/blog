import { NextResponse } from "next/server";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { FOOTPRINT } from "@/lib/footprint";
import { publisherSchedule } from "@/lib/cache";
import { pearson, type YieldRow } from "@/lib/yield";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const BLOG = join(
  process.env.HOME ?? "",
  "repos/ofriperetz.dev/blog-public/apps/blog",
);
const ARTICLES = join(BLOG, "content", "articles");
const COVERS = join(BLOG, "public", "cdn", "blog-cover-image");
const REVIEW_LOGS = join(FOOTPRINT, "logs", "batch-review");

/** Ofri's floor. Below this an article is not done, whatever its status says. */
const SCORE_BAR = 8.75;

/**
 * Both must mirror queue-artifact.ts exactly.
 *
 * ANSI is built from String.fromCharCode(27) so the pattern holds a real ESC
 * byte to strip.
 *
 * SCORE matches the number at END OF LINE, not after the colon. The rendered
 * line is `OVERALL SCORE:  <bar> 9.3` — a progress bar sits between label and
 * value, so anchoring to the colon matches nothing and every article silently
 * reads "unscored". Which is precisely what it did.
 */
const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");
const SCORE = /([\d.]+)\s*$/;

/**
 * Gate scores, mined from the batch-review logs.
 *
 * Deliberately mirrors queue-artifact.ts rather than inventing a second rule,
 * including the two non-obvious ones:
 *
 * - Split by line before matching. The logs are ~170KB and a pattern spanning
 *   "OVERALL SCORE:" to the digits backtracks polynomially.
 * - **Exactly 5.0 is the reviewer-crash signature, not a score.** When the 7
 *   reviewers get rate-limited they all default and the run still prints an
 *   OVERALL SCORE line. Banking it puts a crash on the dashboard as a real —
 *   and alarmingly low — rating.
 */
function scores(): Record<string, { score: number; when: number }> {
  const out: Record<string, { score: number; when: number }> = {};
  if (!existsSync(REVIEW_LOGS)) return out;
  const files = readdirSync(REVIEW_LOGS)
    .filter((f) => f.endsWith(".log"))
    .map((f) => ({ f, mtime: statSync(join(REVIEW_LOGS, f)).mtimeMs }))
    .sort((a, b) => a.mtime - b.mtime);

  for (const { f, mtime } of files) {
    const slug = f
      .replace(/\.log$/, "")
      .replace(/^(corrective|final|retrofit)\d*-/, "");
    let text: string;
    try {
      text = readFileSync(join(REVIEW_LOGS, f), "utf8").replace(ANSI, "");
    } catch {
      continue;
    }
    // PREFER the gate score over OVERALL — mirrors queue-artifact.ts.
    //
    // They are different numbers. OVERALL averages every reviewer; the gate
    // score excludes Challenge, whose Axis 2 weights Gemini/AI brand fit at 40%
    // and therefore caps any article with no AI angle regardless of how well it
    // is written. That is precisely why Challenge does not gate — so measuring
    // "below bar" against OVERALL let it veto through the dashboard instead.
    //
    // Measured 2026-08-12: 9 of 19 "below bar" articles were gate-PASSING.
    // Falls back to OVERALL for logs predating the gate-score line.
    const line = (needle: string) =>
      text
        .split("\n")
        .filter((l) => l.includes(needle))
        .map((l) => SCORE.exec(l)?.[1])
        .filter(Boolean)
        .pop();
    const hit = line("Gate score") ?? line("OVERALL SCORE:");
    if (hit && parseFloat(hit) !== 5)
      out[slug] = { score: parseFloat(hit), when: mtime };
  }
  return out;
}

function frontmatter(raw: string): Record<string, string> {
  const m = /^---\n([\s\S]*?)\n---/.exec(raw);
  if (!m) return {};
  const out: Record<string, string> = {};
  for (const line of m[1].split("\n")) {
    const kv = /^([a-zA-Z_]+):\s*(.*)$/.exec(line);
    if (kv) out[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

/**
 * The release queue, as data.
 *
 * The queue already exists as a generated HTML artifact, but an artifact is a
 * snapshot you have to regenerate and go find. The control room is where the
 * decisions get made, so the queue has to live here too — same numbers, same
 * rules, no second source of truth.
 */
export async function GET(req: Request) {
  const force = new URL(req.url).searchParams.get("refresh") === "1";
  const sc = scores();

  // Schedule + runway, straight from the publisher — cached, because this
  // spawns a tsx subprocess and it was paid on every page view.
  const sched = publisherSchedule(force);
  const schedule = { ...sched.value, cachedAt: sched.at, fresh: sched.fresh };

  const files = existsSync(ARTICLES)
    ? readdirSync(ARTICLES).filter((f) => f.endsWith(".md"))
    : [];

  const articles = files.map((f) => {
    const slug = f.replace(/\.md$/, "");
    const raw = readFileSync(join(ARTICLES, f), "utf8");
    const fm = frontmatter(raw);
    const body = raw.split(/^---$/m).slice(2).join("---");
    const s = sc[slug]?.score ?? null;
    return {
      slug,
      title: fm.title || slug,
      status: fm.status || null,
      tier: fm.tier || null,
      published: !!fm.published_at || fm.status === "published",
      publishedAt: fm.published_at || null,
      devtoUrl: fm.devto_url || null,
      score: s,
      // Three states, never two: a null score on an unwritten piece is expected,
      // a null on a finished one is a gate that never ran. Collapsing them hides
      // the second entirely.
      gate: s === null ? "unscored" : s >= SCORE_BAR ? "pass" : "below-bar",
      words: body.trim().split(/\s+/).length,
      hasCover: existsSync(join(COVERS, `${slug}.jpg`)),
    };
  });

  /*
   * First-14-day comment yield, read from the yield cache if /api/yield has
   * run (never crawled here — a page load must not pay for dev.to). Matched on
   * the dev.to URL the frontmatter records. The Pearson between gate score and
   * yield is the calibration the comment-yield intent asks for; it refuses to
   * speak below twenty pairs.
   */
  const YIELD_CACHE = join(FOOTPRINT, "engagement", ".cache", "yield.json");
  const byUrl = new Map<string, YieldRow>();
  try {
    if (existsSync(YIELD_CACHE)) {
      const cached = JSON.parse(readFileSync(YIELD_CACHE, "utf8"));
      for (const r of cached?.value?.rows ?? []) byUrl.set(String(r.url).replace(/\/$/, ""), r);
    }
  } catch { /* an unreadable cache is "no yield yet", never a broken page */ }
  const withYield = articles.map((a) => {
    const y = a.devtoUrl ? byUrl.get(String(a.devtoUrl).replace(/\/$/, "")) : undefined;
    return { ...a, comments14d: y ? y.comments14d : null, yieldClosed: y ? y.windowClosed : null };
  });
  const calibration = pearson(
    withYield
      .filter((a) => a.score !== null && typeof a.comments14d === "number" && a.yieldClosed)
      .map((a) => [a.score as number, a.comments14d as number] as [number, number]),
  );

  const scored = articles.filter((a) => a.score !== null);
  const unscored = articles.filter((a) => a.score === null);

  return NextResponse.json({
    schedule,
    scoreBar: SCORE_BAR,
    articles: withYield.sort((a, b) => (b.score ?? -1) - (a.score ?? -1)),
    calibration,
    totals: {
      articles: articles.length,
      published: articles.filter((a) => a.published).length,
      scored: scored.length,
      unscored: unscored.length,
      belowBar: articles.filter((a) => a.gate === "below-bar").length,
      missingCover: articles.filter((a) => !a.hasCover).length,
      median:
        scored.length === 0
          ? null
          : Number(
              [...scored]
                .map((a) => a.score as number)
                .sort((x, y) => x - y)
                [Math.floor(scored.length / 2)].toFixed(2),
            ),
    },
  });
}
