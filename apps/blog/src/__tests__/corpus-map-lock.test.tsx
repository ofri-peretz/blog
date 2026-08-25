// Corpus-map lock — the map is now CONSUMED from the Interlace DS.
//
// The app-local CorpusMap was superseded by the DS TimelineMap
// (interlace repo packages/ui, landed in interlace#56): fit-all width,
// roving-tabindex keyboard traversal, series filter chips, and the link
// weave. This lock pins the consumption contract so a refactor can't
// quietly fork the component again or sever the link graph:
//
//   1. /articles renders the VENDORED DS component (with provenance),
//      never a re-authored local one.
//   2. The link weave is fed by real extraction over the markdown corpus
//      (extractInternalLinks), and the extraction semantics hold.
//   3. The strand tokens the DS strokes with exist in this app's theme,
//      light and dark — a missing token renders invisible threads.
//   4. renderToStaticMarkup stays the no-JS/crawler truth: every dot a
//      real anchor, threads aria-hidden with the Detail strip speaking
//      the same links in text.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  TimelineMap,
  type TimelineMapItem,
} from "@/components/ui/timeline-map";
import { extractInternalLinks } from "@/lib/corpus-links";

const FIXTURE: TimelineMapItem[] = [
  { id: "a", href: "/articles/a", label: "Alpha", category: "Foundations", date: "2026-01-10", weight: 0.4, links: ["c"] },
  { id: "b", href: "/articles/b", label: "Beta", category: "Foundations", date: "2026-03-01", weight: 0.6 },
  { id: "c", href: "/articles/c", label: "Gamma", category: null, date: "2026-06-15", weight: 1 },
];

const read = (...p: string[]): string =>
  readFileSync(path.resolve(__dirname, "..", ...p), "utf-8");
const MAP_SOURCE = read("components", "ui", "timeline-map.tsx");
const PAGE_SOURCE = read("app", "articles", "page.tsx");
const CSS_SOURCE = read("app", "globals.css");

describe("consumption contract", () => {
  it("the map is the vendored DS component, with provenance", () => {
    expect(MAP_SOURCE).toContain("VENDORED from the Interlace DS");
    expect(MAP_SOURCE).toContain("interlace#56");
  });

  it("/articles consumes the DS map and the link extraction", () => {
    expect(PAGE_SOURCE).toContain('from "@/components/woven-corpus-map"');
    expect(PAGE_SOURCE).toContain("extractInternalLinks(");
    // The old local component must stay dead.
    expect(PAGE_SOURCE).not.toContain('from "@/components/corpus-map"');
    // The Link injection lives in the client seam — a server page cannot
    // pass a function prop across the RSC boundary (caught live).
    const SEAM = read("components", "woven-corpus-map.tsx");
    expect(SEAM).toContain('"use client"');
    expect(SEAM).toContain("linkComponent={Link}");
    expect(SEAM).toContain('from "@/components/ui/timeline-map"');
  });

  it("strand tokens exist in the theme, both modes, and are registered", () => {
    expect(CSS_SOURCE).toContain("--strand-a: var(--brand-orange)");
    // Light + dark definitions for the cool counter-strand.
    expect(CSS_SOURCE).toContain("--strand-b: oklch(0.55 0.12 230)");
    expect(CSS_SOURCE).toContain("--strand-b: oklch(0.78 0.1 230)");
    // Tailwind registration — without these the utilities never generate.
    expect(CSS_SOURCE).toContain("--color-strand-a: var(--strand-a)");
    expect(CSS_SOURCE).toContain("--color-strand-b: var(--strand-b)");
  });
});

describe("extractInternalLinks", () => {
  const slugs = new Set(["alpha", "beta", "gamma"]);

  it("finds canonical absolute AND site-relative forms, deduplicated", () => {
    const body = [
      "See [A](https://ofriperetz.dev/articles/alpha) and",
      "[A again](/articles/alpha), plus [B](/articles/beta).",
    ].join("\n");
    expect(extractInternalLinks(body, "gamma", slugs).sort()).toEqual([
      "alpha",
      "beta",
    ]);
  });

  it("drops self-references and slugs outside the corpus", () => {
    const body =
      "[me](/articles/gamma) [ghost](/articles/renamed-away) [ok](/articles/beta)";
    expect(extractInternalLinks(body, "gamma", slugs)).toEqual(["beta"]);
  });
});

describe("static markup (crawler truth)", () => {
  const html = renderToStaticMarkup(
    <TimelineMap items={FIXTURE} data-testid="corpus-map" uncategorizedLabel="Standalone">
      <TimelineMap.Filter />
      <TimelineMap.Chart />
      <TimelineMap.Detail idle="Hover a dot to preview an article." />
    </TimelineMap>,
  );

  it("every article is a real anchor with an accessible name", () => {
    for (const i of FIXTURE) expect(html).toContain(`href="${i.href}"`);
    expect(html).toContain('aria-label="Gamma — 2026-06-15"');
  });

  it("threads render aria-hidden in strand-b; marks in strand-a", () => {
    expect(html).toContain('data-slot="timeline-map-links"');
    expect(html).toContain("text-strand-b");
    expect(html).toContain("text-strand-a");
    expect(html).toMatch(/timeline-map-links"[^>]*aria-hidden/);
  });

  it("standalone pieces share the labeled last lane", () => {
    expect(html).toContain("Standalone");
  });
});
