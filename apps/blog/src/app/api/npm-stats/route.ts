// Per-plugin npm downloads, served from Supabase.
//
// Replaced 2026-05-25 — was reading `@/data/npm-stats.json` (bundled at
// build time, refreshed by hand). New path:
//
//   /api/npm-stats → unstable_cache (12h, tag:'ratchet') → Supabase v_plugin_latest
//                                                        + plugin_daily_metrics
//
// API contract preserved: same { updatedAt, totalDownloads, packageCount,
// packages: [{name, downloads, dailyData}], snapshots } shape so the
// /scorecard DownloadsByPackage chart and the homepage stats consumer
// keep working unchanged.

import { getCachedPluginsWithDailyData } from "@/lib/supabase-data";

export async function GET() {
  let packages: Awaited<ReturnType<typeof getCachedPluginsWithDailyData>>;
  try {
    packages = await getCachedPluginsWithDailyData();
  } catch (err) {
    // 503, not a 200 with an empty array: an empty 200 is indistinguishable
    // from "this account publishes nothing", which is how the same failure
    // went unnoticed on /npm for days.
    console.error("[api/npm-stats]", err);
    return Response.json(
      { error: "upstream unavailable" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
  const totalDownloads = packages.reduce((sum, p) => sum + p.downloads, 0);
  return Response.json({
    updatedAt: new Date().toISOString().split("T")[0],
    totalDownloads,
    packageCount: packages.length,
    packages,
    snapshots: [],
  });
}
