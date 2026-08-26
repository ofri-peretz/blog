import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { cache } from "react";

import type { ShortLinkRow } from "@/app/go/resolver";

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

// Exported for sibling cached fetchers (loom-corpus.ts) so every Supabase
// read in the app shares one TTL and one invalidation channel.
export const TWELVE_HOURS_SECONDS = 12 * 60 * 60;

// Cache-bust tags. revalidateTag('ratchet') from a webhook flips every entry
// tagged below in a single call.
export const TAG_RATCHET = "ratchet";

// Separate tag for the /go/ short-link table: routing rows change on
// publish (publisher upsert), not on the daily metrics ingest, so they get
// their own invalidation channel — revalidateTag('short-links') after a
// short_links upsert repoints every /go/ link in seconds without flushing
// the metrics caches (and vice versa).
const TAG_SHORT_LINKS = "short-links";

// Per-render Supabase client — React.cache() dedupes within one server render
// so multiple sections of the same page share a single connection.
const getClient = cache((): SupabaseClient | null => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
});

/**
 * A client, or a throw — never a silent empty result.
 *
 * Every fetcher below runs inside unstable_cache, and Vercel's Data Cache
 * outlives the deployment. Returning [] / null / 0 when the client is missing
 * therefore CACHES that emptiness for the full TTL and across redeploys. That
 * is exactly how /npm served "No package data available" for days against
 * healthy data: the production build runs in GitHub Actions, where
 * SUPABASE_URL / SUPABASE_ANON_KEY are Sensitive-type vars that `vercel pull`
 * cannot read back, so prerendering baked an empty page.
 *
 * A rejected promise is never cached, so the next request simply retries.
 * Callers decide how to degrade — and they degrade for one request, not twelve
 * hours.
 */
export function requireClient(what: string): SupabaseClient {
  const client = getClient();
  if (!client) {
    throw new Error(
      `[supabase-data] ${what}: SUPABASE_URL / SUPABASE_ANON_KEY missing — refusing to cache an empty result`,
    );
  }
  return client;
}

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
    const client = requireClient("v_plugin_latest");
    const { data, error } = await client.from("v_plugin_latest").select("*");
    if (error) throw new Error(`[supabase-data] v_plugin_latest: ${error.message}`);
    return (data as PluginLatestRow[]) ?? [];
  },
  ["v_plugin_latest"],
  { revalidate: TWELVE_HOURS_SECONDS, tags: [TAG_RATCHET] },
);

export const getCachedCreatorLatest = unstable_cache(
  async (): Promise<CreatorLatestRow[]> => {
    const client = requireClient("v_creator_latest");
    const { data, error } = await client.from("v_creator_latest").select("*");
    if (error) throw new Error(`[supabase-data] v_creator_latest: ${error.message}`);
    return (data as CreatorLatestRow[]) ?? [];
  },
  ["v_creator_latest"],
  { revalidate: TWELVE_HOURS_SECONDS, tags: [TAG_RATCHET] },
);

