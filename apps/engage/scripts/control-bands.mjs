#!/usr/bin/env node
/**
 * Stage 6 (Maintain) — the deterministic control-band watcher for the
 * engagement stack. Mirrors eslint/cadence/scripts/control-bands.ts.
 *
 * Reads .agent/control-bands.json, pulls each series from the running control
 * room, computes mean and σ over the baseline (the window minus its last 8
 * points), applies the Western Electric rules to those last 8 on the "worse"
 * side only, and writes the report to engagement/.cache/control-bands.json.
 *
 *   Rule 1  one point beyond 3σ                    → tier 3σ, act
 *   Rule 2  2 of 3 consecutive beyond 2σ           → tier 2σ, diagnose
 *   Rule 3  4 of 5 consecutive beyond 1σ           → tier 1σ, log
 *   Rule 4  8 consecutive on the worse side        → tier 1σ, log (drift)
 *
 * No model runs here. With --write-intents, a 2σ or 3σ breach writes
 * docs/sdlc/intents/<date>-control-band-<id>.intent.md in a fresh worktree of
 * this repo, pushes intent/control-band-<id>-<date>, and opens the PR. A human
 * accepts it. Usage:
 *   node scripts/control-bands.mjs                 # report
 *   node scripts/control-bands.mjs --write-intents # report + intent PRs on ≥2σ
 *   node scripts/control-bands.mjs --base http://localhost:7777
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, "..");
const args = process.argv.slice(2);
const BASE = args.includes("--base") ? args[args.indexOf("--base") + 1] : "http://localhost:7777";
const WRITE = args.includes("--write-intents");
const FOOTPRINT = process.env.FOOTPRINT_ROOT ?? join(process.env.HOME ?? "", "repos/ofriperetz.dev/agents/footprint");
const REPORT = join(FOOTPRINT, "engagement", ".cache", "control-bands.json");
const RECENT = 8;

export function evaluate(points, band, today = new Date().toISOString().slice(0, 10)) {
  // Today's row is a partial day (the analytics ingest writes it in the
  // morning); judging it against full days would breach every morning.
  const vals = points.filter((p) => String(p.t).slice(0, 10) < today).map((p) => p.v).filter((v) => Number.isFinite(v));
  const win = vals.slice(-band.window);
  if (win.length < band.minPoints || win.length <= RECENT) return { id: band.id, tier: null, reason: `only ${win.length} point(s), need ${Math.max(band.minPoints, RECENT + 1)}`, n: win.length };
  const base = win.slice(0, -RECENT);
  const recent = win.slice(-RECENT);
  const mean = base.reduce((s, v) => s + v, 0) / base.length;
  const sd = Math.sqrt(base.reduce((s, v) => s + (v - mean) ** 2, 0) / base.length) || 0;
  const worse = (v, k) => (band.worse === "lower" ? v < mean - k * sd : v > mean + k * sd);
  const beyond = (k) => recent.map((v) => (sd === 0 ? false : worse(v, k)));
  const r1 = beyond(3).some(Boolean);
  const r2 = beyond(2).some((_, i, a) => i >= 2 && a.slice(i - 2, i + 1).filter(Boolean).length >= 2);
  const r3 = beyond(1).some((_, i, a) => i >= 4 && a.slice(i - 4, i + 1).filter(Boolean).length >= 4);
  const r4 = recent.every((v) => (band.worse === "lower" ? v < mean : v > mean));
  const tier = r1 ? "3σ" : r2 ? "2σ" : r3 || r4 ? "1σ" : null;
  const rule = r1 ? 1 : r2 ? 2 : r3 ? 3 : r4 ? 4 : null;
  return { id: band.id, tier, rule, mean: +mean.toFixed(2), sd: +sd.toFixed(2), recent, last: recent[recent.length - 1], n: win.length, worse: band.worse };
}

async function main() {
  const cfg = JSON.parse(readFileSync(join(APP, ".agent", "control-bands.json"), "utf8"));
  const ids = cfg.bands.map((b) => b.id).join(",");
  const res = await fetch(`${BASE}/api/series?ids=${encodeURIComponent(ids)}&grain=day`);
  if (!res.ok) throw new Error(`/api/series → ${res.status}`);
  const data = await res.json();
  const series = new Map((data.series ?? []).map((s) => [s.id, s.points ?? []]));
  const results = cfg.bands.map((b) => evaluate(series.get(b.id) ?? [], b));
  const at = new Date().toISOString();
  mkdirSync(dirname(REPORT), { recursive: true });
  writeFileSync(REPORT, JSON.stringify({ at, results }, null, 2));
  for (const r of results) console.log(`${(r.tier ?? "ok").padEnd(4)} ${r.id.padEnd(28)} ${r.tier ? `rule ${r.rule} · last ${r.last} vs mean ${r.mean} ±${r.sd} (${r.worse} is worse)` : r.reason ?? `last ${r.last} vs mean ${r.mean} ±${r.sd}`}`);
  const breaches = results.filter((r) => r.tier === "2σ" || r.tier === "3σ");
  if (!WRITE || breaches.length === 0) return;
  const day = at.slice(0, 10);
  for (const r of breaches) {
    const slug = `${day}-control-band-${r.id.replace(/\./g, "-")}`;
    const branch = `intent/control-band-${r.id.replace(/\./g, "-")}-${day}`;
    const wt = join("/tmp", `blog-${branch.replace(/\//g, "-")}`);
    try {
      execSync(`git -C "${APP}" worktree add -q -B ${branch} "${wt}" origin/main`, { stdio: "pipe" });
      const f = join(wt, "docs", "sdlc", "intents", `${slug}.intent.md`);
      if (!existsSync(f)) {
        writeFileSync(f, `---\nkind: intent\nslug: ${slug}\nopened: ${day}\nstatus: open\n---\n\n# Intent: control band \`${r.id}\` breached at ${r.tier}\n\n## What\n\nBring \`${r.id}\` back inside its band, or accept the new level with a documented reason.\n\n## Why now\n\nWritten by \`scripts/control-bands.mjs\` on ${day}: rule ${r.rule}, last value ${r.last} against a baseline of ${r.mean} ± ${r.sd} over ${r.n} points; ${r.worse} is worse. Recent: ${r.recent.join(", ")}. No model decided this.\n\n## Constraints\n\nDiagnose before changing anything the band reads. A 2σ tier permits read-only diagnosis; only a human accepts a fix.\n\n## How we will know it worked\n\n| Signal | Now | Target |\n| --- | --- | --- |\n| \`${r.id}\` | ${r.last} | inside ${r.mean} ± 2σ for 7 consecutive days |\n\n## Not doing\n\nMoving the band's baseline to make the breach disappear.\n`);
        execSync(`git -C "${wt}" add docs/sdlc/intents && git -C "${wt}" commit -q -m "docs(sdlc): control band ${r.id} breached at ${r.tier} — intent written by the watcher" && git -C "${wt}" push -q -u origin ${branch}`, { stdio: "pipe" });
        execSync(`gh -R ofri-peretz/blog pr create --base main --head ${branch} --title "docs(sdlc): control band ${r.id} breached at ${r.tier}" --body "Written by scripts/control-bands.mjs. Rule ${r.rule}; last ${r.last} vs ${r.mean} ± ${r.sd}. A human accepts this intent."`, { stdio: "pipe" });
        console.log(`intent PR opened for ${r.id}`);
      }
    } catch (e) {
      console.error(`could not open the intent PR for ${r.id}: ${String(e?.message ?? e).slice(0, 200)}`);
    } finally {
      try { execSync(`git -C "${APP}" worktree remove --force "${wt}"`, { stdio: "pipe" }); } catch { /* best effort */ }
    }
  }
}

if (process.argv[1] && process.argv[1].endsWith("control-bands.mjs")) main().catch((e) => { console.error(e); process.exit(1); });
