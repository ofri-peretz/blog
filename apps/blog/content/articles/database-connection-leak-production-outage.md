---
title: "A Missing client.release() Exhausted Our Postgres Pool at 3 AM. The ESLint Rule That Catches It."
description: "A node-postgres connection leak took our API down: 100 connections gone in 2 minutes on normal traffic. The post-mortem, the finally/pool.query fix, and the structural ESLint rule that flags a checked-out client that's never released — before it merges."
slug: "database-connection-leak-production-outage"
canonical_url: "https://ofriperetz.dev/articles/database-connection-leak-production-outage"
devto_url: "https://dev.to/ofri-peretz/the-connection-leak-that-took-down-our-production-database-3bal"
devto_id: 3138991
published_at: "2025-12-31T21:35:53Z"
edited_at: "2026-01-11T10:21:49Z"
cover_image: "https://ofriperetz.dev/og/cover/database-connection-leak-production-outage"
social_image: "https://ofriperetz.dev/og/article/database-connection-leak-production-outage"
reading_time_minutes: 5
tags:
  - "eslint"
  - "postgres"
  - "node"
  - "database"
reactions: 0
comments: 0
views: 0
author:
  name: "Ofri Peretz"
  username: "ofri-peretz"
  avatar: "https://media2.dev.to/dynamic/image/width=640,height=640,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Fuser%2Fprofile_image%2F3669992%2F50a1f256-472c-48a1-85e8-149459647ea7.png"
  twitter: "ofriperetzdev"
series: "Postgres Security Protocol"
---

3 AM. PagerDuty. Every API request returning 500.

The database was healthy — CPU fine, memory fine, disk fine. But every query
timed out against the same error:

```text
FATAL: too many connections for role "app_user"
```

We had a 100-connection pool and _normal_ traffic. So where had all 100
connections gone?

## The leak

After too long staring at logs, here it was — a single helper, called on a hot
path:

```javascript
// ❌ the leak
async function getUserOrders(userId) {
  const client = await pool.connect();
  const orders = await client.query("SELECT * FROM orders WHERE user_id = $1", [
    userId,
  ]);
  return orders.rows;
  // client.release() never runs — the connection is gone for good
}
```

`pool.connect()` checks a connection _out_ of the pool. Without
`client.release()`, it's never returned. At ~50 req/min, a 100-connection pool
is empty in **two minutes** — and then every other part of the app that needs
the database is dead too. The blast radius of one missing line is the whole
service.

## The fix: release in `finally`, or don't check out at all

Two patterns close the hole. First — if you need an explicit client, release it
in a `finally` so it returns **even when the query throws**:

```javascript
// ✅ finally guarantees the release
async function getUserOrders(userId) {
  const client = await pool.connect();
  try {
    const orders = await client.query(
      "SELECT * FROM orders WHERE user_id = $1",
      [userId],
    );
    return orders.rows;
  } finally {
    client.release();
  }
}
```

Better still — a single-shot query doesn't need a manual checkout at all.
`pool.query()` borrows and returns a connection for you:

```javascript
// ✅ best for single queries — no client to leak
async function getUserOrders(userId) {
  const { rows } = await pool.query("SELECT * FROM orders WHERE user_id = $1", [
    userId,
  ]);
  return rows;
}
```

## The rule: `no-missing-client-release` (CWE-404)

You don't find this leak at 3 AM. You find it at write-time:

```bash
npm install --save-dev eslint-plugin-pg
```

```js
// eslint.config.js — `configs` is a NAMED export (default export is the plugin)
import { configs } from "eslint-plugin-pg";

export default [configs.recommended];
```

```text
src/orders.js
  3:9  error  ⚡ CWE-404 OWASP:A05-Injection | PG client acquired but not released. | HIGH
             Fix: Ensure "client.release()" is called in a finally block to return the client to the pool.
```

> **What it actually checks — and what it doesn't.** The rule is deliberately
> AST-structural: it finds `const client = await pool.connect()` and flags it
> when **no `client.release()` call references that client anywhere in scope** —
> the overwhelmingly common leak (the release that was simply never written). It
> does _not_ prove your release runs on every branch or sits in a `finally` —
> that's why you pair the rule with the patterns above. It catches the omission;
> the `finally`/`pool.query()` shape makes the placement correct. (It also keys
> off a plain `const client = …` assignment, so destructured checkouts are out
> of scope.)

