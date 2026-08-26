/**
 * Shiki notation lock — `[!code highlight]` / `[!code ++]` / `[!code --]`
 * markers in article fences must become line classes (which the vendored
 * DS CodeBlock styles), never visible text. Pins the whole chain: the
 * transformers are wired into the pipeline, the marker comment is
 * stripped from the output, and the classes the DS contract keys on
 * (`highlighted`, `diff add`, `diff remove`) actually appear.
 *
 * The dev.to half of the contract — markers stripped and removed lines
 * dropped on publish — is locked in devto-link-transforms.test.ts.
 */

import { describe, it, expect } from "vitest";

import { renderMarkdown } from "@/components/markdown-article";

const FENCE = [
  "```ts",
  "function validate(input: string) {",
  "  return eval(input); // [!code --]",
  "  return schema.parse(input); // [!code ++]",
  "  audit(input); // [!code highlight]",
  "}",
  "```",
].join("\n");

// The first render pays Shiki's cold start (engine + grammars, ~8s on a
// loaded machine) — well past vitest's 5s default.
const SHIKI_COLD_START_MS = 30_000;

describe("shiki notation", () => {
  it("markers become line classes and never render as text", { timeout: SHIKI_COLD_START_MS }, async () => {
    const html = await renderMarkdown(FENCE);

    // The directive text must be gone — a reader (or the copy button)
    // must never see the marker comment.
    expect(html).not.toContain("[!code");

    // The classes the DS CodeBlock contract styles.
    expect(html).toContain("highlighted");
    expect(html).toContain("diff add");
    expect(html).toContain("diff remove");

    // The code itself survived around the stripped markers — the marked
    // LINES stay in the DOM (the DS copy affordance is what skips the
    // removed one). Shiki splits statements across token spans, so
    // assert the identifiers, which each land inside a single span.
    expect(html).toContain("schema");
    expect(html).toContain("parse");
    expect(html).toContain("eval");
  });

  it("a fence without markers is untouched by the transformers", { timeout: SHIKI_COLD_START_MS }, async () => {
    const html = await renderMarkdown(
      "```ts\nconst a = 1;\n```",
    );
    expect(html).toContain("const");
    expect(html).not.toContain("diff");
    expect(html).not.toContain("highlighted");
  });
});
