---
title: "Post-Mortem: Race Conditions in PostgreSQL Pools (And the Guard)"
description: "A technical post-mortem on transaction corruption in Node.js. Learn the static analysis standard for safe transaction management on pooled clients."
slug: "transaction-race-conditions-begin-on-pool"
canonical_url: "https://ofriperetz.dev/articles/transaction-race-conditions-begin-on-pool"
devto_url: "https://dev.to/ofri-peretz/transaction-race-conditions-why-begin-on-pool-breaks-everything-117h"
devto_id: 3138993
published_at: "2025-12-31T21:38:13Z"
edited_at: "2026-01-11T10:21:47Z"
cover_image: "https://media2.dev.to/dynamic/image/width=1000,height=420,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fofriperetz.dev%2Fcdn%2Fblog-cover-image%2Ftransaction-race-conditions-begin-on-pool.png"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/transaction-race-conditions-begin-on-pool.png"
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

**Managing transactions on a shared connection pool is an architectural minefield. Here is the technical post-mortem on race conditions, and the static analysis standard for safe PostgreSQL transaction management.**

This code looks correct. It passes all tests. It works in development.

In production with 100 concurrent users, it corrupts data.

## The Bug

```javascript
// ❌ Dangerous: Transaction on pool
async function transferFunds(from, to, amount) {
  await pool.query("BEGIN");
  await pool.query("UPDATE accounts SET balance = balance - $1 WHERE id = $2", [
    amount,
    from,
  ]);
  await pool.query("UPDATE accounts SET balance = balance + $1 WHERE id = $2", [
    amount,
    to,
  ]);
  await pool.query("COMMIT");
}
```

## Why It Fails

A PostgreSQL **pool** is a set of client connections. Each `pool.query()` can use a **different client**.

```sql
Request 1: pool.query('BEGIN')     → Client A
Request 1: pool.query('UPDATE...')  → Client B (different!)
Request 2: pool.query('BEGIN')     → Client A (reused!)
```

Your transaction is now spread across multiple clients. Your data is now inconsistent.

## The Correct Pattern

```javascript
// ✅ Safe: Get dedicated client, use it for entire transaction
async function transferFunds(from, to, amount) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "UPDATE accounts SET balance = balance - $1 WHERE id = $2",
      [amount, from],
    );
    await client.query(
      "UPDATE accounts SET balance = balance + $1 WHERE id = $2",
      [amount, to],
    );
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
```

**Same client** for `BEGIN`, all queries, and `COMMIT`. Transaction integrity guaranteed.

## The Rule

```javascript
// ❌ pool.query('BEGIN')      → Error
// ❌ pool.query('COMMIT')     → Error
// ❌ pool.query('ROLLBACK')   → Error
// ❌ pool.query('SAVEPOINT')  → Error

// ✅ client.query('BEGIN')    → OK
// ✅ pool.query('SELECT...')  → OK (no transaction)
```

## Let ESLint Catch This

```bash
npm install --save-dev eslint-plugin-pg
```

```javascript
import pg from "eslint-plugin-pg";
export default [pg.configs.recommended];
```

The [`no-transaction-on-pool`](https://eslint.interlace.tools/docs/security/plugin-pg/rules/no-transaction-on-pool) rule catches every case:

```bash
src/transfer.ts
  3:9  error  🔒 CWE-362 | Transaction command on pool - use pool.connect() for transactions
               Fix: const client = await pool.connect(); client.query('BEGIN');
```

## Helper Function Pattern

```javascript
// ✅ Reusable transaction wrapper
async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

// Usage
await withTransaction(async (client) => {
  await client.query("UPDATE accounts SET...", [amount, from]);
  await client.query("UPDATE accounts SET...", [amount, to]);
});
```

## When To Use What

| Scenario                     | Use                                 |
| ---------------------------- | ----------------------------------- |
| Single query                 | `pool.query()`                      |
| Multiple independent queries | `pool.query()`                      |
| Transaction (BEGIN/COMMIT)   | `pool.connect()` → `client.query()` |
| Long-running session         | `pool.connect()` → `client.query()` |

## Quick Install

```bash
npm install --save-dev eslint-plugin-pg
```

```javascript
import pg from "eslint-plugin-pg";
export default [pg.configs.recommended];
```

Don't let race conditions corrupt your data.

---

📦 [npm: eslint-plugin-pg](https://www.npmjs.com/package/eslint-plugin-pg)
📖 [Rule docs: no-transaction-on-pool](https://github.com/ofri-peretz/eslint/blob/main/packages/eslint-plugin-pg/docs/rules/no-transaction-on-pool.md)

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
