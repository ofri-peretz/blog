// Cached Supabase queries — the single read path for blog API routes.
//
// Architecture (revised 2026-05-25):
//
//   daily-ingest cron (footprint/scripts/daily-ingest.ts) writes Supabase
//                  │
//                  ▼
//   v_plugin_latest, v_creator_latest, v_ecosystem_latest (RLS-allowed reads)
//                  │
//                  ▼
//   unstable_cache (Vercel Data Cache — distributed, NOT per-instance)
//                  │
//                  ▼
//   /api/npm-stats, /api/devto-stats, /api/homepage-stats (this file's consumers)
//
// Why unstable_cache instead of the old lib/cache.ts in-memory Map:
//   - Map is per-serverless-instance. Different users hit different instances,
//     each holding its own snapshot. "Set TTL=1min" never delivered 1-min
//     freshness; it delivered "at most 1-min stale per instance".
//   - Vercel Data Cache is distributed. One global cache state, deterministic
//     TTL, on-demand invalidation via revalidateTag.
//
// TTL = 12 hours. The daily ingest runs every 24h; 12h gives us a "freshness
// floor" of half a day even if the on-demand revalidate webhook (TODO) misses.
// Once that webhook fires after each ingest, the apparent freshness becomes
// "as fast as the cron", not "up to 12h stale".

import "server-only";
import { unstable_cache } from "next/cache";
import { cache } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const TWELVE_HOURS_SECONDS = 12 * 60 * 60;

// Cache-bust tags. revalidateTag('ratchet') from a webhook flips every entry
// tagged below in a single call.
const TAG_RATCHET = "ratchet";

// Per-render Supabase client — React.cache() dedupes within one server render
// so multiple sections of the same page share a single connection.
const getClient = cache((): SupabaseClient | null => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.warn(
      "[supabase-data] SUPABASE_URL / SUPABASE_ANON_KEY missing — falling back to empty results",
    );
    return null;
  }
  return createClient(url, key, { auth: { persistSession: false } });
});

// ─── Types matching the v_* view rows ────────────────────────────────

export interface PluginLatestRow {
  plugin_id: number;
  name: string;
  slug: string;
  category: string | null;
  description: string | null;
  observed_on: string;
  npm_downloads_d1: number | null;
  npm_downloads_d7: number | null;
  npm_downloads_d30: number | null;
  github_stars: number | null;
  rule_count: number | null;
  published: boolean;
}

export interface CreatorLatestRow {
  creator: string;
  platform: "devto" | "github" | "github-repo";
  observed_on: string;
  followers: number | null;
  posts: number | null;
  total_views: number | null;
  total_reactions: number | null;
  total_comments: number | null;
  total_contributions: number | null;
  total_commits: number | null;
}

export interface EcosystemLatestRow {
  observed_on: string;
  total_packages: number | null;
  total_plugins: number | null;
  total_rules: number | null;
  total_npm_downloads: number | null;
  daily_npm_downloads: number | null;
  total_lines: number | null;
  covered_lines: number | null;
  test_coverage: number | null;
}

// ─── Cached fetchers (unstable_cache → Vercel Data Cache) ────────────

export const getCachedPluginLatest = unstable_cache(
  async (): Promise<PluginLatestRow[]> => {
    const client = getClient();
    if (!client) return [];
    const { data, error } = await client.from("v_plugin_latest").select("*");
    if (error) {
      console.error("[supabase-data] v_plugin_latest:", error.message);
      return [];
    }
    return (data as PluginLatestRow[]) ?? [];
  },
  ["v_plugin_latest"],
  { revalidate: TWELVE_HOURS_SECONDS, tags: [TAG_RATCHET] },
);

export const getCachedCreatorLatest = unstable_cache(
  async (): Promise<CreatorLatestRow[]> => {
    const client = getClient();
    if (!client) return [];
    const { data, error } = await client.from("v_creator_latest").select("*");
    if (error) {
      console.error("[supabase-data] v_creator_latest:", error.message);
      return [];
    }
    return (data as CreatorLatestRow[]) ?? [];
  },
  ["v_creator_latest"],
  { revalidate: TWELVE_HOURS_SECONDS, tags: [TAG_RATCHET] },
);

export const getCachedEcosystemLatest = unstable_cache(
  async (): Promise<EcosystemLatestRow | null> => {
    const client = getClient();
    if (!client) return null;
    const { data, error } = await client
      .from("v_ecosystem_latest")
      .select("*")
      .order("observed_on", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error("[supabase-data] v_ecosystem_latest:", error.message);
      return null;
    }
    return (data as EcosystemLatestRow | null) ?? null;
  },
  ["v_ecosystem_latest"],
  { revalidate: TWELVE_HOURS_SECONDS, tags: [TAG_RATCHET] },
);

// ─── Convenience helpers used by API routes ─────────────────────────

export interface CreatorByPlatform {
  devto: CreatorLatestRow | null;
  github: CreatorLatestRow | null;
  githubRepo: CreatorLatestRow | null;
}

export const getCachedCreatorsByPlatform = unstable_cache(
  async (): Promise<CreatorByPlatform> => {
    const rows = await getCachedCreatorLatest();
    const byPlatform = (
      p: CreatorLatestRow["platform"],
    ): CreatorLatestRow | null => rows.find((r) => r.platform === p) ?? null;
    return {
      devto: byPlatform("devto"),
      github: byPlatform("github"),
      githubRepo: byPlatform("github-repo"),
    };
  },
  ["creators-by-platform"],
  { revalidate: TWELVE_HOURS_SECONDS, tags: [TAG_RATCHET] },
);

