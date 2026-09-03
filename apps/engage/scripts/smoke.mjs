#!/usr/bin/env node
/**
 * Route smoke check.
 *
 * The control room has no test suite and does not need one — it is a local
 * instrument, not a product. What it does need is a check that fails loudly if
 * a refactor stops a route rendering, because "the page is blank" is exactly
 * the failure mode a design-system migration produces, and exactly the one that
 * stays invisible until you happen to open that route.
 *
 * Run:
 *   npm run smoke                                   (boots its own dev server)
 *   npm run smoke -- --base http://localhost:7777   (against a running one)
 */

import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';

/**
 * Every route is a client component, so the server-rendered body is the
 * LOADING shell for the data-driven ones. That is still a real assertion: each
 * route reserves a different `<Skeleton variant>`, so a route that stops
 * rendering — or that loses its loading state — fails here.
 */
const ROUTES = [
  { path: '/', mustContain: ['Engage', 'control room', 'data-slot="stat-strip"'] },
  { path: '/queue', mustContain: ['data-variant="data-table"'] },
  { path: '/calendar', mustContain: ['data-variant="meter"'] },
  { path: '/releases', mustContain: ['data-slot="skeleton-group"'] },
  { path: '/raw', mustContain: ['Raw data', 'refetch'] },
  { path: '/journeys', mustContain: ['Journeys', 'data-variant="stat-strip"'] },
  /**
   * The terminal and the conquest map predate the DS and were the last two
   * pages still written in the forked palette. They were ported to DS tokens in
   * one 102-site sweep, which is exactly the change this file exists to catch:
   * a page that stops rendering, or renders with nothing on it, after a styling
   * migration. They were absent from this list while that sweep ran — the
   * routes most likely to break were the ones nothing checked.
   *
   * Asserted on structural markers rather than colour, because the failure mode
   * is a blank page, and no assertion on a hex value would survive a theme
   * switch.
   */
  { path: '/terminal', mustContain: ['Terminal'] },
  { path: '/conquest', mustContain: ['Conquest'] },
  /**
   * The customer monitor was drafted in the forked palette before the DS
   * landed and ported afterwards, so it is the third page this list exists
   * for. Its loading shell is the adoption `<StatStrip loading>`, which
   * reserves the strip's geometry as a `stat-strip` skeleton.
   */
  { path: '/customers', mustContain: ['Customers', 'data-variant="stat-strip"'] },
];

/**
 * The design-system contract, asserted on the document.
 *
 * `data-theme` is absent on the DEFAULT theme by design, so a theme cannot be
 * detected that way. What can be checked is that the no-flash bootstrap is
 * inline in `<head>` — if it ever moves into an effect the app silently regains
 * the white flash on every load and nothing else here would notice.
 */
const DOCUMENT_CONTRACT = [
  {
    name: 'no-flash theme script is inline in <head>',
    pattern: /interlace-theme[\s\S]{0,400}?prefers-color-scheme/,
  },
  { name: 'theme switcher is in the chrome', pattern: /data-slot="theme-switcher"/ },
];

/**
 * The token layer lives in the emitted stylesheet, not in the document, so
 * asserting on the HTML alone would pass with the whole DS baseline missing.
 */
