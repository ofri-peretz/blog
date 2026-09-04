/**
 * Every `viz-*` utility a vendored chart uses must resolve to a token this app
 * actually defines.
 *
 * The failure this prevents is silent by construction. Tailwind emits
 * `text-viz-positive` whether or not `--color-viz-positive` exists; when it
 * does not, the rule sets a colour to nothing and the element inherits. A
 * delta that is supposed to be green-for-up renders in body text, no build
 * error, no console, and the only symptom is that the one thing colour was
 * carrying is gone.
 *
 * It nearly shipped that way: re-vendoring TimeSeries brought `Delta` in with
 * `text-viz-positive` / `text-viz-negative`, and this app defined neither —
 * it had only `--viz-crosshair`.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../../../..");
const UI = join(ROOT, "apps/blog/src/components/ui");
const CSS = readFileSync(join(ROOT, "apps/blog/src/app/globals.css"), "utf-8");

/** `--color-viz-*` names the theme layer actually exposes to Tailwind. */
function definedTokens(): Set<string> {
  return new Set(
    [...CSS.matchAll(/--color-(viz-[a-z-]+)\s*:/g)].map((m) => m[1]),
  );
}

/** `viz-*` utilities referenced anywhere in the vendored chart components. */
function referencedTokens(): Map<string, string[]> {
  const byToken = new Map<string, string[]>();
  for (const file of readdirSync(UI).filter((f) => f.endsWith(".tsx"))) {
    const text = readFileSync(join(UI, file), "utf-8");
    for (const m of text.matchAll(
      /\b(?:text|bg|fill|stroke|border)-(viz-[a-z-]+)\b/g,
    )) {
      byToken.set(m[1], [...(byToken.get(m[1]) ?? []), file]);
    }
  }
  return byToken;
}

const defined = definedTokens();
const referenced = referencedTokens();

describe("viz tokens referenced by vendored charts are defined", () => {
  it("the css scan finds tokens at all", () => {
    // Without this, a regex that stopped matching would make the check below
    // pass by finding nothing to check.
    expect(defined.size).toBeGreaterThan(0);
  });

  it("the component scan finds usages at all", () => {
    expect(referenced.size).toBeGreaterThan(0);
  });

  it("no chart references a viz token this app does not define", () => {
    const missing = [...referenced.entries()]
      .filter(([token]) => !defined.has(token))
      .map(
        ([token, files]) =>
          `${token} (used in ${[...new Set(files)].join(", ")})`,
      );
    expect(
      missing,
      `vendored charts reference viz tokens globals.css does not define:\n  ${missing.join("\n  ")}\n` +
        `defined: ${[...defined].sort().join(", ")}`,
    ).toEqual([]);
  });
});
