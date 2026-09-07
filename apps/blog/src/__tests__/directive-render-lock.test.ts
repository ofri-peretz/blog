import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

// Directive render lock — every directive an article declares must actually
// match the regex that renders it.
//
// The failure mode this catches is silent and reader-visible. `CTA_RE` in
// src/lib/markdown.ts matches exactly ONE content line between the directive
// and its closing `::`. Wrap that content across two lines — which reads as a
// harmless prettier-style soft wrap — and the regex simply does not fire. No
// build error, no lint error, no test failure: the raw `::dev-to-cta{url="…`
// text renders verbatim on the page where the call-to-action should be.
//
// Measured 2026-09-07: FOUR published articles were shipping their CTA as raw
// directive text on ofriperetz.dev, the oldest since its publication. They were
// found only because a PR review caught a fifth about to join them. Every one
// is a conversion CTA — the install line and the star link — so the defect was
// costing exactly the outcome the articles exist to produce.
//
// This asserts declared-count === matched-count per directive per file, rather
// than pinning the known-bad slugs, so a NEW wrapped directive fails too.

const ROOT = resolve(__dirname, "../../../..");
const ARTICLES = join(ROOT, "apps/blog/content/articles");

/**
 * Kept deliberately in sync with src/lib/markdown.ts by construction: each
 * entry pairs the opening-token matcher with the full render regex. If a
 * directive's real regex changes shape, this lock must be updated with it —
 * that edit is the review signal.
 */
const DIRECTIVES: Array<{ name: string; open: RegExp; render: RegExp }> = [
  {
    name: "dev-to-cta",
    open: /^::dev-to-cta\{/gm,
    render: /^::dev-to-cta\{url="([^"]+)"\}[ \t]*\n([^\n]+)\n::/gm,
  },
  {
    name: "install-command",
    open: /^::install-command\{/gm,
    render: /^::install-command\{package="([^"]+)"(?: dev)?\}[ \t]*\n::/gm,
  },
];

function count(source: string, re: RegExp): number {
  // Fresh lastIndex every call — these are /g regexes reused across files.
  return (source.match(new RegExp(re.source, re.flags)) || []).length;
}

describe("directive render lock", () => {
  const files = readdirSync(ARTICLES).filter((f) => f.endsWith(".md"));

  it("finds articles to check", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const { name, open, render } of DIRECTIVES) {
    it(`every ::${name} an article declares also renders`, () => {
      const broken: string[] = [];

      for (const file of files) {
        const source = readFileSync(join(ARTICLES, file), "utf-8");
        const declared = count(source, open);
        if (declared === 0) continue;

        const rendered = count(source, render);
        if (rendered !== declared) {
          broken.push(
            `${file}: declared ${declared}, renders ${rendered} — ` +
              `content must sit on ONE line between the directive and its closing "::"`,
          );
        }
      }

      expect(broken).toEqual([]);
    });
  }
});
