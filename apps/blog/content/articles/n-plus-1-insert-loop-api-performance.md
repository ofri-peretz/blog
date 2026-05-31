---
title: "One INSERT Loop Made Our CSV Import 500x Slower. One ESLint Rule Catches It Before It Ships."
description: "A for-loop with an INSERT inside turned a 100ms bulk write into 50 seconds — 500x slower at 1,000 rows. pg/no-batch-insert-loop (CWE-1049) catches the N+1 pattern in CI, before it ships."
slug: "n-plus-1-insert-loop-api-performance"
canonical_url: "https://ofriperetz.dev/articles/n-plus-1-insert-loop-api-performance"
devto_url: "https://dev.to/ofri-peretz/the-n1-insert-loop-that-slowed-our-api-to-a-crawl-4534"
devto_id: 3144119
published_at: "2026-01-02T20:06:27Z"
edited_at: "2026-01-11T10:21:30Z"
cover_image: "https://media2.dev.to/dynamic/image/width=1000,height=420,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fofriperetz.dev%2Fcdn%2Fblog-cover-image%2Fn-plus-1-insert-loop-api-performance.png"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/n-plus-1-insert-loop-api-performance.png"
reading_time_minutes: 6
tags:
  - "eslint"
  - "postgres"
  - "performance"
  - "node"
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

**Architectural bottlenecks like N+1 loops can degrade API performance by 99% before you notice. Here is how we use static analysis to detect and fix loop-driven performance regression at the commit level.**

Our CSV import endpoint was timing out. 30 seconds wasn't enough.

## The Problem

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

For 1000 users:

- 1000 round trips to database
- ~50ms per query
- **50 seconds total**

## Why It Matters

| Rows  | N+1 Time | Bulk Time | Speedup |
| ----- | -------- | --------- | ------- |
| 100   | 5s       | 50ms      | 100x    |
| 1000  | 50s      | 100ms     | 500x    |
| 10000 | 500s     | 500ms     | 1000x   |

## The Correct Pattern: Bulk Insert

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

This pattern is detected by the [`pg/no-batch-insert-loop`](https://eslint.interlace.tools/docs/security/plugin-pg/rules/no-batch-insert-loop) rule from `eslint-plugin-pg`.

## Let ESLint Catch This

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

For a **literal** query string, the rule's fast path flags `INSERT` and
`UPDATE` queries inside a loop:

- inside `for`, `for...of`, `for...in`, `while`, `do...while`
- inside `forEach`, `map`, `reduce`, `filter` callbacks

For a **non-literal** query — a template literal or a variable — the rule can't
read the SQL verb, so it flags the query-in-loop regardless. That's how a
`DELETE`-in-loop is caught:

```js
// flagged: non-literal query in a loop (any verb)
for (const id of ids) await pool.query(`DELETE FROM users WHERE id = ${id}`);
```

A _literal_ `query("DELETE ...")` or `query("SELECT ...")` in a loop is
intentionally skipped by the fast path — keeping the rule focused on the
write-amplifying `INSERT`/`UPDATE` shape.

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

## What it does — and doesn't — see

`no-batch-insert-loop` flags a `query()` for a literal `INSERT`/`UPDATE` — or an
interpolated query of any verb — inside a loop or array-iterator callback. It's a heuristic for the N+1 _shape_,
not a runtime profiler — it can't measure your actual latency, and a loop that
genuinely runs once isn't a real N+1. It catches the pattern that becomes one at
scale, before it ships. (It's one of 13 rules in `eslint-plugin-pg`; the
[pg getting-started](https://ofriperetz.dev/articles/getting-started-eslint-plugin-pg)
covers the rest — SQL injection, `search_path` hijacking, connection leaks.)

---

- 📦 [npm: eslint-plugin-pg](https://www.npmjs.com/package/eslint-plugin-pg)
- 📖 [Rule docs: pg/no-batch-insert-loop](https://eslint.interlace.tools/docs/security/plugin-pg/rules/no-batch-insert-loop)
- 💻 [Source on GitHub](https://github.com/ofri-peretz/eslint/tree/main/packages/eslint-plugin-pg)

::dev-to-cta{url="https://github.com/ofri-peretz/eslint"}
⭐ Star on GitHub if a loop has ever turned your bulk import into a timeout.
::

---

I'm **Ofri Peretz**, a security engineering leader and the author of the
Interlace ESLint ecosystem — domain-specific static analysis for security,
reliability, and performance on the Node.js stack. `eslint-plugin-pg` is its
node-postgres layer.

[ofriperetz.dev](https://ofriperetz.dev) · [LinkedIn](https://linkedin.com/in/ofri-peretz) · [GitHub](https://github.com/ofri-peretz)
