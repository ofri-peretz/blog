---
title: "Post-Mortem: The Connection Leak Outage (And the Static Analysis Standard)"
description: "A technical breakdown of a production outage caused by node-postgres leaks. Learn the static analysis standard we built to prevent it forever."
slug: "database-connection-leak-production-outage"
canonical_url: "https://ofriperetz.dev/articles/database-connection-leak-production-outage"
devto_url: "https://dev.to/ofri-peretz/the-connection-leak-that-took-down-our-production-database-3bal"
devto_id: 3138991
published_at: "2025-12-31T21:35:53Z"
edited_at: "2026-01-11T10:21:49Z"
cover_image: "https://media2.dev.to/dynamic/image/width=1000,height=420,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fofriperetz.dev%2Fcdn%2Fblog-cover-image%2Fdatabase-connection-leak-production-outage.png"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/database-connection-leak-production-outage.png"
reading_time_minutes: 2
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

**Connection leaks aren't just bugs—they are production-killing events. Here is the post-mortem of an outage we survived, and the automated static analysis standard we built to make it biologically impossible to repeat.**

It was 3 AM. PagerDuty woke me up. Our API was returning 500 errors.

The database was fine. CPU was fine. Memory was fine. But every query was timing out.

## The Problem

```yaml
FATAL: too many connections for role "app_user"
```

We had exhausted our 100-connection limit. But our traffic was normal. Where were all the connections going?

## The Leak

After hours of debugging, we found it:

```javascript
// ❌ The connection leak hiding in our codebase
async function getUserOrders(userId) {
  const client = await pool.connect();
  const orders = await client.query("SELECT * FROM orders WHERE user_id = $1", [
    userId,
  ]);
  return orders.rows;
  // Where's client.release()? 🤔
}
```

Every call leaked a connection. With 50 requests/minute, we exhausted the pool in 2 minutes.

## Why This Happens

| Scenario                        | Result                          |
| ------------------------------- | ------------------------------- |
| Forgot `release()` entirely     | Connection never returned       |
| Early return before `release()` | Connection leaked               |
| Exception thrown                | `finally` block missing         |
| Async error                     | Unhandled rejection, no cleanup |

## The Correct Pattern

```javascript
// ✅ Always release in finally block
async function getUserOrders(userId) {
  const client = await pool.connect();
  try {
    const orders = await client.query(
      "SELECT * FROM orders WHERE user_id = $1",
      [userId],
    );
    return orders.rows;
  } finally {
    client.release(); // Always executes
  }
}
```

Or even better—don't use `connect()` at all for simple queries:

```javascript
// ✅ Best pattern: use pool.query() directly
async function getUserOrders(userId) {
  const orders = await pool.query("SELECT * FROM orders WHERE user_id = $1", [
    userId,
  ]);
  return orders.rows;
}
```

## Let ESLint Catch This

```bash
npm install --save-dev eslint-plugin-pg
```

```javascript
import pg from "eslint-plugin-pg";
export default [pg.configs.recommended];
```

Now every missing release is caught:

```bash
src/orders.ts
  3:17  error  🔒 CWE-772 | Missing client.release() detected
               Fix: Add client.release() in finally block or use pool.query() for simple queries
```

## The Rule: [`no-missing-client-release`](https://eslint.interlace.tools/docs/security/plugin-pg/rules/no-missing-client-release)

This rule tracks:

- Every `pool.connect()` call
- Every code path through the function
- Whether `client.release()` is called on all paths
- Whether it's in a `finally` block (recommended)

## Production Impact

After deploying this rule:

- **0 connection leaks** in 6 months
- **No more 3 AM pages** for connection exhaustion
- **CI catches issues** before they reach staging

## Quick Install

```bash
npm install --save-dev eslint-plugin-pg
```

```javascript
import pg from "eslint-plugin-pg";
export default [pg.configs.recommended];
```

Don't wait for the 3 AM wake-up call.

---

📦 [npm: eslint-plugin-pg](https://www.npmjs.com/package/eslint-plugin-pg)
📖 [Rule docs: no-missing-client-release](https://github.com/ofri-peretz/eslint/blob/main/packages/eslint-plugin-pg/docs/rules/no-missing-client-release.md)

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
