---
title: "pg Lets You Concatenate SQL, Hijack search_path, and Leak Every Connection. 13 ESLint Rules Say No."
description: "SQL injection, search_path schema hijacking, and the missing client.release() that exhausts your pool — node-postgres bugs that pass tests and take down production. 13 CWE-mapped ESLint rules that catch them in CI."
slug: "getting-started-eslint-plugin-pg"
canonical_url: "https://ofriperetz.dev/articles/getting-started-eslint-plugin-pg"
devto_url: "https://dev.to/ofri-peretz/getting-started-with-eslint-plugin-pg-43pj"
devto_id: 3138840
published_at: "2025-12-31T18:45:40Z"
edited_at: "2026-01-11T10:21:52Z"
cover_image: "https://dev-to-uploads.s3.amazonaws.com/uploads/articles/7xvyy2px23d7rolvt8kf.png"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/getting-started-eslint-plugin-pg.png"
reading_time_minutes: 9
tags:
  - "eslint"
  - "postgres"
  - "node"
  - "database"
author:
  name: "Ofri Peretz"
  username: "ofri-peretz"
  avatar: "https://media2.dev.to/dynamic/image/width=640,height=640,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Fuser%2Fprofile_image%2F3669992%2F50a1f256-472c-48a1-85e8-149459647ea7.png"
  twitter: "ofriperetzdev"
series: "Postgres Security Protocol"
---

`node-postgres` (`pg`) is a thin, honest driver. It hands you a connection and
runs the SQL you give it — including the SQL you should never have built:

```ts
// SQL injection
pool.query(`SELECT * FROM users WHERE email = '${req.query.email}'`);

// connection leak — client never returned to the pool
const client = await pool.connect();
const rows = await client.query("SELECT ...");
return rows; // forgot client.release(); one of these per request and the pool dies
```

The first is **CWE-89**, a textbook injection. The second is **CWE-404**: a
missing `client.release()` that leaks one connection per request until the pool
hits its limit and every subsequent request hangs — a slow-motion outage that
passes every unit test, because tests rarely exhaust a 10-connection pool.

Both are _shapes in the source_. `eslint-plugin-pg` is **13 rules** that read
your `pg` call sites and fail CI on those shapes — SQL injection, `search_path`
hijacking, connection leaks, transaction-on-pool mistakes — each pinned to a
CWE.

This guide covers the flagship injection rule, the one PostgreSQL attack almost
nobody guards against (`search_path` hijacking), the connection-lifecycle
family, install/config across package managers, and exact engine support.

---

## TL;DR

- **13 rules**, each carrying a `CWE` id and CVSS. Flagship: `no-unsafe-query`
  (SQL injection, CWE-89, CVSS 9.8).
- **3 presets**: `flagship` (the 1 flagship rule), `recommended` (all 13, a few
  as warnings), and `strict` (all 13, max severity). It's a focused plugin, so
  the sane default _is_ everything.
- **Flat-config**, CommonJS, ESLint `8 || 9 || 10`, Node `>= 18`. Declares a
  `pg` peer (`^6 || ^7 || ^8`), but the rules are AST-based and lint your code
  regardless of which `pg` you've installed.

---

## Flagship: `no-unsafe-query` (SQL injection)

```ts
// ❌ no-unsafe-query (CWE-89, CVSS 9.8)
pool.query(`SELECT * FROM users WHERE email = '${email}'`);
pool.query("SELECT * FROM users WHERE id = " + id);
```

```ts
// ✅ parameterized — values travel out-of-band, never parsed as SQL
pool.query("SELECT * FROM users WHERE email = $1", [email]);
pool.query("SELECT * FROM users WHERE id = $1", [id]);
```

The rule flags string concatenation and interpolated template literals in
`query()` calls. Parameterized queries (`$1`, `$2`) send values over the wire
separately from the statement, so they can never change its structure — the
one defense that actually works.

---

## The one almost nobody guards: `search_path` hijacking

This is the rule worth installing the plugin for, because the attack is
invisible to ORMs and code review alike.