const STYLESHEET_CONTRACT = [
  { name: 'DS brand layer is loaded', pattern: /--interlace-primary/ },
  { name: 'Harbor theme is loaded', pattern: /\[data-theme=.?harbor/ },
  { name: 'dark scheme is class-driven, not media-only', pattern: /\.dark\b/ },
  {
    name: 'the forked @theme palette is gone',
    pattern: /--color-ink-3\s*:|--color-panel\s*:/,
    absent: true,
  },
];

/**
 * API contracts, asserted on the RESPONSE not the page.
 *
 * Every defect this file failed to catch was a route returning a confident,
 * well-formed, wrong answer: an inbox reporting 0 waiting against a real 14, a
 * count silently shrunk by a rate limit, a graph counting deleted accounts.
 * Pages rendered perfectly through all of it, so page checks alone could not
 * see any of them.
 *
 * These assert SHAPE and INVARIANTS, never a specific count — the numbers move
 * every day and a check that has to be updated daily gets deleted.
 */
const API_CONTRACT = [
  {
    path: '/api/threads',
    name: 'inbox reports completeness, not just a number',
    check: (j) => {
      if (!Array.isArray(j.threads)) return 'threads is not an array';
      if (typeof j.actionable !== 'number') return 'missing actionable count';
      if (typeof j.articlesFailed !== 'number') return 'missing articlesFailed — a partial crawl could pass as complete';
      if (j.actionable > j.threads.length) return 'actionable exceeds total';
      // A thread from a deleted account must never be counted as actionable.
      const goneCounted = j.threads.filter((t) => t.authorGone).length;
      if (j.actionable + goneCounted > j.threads.length) return 'gone authors counted as actionable';
      return null;
    },
  },
  {
    path: '/api/alerts',
    name: 'alerts distinguish "none firing" from "nothing evaluated"',
    check: (j) => {
      if (!Array.isArray(j.alerts)) return 'alerts is not an array';
      if (typeof j.evaluated !== 'number') return 'missing evaluated count — "0 alerts" would be ambiguous';
      if (j.alerts.length && !j.alerts[0].message) return 'an alert with no message';
      return null;
    },
  },
  {
    path: '/api/series',
    name: 'every catalogued series declares its source and staleness budget',
    check: (j) => {
      if (!Array.isArray(j.catalog) || !j.catalog.length) return 'empty catalog';
      const bad = j.catalog.find((d) => !d.source || typeof d.staleAfterHours !== 'number');
      if (bad) return `series ${bad.id} has no source or staleness budget`;
      const kinds = new Set(j.catalog.map((d) => d.kind));
      for (const k of kinds) if (!['cumulative', 'rate', 'gauge'].includes(k)) return `unknown kind ${k}`;
      return null;
    },
  },
];

async function checkApiContracts(base, failures) {
  for (const c of API_CONTRACT) {
    let problem = null;
    try {
      const r = await fetch(`${base}${c.path}`, { signal: AbortSignal.timeout(240_000) });
      problem = r.ok ? c.check(await r.json()) : `HTTP ${r.status}`;
    } catch (e) {
      problem = e.message;
    }
    if (problem) {
      failures.push(`${c.path} — ${problem}`);
      console.log(`  \u2717 ${c.path} — ${problem}`);
    } else {
      console.log(`  \u2713 ${c.path} — ${c.name}`);
    }
  }
}

const arg = (flag) => {
  const index = process.argv.indexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
};

const freePort = () =>
  new Promise((resolve, reject) => {
    const server = createServer();
    server.on('error', reject);
    server.listen(0, () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });

const waitFor = async (base, timeoutMs = 120_000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(base, { signal: AbortSignal.timeout(5000) });
      if (response.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`server never became ready at ${base}`);
};

const check = (failures, { name, pattern, absent }, subject, label) => {
  const hit = pattern.test(subject);
  if (absent ? hit : !hit) failures.push(`${label} — ${name}`);
  else console.log(`  ✓ ${name}`);
};

const DEFAULT_BASE = 'http://localhost:7777';

const isUp = async (base) => {
  try {
    return (await fetch(base, { signal: AbortSignal.timeout(2000) })).ok;
  } catch {
    return false;
  }
};

async function main() {
  let base = arg('--base');
  let child;

  if (!base) {
    // Next 16 refuses to start a second dev server for the same directory, so
    // reuse the one on the app's own port if it is already up. Booting a fresh
    // one is the fallback, not the default.
    if (await isUp(DEFAULT_BASE)) {
      base = DEFAULT_BASE;
      console.log(`Reusing the dev server already running at ${base}.\n`);
    } else {
      const port = await freePort();
      base = `http://localhost:${port}`;
      child = spawn('npx', ['next', 'dev', '-p', String(port)], {
        cwd: fileURLToPath(new URL('..', import.meta.url)),
        stdio: 'ignore',
      });
      await waitFor(base);
    }
  }

  const failures = [];
  let firstBody = '';

  await checkApiContracts(base, failures);

  for (const route of ROUTES) {
    let response;
    let body = '';
    try {
      response = await fetch(`${base}${route.path}`, { signal: AbortSignal.timeout(90_000) });
      body = await response.text();
    } catch (error) {
      failures.push(`${route.path} — request failed: ${error.message}`);
      continue;
    }
    if (!firstBody) firstBody = body;

    const before = failures.length;
    if (response.status !== 200) {
      failures.push(`${route.path} — expected 200, got ${response.status}`);
    }
    // Next answers 200 for a render error, so the status alone proves nothing.
    if (/Application error: a client-side exception/.test(body)) {
      failures.push(`${route.path} — rendered an error boundary`);
    }
    for (const needle of route.mustContain) {
      if (!body.includes(needle)) {
        failures.push(`${route.path} — missing ${JSON.stringify(needle)}`);
      }
    }
    const mark = failures.length === before ? '✓' : '✗';
    console.log(`  ${mark} ${route.path} (${response.status}, ${body.length} bytes)`);
  }

  for (const contract of DOCUMENT_CONTRACT) {
    check(failures, contract, firstBody, 'document contract');
  }

  const href = firstBody.match(/href="(\/_next\/static\/[^"]*\.css)"/)?.[1];
  if (!href) {
    failures.push('stylesheet contract — no stylesheet linked');
  } else {
    const css = await fetch(`${base}${href}`).then((r) => r.text());
    for (const contract of STYLESHEET_CONTRACT) {
      check(failures, contract, css, 'stylesheet contract');
    }
  }

  child?.kill('SIGTERM');

  if (failures.length) {
    console.error(`\n${failures.length} failure(s):`);
    for (const failure of failures) console.error(`  ✗ ${failure}`);
    process.exit(1);
  }
  console.log('\nAll routes render and the design-system contract holds.');
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
