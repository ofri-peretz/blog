/**
 * Live plugin stats for article cards — version + weekly downloads for
 * OUR packages, from the npm registry, into a committed cache
 * (src/data/plugin-stats.json).
 *
 * Articles cite these packages hundreds of times with numbers that go
 * stale the day they publish (a known integrity trap in this corpus);
 * the cards read from this cache so the numbers are the sync's, never
 * the author's memory.
 *
 * Advisory by design (the tweet-cache lesson): a package that fails to
 * fetch keeps its previous cached entry and warns — external registry
 * hiccups must never wedge a build or blank real data. Exit 1 only when
 * NOTHING could be fetched and no cache exists.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

/** Our published packages — the whitelist article detection trusts. */
export const OUR_PACKAGES = [
  "eslint-plugin-secure-coding",
  "eslint-plugin-browser-security",
  "eslint-plugin-node-security",
  "eslint-plugin-jwt",
  "eslint-plugin-express-security",
  "eslint-plugin-lambda-security",
  "eslint-plugin-mongodb-security",
  "eslint-plugin-nestjs-security",
  "eslint-plugin-vercel-ai-security",
  "eslint-plugin-pg",
  "eslint-plugin-maintainability",
  "eslint-plugin-reliability",
  "eslint-plugin-modernization",
  "eslint-plugin-conventions",
  "eslint-plugin-modularity",
  "eslint-plugin-operability",
  "eslint-plugin-react-a11y",
  "eslint-plugin-react-features",
  "eslint-plugin-import-next",
  "eslint-devkit",
];

const OUT = path.join("apps/blog/src/data/plugin-stats.json");

let previous = { plugins: {} };
try {
  previous = JSON.parse(readFileSync(OUT, "utf-8"));
} catch {
  /* first run */
}

const plugins = {};
let fetched = 0;
for (const pkg of OUR_PACKAGES) {
  try {
    const [metaRes, dlRes] = await Promise.all([
      fetch(`https://registry.npmjs.org/${pkg}/latest`),
      fetch(`https://api.npmjs.org/downloads/point/last-week/${pkg}`),
    ]);
    if (!metaRes.ok || !dlRes.ok) throw new Error(`${metaRes.status}/${dlRes.status}`);
    const meta = await metaRes.json();
    const dl = await dlRes.json();
    plugins[pkg] = { version: meta.version, weeklyDownloads: dl.downloads ?? 0 };
    fetched++;
  } catch (err) {
    console.warn(`::warning::${pkg}: ${err.message} — keeping cached entry`);
    if (previous.plugins?.[pkg]) plugins[pkg] = previous.plugins[pkg];
  }
}

if (fetched === 0 && Object.keys(plugins).length === 0) {
  console.error("nothing fetched and no cache — refusing to write empty stats");
  process.exit(1);
}

mkdirSync(path.dirname(OUT), { recursive: true });
writeFileSync(
  OUT,
  JSON.stringify({ generatedAt: new Date().toISOString().slice(0, 10), plugins }, null, 2) + "\n",
);
console.log(`${fetched}/${OUR_PACKAGES.length} fetched → ${OUT}`);
