import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { renderArticleReact } from "../components/markdown-article";

/**
 * Article code-copy locks — fenced blocks render through the vendored
 * DS CodeBlock (copy affordance + language tag), highlighting and the
 * dark-mode flip survive the swap, and the copy event stays wired.
 */

const read = (rel: string): string =>
  readFileSync(path.resolve(__dirname, "..", rel), "utf-8");

const FENCED = "# Title\n\n## Section one\n\n```ts\nconst x = 1;\n```\n";

describe("the React article pipeline", () => {
  it("a fenced block becomes the DS CodeBlock with copy + language tag", async () => {
    const { node } = await renderArticleReact(FENCED, "test-slug");
    const html = renderToStaticMarkup(<>{node}</>);
    expect(html).toContain('data-slot="code-block"');
    expect(html).toContain('data-slot="code-block-copy"');
    expect(html).toContain('data-slot="code-block-language"');
    expect(html).toContain(">ts<");
    // Shiki's highlighting rides through: token spans with the dark vars.
    expect(html).toContain("--shiki-dark");
    // Shiki's own <pre> (inline light background and all) is dropped —
    // the DS figure owns the box with theme tokens.
    expect(html).not.toContain("shiki-themes");
  });

  it("headings keep their ids and anchor wrap, and the TOC still collects", async () => {
    const { node, toc } = await renderArticleReact(FENCED, "test-slug");
    const html = renderToStaticMarkup(<>{node}</>);
    expect(html).toContain('id="section-one"');
    expect(html).toContain('class="anchor"');
    expect(toc).toEqual([{ id: "section-one", label: "Section one" }]);
  });

  it("a raw <pre> without <code> (article-embedded HTML) stays authored", async () => {
    const { node } = await renderArticleReact(
      "before\n\n<pre>plain preformatted</pre>\n",
      "test-slug",
    );
    const html = renderToStaticMarkup(<>{node}</>);
    expect(html).toContain("plain preformatted");
    expect(html).not.toContain('data-slot="code-block-copy"');
  });
});

describe("the copy receipt", () => {
  it("ArticleCodeBlock fires article:code_copy_click from the onCopied seam", () => {
    const SRC = read("components/article-code-block.tsx");
    expect(SRC).toContain("onCopied={()");
    expect(SRC).toContain(
      'track("article:code_copy_click", { slug, language: language ?? null })',
    );
  });
});

describe("dark-mode highlighting survives the swap", () => {
  it("globals scopes the --shiki-dark flip to the CodeBlock pre slot", () => {
    const CSS = readFileSync(
      path.resolve(__dirname, "../app/globals.css"),
      "utf-8",
    );
    expect(CSS).toContain('.dark [data-slot="code-block-pre"] span');
    expect(CSS).toContain("var(--shiki-dark)");
  });
});

describe("vendoring (provenance + drift coverage)", () => {
  const DRIFT = readFileSync(
    path.resolve(__dirname, "../../../../scripts/check-vendored-drift.mjs"),
    "utf-8",
  );

  it.each([
    "components/ui/code-block.tsx",
    "components/ui/skeleton.tsx",
    "components/ui/skeleton-variants.ts",
  ])("%s carries provenance and is tracked by the weekly drift check", (rel) => {
    expect(read(rel)).toContain("// VENDORED from the Interlace DS");
    expect(DRIFT).toContain(`"${rel}"`);
  });
});
