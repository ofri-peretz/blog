// Dev.to follower + view count, served from Supabase.
//
// Replaced 2026-05-25 — was hitting dev.to API directly with an in-memory
// per-instance cache. Now reads the daily-ingest's v_creator_latest row.
//
// API contract preserved: same { followers, totalViews, source } shape.

import { getCachedCreatorsByPlatform } from "@/lib/supabase-data";

export async function GET(): Promise<Response> {
  const { devto } = await getCachedCreatorsByPlatform();
  return Response.json({
    followers: devto?.followers ?? 0,
    totalViews: devto?.total_views ?? 0,
    source: devto ? ("supabase" as const) : ("empty" as const),
    observedOn: devto?.observed_on ?? null,
  });
}
