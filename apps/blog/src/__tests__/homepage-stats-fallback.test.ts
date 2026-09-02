/**
 * The GitHub fallback, exercised rather than described.
 *
 * On 2026-05-25 the homepage showed zero stars because live GraphQL failed
 * and the merge zeroed the counters instead of falling back to Supabase. The
 * lock written afterwards was a NEGATIVE regex over the route file:
 *
 *   expect(ROUTE).not.toMatch(/totalStars:\s*github\??\.totalStars\s*\?\?\s*0/)
 *
 * The real code is a ternary, so that pattern never matched the correct
 * version either — it could only have failed on a spelling nobody writes.
 * It guarded a string, not the behaviour, and would not have caught the same
 * bug expressed with `|| 0`, a different ternary, or a zero computed upstream.
 *
 * These call the function instead. If the fallback breaks in ANY spelling,
 * they fail. (behavioural-claims finding, 2026-09-01)
 */
import { describe, expect, it } from "vitest";

import { mergeGitHubStats } from "@/lib/homepage-stats-merge";

const SUPABASE = {
  githubRepo: { followers: 1234 }, // platform=github-repo.followers = stars
  github: { followers: 567 },
};

describe("when live GitHub is unavailable", () => {
  it("keeps stars from Supabase rather than zeroing them", () => {
    // The 2026-05-25 bug, stated as a behaviour.
    const merged = mergeGitHubStats(null, SUPABASE);
    expect(merged.totalStars).toBe(1234);
    expect(merged.followers).toBe(567);
  });

  it("zeroes only the fields Supabase does not track", () => {
    const merged = mergeGitHubStats(null, SUPABASE);
    expect(merged.totalForks).toBe(0);
    expect(merged.totalRepos).toBe(0);
    expect(merged.recentCommits).toBe(0);
    expect(merged.authenticated).toBe(false);
  });

  it("still falls back when Supabase is empty too — 0, never undefined", () => {
    const merged = mergeGitHubStats(null, {});
    expect(merged.totalStars).toBe(0);
    expect(merged.followers).toBe(0);
  });
});

describe("when live GitHub returns a zero", () => {
  it("treats 0 stars as absent and falls back", () => {
    // A rate-limited or partial GraphQL response can return 0 rather than
    // failing outright. Trusting it would show a reader zero stars while
    // Supabase holds the real number — the same visible bug by a subtler route.
    const merged = mergeGitHubStats(
      { totalStars: 0, followers: 0 } as never,
      SUPABASE,
    );
    expect(merged.totalStars).toBe(1234);
    expect(merged.followers).toBe(567);
  });
});

describe("when live GitHub is healthy", () => {
  it("prefers the live numbers over Supabase", () => {
    const merged = mergeGitHubStats(
      { totalStars: 9000, followers: 800, totalForks: 12 } as never,
      SUPABASE,
    );
    expect(merged.totalStars).toBe(9000);
    expect(merged.followers).toBe(800);
    expect(merged.totalForks).toBe(12);
  });
});
