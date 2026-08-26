/**
 * /npm ↔ homepage lifetime-downloads lock — see CLAUDE.md regression policy.
 *
 * Reason this exists: 2026-08-26, the homepage showed 422,330 lifetime npm
 * downloads while /npm showed 405,707 under the label "Downloads (lifetime,
 * these packages)". Both were correct for their own scope — the homepage
 * reads v_npm_alltime_ecosystem (every package ever published), /npm summed
 * only the non-deprecated, on-page subset — but the page read as two
 * contradictory answers to one question.
 *
 * This is the same failure PR #51 already fixed once on the homepage, where
 * two fetchers computed "npm downloads" different ways and the site showed
 * 155k vs 192k for weeks. The rule that came out of it: one number, one
 * source. This lock pins that /npm's HEADLINE lifetime figure goes through
 * the same getCachedNpmAlltimeTotal read the homepage uses, so the two
 * surfaces cannot diverge again.
 *
 * The per-package "All time" card values stay scoped to the listed packages
 * on purpose — those are per-package facts, not a site total.
 *
 * Pattern: file-text lock, same as homepage-stats-lock.test.ts. Hitting the
 * real numbers needs live Supabase and isn't deterministic; what we pin is
 * the source structure that makes the two totals identical.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (...p: string[]) =>
  readFileSync(path.resolve(__dirname, "..", ...p), "utf-8");

const NPM_PAGE = read("app", "npm", "page.tsx");
const NPM_PAGE_DATA = read("lib", "npm-page-data.ts");
const HOMEPAGE_STATS = read("app", "api", "homepage-stats", "route.ts");
const HOMEPAGE = read("app", "page.tsx");
const REVALIDATE_ROUTE = read("app", "api", "revalidate-tag", "route.ts");
const STRUCTURED_DATA = read("components", "structured-data.tsx");

describe("/npm lifetime total lock", () => {
  it("both surfaces resolve lifetime downloads via getCachedNpmAlltimeTotal", () => {
    // The homepage side. If this ever stops being true, the shared source is
    // gone and the two pages are free to drift again.
    expect(HOMEPAGE_STATS).toContain("getCachedNpmAlltimeTotal");
    // The /npm side, one hop away through the page-data module.
    expect(NPM_PAGE_DATA).toContain("getCachedNpmAlltimeTotal");
    expect(NPM_PAGE_DATA).toMatch(
      /export async function getNpmPageLifetimeTotal/,
    );
  });

  it("getNpmPageLifetimeTotal returns the shared read, falling back only on error", () => {
    const fn = NPM_PAGE_DATA.slice(
      NPM_PAGE_DATA.indexOf("export async function getNpmPageLifetimeTotal"),
    );
    // The happy path must be the shared read, not the caller's subset sum.
    expect(fn).toMatch(/return await getCachedNpmAlltimeTotal\(\)/);
    // The fallback is reachable only from the catch — a degraded render beats
    // a 500, but it must never be the normal path.
    expect(fn).toMatch(/catch[\s\S]*return fallback/);
  });

  it("the /npm headline renders the shared total, not the subset sum", () => {
    expect(NPM_PAGE).toContain("getNpmPageLifetimeTotal");
    // The subset sum survives only as the fallback argument. If it is ever
    // passed straight to fmt() for the headline cell, the bug is back.
    expect(NPM_PAGE).toMatch(
      /const totalLifetime = await getNpmPageLifetimeTotal\(listedLifetime\)/,
    );
    expect(NPM_PAGE).not.toMatch(/\{fmt\(listedLifetime\)\}/);
  });

  it("tile labels state their scope so the two figures can't be confused", () => {
    // "these packages" was the old label — it read as the site total.
    expect(NPM_PAGE).not.toContain("Downloads (lifetime, these packages)");
    expect(NPM_PAGE).toContain("Downloads (lifetime, all packages)");
    // The count tile covers only what's rendered below, and says so.
    expect(NPM_PAGE).toContain("Packages listed");
  });
});

describe("homepage stats cache-flush lock", () => {
  /**
   * 2026-08-26: POST /api/revalidate-tag returned ok and the API served
   * 433,686, while ofriperetz.dev kept rendering 422,330 — the PREVIOUS
   * backfill's number — beside same-day dev.to views. The page is statically
   * prerendered (x-nextjs-prerender: 1, x-vercel-cache: STALE), and its
   * fetch of the stats route carried `revalidate: 60` with no tag, so the
   * flush evicted the route's unstable_cache entries but never the HTML
   * holding the rendered figures.
   */
  it("the homepage stats fetch is tagged with a tag the flush actually clears", () => {
    const fetchCall = HOMEPAGE.slice(
      HOMEPAGE.indexOf("/api/homepage-stats"),
      HOMEPAGE.indexOf("/api/homepage-stats") + 200,
    );
    expect(fetchCall).toMatch(/tags:\s*\["ratchet"\]/);
    // ...and 'ratchet' must still be one of the tags the flush route fires,
    // or the tag above is decorative.
    expect(REVALIDATE_ROUTE).toMatch(/TAGS = \[[^\]]*"ratchet"/);
  });
});

describe("JSON-LD download claim lock", () => {
  /**
   * 2026-08-26: the site-wide Person schema hardcoded "35K+ downloads" while
   * every rendered surface said 433,686 — a 12x understatement shipped to
   * search engines on every page. A metric frozen into static metadata has no
   * mechanism to stay true.
   */
  it("states no hardcoded download figure", () => {
    // Strip comments first — the block explaining the old "35K+ downloads"
    // literal is documentation, not a claim the page emits.
    const code = STRUCTURED_DATA.replace(/\/\*[\s\S]*?\*\//g, "").replace(
      /^\s*\/\/.*$/gm,
      "",
    );
    expect(code).not.toMatch(/\d+K\+? downloads/);
  });

  it("derives the figure from the shared ecosystem read", () => {
    expect(STRUCTURED_DATA).toContain("getCachedNpmAlltimeTotal");
    // Must be awaited in the component, not captured at module scope, or it
    // freezes at first import exactly like the literal it replaced.
    expect(STRUCTURED_DATA).toMatch(
      /export async function StructuredData[\s\S]*await getCachedNpmAlltimeTotal\(\)/,
    );
  });

  it("drops the claim entirely when the read fails", () => {
    // A stale-but-plausible number in schema.org markup is worse than silence.
    expect(STRUCTURED_DATA).toMatch(
      /ESLint plugins\.\"?\s*;?\s*$/m,
    );
  });
});
