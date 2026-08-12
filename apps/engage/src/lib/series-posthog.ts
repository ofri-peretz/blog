import "server-only";
import { hogqlPublic } from "@/lib/sources";
import { registerLoader, registerSeries, type Point, type SeriesDef } from "@/lib/series";

/**
 * PostHog as series — the whole Quality group, which existed nowhere in the
 * terminal because vitals, exceptions and sessions live only here.
 *
 * The governing rule, and the reason every id ends in an app name: ONE PostHog
 * project (428927) serves every property, and an ungrouped query silently sums
 * six unrelated sites. That exact defect is live elsewhere in this stack — a
 * cumulative page-view metric labelled "docs-site" that actually counts all six
 * — so there is no un-scoped variant of any series here. If you want a total,
 * add the app series together on the chart, where the composition is visible.
 */

/**
 * The six properties, measured 2026-08-11 over a 90-day window rather than
 * copied from a config:
 *
 *   blog 20,901 · eslint_docs 5,468 · ds 281 · interlace-landing 208 ·
 *   serverless_docs 147 · ds_storybook 27 · (null) 4
 *
 * Hardcoded so the catalog stays static and browsable. `loadPostHog` warns when
 * PostHog returns an app that is not in this list, because a new property that
 * silently never appears in the terminal is the same class of failure as a
 * scheduler that stops without saying so.
 */
const APPS = [
  "blog",
  "eslint_docs",
  "ds",
  "interlace-landing",
  "serverless_docs",
  "ds_storybook",
] as const;

/**
 * `$virt_is_bot` is filtered on traffic series, but it is NOT a solution and
 * must not be presented as one: measured on this project it flagged 0 of a
 * 249-"person" single-browser crawler fleet out of Singapore. The honest
 * audience number is the engaged-reader definition in sources.ts (>=2
 * pageviews); these series are raw traffic and say so on the chart.
 */
const BOT_CAVEAT =
  "raw traffic; $virt_is_bot is measured to catch almost none of the crawler load on this project — see the audience clock for the engaged-reader number";

type MetricSpec = Pick<
  SeriesDef,
  "unit" | "kind" | "goodDirection" | "staleAfterHours"
> & { key: string; label: string; caveat?: string };

const METRICS: MetricSpec[] = [
  { key: "pageviews", label: "page views", unit: "count", kind: "rate", goodDirection: "up", staleAfterHours: 36, caveat: BOT_CAVEAT },
  { key: "sessions", label: "sessions", unit: "count", kind: "rate", goodDirection: "up", staleAfterHours: 36, caveat: BOT_CAVEAT },
  { key: "exceptions", label: "exceptions", unit: "count", kind: "rate", goodDirection: "down", staleAfterHours: 36 },
  { key: "vitals.lcp", label: "LCP p75", unit: "ms", kind: "gauge", goodDirection: "down", staleAfterHours: 48 },
  { key: "vitals.inp", label: "INP p75", unit: "ms", kind: "gauge", goodDirection: "down", staleAfterHours: 48 },
  { key: "vitals.cls", label: "CLS p75", unit: "ratio", kind: "gauge", goodDirection: "down", staleAfterHours: 48 },
];

export const id = (metric: string, app: string) => `posthog.${metric}.${app}`;

/** 36 entries, generated rather than typed out, so the two lists stay the spec. */
export const POSTHOG_CATALOG: SeriesDef[] = APPS.flatMap((app) =>
  METRICS.map((m) => ({
    id: id(m.key, app),
    label: `${m.label} — ${app}`,
    group: m.key.startsWith("vitals") || m.key === "exceptions" ? "Quality" : "Site",
    unit: m.unit,
    kind: m.kind,
    goodDirection: m.goodDirection,
    staleAfterHours: m.staleAfterHours,
    source: `posthog:${m.key}`,
    caveat: m.caveat,
  })),
);

const WINDOW_DAYS = 90;

