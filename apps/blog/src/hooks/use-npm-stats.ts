"use client";

import { useCallback, useMemo, useState } from "react";

export interface PackageStats {
  name: string;
  downloads: number;
  dailyData?: { downloads: number; day: string }[];
}

export interface DailySnapshot {
  date: string;
  npm: {
    totalDownloads: number;
    dailyDownloads: number;
    packageCount: number;
  };
}

export interface NpmStatsResponse {
  packages: PackageStats[];
  totalDownloads: number;
  packageCount: number;
  snapshots?: DailySnapshot[];
}

export function useNpmStats() {
  const [stats, setStats] = useState<PackageStats[]>([]);
  const [snapshots, setSnapshots] = useState<DailySnapshot[]>([]);
  const [packageCount, setPackageCount] = useState(0);
  const [latestTotalDownloads, setLatestTotalDownloads] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalDownloads = useMemo(
    () => stats.reduce((sum, pkg) => sum + pkg.downloads, 0),
    [stats],
  );

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/npm-stats");
      const data = (await res.json()) as NpmStatsResponse;
      setStats(data.packages);
      setPackageCount(data.packageCount);
      setLatestTotalDownloads(data.totalDownloads);
      setSnapshots(data.snapshots ?? []);
    } catch (e) {
      setError("Failed to fetch npm stats");
      console.error("npm stats error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    stats,
    snapshots,
    loading,
    error,
    totalDownloads,
    latestTotalDownloads,
    packageCount,
    fetchStats,
  };
}