## The connection-lifecycle family

`no-missing-client-release` is one of a small set in `eslint-plugin-pg` that
guard the borrow→use→return lifecycle:

| Rule                                                                                                                  | CWE     | Catches                                                           |
| --------------------------------------------------------------------------------------------------------------------- | ------- | ----------------------------------------------------------------- |
| [`no-missing-client-release`](https://eslint.interlace.tools/docs/security/plugin-pg/rules/no-missing-client-release) | CWE-404 | a checked-out client that's never released                        |
| [`prefer-pool-query`](https://eslint.interlace.tools/docs/security/plugin-pg/rules/prefer-pool-query)                 | CWE-400 | a manual checkout for a single-shot query — use `pool.query()`    |
| [`no-floating-query`](https://eslint.interlace.tools/docs/security/plugin-pg/rules/no-floating-query)                 | CWE-391 | a query promise neither `await`ed nor `return`ed                  |
| [`prevent-double-release`](https://eslint.interlace.tools/docs/security/plugin-pg/rules/prevent-double-release)       | —       | `client.release()` called more than once on the same client       |
| [`no-transaction-on-pool`](https://eslint.interlace.tools/docs/security/plugin-pg/rules/no-transaction-on-pool)       | —       | `BEGIN`/`COMMIT` issued on the pool instead of a dedicated client |

`—` = no CWE in the emitted finding; these two carry a CWE only in their
`meta.docs` metadata, not in the lint message itself.

---

## Compatibility

| Surface              | Support                                                                               |
| -------------------- | ------------------------------------------------------------------------------------- |
| **Package managers** | npm, yarn, pnpm, bun                                                                  |
| **Node**             | `>= 18.0.0`                                                                           |
| **ESLint**           | `^8.0.0 \|\| ^9.0.0 \|\| ^10.0.0`, flat config                                        |
| **`pg` driver**      | peer `^6 \|\| ^7 \|\| ^8`; AST-based, lints regardless of installed version           |
| **Module system**    | CommonJS — `eslint.config.js` or `.mjs`                                               |
| **Oxlint**           | Loads under Oxlint's JS-plugin runner via the `interlace-pg` port, parity-gated in CI |

```bash
# npm / yarn / pnpm / bun
npm install --save-dev eslint-plugin-pg
yarn add -D eslint-plugin-pg
pnpm add -D eslint-plugin-pg
bun add -d eslint-plugin-pg
```

---

## Where this fits

`no-missing-client-release` is the availability member of `eslint-plugin-pg` —
the same plugin that catches SQL injection and the N+1 insert loop. The deeper
dives:

- [The full `eslint-plugin-pg` set](https://ofriperetz.dev/articles/getting-started-eslint-plugin-pg) — all 13 rules
- [The N+1 insert loop](https://ofriperetz.dev/articles/n-plus-1-insert-loop-api-performance) — the other "fine in dev, melts in prod" pattern
- [`search_path` hijacking](https://ofriperetz.dev/articles/searchpath-hijacking-postgresql-attack) — the obscure A05 attack

---

## Links

- 📦 [npm: eslint-plugin-pg](https://www.npmjs.com/package/eslint-plugin-pg)
- 📖 [Rule docs: no-missing-client-release](https://eslint.interlace.tools/docs/security/plugin-pg/rules/no-missing-client-release)
- 💻 [Source on GitHub](https://github.com/ofri-peretz/eslint/tree/main/packages/eslint-plugin-pg)

::dev-to-cta{url="https://github.com/ofri-peretz/eslint"}
⭐ Star on GitHub if a missing `client.release()` has ever paged you at 3 AM.
::

---

I'm **Ofri Peretz**, a security engineering leader and the author of the
Interlace ESLint ecosystem — domain-specific static analysis for security,
reliability, and performance on the Node.js stack. `eslint-plugin-pg` is its
node-postgres layer.

[ofriperetz.dev](https://ofriperetz.dev) · [LinkedIn](https://linkedin.com/in/ofri-peretz) · [GitHub](https://github.com/ofri-peretz)
