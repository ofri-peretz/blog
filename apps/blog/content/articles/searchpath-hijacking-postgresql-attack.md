---
title: "search_path Hijacking: the PostgreSQL Attack That Turns SELECT * FROM users Into the Attacker's Table"
description: "Control a connection's search_path and every unqualified query silently resolves to your schema. The obscure-but-lethal PostgreSQL attack, why SET can't be parameterized, the real fixes, and the CWE-426 ESLint rule that catches it."
slug: "searchpath-hijacking-postgresql-attack"
canonical_url: "https://ofriperetz.dev/articles/searchpath-hijacking-postgresql-attack"
devto_url: "https://dev.to/ofri-peretz/searchpath-hijacking-the-postgresql-attack-youve-never-heard-of-10co"
devto_id: 3144104
published_at: "2026-01-02T19:49:31Z"
edited_at: "2026-01-11T10:21:32Z"
cover_image: "https://ofriperetz.dev/og/cover/searchpath-hijacking-postgresql-attack"
social_image: "https://ofriperetz.dev/og/article/searchpath-hijacking-postgresql-attack"
reading_time_minutes: 8
tags:
  - "eslint"
  - "postgres"
  - "security"
  - "node"
author:
  name: "Ofri Peretz"
  username: "ofri-peretz"
  avatar: "https://media2.dev.to/dynamic/image/width=640,height=640,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Fuser%2Fprofile_image%2F3669992%2F50a1f256-472c-48a1-85e8-149459647ea7.png"
  twitter: "ofriperetzdev"
series: "Postgres Security Protocol"
---

Everyone knows SQL injection. Almost nobody guards `search_path` hijacking —
and it turns a perfectly ordinary `SELECT * FROM users` into a read from an
**attacker-controlled table**, no injection string required.

## What `search_path` is

When you reference a table _unqualified_, PostgreSQL resolves the name by
walking `search_path`, schema by schema, and uses the first match:

```sql
-- with search_path = public, these are equivalent:
SELECT * FROM users;
SELECT * FROM public.users;
```

`search_path` is therefore a **name-resolution control surface**: change it, and
the same query binds to a different table.

## The attack

```js
// ❌ search_path set from user input
const schema = req.query.tenant; // attacker controls this
await client.query(`SET search_path TO ${schema}`);
await client.query("SELECT * FROM users"); // now reads the attacker's table
```

The attacker creates a schema with a malicious `users` table (or a shadowing
`crypt()` function), points `search_path` at it, and your unqualified query
returns their data — or runs their function with your privileges.

| Vector               | Impact                                             |
| -------------------- | -------------------------------------------------- |
| Data redirection     | Read/return rows from a fake table; capture writes |
| Privilege escalation | Shadow a trusted `SECURITY DEFINER` function       |
| Code execution       | Malicious trigger/function invoked by your query   |

## Why you can't just parameterize it

The reflex for SQL injection is "use a bind parameter." It **doesn't work
here**: `SET` does not accept parameters —

```js
await client.query("SET search_path TO $1", [schema]); // ❌ syntax error
```

— so people fall back to string interpolation, which _is_ the hole. A schema
name is an **identifier**, and identifiers need identifier-escaping, not value
binding.

## The real fixes

**1. Don't use a dynamic `search_path` at all — fully-qualify names.** This
sidesteps the whole class:

```js
await client.query("SELECT * FROM public.users"); // resolution is explicit
```

**2. If the schema must be dynamic, escape it as an identifier** with
`pg-format`'s `%I` (the client-side equivalent of `quote_ident()`):

```js
import format from "pg-format";
// %I quotes + escapes the value as an identifier — schema injection is impossible
await client.query(format("SET search_path TO %I", tenantSchema));
```

**3. Or constrain the value so it _can't_ carry injection** — an allow-list of
known schemas, or an integer-only tenant id:

