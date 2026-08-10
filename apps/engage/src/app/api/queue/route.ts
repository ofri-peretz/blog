import { NextResponse } from "next/server";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { FOOTPRINT } from "@/lib/footprint";
import { publisherSchedule } from "@/lib/cache";

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
    const hit = text
      .split("\n")
      .filter((l) => l.includes("OVERALL SCORE:"))
      .map((l) => SCORE.exec(l)?.[1])
      .filter(Boolean)
      .pop();
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

  const scored = articles.filter((a) => a.score !== null);
  const unscored = articles.filter((a) => a.score === null);

  return NextResponse.json({
    schedule,
    scoreBar: SCORE_BAR,
    articles: articles.sort((a, b) => (b.score ?? -1) - (a.score ?? -1)),
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
