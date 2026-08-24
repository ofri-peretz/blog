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

  it("announces the encoding: axis header row first, key in the caption", () => {
    // The axis renders BEFORE the first lane strip so left-to-right = time
    // is announced before any dots (2026-08-24 legibility pass).
    const axis = html.indexOf('aria-hidden="true"');
    const firstLane = html.indexOf("Foundations");
    expect(axis).toBeGreaterThan(-1);
    expect(axis).toBeLessThan(firstLane);
    // The caption spells out all three encodings.
    expect(html).toContain("publication date");
    expect(html).toContain("row: series");
    expect(html).toContain("dot size: reading time");
  });

  it("lane labels carry their article counts", () => {
    // Fixture: Foundations has 2 articles, Standalone 1.
    expect(html).toMatch(/Foundations<\/span>[^<]*<span[^>]*>2</);
    expect(html).toMatch(/Standalone<\/span>[^<]*<span[^>]*>1</);
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

  it("a solo (un-bursted) dot sits vertically centered in its lane", () => {
    // The naive fan order parked every solo dot at the lane's top edge.
    const gammaStrip = html.split("<svg").find((s) => s.includes("Gamma"));
    expect(gammaStrip).toMatch(/<circle cx="[^"]+" cy="22"/);
  });
});

describe("no occluded articles — the real corpus renders every dot visibly", () => {
  it("no two dots share coordinates (batch-published bursts must fan out)", async () => {
    // Real data, not fixtures: the corpus was batch-published, so before
    // the beeswarm fan 43 of 89 dots were perfectly stacked and invisible.
    // Same published_at→date fallback as the page: 4 published articles
    // carry only `date` and were silently dropped before it.
    const { getAllArticles } = await import("@/lib/source");
    const all = getAllArticles();
    const points: CorpusPoint[] = all
      .map((a) => ({
        slug: a.slug,
        title: a.frontmatter.title,
        series: a.frontmatter.series ?? null,
        date: String(
          a.frontmatter.published_at ?? a.frontmatter.date ?? "",
        ).slice(0, 10),
        minutes: a.readingTimeMinutes,
      }))
      .filter((p) => p.date.length === 10);
    // The fallback must not lose articles: every article that HAS a date
    // maps. Articles with neither published_at nor date are unplottable
    // on a time axis — the skip must account for them exactly, so a
    // regression in the fallback can't hide behind them.
    const dateless = all.filter(
      (a) => !a.frontmatter.published_at && !a.frontmatter.date,
    );
    expect(points.length + dateless.length).toBe(all.length);
    const markup = renderToStaticMarkup(<CorpusMap points={points} />);
    // Dots live in per-lane svg strips with independent coordinate spaces —
    // uniqueness is asserted within each strip.
    const strips = markup.split("<svg").slice(1);
    let total = 0;
    for (const strip of strips) {
      const coords = [...strip.matchAll(/<circle cx="([^"]+)" cy="([^"]+)"/g)].map(
        (m) => `${m[1]},${m[2]}`,
      );
      total += coords.length;
      expect(new Set(coords).size).toBe(coords.length);
    }
    expect(total).toBe(points.length);
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
