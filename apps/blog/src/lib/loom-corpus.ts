// The Loom's corpus — every thread a visitor can weave, assembled
// server-side from the impact stack (Supabase) and cached.
//
// ## Why a curated catalog, not a raw table dump
//
// The impact stack holds internal series too (competitor intel, ingest
// health). The Loom is the PUBLIC ledger: each series here is chosen
// because it strengthens proof-of-work, reciprocity, or the domain
// story (impact-stack vision doc), and each carries its provenance —
// where the number comes from and how it was made. A series that would
// "just add a number" stays out — which is why metric_snapshots is read
// through an enumerated pick list, never a wildcard.
//
// ## Quota safety — the whole design
//
// Visitors never touch Supabase. `getCachedLoomCorpus` runs inside
// `unstable_cache` (12h TTL, tag `ratchet` — same channel as every
// other metrics read), so assembly hits Supabase at most twice a day
// regardless of traffic; readers get the Vercel Data Cache entry.
// Throw-on-missing-client rides `requireClient` for the same reason the
// other fetchers do: a rejected promise is never cached, an empty
// result cached for 12h is (the /npm lesson).
//
// ## npm series are weekly, the rest are daily
//
// ~30 packages × ~270 days of daily rows would put ~8k points in every
// page payload for strands whose story reads fine at week granularity —
// and downloads/week is npm's own headline unit. Weekly totals cut the
// payload ~7× and smooth single-day registry noise (`weeklyTotals` in
// loom-data.ts owns the partial-trailing-week rule). Small series
// (stars, views, PRs) stay daily — they are tiny and their day-scale
// texture is the story.

import "server-only";

import { unstable_cache } from "next/cache";

import {
  weeklyTotals,
  type LoomCorpus,
  type LoomGroup,
  type LoomSeries,
} from "./loom-data";
import {
  requireClient,
  TAG_RATCHET,
  TWELVE_HOURS_SECONDS,
} from "./supabase-data";

export type { LoomCorpus, LoomSeries } from "./loom-data";

/** First day the impact stack has history for. */
export const LOOM_EPOCH = "2025-12-01";

interface PluginDailyRow {
  plugin_id: number;
  observed_on: string;
  npm_downloads_d1: number | null;
}

/**
 * v_plugin_daily since the epoch — ~7k rows, over PostgREST's 1000-row
 * page, so this pages explicitly. Ordered on (observed_on, plugin_id)
 * both ascending: a stable total order is what makes `.range()` pages
 * non-overlapping.
 */
