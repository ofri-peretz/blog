// Unified homepage stats, served from Supabase.
//
// Replaced 2026-05-25 — was a per-instance in-memory Map cache fronting
// three self-fetches (to /api/npm-stats, /api/devto-stats, /api/devto-
// articles) plus a GitHub GraphQL fetch. The self-fetches went over HTTP
// to the same serverless instance, the cache was per-instance (so each
// user saw their own snapshot), and the route was the canonical "data
// out of sync between renders" surface.
//
// New shape:
//
//   /api/homepage-stats
//      ├── npm + devto + ecosystem ← Supabase v_* views (12h cache, ratchet tag)
//      └── github                  ← live GraphQL (12h cache, github tag)
//
// All cache via unstable_cache (Vercel Data Cache — distributed, NOT
// per-instance). Invalidate from the daily-ingest webhook with
// revalidateTag('ratchet') for the Supabase-derived stuff. GitHub stays
// on a live fetch since we don't ingest it into Supabase yet.

import {
  getCachedCreatorsByPlatform,
  getCachedEcosystemLatest,
  getCachedNpmAlltimeTotal,
  getCachedPluginLatest,
} from "@/lib/supabase-data";
import { mergeGitHubStats } from "@/lib/homepage-stats-merge";
import {
  getCachedGitHubStats,
  type GitHubData,
} from "@/lib/github-live-stats";

interface NpmData {
  totalDownloads: number;
  packageCount: number;
}

interface DevToData {
  totalViews: number;
  followers: number;
  articleCount: number;
  totalReactions: number;
  totalComments: number;
}

interface HomepageStatsResponse {
  github: GitHubData;
  npm: NpmData;
  devto: DevToData;
  source: "supabase+github" | "supabase-only" | "empty";
  fetchedAt: string;
}

// ─── Route handler ────────────────────────────────────────────────────

export async function GET(): Promise<Response> {
  // GitHub fetch is allowed to fail (e.g. GITHUB_TOKEN missing on Vercel,
  // GraphQL endpoint down). Don't let it take down the whole route — the
  // Supabase fallbacks below cover the user-visible metrics (stars,
  // followers) even when live fetch errors.
  let github: GitHubData | null = null;
  try {
    github = await getCachedGitHubStats();
  } catch (err) {
    console.warn("[homepage-stats] github source unavailable:", err);
  }

  // These fetchers now throw rather than returning empty, so a blip is not
  // cached for twelve hours. Answer 503 instead of a 200 full of zeros: "0
  // downloads, 0 stars" is indistinguishable from a genuinely quiet month, and
  // that ambiguity is how /npm's outage stayed invisible for days.
  let creators: Awaited<ReturnType<typeof getCachedCreatorsByPlatform>>;
  let ecosystem: Awaited<ReturnType<typeof getCachedEcosystemLatest>>;
  let plugins: Awaited<ReturnType<typeof getCachedPluginLatest>>;
  let npmAlltimeTotal: Awaited<ReturnType<typeof getCachedNpmAlltimeTotal>>;
  try {
    [creators, ecosystem, plugins, npmAlltimeTotal] = await Promise.all([
      getCachedCreatorsByPlatform(),
      getCachedEcosystemLatest(),
      getCachedPluginLatest(),
      getCachedNpmAlltimeTotal(),
    ]);
  } catch (err) {
    console.error("[homepage-stats]", err);
    return Response.json(
      { error: "upstream unavailable" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }

  // The fetcher only logs on a query error, not on an empty-but-successful
  // read (e.g. v_npm_alltime_ecosystem has no rows yet because the daily
  // backfill hasn't run). Log that case here so 0 is always visible in logs,
  // not just silently rendered — matches the "no silent empty states" intent
  // below.
  if (npmAlltimeTotal === 0) {
    console.warn(
      "[homepage-stats] totalDownloads is 0 — v_npm_alltime_ecosystem may be unpopulated",
    );
  }

  const npm: NpmData = {
    // Total downloads ever (lifetime), from v_npm_alltime_ecosystem — the
    // SAME view the /scorecard eng_downloads_cumulative ratchet reads. This
    // is the single source for this number; no fallback to a differently-
    // computed total. 0 here is a genuine "no data" signal, not silently
    // replaced by a different calculation (see the fetcher's doc comment
    // in @/lib/supabase-data for why: a prior "pick whichever is nonzero"
    // fallback chain let a transient hiccup silently show a DIFFERENT
    // number than /scorecard for weeks).
    totalDownloads: npmAlltimeTotal,
    packageCount: plugins.length,
  };

  const devto: DevToData = {
    totalViews: creators.devto?.total_views ?? 0,
    followers: creators.devto?.followers ?? 0,
    articleCount: creators.devto?.posts ?? 0,
    totalReactions: creators.devto?.total_reactions ?? 0,
    totalComments: creators.devto?.total_comments ?? 0,
  };

  const githubMerged = mergeGitHubStats(github, creators);

  const source: HomepageStatsResponse["source"] =
    github && (ecosystem || creators.devto)
      ? "supabase+github"
      : ecosystem || creators.devto
        ? "supabase-only"
        : "empty";

  return Response.json({
    github: githubMerged,
    npm,
    devto,
    source,
    fetchedAt: new Date().toISOString(),
  } satisfies HomepageStatsResponse);
}
