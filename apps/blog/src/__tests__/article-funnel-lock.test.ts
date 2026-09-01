// Article end-of-read funnel lock — 2026-08-24.
//
// The moment a reader finishes an article is the highest-intent moment the
// site has, and for months the PRIMARY button there said "Follow on
// dev.to" — routing the best-converted readers to a third-party platform.
// The primary action must point at OUR product surface (the playground /
// docs); dev.to remains a secondary follow/discussion link. This lock
// keeps the funnel pointed home.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ARTICLE_PAGE = readFileSync(
  path.resolve(__dirname, "..", "app", "articles", "[slug]", "page.tsx"),
  "utf-8",
);

describe("article end-of-read funnel", () => {
  it("the callout's primary (default-variant) button routes to the playground", () => {
    expect(ARTICLE_PAGE).toMatch(
      /href="https:\/\/eslint\.interlace\.tools\/play"[\s\S]{0,200}?variant: "default"/,
    );
  });

  it("dev.to links are secondary (ghost/outline), never the primary variant", () => {
    // Every anchor whose href resolves to dev.to must carry a non-default
    // buttonVariants variant within its opening tag.
    const devtoAnchors =
      ARTICLE_PAGE.match(/href=\{(?:profileUrl|fm\.devto_url|devtoUrl)\}[\s\S]{0,300}?variant: "(\w+)"/g) ?? [];
    expect(devtoAnchors.length).toBeGreaterThan(0);
    for (const anchor of devtoAnchors) {
      expect(anchor).not.toContain('variant: "default"');
    }
  });
});
