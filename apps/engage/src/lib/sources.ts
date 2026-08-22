/**
 * Phases 5–7: the other data sources the control room has to see.
 *
 * All READ-ONLY. The impact pipeline is owned by the daily-ingest session; this
 * app must never write to it, or the two sessions overwrite each other's numbers
 * and neither can be trusted. Reads are safe and are what makes this a control
 * room rather than an engagement toy.
 */
import "server-only";
import { secret, FOOTPRINT } from "./footprint";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

/* ── Phase 7: impact (Supabase, read-only) ─────────────────────────────── */

export async function impact(): Promise<{
  rows: Record<string, unknown>[];
  error: string | null;
}> {
  const url = secret("SUPABASE_URL");
  const key = secret("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return { rows: [], error: "no Supabase credentials" };

  // Real view names, discovered from the PostgREST OpenAPI root rather than
  // guessed — the first three names this tried (impact_daily, impact_metrics,
  // north_star_daily) do not exist, and returned a confident empty panel.
  // `observed_on` is the date column, not `day`.
  const view = "creator_daily_metrics";
  try {
    const r = await fetch(
      `${url}/rest/v1/${view}?select=observed_on,platform,followers,posts,total_views,total_reactions,total_comments,followers_delta&order=observed_on.desc&limit=90`,
      {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        cache: "no-store",
      },
    );
    if (!r.ok) return { rows: [], error: `${view} HTTP ${r.status}` };
    const rows = await r.json();
    return { rows: Array.isArray(rows) ? rows : [], error: null };
  } catch (e) {
    return { rows: [], error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Commenters the ingest pipeline has already enriched (GitHub login, company,
 * follower count). This is the partnership data we were about to rebuild —
 * reading it instead of duplicating it is the whole point of the boundary.
 */
export async function commenters(): Promise<{
  rows: Record<string, unknown>[];
  error: string | null;
}> {
  const url = secret("SUPABASE_URL");
  const key = secret("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return { rows: [], error: "no Supabase credentials" };
  try {
    const r = await fetch(
      `${url}/rest/v1/article_commenters?select=devto_username,github_login,name,company,location,followers,public_repos,article_title&order=followers.desc&limit=100`,
      {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        cache: "no-store",
      },
    );
    if (!r.ok) return { rows: [], error: `HTTP ${r.status}` };
    return { rows: await r.json(), error: null };
  } catch (e) {
    return { rows: [], error: e instanceof Error ? e.message : String(e) };
  }
}

/* ── Phase 5: plugin FP/FN inbox ───────────────────────────────────────── */

export interface Finding {
  rule: string;
  file: string;
  line: number;
  message: string;
  severity: number;
}

/**
 * Runs our own plugins over the footprint scripts and returns the findings.
 * This is the dogfooding loop made visible: it already caught a real CWE-400 in
 * this app's own request handler.
 */
export function pluginFindings(): { findings: Finding[]; error: string | null } {
  const agents = join(FOOTPRINT, "..");
  if (!existsSync(join(agents, "eslint.config.mjs")))
    return { findings: [], error: "no eslint config" };
  try {
    const out = execFileSync(
      "npx",
      ["eslint", "footprint/scripts", "--format", "json"],
      { cwd: agents, encoding: "utf8", timeout: 180_000, maxBuffer: 32 * 1024 * 1024 },
    );
    return { findings: parseEslint(out), error: null };
  } catch (e: any) {
    // ESLint exits non-zero when it finds problems — that is the success path
    // here, not a failure, so the findings still have to be parsed out.
    const out = e?.stdout;
    if (typeof out === "string" && out.trim().startsWith("["))
      return { findings: parseEslint(out), error: null };
    return {
      findings: [],
      error: e instanceof Error ? e.message.slice(0, 200) : String(e),
    };
  }
}

function parseEslint(json: string): Finding[] {
  try {
    return (JSON.parse(json) as any[]).flatMap((f) =>
      (f.messages ?? [])
        .filter((m: any) => m.ruleId)
        .map((m: any) => ({
          rule: m.ruleId,
          file: String(f.filePath).split("/").slice(-2).join("/"),
          line: m.line,
          message: String(m.message).split("\n")[0].slice(0, 180),
          severity: m.severity,
        })),
    );
  } catch {
    return [];
  }
}

/* ── Site health (PostHog, read-only) ──────────────────────────────────── */

/**
 * One PostHog project (428927) serves every property, and each event carries an
 * `app` super-property naming its source. So every query here MUST group by
 * `app` — an ungrouped number silently sums six unrelated sites and reads as if
 * it described one of them. That exact mistake is already live elsewhere in the
 * stack, so it is worth stating twice.
 *
 * Credentials come from the footprint `.env` (`POSTHOG_API_KEY`,
 * `POSTHOG_PROJECT_ID`) like every other secret this app reads — no second
 * rotation point.
 */
/**
 * Exported for endpoints that need a one-off query (the journey map). Same
 * credentials, same project, same rule: group by `properties.app` or the number
 * is about six sites at once.
 */
export async function hogqlPublic(sql: string) {
  return hogql(sql);
}

async function hogql(
  sql: string,
): Promise<{ rows: any[][]; error: string | null }> {
  const key = secret("POSTHOG_API_KEY");
  const project = secret("POSTHOG_PROJECT_ID");
  if (!key || !project) return { rows: [], error: "no PostHog credentials" };
  try {
    const r = await fetch(
      `https://us.posthog.com/api/projects/${project}/query/`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${key}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ query: { kind: "HogQLQuery", query: sql } }),
        cache: "no-store",
      },
    );
    if (!r.ok) return { rows: [], error: `PostHog HTTP ${r.status}` };
    const j = await r.json();
    return { rows: Array.isArray(j?.results) ? j.results : [], error: null };
  } catch (e) {
    return { rows: [], error: e instanceof Error ? e.message : String(e) };
  }
}

export interface VitalsRow {
  app: string;
  samples: number;
  lcp: number | null;
  inp: number | null;
  cls: number | null;
  /** Google's Core Web Vitals verdict on the p75, the value they rank on. */
  verdict: "good" | "needs-improvement" | "poor";
}

/**
 * p75 Core Web Vitals per app — p75 rather than the mean because that is the
 * statistic Google actually ranks on, and a mean hides exactly the slow tail
 * that costs the ranking.
 *
 * Bots excluded: they render headlessly with no layout shift and would flatter
 * every number here.
 */
export async function siteVitals(): Promise<{
  rows: VitalsRow[];
  error: string | null;
}> {
  const { rows, error } = await hogql(`
    SELECT properties.app AS app,
           count() AS samples,
           quantile(0.75)(toFloat(properties.$web_vitals_LCP_value)) AS lcp,
           quantile(0.75)(toFloat(properties.$web_vitals_INP_value)) AS inp,
           quantile(0.75)(toFloat(properties.$web_vitals_CLS_value)) AS cls
    FROM events
    WHERE event = '$web_vitals'
      AND timestamp > now() - INTERVAL 7 DAY
      AND properties.$virt_is_bot != true
    GROUP BY app
    ORDER BY samples DESC
  `);
  if (error) return { rows: [], error };
  return {
    rows: rows.map(([app, samples, lcp, inp, cls]) => ({
      app: String(app ?? "(unattributed)"),
      samples: Number(samples ?? 0),
      lcp: num(lcp),
      inp: num(inp),
      cls: num(cls),
      verdict: verdict(num(lcp), num(inp), num(cls)),
    })),
    error: null,
  };
}

const num = (v: unknown): number | null =>
  v === null || v === undefined || Number.isNaN(Number(v)) ? null : Number(v);

/** Google's published CWV thresholds — LCP/INP in ms, CLS unitless. */
function verdict(
  lcp: number | null,
  inp: number | null,
  cls: number | null,
): VitalsRow["verdict"] {
  const poor = (lcp ?? 0) > 4000 || (inp ?? 0) > 500 || (cls ?? 0) > 0.25;
  if (poor) return "poor";
  const ni = (lcp ?? 0) > 2500 || (inp ?? 0) > 200 || (cls ?? 0) > 0.1;
  return ni ? "needs-improvement" : "good";
}

export interface ErrorRow {
  app: string;
  type: string;
  message: string;
  count: number;
  users: number;
  lastSeen: string;
}

/**
 * Unhandled exceptions per app, ranked by affected people rather than raw
 * count — one bug hitting 40 readers matters more than a retry loop firing 400
 * times at one of them, and ranking by count puts the loop on top every time.
 */
export async function siteErrors(): Promise<{
  rows: ErrorRow[];
  error: string | null;
}> {
  // The readable message lives inside the `$exception_list` JSON array, NOT in
  // a flat `$exception_message` property — that name does not exist, and a
  // query using it returns a full-looking table where every row says "unknown".
  // 30 days, not 7: exceptions here are rare enough that a weekly window is
  // routinely empty, which reads as "no errors" rather than "no data".
  const { rows, error } = await hogql(`
    SELECT properties.app AS app,
           properties.$exception_list[1].type AS etype,
           properties.$exception_list[1].value AS evalue,
           count() AS occurrences,
           count(DISTINCT person_id) AS users,
           max(timestamp) AS last_seen
    FROM events
    WHERE event = '$exception'
      AND timestamp > now() - INTERVAL 30 DAY
    GROUP BY app, etype, evalue
    ORDER BY users DESC, occurrences DESC
    LIMIT 25
  `);
  if (error) return { rows: [], error };
  return {
    rows: rows.map(([app, etype, evalue, occurrences, users, lastSeen]) => ({
      app: String(app ?? "(unattributed)"),
      type: String(etype ?? "Error"),
      message: String(evalue ?? "unknown").slice(0, 180),
      count: Number(occurrences ?? 0),
      users: Number(users ?? 0),
      lastSeen: String(lastSeen ?? ""),
    })),
    error: null,
  };
}

/* ── Audience clock (PostHog, read-only) ───────────────────────────────── */

export interface AudienceZone {
  /** IANA zone, e.g. "Asia/Singapore". The client resolves offsets from this. */
  tz: string;
  people: number;
  views: number;
}

export interface AudienceHour {
  /** 0–23, UTC. This is the axis the publisher actually controls. */
  utcHour: number;
  views: number;
  people: number;
}

/**
 * When the audience is awake, and when it is reading.
 *
 * Two separate things, and conflating them is the trap. Observed traffic tells
 * you when people DID read — which is partly just when things were published.
 * The zone weights tell you where the audience physically is, so the client can
 * derive when they are awake independent of what we happened to post. The chart
 * needs both to be honest: volume alone would recommend publishing at whatever
 * hour we already publish at.
 *
 * Offsets are deliberately NOT computed here. Server-side offset maths would
 * need a tz database and would get DST wrong at the edges; `Intl.DateTimeFormat`
 * in the browser already knows every zone and every DST rule. So we ship raw
 * IANA names and let the client resolve them.
 */
export async function audienceClock(): Promise<{
  hours: AudienceHour[];
  zones: AudienceZone[];
  error: string | null;
}> {
  // 90 days: long enough that 24 hourly buckets are not single-digit noise,
  // short enough to still describe the current audience.
  const window = "timestamp > now() - INTERVAL 90 DAY";

  // A reader is someone who viewed at least two pages. This is load-bearing,
  // not a tidy-up.
  //
  // PostHog's own `$virt_is_bot` catches almost none of the automated traffic
  // here: measured, Asia/Singapore presented as 249 distinct "people" on a
  // single browser (Chrome), 1.06 views each, spread over 175 paths — a
  // crawler fleet — and `$virt_is_bot` flagged 0 of them. Shanghai and Hong
  // Kong sat at exactly 1.00 views/person. Together those three zones were
  // ~46% of the raw audience weight and all sit in UTC+8, which would have
  // tilted the whole awake curve toward Asian business hours and produced a
  // confident, wrong publishing recommendation.
  //
  // The two-pageview floor drops Singapore from 249 readers to 8 and removes
  // Shanghai and Hong Kong from the top ranks entirely. Crawlers fetch a URL
  // once; people click through to a second page.
  const engaged = `
    person_id IN (
      SELECT person_id FROM events
      WHERE event = '$pageview' AND ${window}
      GROUP BY person_id HAVING count() >= 2
    )`;

  const [hourRes, zoneRes] = await Promise.all([
    hogql(`
      SELECT toHour(timestamp) AS utc_hour,
             count() AS views,
             count(DISTINCT person_id) AS people
      FROM events
      WHERE event = '$pageview' AND ${window} AND ${engaged}
      GROUP BY utc_hour
      ORDER BY utc_hour
    `),
    hogql(`
      SELECT properties.$geoip_time_zone AS tz,
             count(DISTINCT person_id) AS people,
             count() AS views
      FROM events
      WHERE event = '$pageview' AND ${window} AND ${engaged}
        AND properties.$geoip_time_zone != ''
      GROUP BY tz
      ORDER BY people DESC
      LIMIT 24
    `),
  ]);

  const error = hourRes.error ?? zoneRes.error;
  if (error) return { hours: [], zones: [], error };

  // Fill missing hours so the axis is always 24 wide — a gap in the SQL result
  // must render as a real zero, not as a narrower chart.
  const byHour = new Map<number, AudienceHour>();
  for (const [h, views, people] of hourRes.rows) {
    byHour.set(Number(h), {
      utcHour: Number(h),
      views: Number(views ?? 0),
      people: Number(people ?? 0),
    });
  }
  const hours = Array.from({ length: 24 }, (_, h) =>
    byHour.get(h) ?? { utcHour: h, views: 0, people: 0 },
  );

  return {
    hours,
    zones: zoneRes.rows.map(([tz, people, views]) => ({
      tz: String(tz),
      people: Number(people ?? 0),
      views: Number(views ?? 0),
    })),
    error: null,
  };
}

/* ── Phase 6: promotion (GitHub, read-only) ────────────────────────────── */

export async function promotion(): Promise<{
  prs: Record<string, unknown>[];
  error: string | null;
}> {
  const token = secret("GITHUB_TOKEN");
  if (!token) return { prs: [], error: "no GITHUB_TOKEN" };
  try {
    const r = await fetch(
      `https://api.github.com/search/issues?q=${encodeURIComponent(
        "author:ofri-peretz type:pr -user:ofri-peretz",
      )}&sort=updated&per_page=30`,
      {
        headers: {
          authorization: `Bearer ${token}`,
          accept: "application/vnd.github+json",
        },
        cache: "no-store",
      },
    );
    if (!r.ok) return { prs: [], error: `GitHub HTTP ${r.status}` };
    const j = await r.json();
    return {
      prs: (j.items ?? []).map((p: any) => ({
        title: p.title,
        url: p.html_url,
        repo: String(p.repository_url).split("/").slice(-2).join("/"),
        state: p.pull_request?.merged_at ? "merged" : p.state,
        updated: p.updated_at,
      })),
      error: null,
    };
  } catch (e) {
    return { prs: [], error: e instanceof Error ? e.message : String(e) };
  }
}

/* ── Ecosystem: npm downloads, coverage, plugin catalog ─────────────────── */

async function sb(path: string) {
  const url = secret("SUPABASE_URL");
  const key = secret("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("no Supabase credentials");
  const r = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

/**
 * Ecosystem totals + per-plugin download/coverage detail.
 *
 * Counts are read from the pipeline, never recomputed here. This repo has a
 * standing rule that generated manifests are the ONLY source for plugin/rule
 * counts, because hand-typed totals drifted (a published "497 rules" against a
 * real 409). A control room that re-derives them just adds a seventh place to
 * be wrong.
 */
export async function ecosystem(): Promise<{
  totals: Record<string, unknown> | null;
  plugins: Record<string, unknown>[];
  coverage: Record<string, unknown>[];
  error: string | null;
}> {
  try {
    const [eco, plugins, coverage, alltime] = await Promise.all([
      sb("ecosystem_daily_metrics?select=*&order=observed_on.desc&limit=90"),
      sb("plugin_daily_metrics?select=*&order=observed_on.desc&limit=400"),
      sb("coverage_snapshots?select=*&order=observed_on.desc&limit=60").catch(
        () => [],
      ),
      sb("npm_alltime_downloads?select=alltime_total,measured_on").catch(() => []),
    ]);

    // All-time downloads come from `npm_alltime_downloads`, NOT from
    // `ecosystem_daily_metrics.total_npm_downloads`. That column read 283,360
    // while the dedicated table summed 360,361 on the same day — ~77K adrift,
    // and low enough to look plausible. It is the accumulator table because
    // npm's /downloads/point/ silently truncates long ranges, so all-time cannot
    // be fetched in one call and has to be carried forward.
    const totals =
      Array.isArray(eco) && eco.length ? { ...eco[0] } : ({} as any);
    if (Array.isArray(alltime) && alltime.length) {
      const day = alltime
        .map((r: any) => r.measured_on)
        .sort()
        .pop();
      totals.total_npm_downloads = alltime
        .filter((r: any) => r.measured_on === day)
        .reduce((s: number, r: any) => s + (r.alltime_total ?? 0), 0);
      totals.npm_source = `npm_alltime_downloads @ ${day}`;

      // "Per day" needs stating, because three defensible numbers exist and they
      // differ by 4x:
      //   npm_downloads_d1 summed  = 1,784  (npm's single-day count: lags, and
      //                                      collapses at weekends)
      //   all-time delta over 24h  = 3,568
      //   npm_downloads_d7 / 7     = 7,131  (rolling weekly average)
      //
      // The d7 average is the headline because npm daily counts swing hard
      // between weekday CI traffic and weekends — any single-day figure reads as
      // wrong on most days. The raw d1 is kept alongside it so the two are never
      // confused for each other.
      //
      // NOTE: an earlier pass called the repeated 1,784 a stale carried-forward
      // write. That was wrong — it is a genuine sum of per-plugin d1 values, and
      // npm's own d1 legitimately repeats across days.
    }

    return {
      totals: Object.keys(totals).length ? totals : null,
      plugins: Array.isArray(plugins) ? plugins : [],
      coverage: Array.isArray(coverage) ? coverage : [],
      error: null,
    };
  } catch (e) {
    return {
      totals: null,
      plugins: [],
      coverage: [],
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/* ── PR board: what is actually waiting on us ───────────────────────────── */

export interface Board {
  title: string;
  url: string;
  repo: string;
  number: number;
  state: string;
  updated: string;
  /** Ours to move, vs waiting on the maintainer. */
  actionRequired: boolean;
  reason: string;
}

/**
 * A PR list is not a board. The question that matters is "is this one mine to
 * move?", so each PR is classified by mergeability and review state rather than
 * just open/closed — a conflicted PR and a PR awaiting maintainer review look
 * identical in a plain list and demand completely different things.
 */
export async function prBoard(): Promise<{ prs: Board[]; error: string | null }> {
  const token = secret("GITHUB_TOKEN");
  if (!token) return { prs: [], error: "no GITHUB_TOKEN" };
  const gh = async (u: string) => {
    const r = await fetch(u, {
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/vnd.github+json",
      },
      cache: "no-store",
    });
    if (!r.ok) throw new Error(`GitHub HTTP ${r.status}`);
    return r.json();
  };
  try {
    const search = await gh(
      `https://api.github.com/search/issues?q=${encodeURIComponent(
        "author:ofri-peretz type:pr state:open",
      )}&sort=updated&per_page=25`,
    );
    const prs: Board[] = [];
    for (const it of search.items ?? []) {
      const repo = String(it.repository_url).split("/").slice(-2).join("/");
      let actionRequired = false;
      let reason = "waiting on maintainer";
      try {
        const d = await gh(
          `https://api.github.com/repos/${repo}/pulls/${it.number}`,
        );
        if (d.mergeable_state === "dirty") {
          actionRequired = true;
          reason = "merge conflict — rebase needed";
        } else if (d.mergeable_state === "behind") {
          actionRequired = true;
          reason = "branch behind base";
        } else if (it.draft) {
          actionRequired = true;
          reason = "still a draft";
        }
      } catch {
        reason = "state unavailable";
      }
      prs.push({
        title: it.title,
        url: it.html_url,
        repo,
        number: it.number,
        state: it.draft ? "draft" : "open",
        updated: it.updated_at,
        actionRequired,
        reason,
      });
    }
    prs.sort((a, b) => Number(b.actionRequired) - Number(a.actionRequired));
    return { prs, error: null };
  } catch (e) {
    return { prs: [], error: e instanceof Error ? e.message : String(e) };
  }
}

export type RuleEntry = {
  id: string;
  prefix: string;
  rule: string;
  plugin: string;
  description: string | null;
  cwe: string | null;
  cvss: number | null;
  confidence: string | null;
  type: string | null;
  fixable: boolean;
  hasSuggestions: boolean;
  deprecated: boolean;
  recommended: "error" | "warn" | null;
  docsUrl: string | null;
  corpusFindings: number | null;
  budgetReason: string | null;
  seal: {
    axesMet: number;
    axesTotal: number;
    status: string;
    knownGaps: number;
  } | null;
};

/**
 * Every rule we ship, with the evidence we have about each one.
 *
 * Read from `origin/main` of the eslint checkout rather than the working tree,
 * on the same reasoning as `ruleCounts()` in /api/plugins: a local branch
 * mid-edit is not what users have installed, and the control room should show
 * what shipped.
 *
 * Returns `error` rather than throwing, and an EMPTY rule list rather than a
 * partial one. A half-loaded manifest rendered as "we ship 12 rules" is worse
 * than an outage, because it looks like an answer.
 */
export async function rules(): Promise<{
  generatedAt: string | null;
  totals: Record<string, number> | null;
  rules: RuleEntry[];
  error: string | null;
}> {
  const repo = join(process.env.HOME ?? "", "repos/ofriperetz.dev/eslint");
  const empty = { generatedAt: null, totals: null, rules: [], error: null as string | null };
  if (!existsSync(repo)) return { ...empty, error: "eslint checkout not found" };
  try {
    const raw = execFileSync(
      "git",
      ["show", "origin/main:apps/docs/src/data/rules-manifest.json"],
      { cwd: repo, encoding: "utf8", timeout: 20_000, maxBuffer: 16 * 1024 * 1024 },
    );
    const parsed = JSON.parse(raw) as {
      generatedAt?: string;
      totals?: Record<string, number>;
      rules?: RuleEntry[];
    };
    return {
      generatedAt: parsed.generatedAt ?? null,
      totals: parsed.totals ?? null,
      rules: Array.isArray(parsed.rules) ? parsed.rules : [],
      error: null,
    };
  } catch (e) {
    return { ...empty, error: e instanceof Error ? e.message : "unreadable manifest" };
  }
}
