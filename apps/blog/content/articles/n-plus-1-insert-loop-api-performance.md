---
title: "One INSERT Loop Made Our CSV Import 500x Slower. One ESLint Rule Catches It Before It Ships."
description: "A for-loop with an INSERT inside turned a 100ms bulk write into 50 seconds — 500x slower at 1,000 rows. The post-mortem, a reproduction you can run in 60 seconds, and pg/no-batch-insert-loop (CWE-1049): the ESLint rule that catches the N+1 shape before it ships."
slug: "n-plus-1-insert-loop-api-performance"
canonical_url: "https://ofriperetz.dev/articles/n-plus-1-insert-loop-api-performance"
tier: "TOPIC"
devto_url: "https://dev.to/ofri-peretz/the-n1-insert-loop-that-slowed-our-api-to-a-crawl-4534"
devto_id: 3144119
published_at: "2026-01-02T20:06:27Z"
edited_at: "2026-07-28T00:00:00Z"
cover_image: "https://ofriperetz.dev/cdn/blog-cover-image/n-plus-1-insert-loop-api-performance.jpg?v=b2"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/n-plus-1-insert-loop-api-performance-og.jpg?v=b2"
reading_time_minutes: 8
tags:
  - "node"
  - "database"
  - "performance"
  - "devsecops"
reactions: 1
comments: 3
views: 0
author:
  name: "Ofri Peretz"
  username: "ofri-peretz"
  avatar: "https://media2.dev.to/dynamic/image/width=640,height=640,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Fuser%2Fprofile_image%2F3669992%2F50a1f256-472c-48a1-85e8-149459647ea7.png"
  twitter: "ofriperetzdev"
series: "Postgres Security Protocol"
---

The CSV import endpoint had a p99 of 100ms. At 2:47 AM it had a p99 of 50 seconds, it was returning 504s, and the pager had my name on it.

Nothing had shipped that night. The code responsible had been reviewed, merged, and running in production for three weeks: six lines, one loop, one `INSERT`. I was one of the approvals on that pull request. It took me about forty seconds, because there was nothing to argue with.

A linter found it in under a second. Here's the whole thing.

## The Post-Mortem

**The failure.** The CSV import endpoint started timing out under load. During a customer onboarding batch — 1,000 concurrent requests — p99 response time climbed from 100ms to 50+ seconds, and the endpoint began returning 504s.

**The root cause.** Forty minutes of tracing later — query logs, connection pool metrics, slow-query analysis — it came down to these six lines:

```javascript
// ❌ The pattern that killed our performance
async function importUsers(users) {
  for (const user of users) {
    await pool.query("INSERT INTO users (name, email) VALUES ($1, $2)", [
      user.name,
      user.email,
    ]);
  }
}
```

**The numbers.** At 1,000 rows per request: 1,000 sequential round trips × ~50ms each ≈ 50 seconds. That 50ms is our production round trip under load — across the network, with a pool already queueing behind itself; on a loopback socket you'll measure a fraction of it. The one quantity the loop controls is the count: **1,000 queries per request before the fix, 1 after.** Response time: 50 seconds → 100ms.

**The fix.** The bulk insert took 11 minutes to write and deploy. Finding it took 40. The incident had been live for three hours before anyone escalated.

> **A 50ms round trip is a transaction fee. One is nothing. Paying it a thousand times per request is how the account empties.**

## Why It Survived Review

Nobody on the team was careless. The code is logically correct — it processes each record. The problem is invisible until you have production row counts, and the reviewer tested with 5. Production had 50,000.

The loop survived because every signal a reviewer has said it was fine:

- **It's idiomatic.** "Iterate the array, insert each row" reads like the spec sentence.
- **It passed tests.** The unit test seeded three or four rows. Three round trips finish in single-digit milliseconds — green, fast, merged.
- **It's not a bug.** No off-by-one, no injection, no null deref. A reviewer scanning a 40-file PR for _wrong_ code finds nothing, because nothing is wrong. The code is correct and slow, and "slow" is invisible until the data shows up.

