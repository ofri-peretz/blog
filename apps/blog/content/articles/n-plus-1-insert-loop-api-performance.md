---
title: "One INSERT Loop Made Our CSV Import 500x Slower. One ESLint Rule Catches It Before It Ships."
description: "A for-loop with an INSERT inside turned a 100ms bulk write into 50 seconds — 500x slower at 1,000 rows. pg/no-batch-insert-loop (CWE-1049) catches the N+1 pattern in CI, before it ships."
slug: "n-plus-1-insert-loop-api-performance"
canonical_url: "https://ofriperetz.dev/articles/n-plus-1-insert-loop-api-performance"
devto_url: "https://dev.to/ofri-peretz/the-n1-insert-loop-that-slowed-our-api-to-a-crawl-4534"
devto_id: 3144119
published_at: "2026-01-02T20:06:27Z"
edited_at: "2026-01-11T10:21:30Z"
cover_image: "https://ofriperetz.dev/og/cover/n-plus-1-insert-loop-api-performance"
social_image: "https://ofriperetz.dev/og/article/n-plus-1-insert-loop-api-performance"
reading_time_minutes: 6
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

Our API was slowing to a crawl at peak load. Response times ballooned from 100ms to 50 seconds. The root cause: an N+1 insert loop that every code review had approved. ESLint found it in under a second. Here's what it looked like.

## The Post-Mortem

**The failure.** Our CSV import endpoint started timing out under load. At 1,000 concurrent requests during a customer onboarding batch, p99 response time climbed from 100ms to 50+ seconds. The endpoint started returning 504s. The on-call rotation got paged at 2:47 AM.

**The root cause.** After 40 minutes of tracing — query logs, connection pool metrics, slow-query analysis — it came down to six lines that had been reviewed, merged, and running in production for three weeks:

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

**The numbers.** At 1,000 rows per request: 1,000 sequential database round trips × ~50ms each = ~50 seconds per request. Before the fix: **1,000 queries per request**. After the bulk rewrite: **1 query per request**. Response time: 50 seconds → 100ms. **99.8% improvement.**

**The fix.** The bulk insert took 11 minutes to write and deploy. The tracing and root-cause analysis took 40 minutes. The incident had been live for 3 hours before it was escalated.

> **An N+1 insert that processes 1,000 rows per request makes 1,000 database calls. We had 1,000 concurrent requests. Do the math.**

## Why It Survived Review

Nobody on the team was careless. The code is logically correct — it processes each record. The problem is invisible until you have production row counts. The reviewer tested with 5; production had 50,000.

The loop survived review because every signal a reviewer has said it was fine:

- **It's idiomatic.** "Iterate the array, insert each row" is the most natural way to express the intent. It reads like the spec sentence.
- **It passed tests.** The unit test seeded three or four rows. Three round trips finish in single-digit milliseconds — green, fast, merged.
- **It's not a bug.** There's no off-by-one, no injection, no null deref. A reviewer scanning a 40-file PR for _wrong_ code finds nothing wrong, because nothing is wrong. The code is correct and slow, and "slow" is invisible until the data shows up.

Performance regressions like this don't get caught in review because review operates on the diff, not on the production row count. The reviewer would have needed to mentally multiply the loop body by 50,000 and know the per-round-trip latency — for every loop in every PR. Humans don't do that consistently, and we shouldn't ask them to. A linter does it on every line, every commit, for free.

## Why It Matters at Scale

The N+1 column below is just `rows × per-round-trip latency` — it scales linearly with row count, and the constant is your network, not your schema. The bulk column is a single round trip regardless of size. Plug in your own p99 round-trip latency and the ratio holds:

| Rows   | N+1 (≈ rows × 50ms) | Bulk (1 round trip) | Speedup |
| ------ | ------------------- | ------------------- | ------- |
| 100    | ~5s                 | ~50ms               | ~100x   |
| 1,000  | ~50s                | ~100ms              | ~500x   |
| 10,000 | ~500s               | ~500ms              | ~1000x  |

That's the trap: at 5 rows in a dev seed file, both columns are imperceptible. The N+1 loop and the bulk insert look identical on a laptop. The gap only opens at production row counts — which is exactly why it clears review every time.

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

### Use Recommended Config (All Rules)

```javascript
// `configs` is a NAMED export; the default export is the plugin object.
import { configs } from "eslint-plugin-pg";
export default [configs.recommended];
```

### Enable Only This Rule

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

When N+1 loops are detected:

```bash
src/import.ts
  5:3  error  ⚡ CWE-1049 | Database query loop detected. | HIGH
                 Fix: Batch queries using arrays and "UNNEST" or a single batched INSERT. | https://use-the-index-luke.com/sql/joins/nested-loops-join-n1-problem
```

## Detection Patterns

For a **literal** query string, the rule's fast path flags `INSERT` and `UPDATE` queries inside a loop:

- inside `for`, `for...of`, `for...in`, `while`, `do...while`
- inside `forEach`, `map`, `reduce`, `filter` callbacks

For a **non-literal** query — a template literal or a variable — the rule can't read the SQL verb, so it flags the query-in-loop regardless. That's how a `DELETE`-in-loop is caught:

```js
// flagged: non-literal query in a loop (any verb)
for (const id of ids) await pool.query(`DELETE FROM users WHERE id = ${id}`);
```

