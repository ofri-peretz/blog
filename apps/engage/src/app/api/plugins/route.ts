import { NextResponse } from "next/server";
import { secret } from "@/lib/footprint";
import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

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
 * Per-plugin detail: catalog + latest downloads + latest coverage, joined on
 * plugin_id, with direct npm / GitHub / docs links so nothing has to be hunted
 * for.
 *
 * Each metrics table carries one row per plugin per DAY, so rows are reduced to
 * the latest `observed_on` per plugin. Taking the first row back instead would
 * silently mix today's number for one plugin with last week's for another, and
 * the totals would stop reconciling with the ecosystem panel for reasons nobody
 * could see.
 */
/**
 * Rule counts, read from `origin/main` rather than from Supabase or the working tree.
 *
 * Two traps, both hit:
 *
 * 1. `plugin_daily_metrics.rule_count` is NULL for every plugin — the ingest
 *    never writes it. So Supabase cannot answer this.
 * 2. The eslint checkout usually has a feature branch checked out with several
 *    concurrent worktrees in flight, so the on-disk `plugin-stats.json` is
 *    whatever that branch last generated. Reading it returned a file 3 weeks
 *    stale (459 rules) while main said 466 — and nothing about that was visible.
 *
 * `origin/main` is what the docs site actually publishes, so that is the number
 * the control room must agree with. Do NOT re-derive counts here: the generator
 * de-duplicates rules registered twice under an alias id, and every hand-rolled
 * recount (regex, directory listing, `Object.keys`) has produced a different
 * wrong answer.
 *
 * Returns an empty map on any failure — a missing count must stay null and
 * render as "—", never as 0.
 */
function ruleCounts(): { byName: Map<string, number>; at: string | null } {
  const repo = join(process.env.HOME ?? "", "repos/ofriperetz.dev/eslint");
  const byName = new Map<string, number>();
  if (!existsSync(repo)) return { byName, at: null };
  try {
    const raw = execFileSync(
      "git",
      ["show", "origin/main:apps/docs/src/data/plugin-stats.json"],
      { cwd: repo, encoding: "utf8", timeout: 15_000, maxBuffer: 4 * 1024 * 1024 },
    );
    const j = JSON.parse(raw);
    for (const p of j.plugins ?? [])
      if (typeof p.rules === "number") byName.set(p.name, p.rules);
    return { byName, at: j.generatedAt ?? null };
  } catch {
    return { byName, at: null };
  }
}

export async function GET() {
  try {
    const [plugins, metrics, coverage] = await Promise.all([
      sb("plugins?select=id,name,slug,category,description,deprecated"),
      sb("plugin_daily_metrics?select=*&order=observed_on.desc&limit=1000"),
      sb("coverage_snapshots?select=*&order=observed_on.desc&limit=1000"),
    ]);

    const latest = (rows: any[]) => {
      const m = new Map<number, any>();
      for (const r of rows) {
        const cur = m.get(r.plugin_id);
        if (!cur || r.observed_on > cur.observed_on) m.set(r.plugin_id, r);
      }
      return m;
    };
    const { byName, at: rulesGeneratedAt } = ruleCounts();
    const mByPlugin = latest(metrics as any[]);
    const cByPlugin = latest(coverage as any[]);

    const rows = (plugins as any[])
      .map((p) => {
        const m: any = mByPlugin.get(p.id) ?? {};
        const c: any = cByPlugin.get(p.id) ?? {};
        return {
          id: p.id,
          name: p.name,
          slug: p.slug,
          category: p.category,
          description: p.description,
          deprecated: p.deprecated,
          // Real column names, read from the table rather than guessed. An
          // earlier pass invented weekly_downloads/downloads/last_week and every
          // one resolved to undefined, which rendered as a confident "—".
          d1: m.npm_downloads_d1 ?? null,
          weeklyDownloads: m.npm_downloads_d7 ?? null,
          monthlyDownloads: m.npm_downloads_d30 ?? null,
          version: m.npm_version ?? null,
          stars: m.github_stars ?? null,
          rules: m.rule_count ?? byName.get(p.name) ?? null,
          published: m.published ?? null,
          observedOn: m.observed_on ?? null,
          coveragePct: c.coverage_pct ?? null,
          totalLines: c.total_lines ?? null,
          coveredLines: c.covered_lines ?? null,
          status: c.status ?? null,
          npm: `https://www.npmjs.com/package/${p.name}`,
          github: `https://github.com/ofri-peretz/eslint/tree/main/packages/${p.name}`,
          docs: `https://eslint.interlace.tools/docs/plugins/${p.slug}`,
        };
      })
      .sort((a, b) => (b.weeklyDownloads ?? 0) - (a.weeklyDownloads ?? 0));

    const rulesKnown = rows.filter((r) => r.rules != null).length;
    const totals = {
      count: rows.length,
      // Only meaningful if the pipeline actually populated rule_count. Summing
      // nulls as zero would publish a confident undercount, and the ecosystem
      // baseline already has a history of an inflated rule number in the wild.
      totalRules: rulesKnown ? rows.reduce((s, r) => s + (r.rules ?? 0), 0) : null,
      rulesKnown,
      rulesGeneratedAt,
      d1: rows.reduce((s, r) => s + (r.d1 ?? 0), 0),
      d7: rows.reduce((s, r) => s + (r.weeklyDownloads ?? 0), 0),
      totalLines: rows.reduce((s, r) => s + (r.totalLines ?? 0), 0),
      coveredLines: rows.reduce((s, r) => s + (r.coveredLines ?? 0), 0),
    };

    /**
     * The four-way split (lines / statements / functions / branches) is NOT in
     * Supabase — `coverage_snapshots` carries a single `coverage_pct`. It comes
     * from a coverage run's summary file, so when that file is absent this
     * reports the absence instead of deriving four numbers from the one
     * percentage it has, which would be four copies of the same claim wearing
     * different labels.
     */
    const summaryPath = join(
      process.env.HOME ?? "",
      "repos/ofriperetz.dev/eslint/coverage/coverage-summary.json",
    );
    let fourWay: Record<string, number | null> | null = null;
    if (existsSync(summaryPath)) {
      try {
        const t = JSON.parse(readFileSync(summaryPath, "utf8")).total ?? {};
        fourWay = {
          lines: t.lines?.pct ?? null,
          statements: t.statements?.pct ?? null,
          functions: t.functions?.pct ?? null,
          branches: t.branches?.pct ?? null,
        };
      } catch {
        fourWay = null;
      }
    }

    return NextResponse.json({
      plugins: rows,
      totals,
      fourWay,
      fourWayHint: fourWay
        ? null
        : "Run `npm run test:coverage` in eslint/ to populate lines/statements/functions/branches — Supabase stores only a single coverage_pct.",
      error: null,
    });
  } catch (e) {
    return NextResponse.json({
      plugins: [],
      totals: null,
      fourWay: null,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}
