/**
 * Scorecard composition lock — same pattern as homepage-lock.test.tsx.
 *
 * The /scorecard route has a brittle composition: 5 independent <Suspense>
 * boundaries that each `await` async server-component sections, all of
 * which feed into client-side components (NumberTicker, Sparkline,
 * RatchetCard's anchor wrapper). The cost of getting it wrong is the
 * "temporarily unavailable" error UI users saw twice today.
 *
 * Locks pinned here:
 *
 *  1. Route config — `force-dynamic` + (optional) `revalidate`. Required
 *     because the Supabase fetchers throw on missing env; the route can't
 *     statically prerender without SUPABASE_URL set in the build env.
 *
 *  2. Suspense order — NorthStar → Momentum → Contributions → Engagement
 *     → DownloadsByPackage. Reordering changes the narrative arc and
 *     also which sections get the streamed reveal first.
 *
 *  3. Error boundary present — apps/blog/src/app/scorecard/error.tsx
 *     must exist with the "use client" directive + the digest log.
 *
 *  4. NumberTicker uses SERIALIZABLE props in scorecard components.
 *     This is the PR #39 regression: passing `formatter={fn}` from a
 *     Server Component to NumberTicker (a Client Component) throws at
 *     runtime because functions can't cross the RSC boundary. CI never
 *     caught it because `tsc` accepts function props and Turbopack
 *     built but didn't render. This text-grep lock makes the regression
 *     impossible to re-introduce silently.
 *
 *  5. Ratchet card alignment slots — header right placeholder when no
 *     trend, delta div always rendered (min-h), description line-clamp.
 *     The polish that made cards visually align across rows.
 *
 *  6. Whole-card link — RatchetCard wraps content in an <a> when
 *     provenance_url is present. The clickable-card affordance.
 *
 * Pattern: file-text grep. We do NOT render the page — it's async
 * server-component + live Supabase. The source structure IS the
 * regression surface that matters.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SCORECARD_PAGE = readFileSync(
  path.resolve(__dirname, "..", "app", "scorecard", "page.tsx"),
  "utf-8",
);
const SCORECARD_ERROR = readFileSync(
  path.resolve(__dirname, "..", "app", "scorecard", "error.tsx"),
  "utf-8",
);
const RATCHET_CARD = readFileSync(
  path.resolve(
    __dirname,
    "..",
    "..",
    ".interlace",
    "components",
    "scorecard",
    "ratchet-card.tsx",
  ),
  "utf-8",
);
const NORTH_STAR_HERO = readFileSync(
  path.resolve(
    __dirname,
    "..",
    "..",
    ".interlace",
    "components",
    "scorecard",
    "north-star-hero.tsx",
  ),
  "utf-8",
);
const NUMBER_TICKER = readFileSync(
  path.resolve(
    __dirname,
    "..",
    "..",
    ".interlace",
    "components",
    "ui",
    "number-ticker.tsx",
  ),
  "utf-8",
);

describe("scorecard route lock", () => {
  it("declares `dynamic = 'force-dynamic'` (route can't prerender without Supabase env)", () => {
    expect(SCORECARD_PAGE).toMatch(/export\s+const\s+dynamic\s*=\s*["']force-dynamic["']/);
  });

  it("renders every required section component", () => {
    const REQUIRED = [
      "NorthStarSection",
      "MomentumSection",
      "BucketGridSection",
      "DownloadsByPackageSection",
    ];
    for (const name of REQUIRED) {
      expect(SCORECARD_PAGE).toContain(name);
    }
  });

  it("composes sections inside <Suspense> in the canonical order", () => {
    const ORDER = [
      "<NorthStarSection",
      "<MomentumSection",
      'BucketGridSection bucket="contributions"',
      'BucketGridSection bucket="engagement"',
      "<DownloadsByPackageSection",
    ];
    let cursor = 0;
    for (const marker of ORDER) {
      const idx = SCORECARD_PAGE.indexOf(marker, cursor);
      expect(idx, `expected ${marker} after position ${cursor}`).toBeGreaterThan(-1);
      cursor = idx;
    }
  });

  it("frames the per-plugin breakdown as its own section below the metric grids (border-t)", () => {
    // The "deeper dive below all metrics" framing — thin top divider on
    // the DownloadsByPackageSection. Locks the polish from PR #41.
    expect(SCORECARD_PAGE).toMatch(/DownloadsByPackageSection/);
    expect(SCORECARD_PAGE).toMatch(/border-t\s+border-border/);
    expect(SCORECARD_PAGE).toContain("Per-plugin breakdown");
  });

  it("filters null/zero rows in BucketGridSection (hides page-views/tweet-engagement until ingest writes them)", () => {
    expect(SCORECARD_PAGE).toMatch(/r\.current_value\s*!=\s*null\s*&&\s*r\.current_value\s*>\s*0|hasValue/);
    expect(SCORECARD_PAGE).toMatch(/hasDelta|deltaByKind\.has\(r\.kind\)/);
  });

  it('sets `id="main"` on <main> so the skip-link works', () => {
    expect(SCORECARD_PAGE).toMatch(/<main[\s\S]{0,200}data-page="scorecard"/);
    expect(SCORECARD_PAGE).toMatch(/<main[\s\S]{0,100}className=/);
  });
});

describe("scorecard error boundary lock", () => {
  it("is a Client Component (error.tsx requires 'use client')", () => {
    expect(SCORECARD_ERROR).toMatch(/^["']use client["']/);
  });

  it("renders the canonical error UI copy + Try-again + Go-home actions", () => {
    expect(SCORECARD_ERROR).toContain("The numbers are temporarily unavailable");
    expect(SCORECARD_ERROR).toContain("Try again");
    expect(SCORECARD_ERROR).toContain("Go home");
  });

  it("logs the digest to the console for triage correlation with Vercel function logs", () => {
    expect(SCORECARD_ERROR).toMatch(/console\.error\(\s*["']\[scorecard\] render failed:["']/);
    expect(SCORECARD_ERROR).toContain("error.digest");
  });

  it("accepts a reset callback (Next.js error-boundary contract)", () => {
    expect(SCORECARD_ERROR).toMatch(/reset\s*:\s*\(\)\s*=>\s*void/);
    expect(SCORECARD_ERROR).toMatch(/onClick=\{reset\}/);
  });
});

describe("NumberTicker — RSC-serializable props lock (PR #39 regression)", () => {
  it("does NOT export a `formatter` prop (would be a function across the RSC boundary)", () => {
    // The regression vector: a function prop named `formatter` was added
    // in PR #39 and broke every Server Component that rendered a
    // NumberTicker. The serializable-primitive API replaced it.
    expect(NUMBER_TICKER).not.toMatch(/formatter\s*\?:\s*\(.*\)\s*=>/);
    expect(NUMBER_TICKER).not.toMatch(/formatter\s*:\s*\(.*\)\s*=>/);
  });

  it("exposes serializable `notation` + `compactThreshold` props instead", () => {
    expect(NUMBER_TICKER).toMatch(/notation\s*\?:\s*["']standard["']\s*\|\s*["']compact["']/);
    expect(NUMBER_TICKER).toMatch(/compactThreshold\s*\?:\s*number/);
  });

  it("ratchet-card.tsx does NOT pass a function prop to NumberTicker", () => {
    // Pin the call site, not just the API.
    expect(RATCHET_CARD).not.toMatch(/formatter\s*=\s*\{/);
    expect(RATCHET_CARD).toMatch(/<NumberTicker[\s\S]{0,500}notation="compact"/);
    expect(RATCHET_CARD).toMatch(/<NumberTicker[\s\S]{0,500}compactThreshold=\{10_?000\}/);
  });

  it("north-star-hero.tsx does NOT pass a function prop to NumberTicker", () => {
    expect(NORTH_STAR_HERO).not.toMatch(/formatter\s*=\s*\{/);
    expect(NORTH_STAR_HERO).toMatch(/<NumberTicker[\s\S]{0,500}notation="compact"/);
    expect(NORTH_STAR_HERO).toMatch(/<NumberTicker[\s\S]{0,500}compactThreshold=\{100_?000\}/);
  });
});

describe("ratchet-card alignment slots (PR #41 polish lock)", () => {
  it("always renders a header right slot — placeholder when no trend badge", () => {
    // Without a placeholder, cards without a trend had a shorter header
    // and pushed the value row up. Lock the `?? <span aria-hidden>`
    // fallback so the header height is stable across the grid.
    expect(RATCHET_CARD).toMatch(/trendBadge\(trend\)\s*\?\?\s*\(/);
  });

  it("always reserves the delta line height — empty placeholder when no delta", () => {
    expect(RATCHET_CARD).toMatch(/min-h-5[\s\S]{0,300}delta\s*\?/);
    expect(RATCHET_CARD).toMatch(/<span\s+aria-hidden>&nbsp;<\/span>/);
  });

  it("clamps the description to two lines with reserved height", () => {
    expect(RATCHET_CARD).toMatch(/line-clamp-2\s+min-h-\[2\.5rem\]/);
  });
});

describe("eng_github_stars/eng_github_followers show the live-fetched value (2026-07-05)", () => {
  // Product decision: /scorecard and /api/homepage-stats must show the SAME
  // number for GitHub stars + followers specifically. The database row
  // keeps updating daily and still feeds north_star_total unmodified —
  // only the two display tiles get overridden with a live fetch. See
  // src/lib/github-live-stats.ts and homepage-stats-lock.test.ts.
  it("imports the shared live-fetch function from lib/github-live-stats", () => {
    expect(SCORECARD_PAGE).toMatch(
      /getCachedGitHubStats.*from\s+["']@\/lib\/github-live-stats["']/,
    );
  });

  it("overrides current_value only for the two github kinds, not the whole breakdown", () => {
    expect(SCORECARD_PAGE).toMatch(/eng_github_stars/);
    expect(SCORECARD_PAGE).toMatch(/eng_github_followers/);
    expect(SCORECARD_PAGE).toMatch(/current_value:\s*github!?\.totalStars/);
    expect(SCORECARD_PAGE).toMatch(/current_value:\s*github!?\.followers/);
  });

  it("does NOT let the override touch north_star_total (stays 100% database)", () => {
    // Anti-pattern lock: north_star_total must never be recomputed from the
    // overridden array. It's read straight off `breakdown[0]` inside
    // NorthStarSection, which does not call withLiveGitHubOverride.
    const northStarSection = SCORECARD_PAGE.slice(
      SCORECARD_PAGE.indexOf("async function NorthStarSection"),
      SCORECARD_PAGE.indexOf("async function MomentumSection"),
    );
    expect(northStarSection).not.toMatch(/withLiveGitHubOverride/);
  });
});

describe("ratchet-card whole-card link (PR #41 polish lock)", () => {
  it("wraps the card in an <a> when provenance_url is present", () => {
    // The whole-card link affordance — bigger hit area, clearer click.
    // Render branch: when provenance_url is truthy, return <a>...</a>
    // with the same className as the <article> fallback.
    expect(RATCHET_CARD).toMatch(/if\s*\(\s*row\.provenance_url\s*\)/);
    expect(RATCHET_CARD).toMatch(/<a[\s\S]{0,300}href=\{row\.provenance_url\}[\s\S]{0,200}target="_blank"/);
  });

  it("does NOT nest an inner <a> (would be invalid HTML)", () => {
    // The `source ↗` glyph stays as a non-interactive <span>, not a
    // nested anchor. Two anchors at any depth would fail accessibility
    // axe checks and produce invalid HTML. Count only JSX anchor opens
    // (multi-line `<a\n        href=...`), not `<a>` mentions in
    // comments / JSDoc.
    const anchorOpens =
      (RATCHET_CARD.match(/<a\s+(?:href|target|rel|className|aria|onClick|data-)/g) ?? []).length;
    expect(anchorOpens).toBeLessThanOrEqual(1);
  });

  it("keeps the source-link visual affordance as a <span>", () => {
    expect(RATCHET_CARD).toMatch(/data-slot="ratchet-card-provenance"[\s\S]{0,500}<span>source<\/span>/);
  });
});
