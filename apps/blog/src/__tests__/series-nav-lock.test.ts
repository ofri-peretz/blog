// Series navigation lock — 2026-08-24.
//
// 78 of 89 articles carry a `series` frontmatter field, and for the site's
// whole life none of them linked to each other — the series structure
// existed only in frontmatter and every article was a reading dead end.
// This locks both the ordering semantics of getSeriesContext (real corpus
// data, not fixtures) and the article page actually composing the nav.
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import {
  buildSeriesContext,
  getAllArticles,
  type Article,
} from "@/lib/source";

const ARTICLE_PAGE = readFileSync(
  path.resolve(__dirname, "..", "app", "articles", "[slug]", "page.tsx"),
  "utf-8",
);

// Load the corpus ONCE — getAllArticles() re-parses every markdown file per
// call, which is why buildSeriesContext takes the corpus as an argument.
let ALL: Article[];
beforeAll(() => {
  ALL = getAllArticles();
}, 30000);

/** First series in the live corpus with at least 3 published members. */
function pickSeries() {
  const bySeries = new Map<string, string[]>();
  for (const a of ALL) {
    const s = a.frontmatter.series;
    if (!s) continue;
    bySeries.set(s, [...(bySeries.get(s) ?? []), a.slug]);
  }
  const found = [...bySeries.entries()].find(([, slugs]) => slugs.length >= 3);
  expect(found, "corpus must contain a series with ≥3 articles").toBeDefined();
  return found!;
}

describe("buildSeriesContext — real corpus semantics", () => {
  it("orders a series oldest-first with consistent index/total", () => {
    const [name, slugs] = pickSeries();
    const contexts = slugs.map((slug) => buildSeriesContext(ALL, slug)!);
    for (const ctx of contexts) {
      expect(ctx.name).toBe(name);
      expect(ctx.total).toBe(slugs.length);
      expect(ctx.index).toBeGreaterThanOrEqual(1);
      expect(ctx.index).toBeLessThanOrEqual(ctx.total);
    }
    // Exactly one first (no prev) and one last (no next).
    expect(contexts.filter((c) => c.prev === null)).toHaveLength(1);
    expect(contexts.filter((c) => c.next === null)).toHaveLength(1);
  });

  it("prev/next are reciprocal", () => {
    const [, slugs] = pickSeries();
    for (const slug of slugs) {
      const ctx = buildSeriesContext(ALL, slug)!;
      if (ctx.next) {
        expect(buildSeriesContext(ALL, ctx.next.slug)!.prev?.slug).toBe(slug);
      }
      if (ctx.prev) {
        expect(buildSeriesContext(ALL, ctx.prev.slug)!.next?.slug).toBe(slug);
      }
    }
  });

  it("returns null for an article without a series", () => {
    const loner = ALL.find((a) => !a.frontmatter.series);
    // Hard precondition, not a silent skip: if the corpus ever has zero
    // series-less articles this test would pass while asserting nothing —
    // fail loudly instead so it gets updated consciously.
    expect(
      loner,
      "corpus has no series-less articles — this test is vacuous, rework it",
    ).toBeDefined();
    expect(buildSeriesContext(ALL, loner!.slug)).toBeNull();
  });
});

describe("article page composes the series nav", () => {
  it("renders SeriesBanner above the body and SeriesPager after it", () => {
    const banner = ARTICLE_PAGE.indexOf("<SeriesBanner");
    const body = ARTICLE_PAGE.indexOf("<MarkdownArticle");
    const pager = ARTICLE_PAGE.indexOf("<SeriesPager");
    expect(banner).toBeGreaterThan(-1);
    expect(body).toBeGreaterThan(banner);
    expect(pager).toBeGreaterThan(body);
  });
});
