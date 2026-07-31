// The standalone-link marker, tested against real markdown.
//
// This exists because the marker silently did nothing once already: an edit
// targeted a line that had since changed, the replacement never applied, and
// the only symptom was the layout audit going from 204 to 196 clean two
// deploys later. A rendering rule that can vanish without a test failing will
// eventually vanish.
//
// What it must get right is the distinction CSS cannot express. `:only-child`
// counts ELEMENT siblings and ignores text, so `<p>Read <strong><a>x</a></strong>
// now</p>` matches `strong:only-child` — a selector-based rule would inflate a
// link sitting in the middle of a sentence. The plugin sees the text nodes.
import { beforeAll, describe, expect, it } from "vitest";
import { renderMarkdown } from "@/components/markdown-article";

const render = (md: string) => renderMarkdown(md);

// The unified processor lazy-loads Shiki's highlighter (WASM + both themes) on
// first use. On a cold CI runner that alone can exceed vitest's 5s default —
// it landed on whichever test ran first and failed it as a timeout. Pay the
// cost once here, with its own budget, so the tests time only themselves.
beforeAll(async () => {
  await render("warm-up");
}, 30000);

describe("standalone-link marking", () => {
  it("marks a link that is a table cell's whole content", async () => {
    const html = await render(
      "| Cat |\n| --- |\n| [A01](https://example.com) |",
    );
    expect(html).toContain("standalone-link");
  });

  it("marks a link that is a list item's whole content", async () => {
    const html = await render("- [Ranking vs. measuring](https://example.com)");
    expect(html).toContain("standalone-link");
  });

  it("marks a CTA link behind a single inline wrapper", async () => {
    const html = await render("**[Star on GitHub](https://example.com)**");
    expect(html).toContain("standalone-link");
  });

  // The cases that must NOT be marked: inflating these would push a link out
  // of the line it belongs to, mid-sentence.
  it("leaves a link inline in a sentence alone", async () => {
    const html = await render("Read **[this](https://example.com)** now.");
    expect(html).not.toContain("standalone-link");
  });

  it("leaves a link with trailing text in its block alone", async () => {
    const html = await render("[Docs](https://example.com) and more text.");
    expect(html).not.toContain("standalone-link");
  });

  it("leaves a link sharing a cell with other links alone", async () => {
    const html = await render(
      "| Rules |\n| --- |\n| [a](https://e.com), [b](https://e.com) |",
    );
    expect(html).not.toContain("standalone-link");
  });
});
