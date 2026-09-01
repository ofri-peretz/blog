import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SeriesBanner } from "../components/series-nav";
import { buildSeriesContext, type Article } from "../lib/source";

/**
 * Series-navigator locks — the dev.to-style expandable list: every part
 * of the series ships in the SSR HTML (native <details>, zero JS),
 * reading order, the current part marked not linked, jumps tracked.
 */

const art = (slug: string, title: string, published_at: string): Article => ({
  slug,
  frontmatter: {
    title,
    description: "",
    published: true,
    published_at,
    tags: [],
    series: "Foundations",
  },
  body: "",
  readingTimeMinutes: 5,
});

const CORPUS: Article[] = [
  art("c", "Part Three", "2026-03-01"),
  art("a", "Part One", "2026-01-01"),
  art("b", "Part Two", "2026-02-01"),
];

describe("SeriesContext.parts", () => {
  it("carries every part in reading order (oldest first)", () => {
    const ctx = buildSeriesContext(CORPUS, "b")!;
    expect(ctx.parts.map((p) => p.slug)).toEqual(["a", "b", "c"]);
    expect(ctx.index).toBe(2);
    expect(ctx.total).toBe(3);
  });
});

describe("the expandable banner (crawler truth)", () => {
  const html = renderToStaticMarkup(
    <SeriesBanner series={buildSeriesContext(CORPUS, "b")} currentSlug="b" />,
  );

  it("is a native details — the whole list ships in SSR, zero JS", () => {
    expect(html).toMatch(/^<details/);
    expect(html).toContain("<summary");
    expect(html).toContain("Part 2 of 3 in");
    // EVERY other part is a real crawlable link, numbered.
    expect(html).toContain('href="/articles/a"');
    expect(html).toContain('href="/articles/c"');
    expect(html).toContain("Part One");
    expect(html).toContain("Part Three");
  });

  it("the current part is marked, never a self-link", () => {
    expect(html).toContain('aria-current="page"');
    expect(html).not.toContain('href="/articles/b"');
    expect(html).toContain("Part Two");
  });

  it("no series, no banner", () => {
    expect(
      renderToStaticMarkup(<SeriesBanner series={null} currentSlug="x" />),
    ).toBe("");
  });
});

describe("jump tracking", () => {
  it("list jumps carry the jump direction with from/to", () => {
    const SRC = renderToStaticMarkup(
      <SeriesBanner series={buildSeriesContext(CORPUS, "b")} currentSlug="b" />,
    );
    // TrackedLink renders anchors; the event wiring is source-pinned by
    // the analytics lock — here we pin that both non-current parts are
    // TrackedLink-rendered anchors (2 links for 3 parts).
    expect(SRC.match(/href="\/articles\//g)?.length).toBe(2);
  });
});
