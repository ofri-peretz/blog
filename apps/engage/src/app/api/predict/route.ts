import { NextResponse } from "next/server";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { cachedAsync, publisherSchedule } from "@/lib/cache";
import { sbPaged } from "@/lib/series";
import { fetchJson } from "@/lib/throttle";
import { devtoKey } from "@/lib/footprint";
import { levers, type ArticleIn, type Snap } from "@/lib/levers";
import { model, predict } from "@/lib/predict";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** The blog's article directory: this app lives beside it in the monorepo. */
const ARTICLES = join(process.cwd(), "..", "blog", "content", "articles");

/** Minimal frontmatter: the four fields the feature extractor reads. */
function parseDraft(slug: string, raw: string): ArticleIn | null {
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(raw);
  if (!m) return null;
  const fm = m[1];
  if (/^devto_id:\s*\S/m.test(fm)) return null; // published: the fact, not the graph
  const str = (k: string) =>
    fm.match(new RegExp(`^${k}:\\s*"?(.*?)"?\\s*$`, "m"))?.[1] ?? "";
  const tagBlock = fm.match(/^tags:\n((?:\s+-\s+.*\n?)+)/m)?.[1] ?? "";
  const tags = [...tagBlock.matchAll(/-\s+"?([^"\n]+)"?/g)].map((t) =>
    t[1].trim(),
  );
  return {
    id: 0,
    slug,
    title: str("title"),
    published_at: "",
    reading_time_minutes:
      Number(str("reading_time_minutes")) ||
      Math.max(1, Math.round(m[2].split(/\s+/).length / 200)),
    tag_list: tags,
    body_markdown: m[2],
  };
}

async function build() {
  const key = devtoKey();
  const corpus: ArticleIn[] = [];
  for (let page = 1; page <= 3; page++) {
    const batch = await fetchJson(
      `https://dev.to/api/articles/me/published?per_page=100&page=${page}`,
      { headers: key ? { "api-key": key } : {} },
    );
    if (!Array.isArray(batch) || batch.length === 0) break;
    corpus.push(...batch);
    if (batch.length < 100) break;
  }
  const snaps = (await sbPaged(
    "article_daily_snapshots?select=external_id,observed_on,views,comments&source=eq.devto&order=observed_on.asc",
  )) as Snap[];
  const all = levers(corpus, snaps);
  const models = ["views14", "comments14"].map((o) => model(corpus, all, o));

  // The weekday feature needs a date; the publisher's next fire is the honest
  // assumption, printed on the section so nobody reads it as a decision.
  const sched = publisherSchedule().value as any;
  const publishAt = sched?.nextFire ?? new Date().toISOString();

  const drafts: ArticleIn[] = existsSync(ARTICLES)
    ? readdirSync(ARTICLES)
        .filter((f) => f.endsWith(".md"))
        .flatMap((f) => {
          const d = parseDraft(
            f.replace(/\.md$/, ""),
            readFileSync(join(ARTICLES, f), "utf8"),
          );
          return d ? [{ ...d, published_at: publishAt }] : [];
        })
    : [];
  return {
    publishAt,
    corpus: corpus.length,
    levers: models.map((m) => ({
      outcome: m.outcome,
      weights: m.weights.map((w) => w.feature),
    })),
    drafts: drafts.map((d) => predict(d, models)),
    caveat:
      "Rank among our own articles by the levers the panel shows; correlation, not cause. Nothing here predicts a count.",
  };
}

export async function GET(req: Request) {
  const force = new URL(req.url).searchParams.get("refresh") === "1";
  const hit = await cachedAsync("predict", 3_600_000, force, build);
  return NextResponse.json({
    ...hit.value,
    cachedAt: hit.at,
    cached: !hit.fresh,
  });
}
