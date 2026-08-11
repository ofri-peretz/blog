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
