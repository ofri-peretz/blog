import { CACHE_TTL, getCache, setCache } from "@/lib/cache";
import { GITHUB_CONFIG } from "@/lib/metrics-config";

const FALLBACK_STATS = {
  totalStars: 11,
  totalForks: 2,
  totalWatchers: 35,
  totalRepos: 35,
  followers: 51,
  following: 30,
  publicRepos: 35,
  accountAgeYears: 9,
  totalContributions: 1799,
  recentCommits: 477,
  recentPRs: 319,
  recentIssues: 168,
  recentRepos: 35,
  recentReviews: 0,
  contributionCalendar: [] as { date: string; count: number }[],
  topRepos: [
    {
      name: "eslint-plugin-secure-coding",
      stars: 3,
      forks: 0,
      url: "https://github.com/ofri-peretz/eslint-plugin-secure-coding",
      description: "Security-focused ESLint rules",
    },
  ],
  languages: [
    { name: "TypeScript", count: 25 },
    { name: "JavaScript", count: 8 },
    { name: "Vue", count: 2 },
  ],
  starsBreakdown: [] as { name: string; stars: number; url: string }[],
  authenticated: false,
  source: "fallback" as const,
};

interface GitHubUser {
  public_repos: number;
  followers: number;
  following: number;
  created_at: string;
}

interface GitHubRepo {
  name: string;
  stargazers_count: number;
  forks_count: number;
  watchers_count: number;
  language: string | null;
  fork: boolean;
  pushed_at: string;
  html_url: string;
  description: string | null;
}

interface GraphQLContribResponse {
  data: {
    user: {
      contributionsCollection: {
        totalCommitContributions: number;
        totalPullRequestContributions: number;
        totalIssueContributions: number;
        totalRepositoryContributions: number;
        contributionCalendar: {
          totalContributions: number;
          weeks: Array<{
            contributionDays: Array<{
              date: string;
              contributionCount: number;
            }>;
          }>;
        };
      };
    };
  };
}

interface SearchCountResponse {
  total_count: number;
}

