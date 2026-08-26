/**
 * Live benchmark receipts for the "Inside our linter benchmarks"
 * series — the weekly public head-to-head's headline numbers, from the
 * eslint repo's committed result, into a committed cache
 * (src/data/bench-receipts.json).
 *
 * The series makes performance claims that would otherwise freeze the
 * day they publish. The eslint repo's Weekly Benchmark re-earns the
 * numbers every Monday and commits headline-bench.json to main; this
 * sync mirrors the trimmed shape the receipt card renders, so a claim
 * either re-earns its place weekly or visibly ages.
 *
 * Advisory by design (the tweet-cache lesson): a failed fetch keeps
 * the previous cache and warns — external hiccups must never wedge a
 * build or blank real data. Exit 1 only when nothing could be fetched
 * AND no cache exists.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const SOURCE =
  "https://raw.githubusercontent.com/ofri-peretz/eslint/main/apps/docs/src/data/headline-bench.json";
const SCHEMA = "ilb-headline-site/v1";
const OUT = path.join("apps/blog/src/data/bench-receipts.json");

let previous = null;
try {
  previous = JSON.parse(readFileSync(OUT, "utf-8"));
} catch {
  /* first run */
}

let next = null;
try {
  const res = await fetch(SOURCE);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data.schema !== SCHEMA) throw new Error(`schema ${data.schema} != ${SCHEMA}`);
  const rows = (data.rows ?? []).map((r) => ({
    key: r.key,
    label: r.label,
    coldMs: r.coldMs,
    warmMs: r.warmMs,
  }));
  if (rows.length < 2 || !rows.some((r) => r.key === "ours")) {
    throw new Error("rows incomplete — refusing a partial receipt");
  }
  for (const r of rows) {
    if (typeof r.coldMs !== "number" || typeof r.warmMs !== "number") {
      throw new Error(`row ${r.key} carries non-numeric timings`);
    }
  }
  // The receipt footer prints these by name — an upstream key rename
  // (e.g. eslint-version) would otherwise blank the field silently
  // (review). Reject the fetch and keep the cache instead.
  for (const key of ["eslint", "oxlint"]) {
    if (typeof data.versions?.[key] !== "string") {
      throw new Error(`versions.${key} missing — refusing a partial receipt`);
    }
  }
  next = {
    generatedAt: data.generatedAt,
    repo: data.repo,
    versions: data.versions,
    rows,
  };
} catch (err) {
  console.warn(`::warning::bench receipts: ${err.message} — keeping cache`);
}

if (!next && !previous) {
  console.error("nothing fetched and no cache — refusing to write empty receipts");
  process.exit(1);
}

mkdirSync(path.dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(next ?? previous, null, 2) + "\n");
console.log(`${next ? "fetched fresh" : "kept cached"} → ${OUT}`);
