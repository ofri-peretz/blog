---
title: "Exploit Analysis: search_path Hijacking (The Hidden PostgreSQL Attack)"
description: "Engineering against architectural vulnerabilities. A professional analysis of search_path hijacking and the static analysis standard for prevention."
slug: "searchpath-hijacking-postgresql-attack"
canonical_url: "https://ofriperetz.dev/articles/searchpath-hijacking-postgresql-attack"
devto_url: "https://dev.to/ofri-peretz/searchpath-hijacking-the-postgresql-attack-youve-never-heard-of-10co"
devto_id: 3144104
published_at: "2026-01-02T19:49:31Z"
edited_at: "2026-01-11T10:21:32Z"
cover_image: "https://dev-to-uploads.s3.amazonaws.com/uploads/articles/09u14i6uhdwthcrjbygm.png"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/searchpath-hijacking-postgresql-attack.png"
reading_time_minutes: 2
tags:
  - "eslint"
  - "postgres"
  - "security"
  - "node"
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

**Search_path hijacking is an obscure but lethal attack on PostgreSQL apps. Here is the architectural analysis and the automated static analysis standard built to prevent it across the fleet.**

Most developers know about SQL injection. Few know about search_path hijacking.

It's just as dangerous.

## What is search_path?

PostgreSQL's `search_path` determines which schema to look in when you reference an unqualified table name.

```sql
-- With search_path = public, these are equivalent:
SELECT * FROM users;
SELECT * FROM public.users;
```

## The Attack

If an attacker can control the search_path, they can redirect your queries to malicious tables:

```javascript
// ❌ Dynamic search_path from user input
const schema = req.query.tenant; // Attacker controls this
await client.query(`SET search_path TO ${schema}`);
await client.query("SELECT * FROM users"); // Now queries attacker's schema
```

The attacker:

1. Creates a schema with a malicious `users` table
2. Sets search_path to their schema
3. Your query returns their fake data

## Why This Matters

| Attack                   | Impact                          |
| ------------------------ | ------------------------------- |
| **Data theft**           | Return fake data, capture input |
| **Privilege escalation** | Replace security functions      |
| **Code execution**       | Malicious triggers, functions   |

## The Correct Pattern

```javascript
// ✅ Static search_path
await client.query(`SET search_path TO tenant_${tenantId}`);

// ✅ Validated against allowlist
const ALLOWED_SCHEMAS = ["tenant_1", "tenant_2", "tenant_3"];
if (!ALLOWED_SCHEMAS.includes(schema)) {
  throw new Error("Invalid schema");
}
await client.query(`SET search_path TO ${schema}`);

// ✅ Fully qualified table names
await client.query("SELECT * FROM public.users"); // Explicit schema
```

## Let ESLint Catch This

```bash
npm install --save-dev eslint-plugin-pg
```

```javascript
import pg from "eslint-plugin-pg";
export default [pg.configs.recommended];
```

Dynamic search_path is caught:

```bash
src/tenants.ts
  8:15  error  🔒 CWE-426 | Dynamic search_path detected
               Fix: Use static schema name or validate against allowlist
```

## Multi-Tenant Pattern

```javascript
// ✅ Safe multi-tenant with validated schema
async function queryTenant(tenantId, sql, params) {
  // Validate tenant exists
  const tenant = await getTenant(tenantId);
  if (!tenant) throw new Error("Unknown tenant");

  const client = await pool.connect();
  try {
    // Schema name from trusted source, not user input
    await client.query(`SET search_path TO tenant_${tenant.id}`);
    return await client.query(sql, params);
  } finally {
    // Reset search_path
    await client.query("SET search_path TO public");
    client.release();
  }
}
```

## Quick Install

```bash
npm install --save-dev eslint-plugin-pg
```

```javascript
import pg from "eslint-plugin-pg";
export default [pg.configs.recommended];
```

Don't let attackers hijack your queries.

---

📦 [npm: eslint-plugin-pg](https://www.npmjs.com/package/eslint-plugin-pg)
📖 [Rule docs: no-unsafe-search-path](https://github.com/ofri-peretz/eslint/blob/main/packages/eslint-plugin-pg/docs/rules/no-unsafe-search-path.md)

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
