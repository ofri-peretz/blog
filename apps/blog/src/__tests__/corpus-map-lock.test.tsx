// Corpus-map lock — 2026-08-24.
//
// The map is navigation, not decoration: every dot must be a real link,
// identity must be carried spatially (labeled lanes, single hue — never an
// 8-way categorical palette), and the hover layer is a fixed detail strip
// (no floating tooltip, no inline-style positioning). renderToStaticMarkup
// is the no-JS/crawler view: dots must be anchors there, not divs wired up
// later.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CorpusMap, type CorpusPoint } from "@/components/corpus-map";

const FIXTURE: CorpusPoint[] = [
  { slug: "a", title: "Alpha", series: "Foundations", date: "2026-01-10", minutes: 5 },
  { slug: "b", title: "Beta", series: "Foundations", date: "2026-03-01", minutes: 8 },
  { slug: "c", title: "Gamma", series: null, date: "2026-06-15", minutes: 12 },
];

const MAP_SOURCE = readFileSync(
  path.resolve(__dirname, "..", "components", "corpus-map.tsx"),
  "utf-8",
);
const PAGE_SOURCE = readFileSync(
  path.resolve(__dirname, "..", "app", "articles", "page.tsx"),
  "utf-8",
);

describe("CorpusMap static markup", () => {
  const html = renderToStaticMarkup(<CorpusMap points={FIXTURE} />);

  it("renders every article as a real link", () => {
    for (const p of FIXTURE) {
      expect(html).toContain(`href="/articles/${p.slug}"`);
    }
  });

  it("labels every lane directly (spatial identity, no legend box)", () => {
    expect(html).toContain("Foundations");
    expect(html).toContain("Standalone");
  });

  it("dots carry accessible names with title, series, date, minutes", () => {
    expect(html).toMatch(/aria-label="Alpha — Foundations, Jan 10, 2026, 5 min"/);
  });

  it("ships the fixed detail strip with its idle prompt", () => {
    expect(html).toContain("Hover a dot to preview an article.");
  });

  it("renders nothing for an empty corpus", () => {
    expect(renderToStaticMarkup(<CorpusMap points={[]} />)).toBe("");
  });
});

describe("corpus-map constraints", () => {
  it("no inline style props (feedback_no_inline_styles)", () => {
    expect(MAP_SOURCE).not.toMatch(/style=\{\{/);
  });

  it("single-hue marks — no per-series color assignment", () => {
    // Identity lives in the lanes; a future "color by series" must argue
    // with the CVD math for 8 categories first.
    expect(MAP_SOURCE).not.toMatch(/chart-[2-9]/);
  });

  it("the articles page feeds the map the WHOLE corpus, not the page slice", () => {
    expect(PAGE_SOURCE).toContain("<CorpusMap");
    expect(PAGE_SOURCE).toMatch(/mapPoints:\s*CorpusPoint\[\]\s*=\s*all/);
  });
});
