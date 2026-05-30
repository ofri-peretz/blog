"use client";

import { useCallback, useState } from "react";

export interface GitHubStats {
  totalStars: number;
  totalForks: number;
  totalWatchers: number;
  totalRepos: number;
  followers: number;
  following: number;
  publicRepos: number;
  accountAgeYears: number;
  starsBreakdown: { name: string; stars: number; url: string }[];
  totalContributions: number;
  recentCommits: number;
  recentPRs: number;
  recentIssues: number;
  recentRepos: number;
  contributionCalendar: { date: string; count: number }[];
  topRepos: {
    name: string;
    stars: number;
    forks: number;
    url: string;
    description: string | null;
  }[];
  languages: { name: string; count: number }[];
  recentEvents?: { type: string; repo: string; date: string }[];
  authenticated?: boolean;
}

const INITIAL: GitHubStats = {
  totalStars: 0,
  totalForks: 0,
  totalWatchers: 0,
  totalRepos: 0,
  followers: 0,
  following: 0,
  publicRepos: 0,
  accountAgeYears: 0,
  totalContributions: 0,
  recentCommits: 0,
  recentPRs: 0,
  recentIssues: 0,
  recentRepos: 0,
  contributionCalendar: [],
  topRepos: [],
  languages: [],
  starsBreakdown: [],
};

export function useGitHubStats() {
  const [stats, setStats] = useState<GitHubStats>(INITIAL);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/github-stats");
      const data = (await res.json()) as GitHubStats;
      setStats(data);
    } catch (e) {
      setError("Failed to fetch GitHub stats");
      console.error("GitHub stats error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  return { stats, loading, error, fetchStats };
}
