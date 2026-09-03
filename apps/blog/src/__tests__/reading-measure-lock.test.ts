/**
 * The measure — the one typography rule with a gate.
 *
 * Contract: docs/TYPOGRAPHY.md — body text renders 45-75 characters per line,
 * target 66. This is the single number that most determines whether long-form
 * text is comfortable, and it was OUT OF RANGE when the contract was written:
 * 85 characters at 1280px, against a container set to `65ch`.
 *
 * Why the container lied: `ch` is the advance width of the ZERO glyph, which
 * in Geist is 1.418x the average glyph in English prose. `65ch` is not 65
 * characters, it is about 85.
 *
 * This asserts the SOURCE value, not a live browser. The browser count is the
 * authority and lives in `scripts/reading-measure.mjs`, which the deploy gate
 * can run against a real page; a unit test cannot lay out text. What it CAN do
 * is stop the container silently drifting back, which is the regression that
 * would otherwise go unnoticed for months — nothing else in the suite looks at
 * this value.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC = path.resolve(__dirname, "..");
const CONTAINER = readFileSync(
  path.join(SRC, "components/ui/container.tsx"),
  "utf-8",
);
const GLOBALS = readFileSync(path.join(SRC, "app/globals.css"), "utf-8");
const CONTRACT = readFileSync(
  path.resolve(SRC, "../../..", "docs/TYPOGRAPHY.md"),
  "utf-8",
);

/**
 * Measured on production 2026-09-02 by counting characters on rendered lines:
 *
 *   65ch → 85    52ch → 65    50ch → 62    46ch → 58    44ch → 54
 *
 * The window that keeps the rendered count inside 45-75 with headroom. Widen
 * past this and the measure leaves the contract; the numbers above are the
 * evidence, not a guess.
 */
const MIN_CH = 44;
const MAX_CH = 56;

describe("the prose measure stays inside the typography contract", () => {
  it("the prose container is set in the measured window", () => {
    const m = /prose:\s*"max-w-\[([\d.]+)ch\]"/.exec(CONTAINER);
    // Anchored to the `prose:` key, not the first ch-width in the file. An
    // unanchored match would silently test a different variant the day someone
    // adds one above it — the lock would stay green while prose drifted.
    expect(
      m,
      "container.tsx no longer sets a ch-based width on the `prose` variant",
    ).not.toBeNull();
    const ch = Number(m![1]);
    expect(
      ch,
      `prose container is ${ch}ch. Measured: 65ch renders 85 characters, ` +
        `well outside the 45-75 contract. Keep it within ${MIN_CH}-${MAX_CH}ch ` +
        `or re-measure with scripts/reading-measure.mjs and update this window.`,
    ).toBeGreaterThanOrEqual(MIN_CH);
    expect(
      ch,
      `prose container is ${ch}ch, above the measured ceiling of ${MAX_CH}ch. ` +
        `Measured: 65ch->85, 52ch->65, 50ch->62, 46ch->58, 44ch->54 rendered ` +
        `characters. Re-measure with BASE=<origin> node ` +
        `scripts/reading-measure.mjs and move this window deliberately.`,
    ).toBeLessThanOrEqual(MAX_CH);
  });

  it("globals.css agrees with the component", () => {
    // Two declarations of the same number is how they drift apart. This repo
    // has produced that defect repeatedly today alone.
    const fromCss = /--container-prose:\s*([\d.]+)ch/.exec(GLOBALS);
    const fromTsx = /prose:\s*"max-w-\[([\d.]+)ch\]"/.exec(CONTAINER);
    expect(fromCss).not.toBeNull();
    expect(Number(fromCss![1])).toBe(Number(fromTsx![1]));
  });

  it("the contract states the range the gate enforces", () => {
    // If the document stops naming the range, the number above is arbitrary.
    expect(CONTRACT).toMatch(/45[–-]75 characters/);
    expect(CONTRACT).toMatch(/\bch\b[\s\S]{0,200}zero glyph/i);
  });
});