// ─── Cumulative npm downloads since project start ──────────────────────
//
// Sums plugin_daily_metrics.npm_downloads_d1 across all plugins for all
// days >= METRICS_START_DATE. Deterministic — no running-counter bookkeeping
// that can drift (as ecosystem_daily_metrics.total_npm_downloads did when
// backfill-history.ts re-baselined from 0 on 2026-05-24).
//
// Note: requires plugin_daily_metrics to be populated for the full window.
// Backfill via the npm registry `/downloads/range/` endpoint covers any gaps.

export const METRICS_START_DATE = "2025-11-30";

export const getCachedNpmTotalSinceStart = unstable_cache(
  async (): Promise<number> => {
    const client = getClient();
    if (!client) return 0;
    const { data, error } = await client
      .from("plugin_daily_metrics")
      .select("npm_downloads_d1")
      .gte("observed_on", METRICS_START_DATE);
    if (error) {
      console.error("[supabase-data] npm total sum:", error.message);
      return 0;
    }
    return (data ?? []).reduce(
      (sum, row) => sum + (row.npm_downloads_d1 ?? 0),
      0,
    );
  },
  ["npm-total-since-start"],
  { revalidate: TWELVE_HOURS_SECONDS, tags: [TAG_RATCHET] },
);

// ─── Lifetime npm downloads — total downloads ever, across all plugins ──
//
// Hits npm registry's `/downloads/range/` endpoint per plugin and sums.
// Per-plugin pacing (250ms) keeps us well under npm's anonymous rate
// limit. Wall time: ~7-10s on a cache miss. Cache miss happens once per
// 12 hours per cache region, so the cost is amortized to a few API calls
// per day per region.
//
// Start date: 2020-01-01 — well before any of our plugins published.
// npm returns 0 for any day predating the first publish, so the start
// date doesn't need per-plugin tuning.

export const getCachedNpmLifetimeTotal = unstable_cache(
  async (): Promise<number> => {
    const client = getClient();
    if (!client) return 0;
    const { data: plugins, error } = await client
      .from("plugins")
      .select("name");
    if (error || !plugins) {
      console.error(
        "[supabase-data] npm lifetime: plugins query failed:",
        error?.message,
      );
      return 0;
    }
    const today = new Date().toISOString().slice(0, 10);
    let total = 0;
    for (let i = 0; i < plugins.length; i += 1) {
      if (i > 0) await new Promise((r) => setTimeout(r, 250));
      const name = plugins[i]!.name;
      try {
        const r = await fetch(
          `https://api.npmjs.org/downloads/range/2020-01-01:${today}/${encodeURIComponent(name)}`,
          {
            headers: {
              "User-Agent": "ofriperetz.dev/blog (homepage stats)",
              Accept: "application/json",
            },
            signal: AbortSignal.timeout(5_000),
          },
        );
        if (!r.ok) continue;
        const json = (await r.json()) as {
          downloads?: Array<{ downloads: number }>;
        };
        for (const d of json.downloads ?? []) total += d.downloads;
      } catch (err) {
        console.warn(
          `[supabase-data] npm lifetime: ${name} failed`,
          (err as Error).message,
        );
      }
    }
    return total;
  },
  ["npm-lifetime-total"],
  { revalidate: TWELVE_HOURS_SECONDS, tags: [TAG_RATCHET] },
);

// ─── Per-plugin daily downloads (for sparklines + per-package totals) ──
//
// Window: 30 days back from today. Each plugin row gets a {day, downloads}
// array suitable for the per-package chart on /scorecard and the npm-stats
// route's `packages[].dailyData` field.

export interface PluginWithDailyData {
  name: string;
  downloads: number;
  dailyData: Array<{ day: string; downloads: number }>;
}

export const getCachedPluginsWithDailyData = unstable_cache(
  async (): Promise<PluginWithDailyData[]> => {
    const client = getClient();
    if (!client) return [];

    // Window: last 30 days. Hard floor at 2025-11-30 (METRICS_START_DATE in
    // the old bundled-JSON route — keeps the chart's x-axis stable).
    const today = new Date();
    const thirtyAgo = new Date(today);
    thirtyAgo.setDate(thirtyAgo.getDate() - 30);
    const windowStart = thirtyAgo.toISOString().slice(0, 10);

    const { data: plugins, error: pErr } = await client
      .from("plugins")
      .select("id, name");
    if (pErr) {
      console.error("[supabase-data] plugins:", pErr.message);
      return [];
    }

    const { data: daily, error: dErr } = await client
      .from("plugin_daily_metrics")
      .select("plugin_id, observed_on, npm_downloads_d1")
      .gte("observed_on", windowStart)
      .order("observed_on", { ascending: true });
    if (dErr) {
      console.error("[supabase-data] plugin_daily_metrics:", dErr.message);
      return [];
    }

    const byPlugin = new Map<
      number,
      Array<{ day: string; downloads: number }>
    >();
    for (const row of daily ?? []) {
      const arr = byPlugin.get(row.plugin_id) ?? [];
      arr.push({
        day: row.observed_on,
        downloads: row.npm_downloads_d1 ?? 0,
      });
      byPlugin.set(row.plugin_id, arr);
    }

    return (plugins ?? [])
      .map((p) => {
        const dailyData = byPlugin.get(p.id) ?? [];
        const total = dailyData.reduce((s, d) => s + d.downloads, 0);
        return { name: p.name, downloads: total, dailyData };
      })
      .filter((p) => p.downloads > 0)
      .sort((a, b) => b.downloads - a.downloads);
  },
  ["plugins-with-daily-data"],
  { revalidate: TWELVE_HOURS_SECONDS, tags: [TAG_RATCHET] },
);
