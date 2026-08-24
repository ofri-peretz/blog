// Explicit heading anchors (`## Title {#custom-id}`), tested against real
// markdown through the full pipeline.
//
// This exists because the syntax silently rendered as literal text for the
// site's whole life: 36 of 89 articles showed `{#the-four-layers}` inside
// their headings to every reader, and nothing failed. A rendering rule whose
// absence only degrades cosmetically will never be caught by a build.
import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  renderMarkdown,
  renderMarkdownWithToc,
} from "@/components/markdown-article";

const render = (md: string) => renderMarkdown(md);

// Shiki warm-up — same rationale as markdown-standalone-links.test.ts.
beforeAll(async () => {
  await render("warm-up");
}, 30000);

describe("explicit heading ids", () => {
  it("strips the {#id} marker from the visible heading text", async () => {
    const html = await render(
      "## Four layers, each hiding the next {#the-four-layers}",
    );
    expect(html).not.toContain("{#");
    expect(html).toContain("Four layers, each hiding the next<");
  });

  it("applies the explicit id to the heading element", async () => {
    const html = await render("## Detection is the trap {#detection}");
    expect(html).toMatch(/<h2[^>]*\bid="detection"/);
  });

  it("the explicit id wins over the slug the text would generate", async () => {
    const html = await render("## Bug #1: something broke {#bug-1}");
    expect(html).toMatch(/<h2[^>]*\bid="bug-1"/);
    expect(html).not.toMatch(/id="bug-1-something-broke"/);
  });

  it("headings without a marker still get rehype-slug ids", async () => {
    const html = await render("## Plain heading");
    expect(html).toMatch(/<h2[^>]*\bid="plain-heading"/);
  });

  it("a {#id} inside a trailing code span is left alone", async () => {
    const html = await render("## Using the `{#id}` syntax");
    expect(html).toContain("{#id}");
  });

  it("in-page links resolve against the explicit id", async () => {
    const html = await render(
      "[jump](#detection)\n\n## Detection {#detection}",
    );
    expect(html).toContain('href="#detection"');
    expect(html).toMatch(/<h2[^>]*\bid="detection"/);
  });
});

describe("renderMarkdownWithToc — h2 landmark collection", () => {
  it("collects final ids and decoded plain-text labels, h2 only", async () => {
    const { toc } = await renderMarkdownWithToc(
      "## One {#uno}\n\ntext\n\n## Two & `code`\n\n### not a landmark",
    );
    expect(toc).toHaveLength(2);
    expect(toc[0]).toEqual({ id: "uno", label: "One" });
    // Label comes from tree text nodes: entities decoded, markup stripped.
    expect(toc[1].label).toBe("Two & code");
    expect(toc[1].id).toMatch(/^[a-z0-9-]+$/);
  });

  it("html and toc come from the same single pipeline pass", async () => {
    const { html, toc } = await renderMarkdownWithToc("## Detection {#detection}");
    expect(html).toMatch(/<h2[^>]*\bid="detection"/);
    expect(toc).toEqual([{ id: "detection", label: "Detection" }]);
  });
});

describe("corpus: no article renders a literal {#id} in a heading", () => {
  // Cheap corpus-wide guard: ANY `{#` in a heading line that the plugin
  // would not consume — wrong shape (uppercase start, unicode, leading
  // digit) OR wrong position (marker not trailing, e.g. followed by bold
  // text) — fails here naming the file, instead of shipping literal
  // `{#...}` garbage to readers. The plugin deliberately only handles the
  // trailing-text-node convention; this guard is what keeps the corpus
  // inside that convention.
  it("every {#...} in a heading is a trailing marker the plugin consumes", () => {
    const dir = resolve(__dirname, "../../content/articles");
    const offenders: string[] = [];
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".md"))) {
      const body = readFileSync(join(dir, file), "utf-8");
      for (const line of body.split("\n")) {
        if (!/^#{1,6}\s/.test(line) || !line.includes("{#")) continue;
        if (!/\{#[A-Za-z][\w-]*\}\s*$/.test(line)) {
          offenders.push(`${file}: ${line.trim()}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
