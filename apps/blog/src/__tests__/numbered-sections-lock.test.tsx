import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Agenda } from "../components/landing/agenda";
import { SectionIndex } from "../components/ui/section-index";

/**
 * Numbered-sections locks — the homepage reads as a sequence ("01 IMPACT
 * … 05 CAREER"): the page owns the numbering, every landing section
 * renders the vendored SectionIndex, and the numeral's AAA orange comes
 * from the measured DS ladder via the data-slot hook (the vendored
 * source stays byte-identical to canonical).
 */

const read = (...p: string[]): string =>
  readFileSync(path.resolve(__dirname, "..", ...p), "utf-8");

describe("consumption contract", () => {
  it("the eyebrow is the vendored DS primitive, with provenance", () => {
    const SRC = read("components", "ui", "section-index.tsx");
    expect(SRC).toContain("VENDORED from the Interlace DS");
    expect(SRC).toContain("interlace#66");
    expect(SRC).toContain("text-primary");
  });

  it("the numeral's orange is the measured AAA ladder, styled by slot", () => {
    const CSS = read("app", "globals.css");
    // The blog's --primary is achromatic; the slot hook recolors the
    // numeral without forking the vendored source (R6's purpose).
    expect(CSS).toMatch(
      /\[data-slot="section-index-numeral"\] \{\s*color: var\(--brand-orange-text\);/,
    );
    expect(CSS).toContain("--brand-orange-text: #7d350c;");
    expect(CSS).toContain("--brand-orange-text: #fbb99a;");
  });

  it("the page owns the sequence: 1..5 in section order", () => {
    const PAGE = read("app", "page.tsx");
    // Anchored to the five landing components (review): a future
    // unrelated `index={n}` prop on the page must not corrupt this lock.
    const order = [
      ...PAGE.matchAll(
        /<(?:ImpactMetricsBlock|Agenda|FeaturedProject|DevToArticles|WorkExperience)[\s\S]{0,120}?index=\{(\d)\}/g,
      ),
    ].map((m) => Number(m[1]));
    expect(order).toEqual([1, 2, 3, 4, 5]);
  });

  it("every landing section renders its numbered eyebrow", () => {
    for (const name of [
      "agenda",
      "featured-project",
      "impact-metrics-block",
      "devto-articles",
      "work-experience",
    ]) {
      const SRC = read("components", "landing", `${name}.tsx`);
      expect(SRC, name).toContain("<SectionIndex value={index}");
    }
  });
});

describe("rendered sequence voice", () => {
  it("Agenda at index 2 shows 02 and speaks Section 2", () => {
    const html = renderToStaticMarkup(<Agenda id="agenda" index={2} />);
    expect(html).toContain(">02<");
    expect(html).toContain("Section 2:");
    expect(html).toContain("The agenda");
  });

  it("the vendored numeral keeps the terminal form", () => {
    const html = renderToStaticMarkup(
      <SectionIndex value={5} data-testid="si">
        Career
      </SectionIndex>,
    );
    expect(html).toContain(">05<");
    expect(html).toContain("[font-variant-numeric:tabular-nums]");
  });
});
