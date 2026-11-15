// Cross-request cache for the /scorecard Supabase reads.
//
// The fetchers in #interlace/lib/scorecard-data wrap each view read in
// React `cache()` only. That dedupes reads inside ONE render, but the page
// is `force-dynamic`, so every request went back to Supabase for all five
// views. Each view read takes about a second, so the route's p95 tracked
// Supabase latency instead of render cost.
//
// This file adds the Vercel Data Cache layer that every other
// Supabase-backed surface already has (see supabase-data.ts). The TTL is
// one hour because the page footer promises an hourly refresh. The
// `ratchet` tag lets the daily-ingest webhook (/api/revalidate-tag) evict
// these entries together with the rest of the Supabase-derived reads.
//
// scorecard-data.ts is auto-generated from the agents repo, so the cache
// lives here and not in that file. `react/cache` stays on the outside so
// the sections of one render still share one in-flight read on a cold
// cache.
//
// A throw (missing env, Supabase error) is never cached, so the next
// request retries and error.tsx handles this one.

import "server-only";
import { unstable_cache } from "next/cache";
import { cache } from "react";

import {
  createScorecardClient,
  getNorthStarHistory,
  getRatchetAnomalies,
  getRatchetBreakdown,
  getRatchetDeltas,
  getRatchetTrends,
} from "#interlace/lib/scorecard-data";
import { TAG_RATCHET } from "@/lib/supabase-data";

export const SCORECARD_REVALIDATE_SECONDS = 60 * 60;

const options = {
  revalidate: SCORECARD_REVALIDATE_SECONDS,
  tags: [TAG_RATCHET],
};

export const getCachedBreakdown = cache(
  unstable_cache(
    () => getRatchetBreakdown(createScorecardClient()),
    ["scorecard", "v_ratchet_breakdown"],
    options,
  ),
);

export const getCachedDeltas = cache(
  unstable_cache(
    () => getRatchetDeltas(createScorecardClient()),
    ["scorecard", "v_ratchet_deltas"],
    options,
  ),
);

export const getCachedTrends = cache(
  unstable_cache(
    () => getRatchetTrends(createScorecardClient()),
    ["scorecard", "v_ratchet_trends"],
    options,
  ),
);

export const getCachedAnomalies = cache(
  unstable_cache(
    () => getRatchetAnomalies(createScorecardClient()),
    ["scorecard", "v_ratchet_anomalies"],
    options,
  ),
);

export const getCachedNorthStarHistory = cache(
  unstable_cache(
    () => getNorthStarHistory(createScorecardClient()),
    ["scorecard", "v_north_star_history"],
    options,
  ),
);