Review operates on the diff, not on the production row count. To catch this, a reviewer would have to mentally multiply the loop body by 50,000 and know the per-round-trip latency — for every loop in every PR. Humans don't do that consistently, and we shouldn't ask them to. This is the boring half of [static analysis](https://ofriperetz.dev/articles/static-analysis-vs-sast-vs-linting): not finding clever bugs, just never getting tired.

## Why It Matters at Scale

The N+1 column is `rows × per-round-trip latency` — linear in row count, and the constant is your network, not your schema. The bulk column is one round trip regardless of size. Plug in your own p99 and the ratio holds:

| Rows   | N+1 (≈ rows × 50ms) | Bulk (1 round trip) | Speedup |
| ------ | ------------------- | ------------------- | ------- |
| 100    | ~5s                 | ~50ms               | ~100x   |
| 1,000  | ~50s                | ~100ms              | ~500x   |
| 10,000 | ~500s               | ~500ms              | ~1000x  |

That's the trap: at 5 rows in a dev seed file, both columns are imperceptible. The N+1 loop and the bulk insert look identical on a laptop. The gap only opens at production row counts — which is exactly why it clears review every time.

One honest caveat: the ratio holds while the round trip dominates the per-row work. Push 10,000 wide rows over a loopback socket and the server-side write cost starts to matter, so the gap compresses. Wherever the database is a network hop away, the network is the bill.

## Don't Take the 500x on Faith — Run It

Three commands and a file, and you can read your own two numbers instead of mine:

```bash
docker run -d --name pg-n1 -e POSTGRES_PASSWORD=demo -e POSTGRES_DB=demo \
  -p 55433:5432 postgres:16     # give it a few seconds to accept connections

npm init -y && npm install pg   # the driver the script below requires
```

```javascript
// n1.js — same 1,000 rows, two shapes, one timer each.
const { Pool } = require("pg");
const pool = new Pool({
  connectionString: "postgres://postgres:demo@localhost:55433/demo",
});
const rows = Array.from({ length: 1000 }, (_, i) => ({
  name: `u${i}`,
  email: `u${i}@example.com`,
}));

(async () => {
  await pool.query("CREATE TABLE IF NOT EXISTS users (name text, email text)");

  console.time("n+1");
  for (const u of rows) {
    await pool.query("INSERT INTO users (name, email) VALUES ($1, $2)", [
      u.name,
      u.email,
    ]);
  }
  console.timeEnd("n+1");

  console.time("bulk");
  await pool.query(
    `INSERT INTO users (name, email)
     SELECT * FROM unnest($1::text[], $2::text[])`,
    [rows.map((u) => u.name), rows.map((u) => u.email)],
  );
  console.timeEnd("bulk");

  await pool.end();
})();
```

Then run it:

```bash
node n1.js
```

Your numbers won't match mine, and they shouldn't: a container on your own machine has no network to cross, so the absolute gap is much smaller than a production one. Read the ratio, not the milliseconds — and note that it's the same 1,000 rows both times. Nothing about the work changed, only how many times the code asked for it. Being able to [reproduce](https://ofriperetz.dev/articles/reproducibility-vs-replicability) the shape on a laptop is what turns "the API got slow" into a number you can defend in a design review.

## The Fix: Bulk Insert

```javascript
// ✅ Single query, any number of rows
async function importUsers(users) {
  const values = users
    .map((u, i) => `($${i * 2 + 1}, $${i * 2 + 2})`)
    .join(", ");

  const params = users.flatMap((u) => [u.name, u.email]);

  await pool.query(`INSERT INTO users (name, email) VALUES ${values}`, params);
}
```

Or even better with `unnest()`:

```javascript
// ✅ PostgreSQL unnest pattern
async function importUsers(users) {
  await pool.query(
    `INSERT INTO users (name, email)
     SELECT * FROM unnest($1::text[], $2::text[])`,
    [users.map((u) => u.name), users.map((u) => u.email)],
  );
}
```

## The Rule: [`pg/no-batch-insert-loop`](https://eslint.interlace.tools/docs/security/plugin-pg/rules/no-batch-insert-loop)

The [`pg/no-batch-insert-loop`](https://eslint.interlace.tools/docs/security/plugin-pg/rules/no-batch-insert-loop) rule from `eslint-plugin-pg` flags this shape statically — no profiler, no load test, no waiting for the data to show up. One command and it's watching every loop in the repo:

```bash
npm install --save-dev eslint-plugin-pg
```

### Recommended config — all 13 rules

```javascript
// eslint.config.js — `configs` is a NAMED export; the default export is the plugin object.
import { configs } from "eslint-plugin-pg";

export default [configs.recommended];
```

> **If your project has no `"type": "module"`,** that `import` throws a `SyntaxError`. Rename the file to `eslint.config.mjs` — it works in any project, and the plugin itself ships CommonJS, so nothing else has to change.

One thing `recommended` does **not** do: fail your build on this rule. In `eslint-plugin-pg` v1.4.6 the preset puts `no-batch-insert-loop` in its quality bucket at `"warn"`, next to `no-select-all` and `prefer-pool-query`. A warning doesn't gate CI, and a rule that doesn't gate CI is one your team learns to scroll past. To make the loop stop a merge, promote it — `configs.strict` (every rule as `"error"`), or just this one:

### Just this rule, as a CI gate

```javascript
import pgPlugin from "eslint-plugin-pg"; // default export = the plugin object

export default [
  {
    plugins: { pg: pgPlugin },
    rules: {
      "pg/no-batch-insert-loop": "error",
    },
  },
];
```

## What You'll See

With the rule promoted to `"error"`, this is the message verbatim from the rule's own formatter:

```bash
src/import.ts
  5:3  error  ⚡ CWE-1049 | Database query loop detected. | HIGH
                 Fix: Batch queries using arrays and "UNNEST" or a single batched INSERT. | https://use-the-index-luke.com/sql/joins/nested-loops-join-n1-problem
```

`CWE-1049` is this shape's entry in the [CWE taxonomy](https://ofriperetz.dev/articles/cwe-taxonomy-explained) — excessive query operations against a large data table. A catalogue number is what lets a performance bug ride the same pipeline as the security rules instead of sitting in a "we should optimize that someday" ticket.

The trailing `HIGH` is the rule's declared severity; its metadata carries a [CVSS](https://ofriperetz.dev/articles/cvss-scores-explained) score of 7.5, which is the High band. Those two agreeing isn't automatic — when I audited our own catalogue, [33 of 203 rules printed a severity that contradicted their own score](https://ofriperetz.dev/articles/i-audited-203-of-our-own-eslint-security-rules-16-mislabel-their-own-cvss-score), 16%, and I published the list. This one is in the 84% that line up.

## Detection Patterns

For a **literal** query string, the rule's fast path flags `INSERT` and `UPDATE` queries inside a loop:

- inside `for`, `for...of`, `for...in`, `while`, `do...while`
- inside `forEach`, `map`, `reduce`, `filter` callbacks

For a **non-literal** query — a template literal or a variable — the rule can't read the SQL verb, so it flags the query-in-loop regardless. That's how a `DELETE`-in-loop is caught:

```js
// flagged: non-literal query in a loop (any verb)
for (const id of ids) await pool.query(`DELETE FROM users WHERE id = ${id}`);
```

A _literal_ `query("DELETE ...")` or `query("SELECT ...")` in a loop is skipped by the fast path on purpose, keeping the rule on the write-amplifying `INSERT`/`UPDATE` shape.

## The AI Assistant Will Write This Loop for You

This pattern isn't fading, it's accelerating. Ask any coding assistant (Claude, Copilot, Gemini) to "insert a list of users into Postgres" and the loop-with-an-`INSERT` is one of the most common shapes you get back. It's the literal reading of the prompt, and the model learned from a decade of public code that wrote it exactly this way. It runs, it returns, it passes the same three-row test a human would have written. The latency cliff is invisible to the model for the same reason it's invisible in review.

The reassuring part is that the rule doesn't care who typed it. It's purely AST-structural: a write query inside a loop is flagged whether a human, a model, or a copy-paste from an old gist put it there. That's the whole case for running structural rules on generated code — the layer that checks what the model can't see about its own output. (More: [what happens when you point ESLint at AI-generated code](https://ofriperetz.dev/articles/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities), and [the six holes one lint run found in a Claude-written service](https://ofriperetz.dev/articles/claude-wrote-nestjs-service-eslint-found-6-security-holes).)

The same blind spot runs through the whole database access layer. A [connection leak in production](https://ofriperetz.dev/articles/database-connection-leak-production-outage) produces the same kind of 3 AM page — different symptom, same root: pool behavior is invisible until it isn't. On a codebase you've just inherited, the [30-minute static analysis onboarding protocol](https://ofriperetz.dev/articles/the-30-minute-security-audit-onboarding-a-new-codebase) surfaces these shapes before you touch a line.

## The Other Two Verbs

`UPDATE` has the same one-round-trip form, and `DELETE` collapses to a single `ANY`:

```javascript
// ✅ Bulk update with unnest
await pool.query(
  `UPDATE users SET status = data.status
   FROM unnest($1::int[], $2::text[]) AS data(id, status)
   WHERE users.id = data.id`,
  [ids, statuses],
);

// ✅ Bulk delete with ANY
await pool.query("DELETE FROM users WHERE id = ANY($1)", [userIds]);
```

## Compatibility

| Surface              | Support                                                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Package managers** | npm, yarn, pnpm, bun — plain dev dependency                                                                               |
| **Node**             | `>= 18.0.0`                                                                                                               |
| **ESLint**           | `^8.0.0 \|\| ^9.0.0 \|\| ^10.0.0`, flat config                                                                            |
| **`pg` driver**      | peer `^6 \|\| ^7 \|\| ^8`; the rule is AST-based and lints regardless of installed version                                |
| **Module system**    | Plugin ships CommonJS — `import` and `require` both work; without `"type": "module"`, name the config `eslint.config.mjs` |
| **Oxlint**           | Loads under Oxlint's JS-plugin runner via the `interlace-pg` port, with ESLint↔Oxlint parity gated in CI                  |

```bash
# npm / yarn / pnpm / bun
npm install --save-dev eslint-plugin-pg
yarn add -D eslint-plugin-pg
pnpm add -D eslint-plugin-pg
bun add -d eslint-plugin-pg
```

## What It Does — and Doesn't — See

`no-batch-insert-loop` flags a `query()` for a literal `INSERT`/`UPDATE` — or an interpolated query of any verb — inside a loop or array-iterator callback. It's a structural [heuristic, not taint tracking](https://ofriperetz.dev/articles/taint-vs-heuristic-detection), and it's not a runtime profiler: it can't measure your latency.

Which means it also fires on the loop that genuinely runs twice. That's a [false positive](https://ofriperetz.dev/articles/confusion-matrix-tp-fp-fn-tn) by any honest accounting, and it's the [precision](https://ofriperetz.dev/articles/precision-recall-f1-for-static-analysis) cost of catching the shape before the row count exists to prove it. I take that trade here for one reason: the fix is a bulk write, and a bulk write is the better code at two rows as well.

(It's one of 13 rules in `eslint-plugin-pg` v1.4.6; the [pg getting-started guide](https://ofriperetz.dev/articles/getting-started-eslint-plugin-pg) covers the rest — SQL injection, `search_path` hijacking, connection leaks.)

## Where This Fits

The N+1 insert loop belongs to a family: code that passes review because it's _correct_, then fails at production scale because of how it uses the pool. Same root cause every time, same fix — catch the shape at the commit, not at the incident. Part of the **Postgres Security Protocol** series:

- **Read next →** [`BEGIN` on a pool: the transaction race condition](https://ofriperetz.dev/articles/transaction-race-conditions-begin-on-pool) — same pool, inverse failure: one transaction scattered across three connections
- [A missing `client.release()` that exhausted the pool at 3 AM](https://ofriperetz.dev/articles/database-connection-leak-production-outage) — the availability sibling of this rule
- [Getting started with `eslint-plugin-pg`](https://ofriperetz.dev/articles/getting-started-eslint-plugin-pg) — all 13 rules, one install

None of this needs a rewrite of your data layer. One dev dependency and one line promoted to `"error"`, and the next loop like this one dies in a pull request instead of on a pager.

---

- 📦 [npm: eslint-plugin-pg](https://www.npmjs.com/package/eslint-plugin-pg)
- 📖 [Rule docs: pg/no-batch-insert-loop](https://eslint.interlace.tools/docs/security/plugin-pg/rules/no-batch-insert-loop)
- 💻 [Source on GitHub](https://github.com/ofri-peretz/eslint/tree/main/packages/eslint-plugin-pg)

::dev-to-cta{url="https://github.com/ofri-peretz/eslint"}
⭐ Star on GitHub if a loop has ever turned your bulk import into a timeout.
::

**I want the row count.** What's the largest number of rows your production code has quietly looped a query over — and what finally noticed: a timeout, a pager, or a customer? Post the number in the comments; I'll go first, mine was 50,000.

---

_Part of the [Interlace ESLint ecosystem](https://eslint.interlace.tools). Source on [GitHub](https://github.com/ofri-peretz/eslint) · Follow: [Dev.to/ofri-peretz](https://dev.to/ofri-peretz)_
