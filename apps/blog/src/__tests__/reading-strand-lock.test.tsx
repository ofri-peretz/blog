import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ReadingStrand, readingProgress } from "../components/ui/reading-strand";

/**
 * ReadingStrand consumption locks — the vendored provenance, the SSR/CLS
 * contract, and the article-page wiring (the strand must track the BODY
 * span, so progress completes when the reading does).
 */

const read = (...p: string[]): string =>
  readFileSync(path.resolve(__dirname, "..", ...p), "utf-8");

describe("consumption contract", () => {
  it("the strand is the vendored DS primitive, with provenance", () => {
    const SRC = read("components", "ui", "reading-strand.tsx");
    expect(SRC).toContain("VENDORED from the Interlace DS");
    expect(SRC).toContain("interlace#62");
    // The reduced-motion decision travels with the code, not the PR.
    expect(SRC).toContain("prefers-reduced-motion");
  });

  it("the article page draws the strand over the body span only", () => {
    const PAGE = read("app", "articles", "[slug]", "page.tsx");
    expect(PAGE).toContain('<ReadingStrand target="article-reading-span"');
    expect(PAGE).toMatch(
      /<div id="article-reading-span">\s*<MarkdownArticle/,
    );
  });
});

describe("SSR / CLS contract", () => {
  it("renders a named progressbar at scaleX(0) in the strand token", () => {
    const html = renderToStaticMarkup(<ReadingStrand data-testid="rs" />);
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-label="Reading progress"');
    expect(html).toContain('aria-valuenow="0"');
    expect(html).toContain("scaleX(0)");
    expect(html).toContain("bg-strand-a");
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });
});

describe("progress math (the vendored pure core)", () => {
  it("maps the span linearly and clamps", () => {
    expect(readingProgress(-500, 2000, 1000)).toBe(0.5);
    expect(readingProgress(200, 2000, 1000)).toBe(0);
    expect(readingProgress(-5000, 2000, 1000)).toBe(1);
    expect(readingProgress(100, 800, 1000)).toBe(1);
  });
});
