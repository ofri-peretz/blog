// Live-fetched GitHub stats — shared between /api/homepage-stats and
// /scorecard so both surfaces show the SAME number for stars + followers.
//
// Extracted 2026-07-05 from api/homepage-stats/route.ts (was private to
// that file). Product decision: eng_github_stars / eng_github_followers
// should display a live GraphQL value everywhere, even though the
// database keeps recording its own daily snapshot for those two ratchet
// kinds (north_star_total and historical trends stay 100% Supabase —
// only the DISPLAYED number for these two tiles changes).
//
// Cache: unstable_cache, 12h TTL, tagged ["ratchet","github"] so the
// daily-ingest webhook's revalidateTag('ratchet') invalidates this
// alongside every other Supabase-derived read — keeps every surface
// consistent even though this particular fetch doesn't touch Supabase.

import "server-only";
import { unstable_cache } from "next/cache";
import { GITHUB_CONFIG } from "@/lib/metrics-config";

const TWELVE_HOURS_SECONDS = 12 * 60 * 60;

export interface GitHubData {
  totalStars: number;
  totalForks: number;
  totalRepos: number;
  followers: number;
  recentCommits: number;
  totalContributions: number;
  starsBreakdown: Array<{ name: string; stars: number; url: string }>;
  authenticated: boolean;
}

// ─── GitHub: live GraphQL with 12h cache ─────────────────────────────
// Cache key bound to ratchet-tag so the daily-ingest webhook invalidates
// it alongside the Supabase reads — keeps every surface consistent.

export const getCachedGitHubStats = unstable_cache(
  async (): Promise<GitHubData> => {
    const { username, targetedRepos } = GITHUB_CONFIG;
    const token = process.env.GITHUB_TOKEN;

    const fallback: GitHubData = {
      totalStars: 0,
      totalForks: 0,
      totalRepos: 0,
      followers: 0,
      recentCommits: 0,
      totalContributions: 0,
      starsBreakdown: [],
      authenticated: false,
    };

    if (!token) {
      // Throw instead of returning fallback. unstable_cache caches the
      // function's return value; if we returned the empty fallback once,
      // the bad value would stick for the 12-hour TTL and every consumer
      // (homepage `IMPACT` block, /scorecard's github tiles, etc.) would
      // render zeros until the cache naturally expired — even after the
      // env var was restored. Throwing means the cache stays empty and
      // the next request re-tries.
      // Callers are expected to catch this and fall back to Supabase
      // creator rows for whatever overlapping fields are available.
      throw new Error("[github-live-stats] GITHUB_TOKEN not set");
    }

    const headers = {
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };

    const repoQueries = targetedRepos
      .map((name) => {
        const alias = `repo_${name.replace(/-/g, "_")}`;
        return `${alias}: repository(owner: "${username}", name: "${name}") { name stargazerCount forkCount url }`;
      })
      .join("\n  ");
    const query = `query {
      user(login: "${username}") {
        followers { totalCount }
        repositories(first: 1, privacy: PUBLIC) { totalCount }
        contributionsCollection {
          totalCommitContributions
          contributionCalendar { totalContributions }
        }
      }
      ${repoQueries}
    }`;

    interface GraphQLResponse {
      data?: {
        user?: {
          followers?: { totalCount: number };
          repositories?: { totalCount: number };
          contributionsCollection?: {
            totalCommitContributions: number;
            contributionCalendar?: { totalContributions: number };
          };
        };
        [k: string]: unknown;
      };
    }

    try {
      const res = await fetch("https://api.github.com/graphql", {
        method: "POST",
        headers,
        body: JSON.stringify({ query }),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        console.error(`[github-live-stats] github GraphQL → ${res.status}`);
        return fallback;
      }
      const json = (await res.json()) as GraphQLResponse;
      const user = json.data?.user;
      if (!user) return fallback;

      const repos: Array<{
        name: string;
        stars: number;
        forks: number;
        url: string;
      }> = [];
      for (const name of targetedRepos) {
        const key = `repo_${name.replace(/-/g, "_")}`;
        const r = json.data?.[key] as
          | { stargazerCount?: number; forkCount?: number; url?: string }
          | undefined;
        if (r) {
          repos.push({
            name,
            stars: r.stargazerCount ?? 0,
            forks: r.forkCount ?? 0,
            url: r.url ?? "",
          });
        }
      }
      return {
        totalStars: repos.reduce((s, r) => s + r.stars, 0),
        totalForks: repos.reduce((s, r) => s + r.forks, 0),
        totalRepos: user.repositories?.totalCount ?? 0,
        followers: user.followers?.totalCount ?? 0,
        recentCommits:
          user.contributionsCollection?.totalCommitContributions ?? 0,
        totalContributions:
          user.contributionsCollection?.contributionCalendar
            ?.totalContributions ?? 0,
        starsBreakdown: repos.map((r) => ({
          name: r.name,
          stars: r.stars,
          url: r.url,
        })),
        authenticated: true,
      };
    } catch (err) {
      console.error("[github-live-stats] github fetch error:", err);
      return fallback;
    }
  },
  ["github-graphql-homepage"],
  { revalidate: TWELVE_HOURS_SECONDS, tags: ["ratchet", "github"] },
);
