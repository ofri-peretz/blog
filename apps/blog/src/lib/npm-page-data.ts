// Data source for the /npm page. Combines:
//   - plugins + plugin_daily_metrics from Supabase, via the shared
//     getCachedPluginsDailyRaw() fetcher (per-package sparkline) — same
//     query the /api/npm-stats route's getCachedPluginsWithDailyData()
//     uses, so the two pages can't silently diverge on the 30-day window.
//   - lifetime per-package downloads from npm_alltime_downloads (12h cached)
//
// Single read path so the page server component stays presentational.

import "server-only";
import { unstable_cache } from "next/cache";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";
import { getCachedPluginsDailyRaw } from "@/lib/supabase-data";

const TWELVE_HOURS_SECONDS = 12 * 60 * 60;

// Deprecation is no longer a list here — it's `plugins.deprecated`, set by the
// ingest from npm itself. What stays is page scope: these are live, counted,
// non-deprecated packages that simply aren't ESLint plugins, so they don't
// belong on the ESLint package page.
const OFF_PAGE = new Set<string>([
  "@interlace/serverless-iam-roles-per-function",
  "@interlace/serverless-api-gateway-caching",
  "@interlace/serverless-devkit",
]);

const getClient = cache((): SupabaseClient | null => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
});

export interface NpmPagePackage {
  name: string;
  slug: string;
  category: string | null;
  description: string | null;
  downloads30d: number;
  downloadsLifetime: number;
  dailyData: Array<{ day: string; downloads: number }>;
}

// Lifetime per-package downloads, from npm_alltime_downloads (PRIMARY KEY
// plugin_id) — the same table backing v_npm_alltime_ecosystem, which
// /api/homepage-stats now reads for the site-wide total (see
// getCachedNpmAlltimeTotal in @/lib/supabase-data). Refreshed daily by
// agents/footprint/scripts/backfill-npm-alltime.ts. Replaces a former
// per-package loop against the live npm registry `/downloads/range/`
// endpoint — that path independently recomputed the same figure a
// different way per package, the same SSOT hazard the homepage total had.
const getCachedLifetimePerPackage = unstable_cache(
  async (
    plugins: ReadonlyArray<{ pluginId: number; name: string }>,
  ): Promise<Record<string, number>> => {
    const out: Record<string, number> = {};
    if (plugins.length === 0) return out;

    // Throws rather than returning {} for the same reason as
    // getCachedPluginsDailyRaw: a cached failure outlives the deployment.
    const client = getClient();
    if (!client) {
      throw new Error("[npm-page-data] Supabase env missing");
    }

    const idToName = new Map(plugins.map((p) => [p.pluginId, p.name]));
    const { data, error } = await client
      .from("npm_alltime_downloads")
      .select("plugin_id, alltime_total")
      .in("plugin_id", plugins.map((p) => p.pluginId));
    if (error) {
      throw new Error(`[npm-page-data] npm_alltime_downloads: ${error.message}`);
    }

    for (const row of data ?? []) {
      const name = idToName.get(row.plugin_id);
      if (name) out[name] = row.alltime_total ?? 0;
    }
    return out;
  },
  ["npm-lifetime-per-package"],
  { revalidate: TWELVE_HOURS_SECONDS, tags: ["ratchet"] },
);

// Composed: per-package data ready to render.
export async function getNpmPagePackages(): Promise<NpmPagePackage[]> {
  try {
    return await loadNpmPagePackages();
  } catch (err) {
    // Degrade for THIS request only. The rejected promise above was never
    // cached, so the next request retries against a healthy Supabase instead
    // of serving a cached failure for the next twelve hours.
    console.error("[npm-page-data]", err);
    return [];
  }
}

async function loadNpmPagePackages(): Promise<NpmPagePackage[]> {
  const { plugins, daily: dailyEntries } = await getCachedPluginsDailyRaw();
  const daily = new Map(dailyEntries);
  if (plugins.length === 0) return [];

  const lifetimeByName = await getCachedLifetimePerPackage(
    plugins.map((p) => ({ pluginId: p.id, name: p.name })),
  );

  const packages: NpmPagePackage[] = plugins
    .filter((p) => !p.deprecated && !OFF_PAGE.has(p.name))
    .map((p) => {
      const dailyData = daily.get(p.id) ?? [];
      const downloads30d = dailyData.reduce((s, d) => s + d.downloads, 0);
      const downloadsLifetime = lifetimeByName[p.name] ?? 0;
      return {
        name: p.name,
        slug: p.slug,
        category: p.category,
        description: p.description,
        downloads30d,
        downloadsLifetime,
        dailyData,
      };
    })
    // Only show packages we're actively promoting AND that have any signal.
    .filter((p) => p.downloads30d > 0 || p.downloadsLifetime > 0)
    .sort((a, b) => b.downloadsLifetime - a.downloadsLifetime);

  return packages;
}