A _literal_ `query("DELETE ...")` or `query("SELECT ...")` in a loop is intentionally skipped by the fast path — keeping the rule focused on the write-amplifying `INSERT`/`UPDATE` shape.

## The AI Assistant Will Write This Loop for You

This pattern isn't fading — it's accelerating. Ask any coding assistant (Claude, Copilot, Gemini) to "insert a list of users into Postgres" and the loop-with-an-`INSERT` is one of the most common shapes you get back. It's the literal reading of the prompt, and the model learned from a decade of public code that wrote it exactly this way. The assistant optimizes for "this looks like working code" — and a sequential insert loop _looks_ like working code. It runs, it returns, it passes the same three-row test a human would have written. The latency cliff is invisible to the model for the same reason it's invisible in review.

The rule doesn't care who typed it. It's purely AST-structural: it sees a write query inside a loop and flags the shape, whether a human, a model, or a copy-paste from an old gist put it there. That's the whole case for running structural rules on generated code — the layer that catches what the model can't see about its own output.

This same pattern surfaces across the database access layer. A [connection leak in production](https://dev.to/ofri-peretz/the-connection-leak-that-took-down-our-production-database-3bal) causes the same kind of 3 AM page — a different symptom, the same root: the pool behavior is invisible until it isn't. And if you're new to a codebase, the [30-minute static analysis onboarding protocol](https://dev.to/ofri-peretz/the-30-minute-security-audit-onboarding-a-new-codebase-4f91) surfaces these patterns before you touch a line.

(I've written more on [what happens when you point ESLint at AI-generated code](https://ofriperetz.dev/articles/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities) and [the six holes one lint run found in a Claude-written service](https://ofriperetz.dev/articles/claude-wrote-nestjs-service-eslint-found-6-security-holes).)

## Other Bulk Patterns

### Bulk Update

```javascript
// ✅ Update with unnest
await pool.query(
  `
  UPDATE users SET status = data.status
  FROM unnest($1::int[], $2::text[]) AS data(id, status)
  WHERE users.id = data.id
`,
  [ids, statuses],
);
```

### Bulk Delete

```javascript
// ✅ Delete with ANY
await pool.query("DELETE FROM users WHERE id = ANY($1)", [userIds]);
```

## Compatibility

| Surface              | Support                                                                                                  |
| -------------------- | -------------------------------------------------------------------------------------------------------- |
| **Package managers** | npm, yarn, pnpm, bun — plain dev dependency                                                              |
| **Node**             | `>= 18.0.0`                                                                                              |
| **ESLint**           | `^8.0.0 \|\| ^9.0.0 \|\| ^10.0.0`, flat config                                                           |
| **`pg` driver**      | peer `^6 \|\| ^7 \|\| ^8`; the rule is AST-based and lints regardless of installed version               |
| **Module system**    | CommonJS — loads from both `eslint.config.js` and `eslint.config.mjs`                                    |
| **Oxlint**           | Loads under Oxlint's JS-plugin runner via the `interlace-pg` port, with ESLint↔Oxlint parity gated in CI |

## What It Does — and Doesn't — See

`no-batch-insert-loop` flags a `query()` for a literal `INSERT`/`UPDATE` — or an interpolated query of any verb — inside a loop or array-iterator callback. It's a heuristic for the N+1 _shape_, not a runtime profiler — it can't measure your actual latency, and a loop that genuinely runs once isn't a real N+1. It catches the pattern that becomes one at scale, before it ships. (It's one of 13 rules in `eslint-plugin-pg`; the [pg getting-started](https://ofriperetz.dev/articles/getting-started-eslint-plugin-pg) covers the rest — SQL injection, `search_path` hijacking, connection leaks.)

> **Part of the [Postgres Security Protocol](https://ofriperetz.dev/articles/getting-started-eslint-plugin-pg) series.**
> The N+1 insert loop is one member of a family: code that passes review because it's _correct_, then fails at production scale because of how it uses the pool. Its siblings:
> [a missing `client.release()` that exhausted the pool at 3 AM](https://ofriperetz.dev/articles/database-connection-leak-production-outage),
> and
> [`BEGIN` on a pool scattering one transaction across connections](https://ofriperetz.dev/articles/transaction-race-conditions-begin-on-pool).
> Same root cause — the pool is invisible until it isn't — same fix: catch the shape at the commit, not the incident.

---

- 📦 [npm: eslint-plugin-pg](https://www.npmjs.com/package/eslint-plugin-pg)
- 📖 [Rule docs: pg/no-batch-insert-loop](https://eslint.interlace.tools/docs/security/plugin-pg/rules/no-batch-insert-loop)
- 💻 [Source on GitHub](https://github.com/ofri-peretz/eslint/tree/main/packages/eslint-plugin-pg)

::dev-to-cta{url="https://github.com/ofri-peretz/eslint"}
⭐ Star on GitHub if a loop has ever turned your bulk import into a timeout.
::

**What's the most expensive database pattern your team has shipped that passed all code reviews — and what finally surfaced it?** The one that looked fine in review, passed the seed-data test, and only showed its teeth when real traffic — or a real CSV — hit it. How many rows in before someone noticed, and what surfaced it: a timeout, a pager, or a customer? Tell me in the comments.

---

*Part of the [Interlace ESLint ecosystem](https://eslint.interlace.tools). Source on [GitHub](https://github.com/ofri-peretz/eslint) · Follow: [Dev.to/ofri-peretz](https://dev.to/ofri-peretz)*
