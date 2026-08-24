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
import { renderMarkdown } from "@/components/markdown-article";

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

describe("corpus: no article renders a literal {#id} in a heading", () => {
  // Cheap corpus-wide guard: the marker regex applied to every heading LINE
  // of every article must be handled by the plugin's pattern. If an author
  // writes a marker shape the plugin doesn't match (uppercase start, unicode,
  // leading digit), this fails naming the file instead of shipping garbage.
  it("every {#...} marker in the corpus matches the plugin's pattern", () => {
    const dir = resolve(__dirname, "../../content/articles");
    const offenders: string[] = [];
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".md"))) {
      const body = readFileSync(join(dir, file), "utf-8");
      for (const line of body.split("\n")) {
        if (!/^#{1,6}\s/.test(line)) continue;
        const marker = line.match(/\{#([^}]*)\}\s*$/);
        if (marker && !/^[A-Za-z][\w-]*$/.test(marker[1])) {
          offenders.push(`${file}: ${line.trim()}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