```ts
// ❌ no-unsafe-search-path (CWE-426, CRITICAL)
await client.query(`SET search_path TO tenant_${tenantId}`);
```

**Why it's dangerous.** When you reference a table or function _unqualified_ —
`SELECT * FROM accounts`, `crypt(...)` — PostgreSQL resolves the name by walking
`search_path`, schema by schema, and uses the first match. `search_path` is
therefore a **name-resolution control surface**. If an attacker influences it
(a tenant id, a user-controlled value, or a schema they can create objects in),
they can put a malicious `accounts` table or a shadowing `crypt()` function
earlier in the path. Your unqualified query silently binds to _their_ object,
and now it returns their data — or runs their function with your privileges.

**Why parameterization doesn't save you here.** `SET` does **not** accept bind
parameters — `SET search_path = $1` is a syntax error. So the usual "just
parameterize it" reflex fails, and people fall back to string interpolation,
which is exactly the hole.

```ts
// ✅ make the identifier safe, or don't let it be dynamic at all
import format from "pg-format";
await client.query(format("SET search_path TO %I", tenantSchema)); // %I = quoted identifier

// or validate against an allow-list / integer id before it ever reaches SQL:
const schema = TENANT_SCHEMAS[tenantId]; // throws/handles if unknown
await client.query(format("SET search_path TO %I", schema));
```

`%I` (or `quote_ident()`) quotes and escapes the value as an _identifier_,
making schema injection impossible; an allow-list removes the dynamic value
entirely. `no-unsafe-search-path` (CWE-426) makes the dynamic form a CI error.

> **Static-analysis caveat.** The rule flags a _dynamic_ `SET search_path`; it
> can't prove at lint time that `%I` escaped the value, so it may still flag the
> `format()` form. That's the conservative-by-design behavior — the durable fix
> is to remove the dynamic value (a static `search_path`, an allow-listed
> schema, or fully-qualified names like `schema.accounts`). Where a validated
> dynamic value is genuinely required, apply `%I`/allow-list and add a
> documented scoped disable.

---

## The connection-lifecycle family

The bugs that don't leak data — they take the database down.

| Rule                        | What goes wrong                                                                                  | CWE     |
| --------------------------- | ------------------------------------------------------------------------------------------------ | ------- |
| `no-missing-client-release` | `pool.connect()` without `client.release()` → pool exhaustion                                    | CWE-404 |
| `prevent-double-release`    | `release()` called twice → returns a reused/closed client                                        | CWE-415 |
| `no-transaction-on-pool`    | `BEGIN`/`COMMIT` on the pool, not a single client → statements land on different connections     | CWE-662 |
| `prefer-pool-query`         | manual connect/release for a one-shot query → use `pool.query()` and skip the leak risk entirely | CWE-400 |

A single missing `release()` on a hot path is the classic "the database was
fine, then at 3pm everything hung" outage. The rule makes the omission visible
at review time, not at peak traffic.

---

## The full rule set

All 13, with each rule's declared CWE:

| Rule                        | Catches                                    | CWE      |
| --------------------------- | ------------------------------------------ | -------- |
| `no-unsafe-query`           | SQL injection (concat / template)          | CWE-89   |
| `no-unsafe-search-path`     | `search_path` schema hijacking             | CWE-426  |
| `no-unsafe-copy-from`       | `COPY FROM` with untrusted path/source     | CWE-73   |
| `check-query-params`        | `$n` placeholders vs params array mismatch | CWE-20   |
| `no-hardcoded-credentials`  | connection secrets in source               | CWE-798  |
| `no-insecure-ssl`           | TLS disabled / `rejectUnauthorized:false`  | CWE-319  |
| `no-missing-client-release` | leaked pooled connection                   | CWE-404  |
| `prevent-double-release`    | double `release()`                         | CWE-415  |
| `no-transaction-on-pool`    | transaction on the pool, not a client      | CWE-662  |
| `prefer-pool-query`         | manual connect for a one-shot query        | CWE-400  |
| `no-floating-query`         | un-awaited query promise                   | CWE-391  |
| `no-batch-insert-loop`      | N inserts in a loop instead of one batch   | CWE-1049 |
| `no-select-all`             | `SELECT *` (over-fetch / brittle)          | CWE-1049 |