async function fetchJson<T>(
  url: string,
  init?: RequestInit & { timeout?: number },
): Promise<T> {
  const { timeout = 10_000, ...rest } = init ?? {};
  const res = await fetch(url, {
    ...rest,
    signal: AbortSignal.timeout(timeout),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return (await res.json()) as T;
}

export async function GET() {
  const { username, targetedRepos } = GITHUB_CONFIG;
  const cacheKey = "github:full-stats";
  const cached = getCache<typeof FALLBACK_STATS>(cacheKey);
  if (cached) return Response.json({ ...cached, source: "cache" });

  const token = process.env.GITHUB_TOKEN;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "ofriperetz-dev-stats",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  try {
    const [user, repos] = await Promise.all([
      fetchJson<GitHubUser>(`https://api.github.com/users/${username}`, {
        headers,
      }),
      fetchJson<GitHubRepo[]>(
        `https://api.github.com/users/${username}/repos?per_page=100&sort=pushed`,
        { headers },
      ),
    ]);

    let contributionStats = {
      totalContributions: FALLBACK_STATS.totalContributions,
      contributionCalendar: [] as { date: string; count: number }[],
      totalCommitContributions: FALLBACK_STATS.recentCommits,
      totalPullRequestContributions: FALLBACK_STATS.recentPRs,
      totalIssueContributions: FALLBACK_STATS.recentIssues,
      totalRepositoryContributions: FALLBACK_STATS.recentRepos,
    };

    if (token) {
      const contribCacheKey = "github:contributions";
      const cachedContrib = getCache<typeof contributionStats>(contribCacheKey);
      if (cachedContrib) {
        contributionStats = cachedContrib;
      } else {
        try {
          const graphqlResponse = await fetchJson<GraphQLContribResponse>(
            "https://api.github.com/graphql",
            {
              method: "POST",
              headers: { ...headers, "Content-Type": "application/json" },
              body: JSON.stringify({
                query: `query { user(login: "${username}") { contributionsCollection { totalCommitContributions totalPullRequestContributions totalIssueContributions totalRepositoryContributions contributionCalendar { totalContributions weeks { contributionDays { date contributionCount } } } } } }`,
              }),
            },
          );
          const collection =
            graphqlResponse.data?.user?.contributionsCollection;
          if (collection) {
            contributionStats = {
              totalContributions:
                collection.contributionCalendar.totalContributions,
              totalCommitContributions: collection.totalCommitContributions,
              totalPullRequestContributions:
                collection.totalPullRequestContributions,
              totalIssueContributions: collection.totalIssueContributions,
              totalRepositoryContributions:
                collection.totalRepositoryContributions,
              contributionCalendar: collection.contributionCalendar.weeks
                .flatMap((w) => w.contributionDays)
                .slice(-30)
                .map((d) => ({ date: d.date, count: d.contributionCount })),
            };
            setCache(contribCacheKey, contributionStats, CACHE_TTL.STANDARD);
          }
        } catch (graphqlError) {
          console.error("GraphQL error, using fallback:", graphqlError);
        }
      }
    }

    const ownRepos = repos.filter((r) => !r.fork);
    const targetedRepoData = ownRepos.filter((r) =>
      (targetedRepos as readonly string[]).includes(r.name),
    );

    const totalStars = targetedRepoData.reduce(
      (sum, r) => sum + r.stargazers_count,
      0,
    );
    const totalForks = targetedRepoData.reduce(
      (sum, r) => sum + r.forks_count,
      0,
    );
    const totalWatchers = targetedRepoData.reduce(
      (sum, r) => sum + r.watchers_count,
      0,
    );

    const starsBreakdown = targetedRepoData.map((r) => ({
      name: r.name,
      stars: r.stargazers_count,
      url: r.html_url,
    }));

    const topRepos = [...targetedRepoData]
      .sort((a, b) => b.stargazers_count - a.stargazers_count)
      .map((r) => ({
        name: r.name,
        stars: r.stargazers_count,
        forks: r.forks_count,
        url: r.html_url,
        description: r.description,
      }));

    const langMap: Record<string, number> = {};
    targetedRepoData.forEach((repo) => {
      if (repo.language) {
        langMap[repo.language] = (langMap[repo.language] || 0) + 1;
      }
    });
    const languages = Object.entries(langMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    let targetedCommits = 0;
    let targetedContributions = 0;

    if (token) {
      const commitsCacheKey = "github:targeted-commits";
      const cachedCommits = getCache<{
        commits: number;
        contributions: number;
      }>(commitsCacheKey);
      if (cachedCommits) {
        targetedCommits = cachedCommits.commits;
        targetedContributions = cachedCommits.contributions;
      } else {
        try {
          for (const repoName of targetedRepos) {
            try {
              const commitSearch = await fetchJson<SearchCountResponse>(
                `https://api.github.com/search/commits?q=author:${username}+repo:${username}/${repoName}`,
                {
                  headers: {
                    ...headers,
                    Accept: "application/vnd.github.cloak-preview+json",
                  },
                },
              );
              targetedCommits += commitSearch.total_count || 0;
            } catch (e) {
              console.error(`Error counting commits for ${repoName}:`, e);
            }
          }

          for (const repoName of targetedRepos) {
            try {
              const [prSearch, issueSearch] = await Promise.all([
                fetchJson<SearchCountResponse>(
                  `https://api.github.com/search/issues?q=author:${username}+repo:${username}/${repoName}+type:pr`,
                  { headers },
                ),
                fetchJson<SearchCountResponse>(
                  `https://api.github.com/search/issues?q=author:${username}+repo:${username}/${repoName}+type:issue`,
                  { headers },
                ),
              ]);
              targetedContributions +=
                (prSearch.total_count || 0) + (issueSearch.total_count || 0);
            } catch (e) {
              console.error(`Error counting contributions for ${repoName}:`, e);
            }
          }
          targetedContributions += targetedCommits;
          setCache(
            commitsCacheKey,
            {
              commits: targetedCommits,
              contributions: targetedContributions,
            },
            CACHE_TTL.HISTORICAL,
          );
        } catch (e) {
          console.error("Error fetching targeted repo stats:", e);
          targetedCommits = contributionStats.totalCommitContributions;
          targetedContributions = contributionStats.totalContributions;
        }
      }
    } else {
      targetedCommits = contributionStats.totalCommitContributions;
      targetedContributions = contributionStats.totalContributions;
    }

    const accountAge = Math.floor(
      (Date.now() - new Date(user.created_at).getTime()) /
        (1000 * 60 * 60 * 24 * 365),
    );

    const result = {
      totalStars,
      totalForks,
      totalWatchers,
      starsBreakdown,
      totalRepos: ownRepos.length,
      followers: user.followers,
      following: user.following,
      publicRepos: user.public_repos,
      accountAgeYears: accountAge,
      totalContributions: targetedContributions,
      recentCommits: targetedCommits,
      recentPRs: contributionStats.totalPullRequestContributions,
      recentIssues: contributionStats.totalIssueContributions,
      recentRepos: contributionStats.totalRepositoryContributions,
      recentReviews: 0,
      contributionCalendar: contributionStats.contributionCalendar,
      topRepos,
      languages,
      authenticated: !!token,
      source: "api" as const,
    };

    setCache(cacheKey, result, CACHE_TTL.FRESH);
    return Response.json(result);
  } catch (error) {
    console.error("Failed to fetch GitHub stats, returning fallback:", error);
    const cached = getCache<typeof FALLBACK_STATS>(cacheKey);
    if (cached) return Response.json({ ...cached, source: "cache" });
    return Response.json(FALLBACK_STATS);
  }
}