export const getCachedEcosystemLatest = unstable_cache(
  async (): Promise<EcosystemLatestRow | null> => {
    const client = requireClient("v_ecosystem_latest");
    const { data, error } = await client
      .from("v_ecosystem_latest")
      .select("*")
      .order("observed_on", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error)
      throw new Error(`[supabase-data] v_ecosystem_latest: ${error.message}`);
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

// ─── All-time ecosystem npm downloads — the canonical total ────────────
//
// Single row from v_npm_alltime_ecosystem, which sums npm_alltime_downloads
// (PRIMARY KEY plugin_id) across every plugin. That table is refreshed daily
// by agents/footprint/scripts/backfill-npm-alltime.ts and is the SAME source
// the eng_downloads_cumulative ratchet on /scorecard reads — this fetcher
// exists so /api/homepage-stats reads the identical number instead of
// independently recomputing "npm downloads" a different way.
//
// Two earlier fetchers computed this differently — getCachedNpmLifetimeTotal
// (summed live npm registry `/downloads/range/` calls per plugin) and
// getCachedNpmTotalSinceStart (summed plugin_daily_metrics.npm_downloads_d1
// from base tables since METRICS_START_DATE). Keeping either as a homepage
// fallback let a transient Supabase hiccup silently revert the homepage to
// a DIFFERENT total than /scorecard shows — this exact class of bug already
// happened once, 155k vs 192k, for weeks. PR #51 made this the sole source;
// both legacy fetchers were deleted entirely once confirmed unused
// (see git history for apps/blog/src/lib/supabase-data.ts if you need the
// old implementations back).

export const getCachedNpmAlltimeTotal = unstable_cache(
  async (): Promise<number> => {
    const client = requireClient("v_npm_alltime_ecosystem");
    const { data, error } = await client
      .from("v_npm_alltime_ecosystem")
      .select("ecosystem_alltime")
      .maybeSingle();
    if (error)
      throw new Error(
        `[supabase-data] v_npm_alltime_ecosystem: ${error.message}`,
      );
    return (data?.ecosystem_alltime as number | null) ?? 0;
  },
  ["v_npm_alltime_ecosystem"],
  { revalidate: TWELVE_HOURS_SECONDS, tags: [TAG_RATCHET] },
);

// ─── Per-plugin daily downloads (for sparklines + per-package totals) ──
//
// Window: 30 days back from today. Each plugin row gets a {day, downloads}
// array suitable for the per-package chart on /scorecard, the npm-stats
// route's `packages[].dailyData` field, and the /npm page. Single canonical
// query — was previously duplicated (same two Supabase queries + the same
// day-bucketing loop, hand-rolled twice) between this file and
// npm-page-data.ts's now-removed getCachedDailyHistory().
//
// Reads v_plugin_daily (agents/supabase/migrations/202607050200_add_v_plugin_daily.sql)
// instead of querying plugin_daily_metrics directly — the view already
// joins plugin metadata onto each daily row, same as every other fetcher
// in this file goes through the v_* view layer rather than base tables.
//
// The plugin ROSTER query stays separate from the metrics query rather
// than being folded into "one query total": v_plugin_daily inner-joins
// plugins ⋈ plugin_daily_metrics, so a plugin with zero rows in
// plugin_daily_metrics for the whole 30-day window (a real, seen-before gap
// — see agents/footprint/scripts/backfill-gaps.ts) would silently vanish
// from `plugins` too if the roster came from the same join. Consumers rely
// on the roster including such plugins: npm-page-data.ts's
// getNpmPagePackages() keeps a plugin visible when it has ANY lifetime
// downloads even with zero 30-day rows (`downloads30d > 0 ||
// downloadsLifetime > 0`). Splitting the queries keeps that contract while
// still eliminating the plugin_daily_metrics base-table read.
export interface PluginMeta {
  id: number;
  name: string;
  slug: string;
  category: string | null;
  description: string | null;
  /**
   * npm-deprecated. Such a plugin is still in the roster and still counted in
   * every download total — that is the point of DEPRECATED_INCLUDE in the
   * ingest — but listings hide it so a rename doesn't appear twice.
   */
  deprecated: boolean;
}

export interface PluginsDailyRaw {
  plugins: PluginMeta[];
  // Array-of-entries, not a Map: `unstable_cache` serializes its return
  // value through JSON, and Next.js explicitly documents that Map/Set/Date
  // aren't supported — on a cache hit a Map field comes back as `{}`. Each
  // call site reconstructs a Map locally via `new Map(daily)`.
  daily: Array<[number, Array<{ day: string; downloads: number }>]>;
}

export const getCachedPluginsDailyRaw = unstable_cache(
  async (): Promise<PluginsDailyRaw> => {
    // THROW, never return empty. unstable_cache stores whatever this resolves
    // to, and Vercel's Data Cache outlives the deployment — so returning [] on
    // a transient Supabase blip cached that blip for 12h AND survived every
    // redeploy. /npm served "No package data available" for days on healthy
    // data; only revalidateTag('ratchet') cleared it. A rejected promise is not
    // cached, so the next request simply retries. Callers catch and degrade.
    const client = getClient();
    if (!client) {
      throw new Error(
        "[supabase-data] SUPABASE_URL / SUPABASE_ANON_KEY missing — refusing to cache an empty result",
      );
    }

    // Window: last 30 days. Hard floor at 2025-11-30 (METRICS_START_DATE in
    // the old bundled-JSON route — keeps the chart's x-axis stable).
    const today = new Date();
    const thirtyAgo = new Date(today);
    thirtyAgo.setDate(thirtyAgo.getDate() - 30);
    const windowStart = thirtyAgo.toISOString().slice(0, 10);

    const { data: plugins, error: pErr } = await client
      .from("plugins")
      .select("id, name, slug, category, description, deprecated");
    if (pErr || !plugins) {
      throw new Error(`[supabase-data] plugins: ${pErr?.message ?? "no rows"}`);
    }

    const { data: daily, error: dErr } = await client
      .from("v_plugin_daily")
      .select("plugin_id, observed_on, npm_downloads_d1")
      .gte("observed_on", windowStart)
      .order("observed_on", { ascending: true });
    if (dErr) {
      // Also a throw: caching plugins-with-no-daily zeroes every sparkline and
      // every downloads30d, which the /npm filter then reads as "no signal".
      throw new Error(`[supabase-data] v_plugin_daily: ${dErr.message}`);
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

    return { plugins, daily: Array.from(byPlugin.entries()) };
  },
  ["plugins-daily-raw"],
  { revalidate: TWELVE_HOURS_SECONDS, tags: [TAG_RATCHET] },
);

export interface PluginWithDailyData {
  name: string;
  downloads: number;
  dailyData: Array<{ day: string; downloads: number }>;
}

export const getCachedPluginsWithDailyData = unstable_cache(
  async (): Promise<PluginWithDailyData[]> => {
    const { plugins, daily: dailyEntries } = await getCachedPluginsDailyRaw();
    const daily = new Map(dailyEntries);

    return plugins
      .map((p) => {
        const dailyData = daily.get(p.id) ?? [];
        const total = dailyData.reduce((s, d) => s + d.downloads, 0);
        return { name: p.name, downloads: total, dailyData };
      })
      .filter((p) => p.downloads > 0)
      .sort((a, b) => b.downloads - a.downloads);
  },
  ["plugins-with-daily-data"],
  { revalidate: TWELVE_HOURS_SECONDS, tags: [TAG_RATCHET] },
);

// ─── /go/ short-link table (short_links) ─────────────────────────────
//
// The routing table behind the /go/ redirect layer (a small URL
// shortener — see src/app/go/resolver.ts and supabase/migrations/
// *_short_links.sql). Read by the /go/[...key] route handler: a request
// stamped `?utm_source=devto` looks up its key here and, if the row has a
// `platforms.devto` copy, 302s there so platform readers stay native; no
// row (or no override) falls back to the derived default (blog canonical
// /articles/<slug>, npm/gh page). Rows are upserted by the publisher at
// publish time — zero manual rows for the common case.
//
// Whole-table fetch, not per-key: the table is tiny (one row per
// OVERRIDDEN link — most links have none) and one cache entry beats a
// cache entry per key. Same fetch-all-then-filter shape as the metrics
// fetchers above; the route closes a sync `lookup` over the result.

export const getCachedShortLinks = unstable_cache(
  async (): Promise<ShortLinkRow[]> => {
    const client = requireClient("short_links");
    const { data, error } = await client
      .from("short_links")
      .select(
        "key, kind, destination, platforms, campaign, tags, active, created_at, expires_at, note",
      );
    // Degrading to "no overrides" is still the right BEHAVIOUR for /go/ — every
    // /go/<slug> should 302 to its derived default rather than 500. But that
    // decision belongs at the route, not here: returning [] from inside
    // unstable_cache stores the failure for twelve hours, so a transient blip
    // silently disables every override until the tag is revalidated. The route
    // catches this and falls back for that request only.
    if (error) throw new Error(`[supabase-data] short_links: ${error.message}`);
    return (data as ShortLinkRow[]) ?? [];
  },
  ["short_links"],
  { revalidate: TWELVE_HOURS_SECONDS, tags: [TAG_SHORT_LINKS] },
);