```js
const ALLOWED = new Set(["tenant_1", "tenant_2", "tenant_3"]);
if (!ALLOWED.has(schema)) throw new Error("unknown schema");
await client.query(format("SET search_path TO %I", schema));

// or: a numeric id literally cannot contain SQL
if (!Number.isInteger(tenantId)) throw new Error("bad tenant id");
await client.query(`SET search_path TO ${"tenant_" + tenantId}`); // integer-safe
```

What is **never** safe — no matter how "trusted" the source feels — is raw
interpolation of a string identifier: `SET search_path TO ${schema}` is the
vulnerability, not the fix.

## The rule: `no-unsafe-search-path` (CWE-426)

```text
src/tenants.ts
  8:15  error  🔒 CWE-426 OWASP:A05-Security CVSS:7.5 | Unsafe "SET search_path" detected. | CRITICAL [SOC2,PCI-DSS]
              Fix: Do not use dynamic values for search_path. Use static strings or strict validation.
```

```bash
npm install --save-dev eslint-plugin-pg
```

```js
// `configs` is a NAMED export; the default export is the plugin object.
import { configs } from "eslint-plugin-pg";
export default [configs.recommended];
```

> **Conservative by design.** The rule flags **any** dynamic `SET search_path` —
> it can't prove at lint time that your `%I`/allow-list/integer guard is
> correct. That's intentional: a dynamic search_path is a decision worth a human
> look. Prefer the static/qualified forms; where a validated dynamic value is
> genuinely required, apply `%I` or an allow-list and add a documented
> `// eslint-disable-next-line pg/no-unsafe-search-path` with the reason.

## The multi-tenant pattern, done right

```js
import format from "pg-format";

async function queryTenant(tenantId, sql, params) {
  const tenant = await getTenant(tenantId); // trusted lookup
  if (!tenant) throw new Error("unknown tenant");

  const client = await pool.connect();
  try {
    // identifier-escaped — even a trusted value goes through %I
    await client.query(format("SET search_path TO %I, public", tenant.schema));
    return await client.query(sql, params);
  } finally {
    await client.query("SET search_path TO public"); // reset
    client.release();
  }
}
```

The difference from the broken version: `tenant.schema` being "from a trusted
source" is **not** sufficient — a future refactor, a renamed tenant, or a
mis-seeded row makes "trusted" untrue. Routing it through `%I` makes the
identifier safe by construction, regardless of provenance.

## Defense in depth (the database side)

Static analysis guards the source; pair it with the server:

- `REVOKE CREATE ON SCHEMA public FROM PUBLIC` so attackers can't create the
  shadowing schema/objects in the first place.
- Set a safe `search_path` on the role/function (`ALTER FUNCTION … SET search_path = pg_catalog, public`)
  for `SECURITY DEFINER` functions.
- Qualify names in security-sensitive code regardless.

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

`no-unsafe-search-path` is one of 13 rules in `eslint-plugin-pg`; the
[pg getting-started](https://ofriperetz.dev/articles/getting-started-eslint-plugin-pg)
covers the rest — SQL injection, connection leaks, the N+1 insert loop.

---

- 📦 [npm: eslint-plugin-pg](https://www.npmjs.com/package/eslint-plugin-pg)
- 📖 [Rule docs: no-unsafe-search-path](https://eslint.interlace.tools/docs/security/plugin-pg/rules/no-unsafe-search-path)
- 💻 [Source on GitHub](https://github.com/ofri-peretz/eslint/tree/main/packages/eslint-plugin-pg)

::dev-to-cta{url="https://github.com/ofri-peretz/eslint"}
⭐ Star on GitHub if you've ever set `search_path` from a variable.
::

---

I'm **Ofri Peretz**, a security engineering leader and the author of the
Interlace ESLint ecosystem — domain-specific static analysis for security,
reliability, and performance on the Node.js stack. `eslint-plugin-pg` is its
node-postgres layer.

[ofriperetz.dev](https://ofriperetz.dev) · [LinkedIn](https://linkedin.com/in/ofri-peretz) · [GitHub](https://github.com/ofri-peretz)
