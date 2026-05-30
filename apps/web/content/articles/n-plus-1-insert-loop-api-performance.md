---
title: "The Performance Protocol: Solving PostgreSQL N+1 Loops via Static Analysis"
description: "Eliminate API performance bottlenecks at the commit level. A case study on detecting and fixing architectural N+1 patterns programmatically."
slug: "n-plus-1-insert-loop-api-performance"
canonical_url: "https://ofriperetz.dev/articles/n-plus-1-insert-loop-api-performance"
devto_url: "https://dev.to/ofri-peretz/the-n1-insert-loop-that-slowed-our-api-to-a-crawl-4534"
devto_id: 3144119
published_at: "2026-01-02T20:06:27Z"
edited_at: "2026-01-11T10:21:30Z"
cover_image: "https://media2.dev.to/dynamic/image/width=1000,height=420,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fofriperetz.dev%2Fcdn%2Fblog-cover-image%2Fn-plus-1-insert-loop-api-performance.png"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/n-plus-1-insert-loop-api-performance.png"
reading_time_minutes: 2
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
import pg from "eslint-plugin-pg";
export default [pg.configs.recommended];
```

### Enable Only This Rule

```javascript
import pg from "eslint-plugin-pg";

export default [
  {
    plugins: { pg },
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

The [`pg/no-batch-insert-loop`](https://eslint.interlace.tools/docs/security/plugin-pg/rules/no-batch-insert-loop) rule catches:

- `query('INSERT...')` inside `for`, `for...of`, `for...in` loops
- `query('INSERT...')` inside `while` and `do...while` loops
- `query('INSERT...')` inside `forEach`, `map`, `reduce`, `filter` callbacks
- `query('UPDATE...')` inside any loop construct
- `query('DELETE...')` inside any loop construct

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

## Quick Install

```bash
npm install --save-dev eslint-plugin-pg
```

```javascript
import pg from "eslint-plugin-pg";
export default [pg.configs.recommended];
```

Turn 50-second imports into 100ms operations.

---

📦 [npm: eslint-plugin-pg](https://www.npmjs.com/package/eslint-plugin-pg)
📖 [Rule docs: pg/no-batch-insert-loop](https://github.com/ofri-peretz/eslint/blob/main/packages/eslint-plugin-pg/docs/rules/no-batch-insert-loop.md)

::dev-to-cta{url="https://github.com/ofri-peretz/eslint"}
⭐ Star on GitHub
::

---

**The Interlace ESLint Ecosystem**
Interlace is a high-fidelity suite of static code analyzers designed to automate security, performance, and reliability for the modern Node.js stack. With over 330 rules across 18 specialized plugins, it provides 100% coverage for OWASP Top 10, LLM Security, and Database Hardening.

## [Explore the full Documentation](https://eslint.interlace.tools)

© 2026 Ofri Peretz. All rights reserved.

---

**Build Securely.**
I'm Ofri Peretz, a Security Engineering Leader and the architect of the Interlace Ecosystem. I build static analysis standards that automate security and performance for Node.js fleets at scale.

[ofriperetz.dev](https://ofriperetz.dev) | [LinkedIn](https://linkedin.com/in/ofri-peretz) | [GitHub](https://github.com/ofri-peretz)
