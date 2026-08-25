import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { computeReadIds, type TocItem } from "../components/floating-toc";

/**
 * Lint-run TOC locks — the read semantics (a section is read when you
 * move PAST it, never merely opened) and the restrained rendering
 * contract: decorative ticks, honest SR text, the pass line only when
 * everything is read.
 */

const ITEMS: TocItem[] = [
  { id: "a", label: "A" },
  { id: "b", label: "B" },
  { id: "c", label: "C" },
];

describe("computeReadIds — read means moved past", () => {
  it("opening a section does not read it; passing it does", () => {
    // Reader is IN b: a is read (passed), b is not (merely open).
    expect(computeReadIds(ITEMS, new Set(["a", "b"]), false)).toEqual(
      new Set(["a"]),
    );
    // Reader only ever saw a: nothing is read yet.
    expect(computeReadIds(ITEMS, new Set(["a"]), false)).toEqual(new Set());
  });

  it("the last section needs the page end; reaching it reads everything", () => {
    expect(computeReadIds(ITEMS, new Set(["a", "b", "c"]), false)).toEqual(
      new Set(["a", "b"]),
    );
    expect(computeReadIds(ITEMS, new Set(["a"]), true)).toEqual(
      new Set(["a", "b", "c"]),
    );
  });

  it("no sections, no run", () => {
    expect(computeReadIds([], new Set(), true)).toEqual(new Set());
  });
});

describe("restrained rendering contract", () => {
  const SRC = readFileSync(
    path.resolve(__dirname, "..", "components", "floating-toc.tsx"),
    "utf-8",
  );

  it("ticks are decorative, in the success green — state, never motion", () => {
    expect(SRC).toMatch(/aria-hidden="true"[\s\S]{0,80}text-brand-green[\s\S]{0,40}✓/);
    // The tick has no animation of its own — no new motion primitives.
    expect(SRC).not.toMatch(/✓[^<]*animate-/);
  });

  it("the pass line appears only when ALL sections are read, and speaks plainly", () => {
    expect(SRC).toMatch(/allRead = items\.length > 0 && readIds\.size === items\.length/);
    expect(SRC).toContain("0 problems");
    // SR users hear the meaning, not the joke idiom.
    expect(SRC).toContain('<span className="sr-only">All sections read.</span>');
  });

  it("the end-of-page listener retires itself after firing", () => {
    expect(SRC).toMatch(/setReachedEnd\(true\);\s*window\.removeEventListener\("scroll", onScroll\)/);
  });
});