---

## Install

```bash
# npm
npm install --save-dev eslint-plugin-pg
# yarn
yarn add --dev eslint-plugin-pg
# pnpm
pnpm add --save-dev eslint-plugin-pg
# bun
bun add --dev eslint-plugin-pg
```

Flat config (`eslint.config.js`):

```js
// `configs` is a NAMED export; the default export is the plugin object.
import { configs } from "eslint-plugin-pg";

export default [
  configs.recommended, // all 13 rules
  // configs.flagship,  // just no-unsafe-query
  // configs.strict,    // all 13 (same set, max severity)
];
```

Run it:

```bash
npx eslint .
```

Findings carry the CWE, OWASP category, CVSS, and fix:

```text
src/users.ts
  8:18  error  🔒 CWE-89 OWASP:A03-Injection CVSS:9.8 | Unsafe SQL query detected. Variable interpolation found. | CRITICAL
              Fix: Use parameterized queries ($1, $2) instead of string concatenation.
```

---

## Compatibility

| Surface              | Support                                                                                                                                                                                   |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Package managers** | npm, yarn, pnpm, bun — plain dev dependency                                                                                                                                               |
| **Node**             | `>= 18.0.0`                                                                                                                                                                               |
| **ESLint**           | `^8.0.0 \|\| ^9.0.0 \|\| ^10.0.0`, flat config                                                                                                                                            |
| **`pg` driver**      | peer `^6 \|\| ^7 \|\| ^8`; rules are AST-based and lint regardless of installed version                                                                                                   |
| **Module system**    | CommonJS — loads from both `eslint.config.js` and `eslint.config.mjs`                                                                                                                     |
| **Oxlint**           | Loads under Oxlint's JS-plugin runner via the `interlace-pg` port; the flagship rule is wired into the Oxlint config and parity-checked in CI. The full 13-rule set runs on ESLint today. |

---

## What it does — and doesn't — see

- **Source patterns, not the database.** It flags interpolated SQL, dynamic
  `SET search_path`, and missing `release()`. It can't see your actual schema,
  your `GRANT`s, or whether a tenant value is _really_ attacker-controlled —
  it errs toward flagging dynamic SQL so you make the call explicitly.
- **Pair it with the database's own defenses.** Least-privilege roles,
  `REVOKE CREATE ON SCHEMA public`, and qualified names are the runtime half;
  the linter ensures the source half never regresses.

---

## Where this sits in the ecosystem

Generic security linters flag `eval` and obvious string-built SQL, but they
don't know what a `Pool`, a `client.release()`, or `SET search_path` _is_.
`eslint-plugin-pg` is the dedicated node-postgres layer — injection, the
`search_path` resolution attack, and the connection-lifecycle bugs that cause
outages — each finding tagged with a CWE and CVSS. It's the Postgres member of
the [Interlace](https://eslint.interlace.tools) family, complementary to the
generic set and to the other data-layer plugins (`eslint-plugin-mongodb-security`, …).

---

## Links

- 📦 [npm: eslint-plugin-pg](https://www.npmjs.com/package/eslint-plugin-pg)
- 📖 [Full rule docs (per-rule CWE + examples)](https://eslint.interlace.tools/docs/security/plugin-pg/rules)
- 💻 [Source on GitHub](https://github.com/ofri-peretz/eslint/tree/main/packages/eslint-plugin-pg)

::dev-to-cta{url="https://github.com/ofri-peretz/eslint"}
⭐ Star on GitHub if your `pg` code does any of the above.
::

---

I'm **Ofri Peretz**, a security engineering leader and the author of the
Interlace ESLint ecosystem — domain-specific static analysis for security,
reliability, and performance on the Node.js stack. `eslint-plugin-pg` is its
node-postgres layer.

[ofriperetz.dev](https://ofriperetz.dev) · [LinkedIn](https://linkedin.com/in/ofri-peretz) · [GitHub](https://github.com/ofri-peretz)
