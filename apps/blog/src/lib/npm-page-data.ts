import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { cache } from "react";

// Data source for the /npm page. Combines:
//   - plugins + plugin_daily_metrics from Supabase (per-package sparkline)
//   - lifetime per-package downloads from npm registry (12h cached)
//
// Single read path so the page server component stays presentational.

import "server-only";

const TWELVE_HOURS_SECONDS = 12 * 60 * 60;

// Plugins we no longer actively promote. Hardcoded for v1 — a `deprecated`
// column on the `plugins` table would be the right long-term fix.
const DEPRECATED = new Set<string>(["eslint-plugin-crypto"]);

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

// Lifetime per-package downloads. One npm-registry call per plugin, paced
// 250ms apart to stay under anonymous rate limits. ~10s wall-time on a
// cache miss, then 12h cached. Falls back to 0 on per-plugin failure.
const getCachedLifetimePerPackage = unstable_cache(
  async (
    plugins: ReadonlyArray<{ name: string }>,
  ): Promise<Record<string, number>> => {
    const today = new Date().toISOString().slice(0, 10);
    const out: Record<string, number> = {};
    for (let i = 0; i < plugins.length; i += 1) {
      if (i > 0) await new Promise((r) => setTimeout(r, 250));
      const name = plugins[i]!.name;
      try {
        const r = await fetch(
          `https://api.npmjs.org/downloads/range/2020-01-01:${today}/${encodeURIComponent(name)}`,
          {
            headers: {
              "User-Agent": "ofriperetz.dev/blog (/npm)",
              Accept: "application/json",
            },
            signal: AbortSignal.timeout(5_000),
          },
        );
        if (!r.ok) {
          out[name] = 0;
          continue;
        }
        const json = (await r.json()) as {
          downloads?: Array<{ downloads: number }>;
        };
        out[name] = (json.downloads ?? []).reduce(
          (sum, d) => sum + d.downloads,
          0,
        );
      } catch {
        out[name] = 0;
      }
    }
    return out;
  },
  ["npm-lifetime-per-package"],
  { revalidate: TWELVE_HOURS_SECONDS, tags: ["ratchet"] },
);

// Daily download history (last 30 days) per plugin, from Supabase.
const getCachedDailyHistory = unstable_cache(
  async (): Promise<{
    plugins: Array<{
      id: number;
      name: string;
      slug: string;
      category: string | null;
      description: string | null;
    }>;
    daily: Map<number, Array<{ day: string; downloads: number }>>;
  }> => {
    const empty = { plugins: [], daily: new Map() };
    const client = getClient();
    if (!client) return empty;

    const today = new Date();
    const thirtyAgo = new Date(today);
    thirtyAgo.setDate(thirtyAgo.getDate() - 30);
    const windowStart = thirtyAgo.toISOString().slice(0, 10);

    const { data: plugins, error: pErr } = await client
      .from("plugins")
      .select("id, name, slug, category, description");
    if (pErr || !plugins) {
      console.error("[npm-page-data] plugins:", pErr?.message);
      return empty;
    }

    const { data: rows, error: dErr } = await client
      .from("plugin_daily_metrics")
      .select("plugin_id, observed_on, npm_downloads_d1")
      .gte("observed_on", windowStart)
      .order("observed_on", { ascending: true });
    if (dErr) {
      console.error("[npm-page-data] daily:", dErr.message);
      return { plugins, daily: new Map() };
    }

    const daily = new Map<number, Array<{ day: string; downloads: number }>>();
    for (const row of rows ?? []) {
      const arr = daily.get(row.plugin_id) ?? [];
      arr.push({
        day: row.observed_on,
        downloads: row.npm_downloads_d1 ?? 0,
      });
      daily.set(row.plugin_id, arr);
    }
    return { plugins, daily };
  },
  ["npm-page-daily"],
  { revalidate: TWELVE_HOURS_SECONDS, tags: ["ratchet"] },
);

// Composed: per-package data ready to render.
export async function getNpmPagePackages(): Promise<NpmPagePackage[]> {
  const { plugins, daily } = await getCachedDailyHistory();
  if (plugins.length === 0) return [];

  const lifetimeByName = await getCachedLifetimePerPackage(
    plugins.map((p) => ({ name: p.name })),
  );

  const packages: NpmPagePackage[] = plugins
    .filter((p) => !DEPRECATED.has(p.name))
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
