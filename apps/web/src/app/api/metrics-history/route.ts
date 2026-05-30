interface Snapshot {
  date: string;
  npm: {
    totalDownloads: number;
    dailyDownloads?: number;
    packageCount: number;
  };
  github: {
    stars: number;
    followers: number;
    contributions?: number;
    dailyContributions?: number;
    commits?: number;
    dailyCommits?: number;
  };
  devto: {
    views: number;
    dailyViews?: number;
    followers: number;
    dailyFollowers?: number;
    reactions: number;
    dailyReactions?: number;
    comments: number;
    dailyComments?: number;
    articles?: number;
  };
  ecosystem?: {
    packages: number;
    plugins: number;
    rules: number;
    owaspCoverage: number;
    testCoverage: number;
  };
}

const AGGREGATION_URL =
  "https://raw.githubusercontent.com/ofri-peretz/ofriperetz-dev/main/.data/snapshots/aggregation.json";

const cachedHistory = {
  lastFetched: 0,
  data: null as Snapshot[] | null,
};

const isDev = process.env.NODE_ENV === "development";

export async function GET() {
  const TTL = isDev ? 60_000 : 60 * 60 * 1000;
  const useCache =
    cachedHistory.data &&
    cachedHistory.data.length > 0 &&
    Date.now() - cachedHistory.lastFetched < TTL;
  if (useCache) return Response.json(cachedHistory.data);

  try {
    let snapshots: Snapshot[];
    if (isDev) {
      const fs = await import("node:fs/promises");
      const path = await import("node:path");
      const localPath = path.join(
        process.cwd(),
        ".data",
        "snapshots",
        "aggregation.json",
      );
      const fileContent = await fs.readFile(localPath, "utf-8");
      snapshots = JSON.parse(fileContent) as Snapshot[];
    } else {
      // ofri-peretz/ofriperetz-dev is a private repo, so an unauthenticated
      // raw.githubusercontent.com fetch returns 404. Pass the same token
      // the rest of the routes use — raw.githubusercontent.com accepts a
      // Bearer token for private repos the token can read.
      const token = process.env.GITHUB_TOKEN;
      const headers: Record<string, string> = {
        Accept: "application/json",
        "Cache-Control": "no-cache",
        "User-Agent": "ofriperetz-dev-stats",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const response = await fetch(AGGREGATION_URL, { headers });
      if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
      snapshots = (await response.json()) as Snapshot[];
    }
    cachedHistory.data = snapshots;
    cachedHistory.lastFetched = Date.now();
    return Response.json(snapshots);
  } catch (error) {
    console.error("[metrics-history] Failed:", error);
    if (cachedHistory.data) return Response.json(cachedHistory.data);
    return Response.json([]);
  }
}
