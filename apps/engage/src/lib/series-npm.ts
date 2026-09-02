import "server-only";
import { registerLoader, registerSeries, sbPaged, type Point, type SeriesDef } from "@/lib/series";

/**
 * npm downloads per package — turning one headline number into the series that
 * answers which plugin is actually being adopted.
 *
 * Two decisions here are load-bearing and both are about not lying:
 *
 * 1. **d7, not d1.** Three defensible "per day" numbers exist for this data and
 *    they differ by ~4x (measured: d1 summed 1,784 · all-time delta 3,568 ·
 *    d7/7 7,131). npm's d1 lags and collapses at weekends, so a per-package d1
 *    chart reads as a cliff every Saturday for every package at once.
 *
 * 2. **d7 is a GAUGE, not a rate.** It is a rolling 7-day window, so
 *    consecutive days overlap by six sevenths. Summing seven of them into a
 *    weekly bucket would count most downloads seven times and report ~7x the
 *    real figure. `gauge` averages instead, which is the only aggregation that
 *    keeps the units meaning "downloads in the trailing week".
 */

/**
 * plugin_id → slug, measured from the `plugins` table on 2026-08-11.
 *
 * Hardcoded so the catalog is static and browsable rather than depending on a
 * network call at import time. `loadNpm` warns when the table contains an id
 * that is not here, because a newly published package that silently never
 * appears in the terminal is the failure this map would otherwise cause.
 *
 * All 36 carry data and `published: true` as of that date, including the two
 * deliberately-kept deprecated ones (pg, jwt).
 */
const PLUGINS: Record<number, string> = {
  1: "browser-security",
  2: "node-security",
  3: "secure-coding",
  4: "vercel-ai-security",
  5: "mongodb-security",
  6: "pg",
  7: "jwt",
  9: "lambda-security",
  10: "express-security",
  11: "nestjs-security",
  12: "import-next",
  13: "maintainability",
  14: "conventions",
  15: "reliability",
  16: "modularity",
  17: "operability",
  18: "modernization",
  19: "react-features",
  20: "react-a11y",
  21: "eslint-devkit",
  29: "serverless-iam-roles-per-function",
  30: "serverless-api-gateway-caching",
  31: "serverless-devkit",
  37: "jwt-security",
  38: "postgresql-security",
  39: "prisma-security",
  40: "drizzle-security",
  41: "typeorm-security",
  42: "sequelize-security",
  43: "knex-security",
  44: "mysql-security",
  45: "sqlite-security",
  46: "openai-security",
  47: "anthropic-security",
  48: "gemini-security",
  49: "mcp-sdk-security",
};

/**
 * The devkit is a dependency of our own plugins, so every plugin install also
 * counts as a devkit download. It is the single largest "package" by downloads
 * and none of it is external adoption.
 *
 * Measured 2026-08-11 on d7: 10,461 of 50,931 total = 20.5%. The 39% figure in
 * the planning docs does not reproduce on this metric — treat it as referring
 * to a different window or date, and re-measure before quoting either.
 */
const DEVKIT_ID = 21;

const WINDOW_DAYS = 90;

const id = (slug: string) => `npm.downloads.${slug}`;

const base = {
  group: "Distribution",
  unit: "count",
  kind: "gauge",
  goodDirection: "up",
  staleAfterHours: 36,
  source: "supabase:plugin_daily_metrics.npm_downloads_d7",
  caveat: "rolling 7-day window — overlapping, so it averages across buckets rather than summing",
} satisfies Omit<SeriesDef, "id" | "label">;

export const NPM_CATALOG: SeriesDef[] = [
  ...Object.values(PLUGINS).map((slug) => ({ ...base, id: id(slug), label: `${slug} (7d)` })),
  { ...base, id: id("total"), label: "all packages (7d)" },
  {
    ...base,
    id: id("excl_devkit"),
    label: "all packages excl. devkit (7d)",
    caveat:
      "total minus @interlace/eslint-devkit, which every plugin install pulls in — 20.5% of the total on 2026-08-11 and not external adoption",
  },
];

async function loadNpm(): Promise<Map<string, Point[]>> {
  // Bounded by DATE, not by row count.
  //
  // `order=observed_on.asc&limit=5000` looks like a generous cap and is not:
  // 36 packages x 90 days is 3,240 rows, but the table holds far more history,
  // so ascending order + a limit returns the OLDEST 5,000 rows. Measured, that
  // served January data with an August timestamp nowhere in sight — every
  // package charted, every number wrong, and nothing in the response saying so.
  //
  // And bounded by a PAGED read, because `limit=` alone does not bound it:
  // PostgREST caps the response at 1,000 rows and ignores anything larger, so
  // 36 packages x 90 days came back as the earliest 28 days with no error.
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - WINDOW_DAYS);
  const rows = await sbPaged(
    `plugin_daily_metrics?select=plugin_id,observed_on,npm_downloads_d7` +
      `&observed_on=gte.${since.toISOString().slice(0, 10)}` +
      `&order=observed_on.asc,plugin_id.asc`,
  );
  const out = new Map<string, Point[]>();
  if (!rows.length) return out;

  const unknown = new Set<number>();
  const perSlug = new Map<string, Map<string, number>>();
  const totals = new Map<string, number>();
  const exclDevkit = new Map<string, number>();

  for (const r of rows) {
    const pid = Number(r.plugin_id);
    const slug = PLUGINS[pid];
    if (!slug) {
      unknown.add(pid);
      continue;
    }
    const v = Number(r.npm_downloads_d7);
    if (!Number.isFinite(v)) continue;
    const t = String(r.observed_on).slice(0, 10);

    (perSlug.get(slug) ?? perSlug.set(slug, new Map()).get(slug)!).set(t, v);
    totals.set(t, (totals.get(t) ?? 0) + v);
    if (pid !== DEVKIT_ID) exclDevkit.set(t, (exclDevkit.get(t) ?? 0) + v);
  }

  for (const pid of unknown)
    console.warn(
      `[series-npm] plugin_id ${pid} has metrics but no slug in PLUGINS — add it to series-npm.ts or it will never appear in the terminal`,
    );

  const toPoints = (m: Map<string, number>): Point[] =>
    [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([t, v]) => ({ t, v }));

  for (const [slug, m] of perSlug) out.set(id(slug), toPoints(m));
  out.set(id("total"), toPoints(totals));
  out.set(id("excl_devkit"), toPoints(exclDevkit));
  return out;
}

registerSeries(NPM_CATALOG);
registerLoader("npm", loadNpm);
