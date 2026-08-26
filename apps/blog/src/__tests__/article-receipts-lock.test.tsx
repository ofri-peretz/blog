import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Article-receipts locks — the community numbers from the dev.to sync
 * rendered in the article meta row. The load-bearing rule: a zero or
 * missing value is a DATA GAP, not a fact, and renders nothing (the
 * impact-metrics rule applied to article pages).
 */

const PAGE = readFileSync(
  path.resolve(__dirname, "..", "app", "articles", "[slug]", "page.tsx"),
  "utf-8",
);

describe("receipts contract (source pins)", () => {
  it("renders receipts in the meta row, terminal-voiced", () => {
    expect(PAGE).toContain('data-slot="article-receipt"');
    expect(PAGE).toContain("articleReceipts(fm)");
    // The numeral speaks mono/tabular like every count on this site.
    expect(PAGE).toMatch(/article-receipt[\s\S]{0,200}font-mono \[font-variant-numeric:tabular-nums\]/);
  });

  it("zero or missing is a data gap, not a fact — truthiness gate on purpose", () => {
    // Unlike thread minutes (where 0 is meaningful), a receipt of 0
    // reactions is indistinguishable from "sync hasn't run" — so the
    // truthy check is the CORRECT guard here, and this comment-pin
    // records that it is deliberate.
    expect(PAGE).toMatch(/fm\.reactions \? \{ label: "reactions"/);
    expect(PAGE).toMatch(/fm\.comments \? \{ label: "comments"/);
    expect(PAGE).toMatch(/fm\.views \? \{ label: "views"/);
    expect(PAGE).toContain("DATA GAP");
  });

  it("compact notation keeps magnitudes scannable", () => {
    expect(PAGE).toContain('notation: "compact"');
  });
});
