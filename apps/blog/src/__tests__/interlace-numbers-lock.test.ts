/**
 * Interlace numbers-manifest lock
 *
 * Every plugin/rule count claim about the Interlace ESLint Ecosystem must
 * come from src/data/interlace-numbers.json — a committed copy of the
 * manifest the eslint repo generates from its actual package registry
 * (apps/docs/scripts/sync-plugin-stats.ts). Refresh with
 * `node apps/blog/scripts/sync-interlace-numbers.mjs`; never hand-edit it,
 * and never hand-type a count in a surface file.
 *
 * Article prose is deliberately NOT covered: articles cite historical
 * measurements ("scored by 332 rules on <date>") that must not be rewritten.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join, resolve } from "path";
import numbers from "@/data/interlace-numbers.json";

// Anchor to this file, not process.cwd() — same convention as
// interlace-floor-lock.test.ts.
const PROJECT_ROOT = resolve(__dirname, "../..");

// Every surface that makes an ecosystem plugin/rule count claim.
const COVERED_SURFACES = [
  "src/app/page.tsx",
  "src/components/landing/about.tsx",
  "src/components/landing/featured-project.tsx",
  "src/components/landing/faq.tsx",
  "src/components/structured-data.tsx",
  "src/app/og/route.tsx",
];

// A digit immediately followed by a plugins/rules noun is a hand-typed count.
const HAND_TYPED_COUNT =
  /\b\d+\+?\s+(?:specialized\s+|security\s+|quality\s+|production-ready\s+|eslint\s+)?(?:plugins?|rules)\b/gi;

describe("interlace-numbers.json manifest", () => {
  it("has schemaVersion 1 and internally consistent pillars", () => {
    expect(numbers.schemaVersion).toBe(1);
    expect(
      numbers.plugins.security + numbers.plugins.quality + numbers.plugins.react,
    ).toBe(numbers.plugins.total);
    expect(
      numbers.rules.security + numbers.rules.quality + numbers.rules.react,
    ).toBe(numbers.rules.total);
  });
});

describe("no hand-typed Interlace counts on covered surfaces", () => {
  for (const surface of COVERED_SURFACES) {
    it(`${surface} renders counts from the manifest`, () => {
      const content = readFileSync(join(PROJECT_ROOT, surface), "utf-8");
      const matches = content.match(HAND_TYPED_COUNT) ?? [];
      expect(
        matches,
        `${surface} hand-types counts (${matches.join(", ")}) — render them from src/data/interlace-numbers.json instead`,
      ).toEqual([]);
      expect(content).toMatch(/from "@\/data\/interlace-numbers\.json"/);
    });
  }
});