async function fetchPluginDaily(): Promise<PluginDailyRow[]> {
  const client = requireClient("loom plugin daily");
  const rows: PluginDailyRow[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await client
      .from("v_plugin_daily")
      .select("plugin_id, observed_on, npm_downloads_d1")
      .gte("observed_on", LOOM_EPOCH)
      .order("observed_on", { ascending: true })
      .order("plugin_id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`[loom-corpus] v_plugin_daily: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}

interface CreatorRow {
  platform: string;
  observed_on: string;
  followers: number | null;
  total_views: number | null;
  total_reactions: number | null;
}

interface SnapshotRow {
  source: string;
  kind: string;
  observed_on: string;
  value: number | null;
}

/**
 * The metric_snapshots picks. Sources/kinds are enumerated — the table
 * also holds internal series (intel, ingest health) that must never
 * ride into a public payload by accident.
 */
const SNAPSHOT_PICKS: ReadonlyArray<{
  source: string;
  kind: string;
  id: string;
  group: LoomGroup;
  label: string;
  unit: string;
  provenance: string;
}> = [
  {
    source: "posthog",
    kind: "page_views",
    id: "site:page-views",
    group: "site",
    label: "Site page views",
    unit: "views/day",
    provenance: "PostHog (aggregate, no personal data) · daily ingest",
  },
  {
    source: "github-contributions",
    kind: "prs_merged_total",
    id: "github:prs-merged",
    group: "github",
    label: "PRs merged (all repos)",
    unit: "PRs",
    provenance: "GitHub API · daily ingest",
  },
  {
    source: "github-contributions",
    kind: "external_prs_merged",
    id: "github:external-prs",
    group: "github",
    label: "PRs merged into others' repos",
    unit: "PRs",
    provenance: "GitHub API · daily ingest",
  },
  {
    source: "github-releases",
    kind: "releases_cumulative",
    id: "github:releases",
    group: "github",
    label: "Releases shipped",
    unit: "releases",
    provenance: "GitHub API · daily ingest",
  },
  {
    source: "devto-engagement",
    kind: "comments_left",
    id: "devto:comments-left",
    group: "devto",
    label: "Comments left on others' posts",
    unit: "comments",
    provenance: "DEV.to API · engagement log",
  },
  {
    source: "computed",
    kind: "downloads_per_star",
    id: "github:downloads-per-star",
    group: "github",
    label: "Downloads per star",
    unit: "downloads/star",
    provenance: "npm ÷ GitHub · computed at ingest",
  },
];

async function assembleLoomCorpus(): Promise<LoomCorpus> {
  const client = requireClient("loom corpus");

  const [pluginDaily, pluginsRes, creatorRes, snapshotRes] = await Promise.all([
    fetchPluginDaily(),
    client.from("plugins").select("id, name, deprecated"),
    client
      .from("creator_daily_metrics")
      .select("platform, observed_on, followers, total_views, total_reactions")
      .gte("observed_on", LOOM_EPOCH)
      .order("observed_on", { ascending: true }),
    client
      .from("metric_snapshots")
      .select("source, kind, observed_on, value")
      // Exact (source, kind) pairs, not a cross-product .in()×.in()
      // (review catch, CWE-284): the pairwise .or() makes the DB query
      // itself the enforcement boundary, so an internal series whose
      // source and kind each appear in the pick list — just in a
      // different combination — is never even fetched. The in-memory
      // pairwise filter below stays as the belt.
      .or(
        SNAPSHOT_PICKS.map(
          (p) => `and(source.eq.${p.source},kind.eq.${p.kind})`,
        ).join(","),
      )
      .order("observed_on", { ascending: true }),
  ]);
  if (pluginsRes.error) {
    throw new Error(`[loom-corpus] plugins: ${pluginsRes.error.message}`);
  }
  if (creatorRes.error) {
    throw new Error(`[loom-corpus] creator: ${creatorRes.error.message}`);
  }
  if (snapshotRes.error) {
    throw new Error(`[loom-corpus] snapshots: ${snapshotRes.error.message}`);
  }
  const plugins = (pluginsRes.data ?? []) as Array<{
    id: number;
    name: string;
    deprecated: boolean;
  }>;
  const creators = (creatorRes.data ?? []) as CreatorRow[];
  const snapshots = (snapshotRes.data ?? []) as SnapshotRow[];

  const observedThrough = [
    ...pluginDaily.map((r) => r.observed_on),
    ...creators.map((r) => r.observed_on),
    ...snapshots.map((r) => r.observed_on),
  ].reduce((a, b) => (a > b ? a : b), LOOM_EPOCH);

  // npm's weekly cutoff derives from npm's OWN newest row, never the
  // global max (review catch): a partial ingest — GitHub cron succeeds,
  // npm cron fails — pushes the global date past npm's data, and the
  // trailing npm week would stop being dropped, drawing the exact
  // Monday-morning cliff weeklyTotals exists to prevent.
  const npmObservedThrough = pluginDaily.reduce(
    (a, r) => (r.observed_on > a ? r.observed_on : a),
    LOOM_EPOCH,
  );

  const series: LoomSeries[] = [];

  // npm — the ecosystem total first, then each live package.
  const NPM_PROVENANCE = "npm registry · daily ingest, summed by week";
  const byPlugin = new Map<number, Array<{ day: string; value: number }>>();
  const totalByDay = new Map<string, number>();
  const live = new Map(
    plugins.filter((p) => !p.deprecated).map((p) => [p.id, p.name]),
  );
  for (const row of pluginDaily) {
    const value = row.npm_downloads_d1 ?? 0;
    // Deprecated packages still count in the ecosystem total (their
    // installs happened) but do not get their own thread.
    totalByDay.set(
      row.observed_on,
      (totalByDay.get(row.observed_on) ?? 0) + value,
    );
    if (!live.has(row.plugin_id)) continue;
    const arr = byPlugin.get(row.plugin_id) ?? [];
    arr.push({ day: row.observed_on, value });
    byPlugin.set(row.plugin_id, arr);
  }
  series.push({
    id: "npm:total",
    group: "npm",
    label: "All packages — npm downloads",
    unit: "downloads/week",
    points: weeklyTotals(
      [...totalByDay.entries()].map(([day, value]) => ({ day, value })),
      npmObservedThrough,
    ),
    provenance: NPM_PROVENANCE,
  });
  const packageSeries = [...byPlugin.entries()]
    .map(([id, daily]) => {
      const name = live.get(id) ?? String(id);
      // Scoped names URL-flatten: "@interlace/eslint-devkit" →
      // "interlace-eslint-devkit".
      const slug = name.replace(/^@/, "").replace(/\//g, "-");
      return {
        id: `npm:${slug}`,
        group: "npm" as const,
        label: name,
        unit: "downloads/week",
        points: weeklyTotals(daily, npmObservedThrough),
        provenance: NPM_PROVENANCE,
        recent: daily.slice(-28).reduce((s, d) => s + d.value, 0),
      };
    })
    // Busiest packages first — the chip list reads as a ranking.
    .sort((a, b) => b.recent - a.recent)
    .map(({ recent: _recent, ...s }) => s);
  series.push(...packageSeries);

  // Creator series — cumulative ledgers from the daily ingest.
  const creatorSeries = (
    [
      ["devto", "total_views", "devto:views", "Article views (DEV.to)", "views"],
      ["devto", "followers", "devto:followers", "Followers (DEV.to)", "followers"],
      [
        "devto",
        "total_reactions",
        "devto:reactions",
        "Reactions (DEV.to)",
        "reactions",
      ],
      ["github-repo", "followers", "github:stars", "GitHub stars", "stars"],
      ["github", "followers", "github:followers", "Followers (GitHub)", "followers"],
    ] as const
  ).map(([platform, col, id, label, unit]) => ({
    id,
    group: (id.startsWith("github") ? "github" : "devto") as LoomGroup,
    label,
    unit,
    points: creators
      .filter((r) => r.platform === platform && r[col] != null)
      .map((r) => ({ t: r.observed_on, v: r[col] })),
    provenance:
      platform === "devto"
        ? "DEV.to API · daily ingest"
        : "GitHub API · daily ingest",
  }));
  series.push(...creatorSeries);

  for (const pick of SNAPSHOT_PICKS) {
    series.push({
      id: pick.id,
      group: pick.group,
      label: pick.label,
      unit: pick.unit,
      points: snapshots
        .filter(
          (r) => r.source === pick.source && r.kind === pick.kind && r.value != null,
        )
        .map((r) => ({ t: r.observed_on, v: r.value })),
      provenance: pick.provenance,
    });
  }

  // A thread with fewer than two points cannot be drawn; shipping it
  // would render every chip as a possible dead end.
  return {
    observedThrough,
    series: series.filter((s) => s.points.length >= 2),
  };
}

export const getCachedLoomCorpus = unstable_cache(
  assembleLoomCorpus,
  ["loom-corpus"],
  { revalidate: TWELVE_HOURS_SECONDS, tags: [TAG_RATCHET] },
);