/**
 * Every day from the window start up to the INGEST FRONTIER — the most recent
 * day on which PostHog recorded anything at all, across every app.
 *
 * Padding to *today* instead is a trap that took a live measurement to catch:
 * it stamps every count series with `asOf = today` no matter how long ingest
 * has been dead, so `stale` can never fire and the last point on every chart is
 * a zero nobody observed. That silently defeats the whole staleness feature.
 *
 * The frontier is the honest boundary. Inside it, a missing day for one app is
 * a real zero (that app was quiet while others were not). Beyond it, nobody
 * reported anything, so there is no data — and the series ends there, ages, and
 * goes stale like it should.
 */
function calendar(frontier: string | null): string[] {
  if (!frontier) return [];
  const end = new Date(frontier + "T00:00:00Z");
  const out: string[] = [];
  for (let i = WINDOW_DAYS - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setUTCDate(d.getUTCDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

/**
 * Fill the gaps — but only for counts.
 *
 * A day with no pageviews genuinely IS zero, and leaving the gap makes a quiet
 * site look like a broken ingest: its last point recedes and the staleness rule
 * fires on a site that is merely quiet. `ds_storybook` at 27 events over 90 days
 * would be permanently "stale" without this.
 *
 * A day with no web-vitals samples is the opposite: there is no p75 of nothing.
 * Filling it with 0 would draw a perfect 0ms LCP — the best possible score —
 * out of an absence of data. Gauges keep their gaps.
 */
function densify(points: Map<string, number>, days: string[]): Point[] {
  return days.map((t) => ({ t, v: points.get(t) ?? 0 }));
}

function sparse(points: Map<string, number>): Point[] {
  return [...points.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([t, v]) => ({ t, v }));
}

const known = new Set<string>(APPS);

function warnUnknown(rows: unknown[][], where: string): void {
  const seen = new Set<string>();
  for (const r of rows) {
    const app = r[1] === null || r[1] === undefined ? "(unattributed)" : String(r[1]);
    if (!known.has(app) && !seen.has(app)) {
      seen.add(app);
      console.warn(
        `[series-posthog] ${where}: app "${app}" has events but no catalog entry — add it to APPS in series-posthog.ts or it will never appear in the terminal`,
      );
    }
  }
}

/**
 * HogQL applies its own default LIMIT when the query does not state one, and
 * it applies it AFTER the GROUP BY. With `ORDER BY d` ascending that keeps the
 * OLDEST rows: measured, the blog series ended 2026-07-31 while PostHog had
 * events through 08-10, and the frontier logic then dutifully aged the whole
 * thing to "stale" — a correct-looking verdict computed from a truncated read.
 *
 * 6 apps x 90 days is 540 rows, so this ceiling is ~18x headroom and any
 * approach to it means the grouping changed.
 */
const ROW_CAP = 10_000;

async function loadPostHog(): Promise<Map<string, Point[]>> {
  const out = new Map<string, Point[]>();
  const window = `timestamp > now() - INTERVAL ${WINDOW_DAYS} DAY`;

  /*
   * Retry 5xx and 429. PostHog answered `HTTP 504` mid-session and the whole
   * Quality group vanished from the terminal for that refresh — six apps x four
   * series, gone, because one gateway timed out. A timeout is not an answer.
   */
  const hog = async (sql: string, label: string) => {
    let last: Awaited<ReturnType<typeof hogqlPublic>> = { rows: [], error: "unrun" };
    for (let n = 0; n < 3; n++) {
      last = await hogqlPublic(sql);
      if (!last.error) return last;
      const retryable = /HTTP (429|5\d\d)/.test(last.error);
      if (!retryable) break;
      console.warn(`[series-posthog] ${label} ${last.error}, retry ${n + 1}/2`);
      await new Promise((r) => setTimeout(r, 1500 * (n + 1)));
    }
    return last;
  };

  const [traffic, errors, vitals] = await Promise.all([
    hog(`
      SELECT toDate(timestamp) AS d, properties.app AS app,
             count() AS views, uniq(properties.$session_id) AS sessions
      FROM events
      WHERE event = '$pageview' AND ${window} AND properties.$virt_is_bot != true
      GROUP BY d, app ORDER BY d LIMIT ${ROW_CAP}
    `, "traffic"),
    hog(`
      SELECT toDate(timestamp) AS d, properties.app AS app, count() AS n
      FROM events
      WHERE event = '$exception' AND ${window}
      GROUP BY d, app ORDER BY d LIMIT ${ROW_CAP}
    `, "exceptions"),
    hog(`
      SELECT toDate(timestamp) AS d, properties.app AS app,
             quantile(0.75)(toFloat(properties.$web_vitals_LCP_value)) AS lcp,
             quantile(0.75)(toFloat(properties.$web_vitals_INP_value)) AS inp,
             quantile(0.75)(toFloat(properties.$web_vitals_CLS_value)) AS cls
      FROM events
      WHERE event = '$web_vitals' AND ${window} AND properties.$virt_is_bot != true
      GROUP BY d, app ORDER BY d LIMIT ${ROW_CAP}
    `, "vitals"),
  ]);

  // A failed query must not masquerade as a site with no traffic. Returning an
  // empty map leaves the series absent, which the route reports as stale rather
  // than as a confident flat zero.
  for (const [name, r] of [
    ["traffic", traffic],
    ["exceptions", errors],
    ["vitals", vitals],
  ] as const) {
    if (r.error) {
      console.error(`[series-posthog] ${name} query failed: ${r.error}`);
      return out;
    }
  }

  warnUnknown(traffic.rows, "pageviews");
  warnUnknown(errors.rows, "exceptions");
  warnUnknown(vitals.rows, "vitals");

  const day = (v: unknown) => String(v).slice(0, 10);
  const num = (v: unknown) => (v == null || Number.isNaN(Number(v)) ? null : Number(v));

  const maxKey = (...ms: Map<string, number>[]): string | null => {
    let max: string | null = null;
    for (const m of ms) for (const t of m.keys()) if (!max || t > max) max = t;
    return max;
  };

  for (const app of APPS) {
    const views = new Map<string, number>();
    const sessions = new Map<string, number>();
    for (const [d, a, v, s] of traffic.rows) {
      if (String(a) !== app) continue;
      views.set(day(d), Number(v ?? 0));
      sessions.set(day(d), Number(s ?? 0));
    }
    const exc = new Map<string, number>();
    for (const [d, a, n] of errors.rows) {
      if (String(a) !== app) continue;
      exc.set(day(d), Number(n ?? 0));
    }

    // Each app gets its OWN frontier, from its own last recorded event.
    //
    // A shared frontier across all six would let a dead property inherit a live
    // one's freshness: blog stops on the 10th, ds keeps reporting on the 11th,
    // and blog gets a zero on the 11th that makes it look current. That is the
    // same neighbour-inherits-freshness bug the per-series asOf change fixed at
    // the spine, reintroduced one layer down.
    //
    // Exceptions do not extend the frontier on their own — a property with zero
    // traffic and zero errors is quiet, not reporting.
    const days = calendar(maxKey(views, sessions, exc));
    out.set(id("pageviews", app), densify(views, days));
    out.set(id("sessions", app), densify(sessions, days));
    out.set(id("exceptions", app), densify(exc, days));

    const lcp = new Map<string, number>();
    const inp = new Map<string, number>();
    const cls = new Map<string, number>();
    for (const [d, a, l, i, c] of vitals.rows) {
      if (String(a) !== app) continue;
      const t = day(d);
      const nl = num(l), ni = num(i), nc = num(c);
      if (nl !== null) lcp.set(t, nl);
      if (ni !== null) inp.set(t, ni);
      if (nc !== null) cls.set(t, nc);
    }
    out.set(id("vitals.lcp", app), sparse(lcp));
    out.set(id("vitals.inp", app), sparse(inp));
    out.set(id("vitals.cls", app), sparse(cls));
  }

  return out;
}

registerSeries(POSTHOG_CATALOG);
registerLoader("posthog", loadPostHog);
