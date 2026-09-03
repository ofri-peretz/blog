/**
 * The corpus's code blocks, checked against the plugins they describe.
 *
 * 655 fenced blocks, 393 of them JS/TS, every one making a claim a reader
 * relies on — and until 2026-09-02, none checked. The failure mode is not
 * hypothetical: wrong rule counts, an export shape that did not exist, and
 * "taint" analysis the code does not perform have all shipped, each caught by
 * a human re-reading afterwards.
 *
 * A block opts in through its fence — `lint:pkg/rule`, or `lint:!pkg/rule` for
 * "this reports nothing". Unannotated blocks are not checked, which keeps the
 * ~260 config, terminal and JSON blocks out of it and means nobody has to
 * learn anything to write an ordinary block.
 *
 * Intent: docs/sdlc/intents/2026-09-02-articles-that-cannot-lie
 */
import { describe, expect, it } from "vitest";

import { collectClaims, verifyClaim } from "../../scripts/verify-code-claims.mjs";

const claims = collectClaims();

describe("every annotated code block does what it claims", () => {
  it("there is at least one annotated block", () => {
    // Without this the suite is green whether the claims hold or the collector
    // silently stopped finding them — the two states this whole intent exists
    // to tell apart.
    expect(
      claims.length,
      "no lint: annotations found — either none exist yet, or the fence " +
        "parser stopped matching. Both are worth failing on.",
    ).toBeGreaterThan(0);
  });

  for (const entry of claims) {
    const c = entry.claim;
    const label = `${entry.file}:${entry.line} claims ${c.negated ? "!" : ""}${c.ns}/${c.rule}`;
    it(label, () => {
      const r = verifyClaim(entry);
      expect(r.ok, `${r.where} — ${r.msg}`).toBe(true);
    });
  }
});
