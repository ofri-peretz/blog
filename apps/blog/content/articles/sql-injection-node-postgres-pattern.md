---
title: "Hardening the Data Layer: The node-postgres Engineering Standard"
description: "Eliminate the #1 database vulnerability. An automated static analysis protocol for preventing SQL injection in high-scale Node.js environments."
slug: "sql-injection-node-postgres-pattern"
canonical_url: "https://ofriperetz.dev/articles/sql-injection-node-postgres-pattern"
devto_url: "https://dev.to/ofri-peretz/sql-injection-in-node-postgres-the-pattern-everyone-gets-wrong-54mn"
devto_id: 3137480
published_at: "2025-12-31T05:50:50Z"
edited_at: "2026-01-11T10:22:01Z"
cover_image: "https://media2.dev.to/dynamic/image/width=1000,height=420,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fofriperetz.dev%2Fcdn%2Fblog-cover-image%2Fsql-injection-node-postgres-pattern.png"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/sql-injection-node-postgres-pattern.png"
reading_time_minutes: 2
tags:
  - "eslint"
  - "postgres"
  - "node"
  - "security"
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

I've reviewed hundreds of Node.js + PostgreSQL codebases. The same vulnerability appears in 80% of them.

## The Pattern That Looks Safe

```javascript
// ❌ This looks fine, right?
async function getUser(userId) {
  const query = `SELECT * FROM users WHERE id = '${userId}'`;
  const result = await pool.query(query);
  return result.rows[0];
}
```

It's clean. It's readable. It's also a critical security vulnerability.

## The Attack

```javascript
// Attacker input:
const userId = "'; DROP TABLE users; --";

// Generated query:
// SELECT * FROM users WHERE id = ''; DROP TABLE users; --'
```

Your users table is gone. Your data is gone. Your job might be gone.

## Why Developers Keep Making This Mistake

| Reason                       | Reality                           |
| ---------------------------- | --------------------------------- |
| "I validate the input"       | Validation can be bypassed        |
| "It's an internal API"       | Internal APIs get exposed         |
| "Template literals are safe" | They're just string concatenation |
| "ORM handles this"           | Not if you use raw queries        |

## The Correct Pattern

```javascript
// ✅ Parameterized query - the ONLY safe pattern
async function getUser(userId) {
  const query = "SELECT * FROM users WHERE id = $1";
  const result = await pool.query(query, [userId]);
  return result.rows[0];
}
```

The `$1` placeholder tells PostgreSQL to treat the value as data, not code. No amount of SQL injection can escape this.

## Let ESLint Enforce This

```bash
npm install --save-dev eslint-plugin-pg
```

```javascript
// eslint.config.js
import pg from "eslint-plugin-pg";
export default [pg.configs.recommended];
```

Now run your linter:

```bash
src/users.ts
  4:17  error  🔒 CWE-89 OWASP:A03 CVSS:9.8 | Unsafe query detected
               Fix: Use parameterized query: client.query('SELECT * FROM users WHERE id = $1', [userId])
```

## More Examples

### ❌ Dynamic table names

```javascript
const table = userInput;
pool.query(`SELECT * FROM ${table}`); // SQL injection
```

### ✅ Allowlist tables

```javascript
const ALLOWED_TABLES = ["users", "orders", "products"];
if (!ALLOWED_TABLES.includes(table)) throw new Error("Invalid table");
pool.query(`SELECT * FROM ${table}`); // Now safe
```

### ❌ Building WHERE clauses

```javascript
let query = "SELECT * FROM users WHERE 1=1";
if (name) query += ` AND name = '${name}'`; // Injection!
```

### ✅ Build params array

```javascript
const params = [];
let query = "SELECT * FROM users WHERE 1=1";
if (name) {
  params.push(name);
  query += ` AND name = $${params.length}`;
}
await pool.query(query, params);
```

## Quick Install

```bash
npm install --save-dev eslint-plugin-pg in 60 seconds. 15 rules.** PostgreSQL security. Connection management. Query optimization.

---
📦 [npm: eslint-plugin-pg](https://www.npmjs.com/package/eslint-plugin-pg)
📖 [Rule docs: no-unsafe-query](https://github.com/ofri-peretz/eslint/blob/main/packages/eslint-plugin-pg/docs/rules/no-unsafe-query.md)

::dev-to-cta{url="https://github.com/ofri-peretz/eslint"}
⭐ Star on GitHub
::

---

**The Interlace ESLint Ecosystem**
Interlace is a high-fidelity suite of static code analyzers designed to automate security, performance, and reliability for the modern Node.js stack. With over 330 rules across 18 specialized plugins, it provides 100% coverage for OWASP Top 10, LLM Security, and Database Hardening.

[Explore the full Documentation](https://eslint.interlace.tools)
---

© 2026 Ofri Peretz. All rights reserved.

---

**Build Securely.**
I'm Ofri Peretz, a Security Engineering Leader and the architect of the Interlace Ecosystem. I build static analysis standards that automate security and performance for Node.js fleets at scale.

[ofriperetz.dev](https://ofriperetz.dev) | [LinkedIn](https://linkedin.com/in/ofri-peretz) | [GitHub](https://github.com/ofri-peretz)
```
