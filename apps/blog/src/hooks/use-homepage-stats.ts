"use client";

import { useCallback, useMemo, useState } from "react";

export interface HomepageStats {
  github: {
    totalStars: number;
    totalForks: number;
    totalRepos: number;
    followers: number;
    recentCommits: number;
    totalContributions: number;
    starsBreakdown: { name: string; stars: number; url: string }[];
    authenticated: boolean;
  };
  npm: { totalDownloads: number; packageCount: number };
  devto: {
    totalViews: number;
    followers: number;
    articleCount: number;
    totalReactions: number;
    totalComments: number;
    totalReadingMinutes: number;
  };
  source: "api" | "cache" | "fallback";
  fetchedAt?: string;
}

const FALLBACK: HomepageStats = {
  github: {
    totalStars: 11,
    totalForks: 2,
    totalRepos: 35,
    followers: 6,
    recentCommits: 477,
    totalContributions: 583,
    starsBreakdown: [],
    authenticated: false,
  },
  npm: { totalDownloads: 11222, packageCount: 23 },
  devto: {
    totalViews: 1834,
    followers: 85,
    articleCount: 28,
    totalReactions: 10,
    totalComments: 9,
    totalReadingMinutes: 100,
  },
  source: "fallback",
};

export function useHomepageStats() {
  const [stats, setStats] = useState<HomepageStats>(FALLBACK);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalFollowers = useMemo(
    () => stats.github.followers + stats.devto.followers,
    [stats.github.followers, stats.devto.followers],
  );

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/homepage-stats");
      const data = (await res.json()) as HomepageStats;
      setStats({
        ...data,
        github: {
          ...data.github,
          totalContributions:
            data.github.totalContributions ||
            FALLBACK.github.totalContributions,
          recentCommits:
            data.github.recentCommits || FALLBACK.github.recentCommits,
        },
      });
    } catch (e) {
      setError("Failed to fetch homepage stats");
      console.error("Homepage stats error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    stats,
    loading,
    error,
    githubStats: stats.github,
    npmStats: stats.npm,
    devtoStats: stats.devto,
    totalFollowers,
    fetchStats,
  };
}
