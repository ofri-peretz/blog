import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { renderArticleReact } from "../components/markdown-article";
import { ArticleCodeBlock } from "../components/article-code-block";
import { track } from "../lib/analytics";

vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));

/**
 * Article code-copy locks — fenced blocks render through the vendored
 * DS CodeBlock (copy affordance + language tag), highlighting and the
 * dark-mode flip survive the swap, and the copy event stays wired.
 */

const read = (rel: string): string =>
  readFileSync(path.resolve(__dirname, "..", rel), "utf-8");

const FENCED = "# Title\n\n## Section one\n\n```ts\nconst x = 1;\n```\n";

// Whichever pipeline test runs first pays Shiki's cold highlighter
// init (theme + oniguruma load) — measured over vitest's 5s default on
// the CI runner while warm runs take ~30ms. The budget covers the cold
// start only; it is not a license for slow assertions.
const SHIKI_COLD_START_MS = 30_000;

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
  }, SHIKI_COLD_START_MS);

  it("headings keep their ids and anchor wrap, and the TOC still collects", async () => {
    const { node, toc } = await renderArticleReact(FENCED, "test-slug");
    const html = renderToStaticMarkup(<>{node}</>);
    expect(html).toContain('id="section-one"');
    expect(html).toContain('class="anchor"');
    expect(toc).toEqual([{ id: "section-one", label: "Section one" }]);
  }, SHIKI_COLD_START_MS);

  it("a raw <pre> without <code> (article-embedded HTML) stays authored", async () => {
    const { node } = await renderArticleReact(
      "before\n\n<pre>plain preformatted</pre>\n",
      "test-slug",
    );
    const html = renderToStaticMarkup(<>{node}</>);
    expect(html).toContain("plain preformatted");
    expect(html).not.toContain('data-slot="code-block-copy"');
  }, SHIKI_COLD_START_MS);
});

describe("the copy receipt", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.mocked(track).mockClear();
  });

  // The source scan below guards against accidental deletion; this is
  // the behavioral half (review): a real click drives clipboard →
  // onCopied → track with the exact event and props.
  it("clicking copy fires track with the event, slug, and language", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    const { container, findByText } = render(
      <ArticleCodeBlock slug="pool-article">
        <code className="language-ts">{"const a = 1;"}</code>
      </ArticleCodeBlock>,
    );
    await act(async () => {
      fireEvent.click(container.querySelector('[data-slot="code-block-copy"]')!);
    });

    await findByText("Copied!");
    expect(writeText).toHaveBeenCalledWith("const a = 1;");
    expect(track).toHaveBeenCalledExactlyOnceWith("article:code_copy_click", {
      slug: "pool-article",
      language: "ts",
    });
  });

  it("a failed write fires nothing — copies, not clicks, are the receipt", async () => {
    vi.stubGlobal("navigator", {});
    const { container } = render(
      <ArticleCodeBlock slug="pool-article">
        <code className="language-ts">{"const a = 1;"}</code>
      </ArticleCodeBlock>,
    );
    await act(async () => {
      fireEvent.click(container.querySelector('[data-slot="code-block-copy"]')!);
    });
    expect(track).not.toHaveBeenCalled();
  });

  it("ArticleCodeBlock fires article:code_copy_click from the onCopied seam", () => {
    const SRC = read("components/article-code-block.tsx");
    expect(SRC).toContain("onCopied={()");
    expect(SRC).toContain(
      'track("article:code_copy_click", { slug, language: language ?? null })',
    );
  });
});

describe("dark-mode highlighting survives the swap", () => {
  const CSS = readFileSync(
    path.resolve(__dirname, "../app/globals.css"),
    "utf-8",
  );

  it("globals scopes the --shiki-dark flip to the CodeBlock pre slot", () => {
    expect(CSS).toContain('.dark [data-slot="code-block-pre"] span');
    expect(CSS).toContain("var(--shiki-dark)");
  });

  it("the AA token overrides ride the slot scope too", () => {
    // The comment-colour (#6A737D → #8b949e, 3.72:1 regressed live) and
    // constant-colour (#e36209 → #bc4c00) fixes were left scoped to
    // `.shiki` when the swap dropped that element — dead CSS, caught by
    // Lighthouse on production (a11y 100 → 97).
    expect(CSS).toContain(
      '.dark [data-slot="code-block-pre"] span[style*="--shiki-dark:#6A737D"]',
    );
    expect(CSS).toContain(
      ':root:not(.dark) [data-slot="code-block-pre"] span[style*="color:#e36209"]',
    );
  });

  it("no selector targets .shiki — that element no longer exists", () => {
    // Any future .shiki-scoped rule is dead on arrival; comments may
    // mention the class, selectors may not.
    expect(CSS).not.toMatch(/^[^\n/]*\.shiki[^\n]*\{/m);
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
