/*
 * Every `::dev-to-cta` directive in the corpus must actually render.
 *
 * `CTA_RE` matched the label with `([^\n]+)` — exactly one line before the
 * closing `::`. Four published articles hard-wrap their label across two or
 * three lines, so the pattern never matched, `.replace` found nothing to
 * replace, and the raw directive text went out onto the live page:
 *
 *     ::dev-to-cta{url="https://github.com/ofri-peretz/eslint"}
 *     Star on GitHub if your Node backend …
 *     ::
 *
 * Nothing threw and no build failed. A renderer that silently no-ops is the
 * quietest way to ship broken output, which is why the corpus sweep below
 * matters more than the unit cases: it is the one that would have caught it.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { preprocessMarkdown } from "../lib/markdown";

const ARTICLES = path.join(process.cwd(), "content", "articles");

describe("the CTA directive survives its own line wrapping", () => {
  it("renders a single-line label", () => {
    const out = preprocessMarkdown(
      '::dev-to-cta{url="https://example.com"}\nStar the repo.\n::',
    );
    expect(out).toBe("**[Star the repo.](https://example.com)**");
  });

  it("renders a label wrapped over three lines, joined to one", () => {
    // A Markdown link's text cannot contain a newline, so the wrapping — which
    // is source formatting, not content — has to collapse.
    const out = preprocessMarkdown(
      '::dev-to-cta{url="https://example.com"}\nStar on GitHub if your Node\nbackend needs more than a\nfrontend linter.\n::',
    );
    expect(out).toBe(
      "**[Star on GitHub if your Node backend needs more than a frontend linter.](https://example.com)**",
    );
  });

  it("stops at the first terminator instead of swallowing the next block", () => {
    // The lazy quantifier earns its place here: a greedy one would run from
    // the first directive to the LAST `::` in the document.
    const out = preprocessMarkdown(
      [
        '::dev-to-cta{url="https://a.example"}',
        "First",
        "::",
        "",
        "Body text.",
        "",
        '::dev-to-cta{url="https://b.example"}',
        "Second",
        "::",
      ].join("\n"),
    );
    expect(out).toContain("**[First](https://a.example)**");
    expect(out).toContain("**[Second](https://b.example)**");
    expect(out).toContain("Body text.");
  });

  it("leaves an empty label alone rather than rendering an empty link", () => {
    // `[\s\S]*?` would match zero characters here and produce `**[](url)**`:
    // valid Markdown, invisible on the page, and caught by nothing. Leaving
    // the directive raw is the louder failure, and the corpus sweep below
    // catches that one.
    const src = '::dev-to-cta{url="https://example.com"}\n\n::';
    expect(preprocessMarkdown(src)).toContain("::dev-to-cta{");
    expect(preprocessMarkdown(src)).not.toContain("**[](");
  });

  it("leaves no raw directive in any published article", () => {
    // The sweep. Asserts on the RENDERED output, so it cannot pass by
    // pointing at the wrong thing or by counting a directive it never read.
    const offenders: string[] = [];
    let checked = 0;
    for (const file of fs.readdirSync(ARTICLES)) {
      if (!file.endsWith(".md")) continue;
      const raw = fs.readFileSync(path.join(ARTICLES, file), "utf-8");
      if (!/^::dev-to-cta\{/m.test(raw)) continue;
      checked += 1;
      if (/^::dev-to-cta\{/m.test(preprocessMarkdown(raw)))
        offenders.push(file);
    }
    // Guard against the sweep silently scanning nothing — an empty result
    // must mean "all clean", never "found no articles".
    expect(checked).toBeGreaterThan(20);
    expect(offenders).toEqual([]);
  });
});
