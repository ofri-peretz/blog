import { readFileSync } from "node:fs";
import path from "node:path";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ArticleThreads } from "../components/article-threads";
import { computeThreads } from "../lib/corpus-links";

/**
 * Threads-per-article locks.
 *
 * The section is the corpus map's weave delivered on the article page:
 * backlinks in both directions, fully SSR. Three contracts:
 *
 *  1. Graph semantics — computeThreads is the single source of both
 *     directions; self/unknown/queued targets can never surface.
 *  2. Crawler truth — every thread renders as a real anchor; the
 *     decorative strand glyph stays out of the accessibility tree.
 *  3. Page wiring — the article page actually renders the section from
 *     the published-only corpus (a refactor that drops it, or feeds it
 *     unpublished articles, must break here first).
 */

const corpus = [
  {
    slug: "newest",
    body: "cites [older](https://ofriperetz.dev/articles/older) twice: /articles/older",
  },
  { slug: "middle", body: "no internal links, just prose" },
  {
    slug: "older",
    body: "cites /articles/middle and itself /articles/older and a ghost /articles/never-published",
  },
];

describe("computeThreads", () => {
  it("resolves both directions, dropping self and unknown targets", () => {
    const t = computeThreads("older", corpus[2].body, corpus);
    expect(t.drawsOn).toEqual(["middle"]);
    expect(t.pulledBy).toEqual(["newest"]);
  });

  it("dedupes repeated citations into one thread", () => {
    const t = computeThreads("newest", corpus[0].body, corpus);
    expect(t.drawsOn).toEqual(["older"]);
  });

  it("preserves corpus order for pulledBy (caller passes newest-first)", () => {
    const citedByAll = [
      { slug: "a", body: "/articles/target" },
      { slug: "b", body: "/articles/target" },
      { slug: "target", body: "" },
    ];
    const t = computeThreads("target", "", citedByAll);
    expect(t.pulledBy).toEqual(["a", "b"]);
  });

  it("a queued current article (absent from the corpus) pulls nothing", () => {
    // Its slug isn't a known target, so published bodies can't thread to it.
    const t = computeThreads("queued", "/articles/newest is cited", corpus);
    expect(t.drawsOn).toEqual(["newest"]);
    expect(t.pulledBy).toEqual([]);
  });
});

describe("crawler truth (rendered markup)", () => {
  const items = [
    { slug: "older", title: "The Older Piece", series: "Security" },
    { slug: "middle", title: "The Middle Piece", series: null },
  ];

  it("renders real anchors with hrefs and visible titles", () => {
    const { container, unmount } = render(
      <ArticleThreads currentSlug="newest" drawsOn={items} pulledBy={[]} />,
    );
    const anchors = [...container.querySelectorAll("a")];
    expect(anchors.map((a) => a.getAttribute("href"))).toEqual([
      "/articles/older",
      "/articles/middle",
    ]);
    expect(container.textContent).toContain("The Older Piece");
    expect(container.textContent).toContain("Security");
    unmount();
  });

  it("only non-empty directions render; both empty renders nothing", () => {
    const one = render(
      <ArticleThreads currentSlug="x" drawsOn={[]} pulledBy={items} />,
    );
    expect(
      one.container.querySelector('[data-slot="article-threads-pulled_by"]'),
    ).toBeTruthy();
    expect(
      one.container.querySelector('[data-slot="article-threads-draws_on"]'),
    ).toBeNull();
    one.unmount();

    const none = render(
      <ArticleThreads currentSlug="x" drawsOn={[]} pulledBy={[]} />,
    );
    expect(none.container.innerHTML).toBe("");
    none.unmount();
  });

  it("hub articles cap at 6 visible threads + a corpus-map overflow link", () => {
    // cwe-taxonomy-explained has 52 backlinks — uncapped, the section is
    // a wall of links that buries the page footer (seen rendered).
    const many = Array.from({ length: 10 }, (_, i) => ({
      slug: `a${i}`,
      title: `Article ${i}`,
    }));
    const { container, unmount } = render(
      <ArticleThreads currentSlug="hub" drawsOn={[]} pulledBy={many} />,
    );
    const threadAnchors = [...container.querySelectorAll("a")].filter((a) =>
      a.getAttribute("href")?.startsWith("/articles/"),
    );
    expect(threadAnchors).toHaveLength(6);
    expect(container.textContent).toContain("4 more on the corpus map");
    expect(
      container.querySelector('a[href="/articles"]'),
    ).toBeTruthy();
    unmount();
  });

  it("the strand glyph is decorative: aria-hidden, strand-b token, no raw color", () => {
    const { container, unmount } = render(
      <ArticleThreads currentSlug="x" drawsOn={items} pulledBy={[]} />,
    );
    const glyph = container.querySelector('[aria-hidden="true"]');
    expect(glyph?.className).toContain("text-strand-b");
    expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    unmount();
  });
});

describe("article page wiring", () => {
  const PAGE = readFileSync(
    path.resolve(__dirname, "..", "app/articles/[slug]/page.tsx"),
    "utf-8",
  );

  it("renders ArticleThreads from computeThreads over the published corpus", () => {
    expect(PAGE).toContain("computeThreads(slug, article.body, corpus)");
    // getAllArticles is the published-only accessor — the queue never leaks.
    expect(PAGE).toMatch(/const corpus = getAllArticles\(\)/);
    expect(PAGE).toMatch(/<ArticleThreads[\s\S]{0,200}drawsOn=[\s\S]{0,200}pulledBy=/);
  });
});
