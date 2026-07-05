/**
 * /api/homepage-stats route lock — see CLAUDE.md regression policy.
 *
 * Reason this exists: 2026-05-25, a refactor of /api/homepage-stats from
 * direct-fetch + in-memory cache to Supabase + unstable_cache silently
 * returned `{ totalStars: 0, recentCommits: 0, totalContributions: 0 }`
 * because the GitHub fallback baked into unstable_cache when GITHUB_TOKEN
 * was unavailable. The zeros rendered live on ofriperetz.dev for ~hours
 * until the user noticed.
 *
 * The fix added explicit Supabase fallbacks for stars + followers so the
 * route never returns 0 for those fields when Supabase has data. This
 * lock pins that contract — both shape and the "never silently 0 a field
 * we have data for" invariant.
 *
 * Pattern: file-text grep on src/app/api/homepage-stats/route.ts. We
 * don't hit the network — that needs a live Supabase + GITHUB_TOKEN and
 * isn't deterministic. We pin the source structure that produces the
 * correct response.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROUTE = readFileSync(
  path.resolve(__dirname, "..", "app", "api", "homepage-stats", "route.ts"),
  "utf-8",
);

const SUPABASE_DATA = readFileSync(
  path.resolve(__dirname, "..", "lib", "supabase-data.ts"),
  "utf-8",
);

describe("/api/homepage-stats lock", () => {
  describe("Supabase fallback for github stars + followers", () => {
    it("totalStars falls back to creators.githubRepo.followers", () => {
      // The `github-repo` platform row in creator_daily_metrics stores the
      // GitHub star count in its `followers` column (see daily-ingest.ts).
      // When GitHub GraphQL fails (missing token, rate-limit, network), the
      // route MUST fall back to Supabase here, not silently return 0.
      expect(ROUTE).toMatch(/creators\.githubRepo\?\.followers/);
    });

    it("followers falls back to creators.github.followers", () => {
      expect(ROUTE).toMatch(/creators\.github\?\.followers/);
    });

    it("does NOT zero stars when github source is null", () => {
      // Anti-pattern lock: `totalStars: github?.totalStars ?? 0` without
      // a Supabase fallback would re-introduce the 2026-05-25 bug. Force
      // the conditional to include a non-zero fallback.
      expect(ROUTE).not.toMatch(
        /totalStars:\s*github\??\.totalStars\s*\?\?\s*0[,;\n]/,
      );
    });
  });

  describe("unstable_cache does NOT bake bad GitHub data", () => {
    it("getCachedGitHubStats throws when GITHUB_TOKEN is missing", () => {
      // If we returned a fallback object from the cached function, the
      // Vercel Data Cache would persist it for the full 12h TTL — every
      // subsequent request returns zeros until cache expires, even if
      // the env var gets restored.
      expect(ROUTE).toMatch(/GITHUB_TOKEN not set/);
      expect(ROUTE).toMatch(/throw new Error/);
    });

    it("route handler catches the throw + uses Supabase fallbacks", () => {
      // The route handler MUST tolerate the throw above. If it propagated
      // the error, the whole /api/homepage-stats endpoint would 500.
      expect(ROUTE).toMatch(
        /try\s*{\s*github\s*=\s*await\s+getCachedGitHubStats/,
      );
      expect(ROUTE).toMatch(/} catch \(err\)/);
    });
  });

  describe("npm total is single-sourced", () => {
    it("totalDownloads comes only from getCachedNpmAlltimeTotal", () => {
      // v_npm_alltime_ecosystem is the SAME view the /scorecard
      // eng_downloads_cumulative ratchet reads. Homepage and scorecard must
      // never be able to show different numbers for "total npm downloads" —
      // that class of bug (155k vs 192k, for weeks) is exactly what this
      // lock exists to prevent. No fallback to a differently-computed total:
      // a "pick whichever legacy fetcher is nonzero" chain is what caused
      // the original incident, since a transient hiccup in one path would
      // silently substitute a DIFFERENT number instead of surfacing 0.
      expect(ROUTE).toMatch(/getCachedNpmAlltimeTotal/);
      expect(ROUTE).toMatch(/totalDownloads:\s*npmAlltimeTotal/);
      expect(ROUTE).not.toMatch(/getCachedNpmLifetimeTotal/);
      expect(ROUTE).not.toMatch(/getCachedNpmTotalSinceStart/);
    });
  });

  describe("supabase-data exports the cached fetchers used here", () => {
    const required = [
      "getCachedCreatorsByPlatform",
      "getCachedEcosystemLatest",
      "getCachedNpmAlltimeTotal",
      "getCachedPluginLatest",
    ] as const;
    for (const fn of required) {
      it(`exports ${fn}`, () => {
        expect(SUPABASE_DATA).toMatch(new RegExp(`export const ${fn}\\b`));
      });
    }

    it("all cached fetchers use 12h TTL", () => {
      // Regression lock: any 1-min / 5-min / 24h backslide would bring
      // back the per-instance-cache problems we just exited. 43200s = 12h.
      const ttls = SUPABASE_DATA.match(/revalidate:\s*\w+/g) ?? [];
      expect(ttls.length).toBeGreaterThan(0);
      for (const t of ttls) {
        expect(t).toMatch(/TWELVE_HOURS_SECONDS|43200/);
      }
    });
  });
});
