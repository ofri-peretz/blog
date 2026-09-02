import type { GitHubData } from "@/lib/github-live-stats";

/**
 * Merge live GitHub stats with the Supabase fallback.
 *
 * EXTRACTED so it can be TESTED. Supabase is the source of truth for the
 * cumulative counters (stars + followers) the daily ingest writes; live
 * GraphQL adds what Supabase does not track (forks, repos, commits,
 * contributions). When GraphQL fails those go to zero — but stars and
 * followers must NEVER zero out, because Supabase has them.
 *
 * That last sentence is the 2026-05-25 bug. Its lock was a negative regex
 * over this file looking for one spelling of the mistake, which the real
 * (correct) code never matched either — so it could only ever fail on a
 * form nobody writes, and gave no protection at all. A pure function can
 * be handed a null `github` and asked what it returns. (behavioural-claims)
 */
export function mergeGitHubStats(
  github: GitHubData | null,
  creators: {
    githubRepo?: { followers?: number | null } | null;
    github?: { followers?: number | null } | null;
  },
): GitHubData {
  return {
    // platform=github-repo.followers stores the star count (daily-ingest.ts)
    totalStars:
      github?.totalStars && github.totalStars > 0
        ? github.totalStars
        : (creators.githubRepo?.followers ?? 0),
    totalForks: github?.totalForks ?? 0,
    totalRepos: github?.totalRepos ?? 0,
    followers:
      github?.followers && github.followers > 0
        ? github.followers
        : (creators.github?.followers ?? 0),
    recentCommits: github?.recentCommits ?? 0,
    totalContributions: github?.totalContributions ?? 0,
    starsBreakdown: github?.starsBreakdown ?? [],
    authenticated: github?.authenticated ?? false,
  };
}
