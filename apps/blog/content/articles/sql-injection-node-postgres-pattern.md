---
title: "Your node-postgres Data Layer Fails 4 Ways in Production. SQL Injection Is Only the First."
description: "SQL injection is the famous node-postgres failure — but identifier hijacking, connection-pool exhaustion, and insecure transport page you at 3 AM just as hard. The four data-layer threat classes, the pg-specific ESLint rule for each, and the one config that turns them all on."
slug: "sql-injection-node-postgres-pattern"
canonical_url: "https://ofriperetz.dev/articles/sql-injection-node-postgres-pattern"
devto_url: "https://dev.to/ofri-peretz/sql-injection-in-node-postgres-the-pattern-everyone-gets-wrong-54mn"
devto_id: 3137480
published_at: "2025-12-31T05:50:50Z"
edited_at: "2026-01-11T10:22:01Z"
cover_image: "https://media2.dev.to/dynamic/image/width=1000,height=420,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fofriperetz.dev%2Fcdn%2Fblog-cover-image%2Fsql-injection-node-postgres-pattern.png"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/sql-injection-node-postgres-pattern.png"
reading_time_minutes: 6
tags:
  - "eslint"
  - "postgres"
  - "node"
  - "security"
author:
  name: "Ofri Peretz"
  username: "ofri-peretz"
  avatar: "https://media2.dev.to/dynamic/image/width=640,height=640,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Fuser%2Fprofile_image%2F3669992%2F50a1f256-472c-48a1-85e8-149459647ea7.png"
  twitter: "ofriperetzdev"
series: "Postgres Security Protocol"
---

Ask a backend engineer how the database layer fails and you'll hear "SQL
injection." It's real, it's CWE-89, and it's _one of four_ structural ways a
node-postgres data layer breaks in production. The other three — identifier
hijacking, connection-pool exhaustion, insecure transport — don't make the OWASP
headlines, but they page you at 3 AM all the same.

Each is a **structural** pattern (it survives code review precisely because each
line looks fine in isolation), and each has a dedicated rule in
`eslint-plugin-pg`. Here's the threat model and the rule that closes it.

| #   | Failure mode              | What an attacker (or load) controls   | The pg rule                 | CWE     |
| --- | ------------------------- | ------------------------------------- | --------------------------- | ------- |
| 1   | Injection via **values**  | a value spliced into the query string | `no-unsafe-query`           | CWE-89  |
| 2   | **Identifier** hijacking  | a table/schema name (`search_path`)   | `no-unsafe-search-path`     | CWE-426 |
| 3   | Connection **exhaustion** | a leaked pool client → pool empties   | `no-missing-client-release` | CWE-404 |
| 4   | Insecure **transport**    | TLS turned off to the database        | `no-insecure-ssl`           | CWE-319 |

---

## 1. Injection via values — `no-unsafe-query` (CWE-89)

The classic. A user-controlled **value** is concatenated or interpolated into the
SQL text instead of being passed as a parameter:

```js
client.query(`SELECT * FROM users WHERE id = ${req.query.id}`); // ❌
client.query("SELECT * FROM users WHERE id = $1", [req.query.id]); // ✅
```

The `$1` placeholder + values array is pg's escaping contract — the driver
handles quoting and types, and the pattern can't be accidentally broken.

```text
src/users.js
  3:3  error  🔒 CWE-89 OWASP:A03-Injection CVSS:9.8 | Unsafe SQL query detected. Variable interpolation found. | CRITICAL [SOC2,PCI-DSS,NIST-CSF]
             Fix: Use parameterized queries ($1, $2) instead of string concatenation.
```

(The ESLint CLI also appends the rule's doc URL to the `Fix:` line; it's trimmed
here for width.) The rule fires on `+`-concatenation, `${…}` template expressions, and
cross-line tainted variables in `.query()` calls — the full taxonomy is in
[Three SQL Injection Patterns That Still Ship](https://ofriperetz.dev/articles/three-sql-injection-patterns-node-postgres-eslint).

## 2. Identifier hijacking — `no-unsafe-search-path` (CWE-426)

Here's the part parameterization **can't** help with: `$1` binds _values_, not
_identifiers_. A table, column, or schema name can't be a bind parameter — so
when the schema is dynamic, teams fall back to interpolation, and an attacker who
controls `search_path` re-points an unqualified `SELECT * FROM users` at their
own table.

```js
await client.query(`SET search_path TO ${tenant}`); // ❌ identifier injection
```

`SET` rejects parameters, so the fix is identifier-escaping (`pg-format`'s `%I`)
or an allow-list — not a bind. The full attack and the defenses are in
[search_path Hijacking](https://ofriperetz.dev/articles/searchpath-hijacking-postgresql-attack).

## 3. Connection exhaustion — `no-missing-client-release` (CWE-404)

Not an attacker — just normal load against a leak. A `pool.connect()` whose
client is never released drains a 100-connection pool in minutes, and then
_every_ query times out:

```js
const client = await pool.connect();
const rows = await client.query("..."); // ❌ no client.release() — leaked
```

Release in a `finally`, or use `pool.query()` for single-shot queries. The 3 AM
post-mortem is in
[The Connection Leak That Exhausted Our Pool](https://ofriperetz.dev/articles/database-connection-leak-production-outage).

## 4. Insecure transport — `no-insecure-ssl` (CWE-319)

The one-line config that ships secrets in cleartext to the database:

```js
new Pool({ ssl: { rejectUnauthorized: false } }); // ❌ accepts any cert (MITM)
```

`rejectUnauthorized: false` disables certificate validation — convenient against
a self-signed dev cert, catastrophic in production. `no-insecure-ssl` flags it;
use a real CA bundle (`ssl: { ca: fs.readFileSync(...) }`) instead.

---

## One config turns on all four

```bash
# npm
npm install --save-dev eslint-plugin-pg
# yarn
yarn add -D eslint-plugin-pg
# pnpm
pnpm add -D eslint-plugin-pg
# bun
bun add -d eslint-plugin-pg
```

```js
// eslint.config.mjs — `configs` is a NAMED export (default export is the plugin)
import { configs } from "eslint-plugin-pg";

export default [
  // scope to where the database code lives
  {
    files: ["**/db/**", "**/repositories/**", "**/models/**"],
    ...configs.recommended,
  },
];
```

```yaml
# CI — block the PR on any new data-layer finding
- run: npx eslint . --max-warnings 0
```

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

---

## Where this fits

This is the data-layer **threat map**. Each failure mode has a dedicated deep-dive,
and the full plugin tour covers the rest of the 13 rules:

- [Three SQL Injection Patterns](https://ofriperetz.dev/articles/three-sql-injection-patterns-node-postgres-eslint) — the `no-unsafe-query` detection in depth
- [search_path Hijacking](https://ofriperetz.dev/articles/searchpath-hijacking-postgresql-attack) — the identifier attack most teams have never heard of
- [The Connection Leak Outage](https://ofriperetz.dev/articles/database-connection-leak-production-outage) — the 3 AM pool-exhaustion post-mortem
- [Getting Started with `eslint-plugin-pg`](https://ofriperetz.dev/articles/getting-started-eslint-plugin-pg) — all 13 rules end to end

---

## Links

- 📦 [npm: eslint-plugin-pg](https://www.npmjs.com/package/eslint-plugin-pg)
- 📖 [Full rule docs (per-rule CWE)](https://eslint.interlace.tools/docs/security/plugin-pg/rules)
- 💻 [Source on GitHub](https://github.com/ofri-peretz/eslint/tree/main/packages/eslint-plugin-pg)

::dev-to-cta{url="https://github.com/ofri-peretz/eslint"}
⭐ Star on GitHub if your data layer fails any of these four ways.
::

---

I'm **Ofri Peretz**, a security engineering leader and the author of the
Interlace ESLint ecosystem — domain-specific static analysis for security,
reliability, and performance on the Node.js stack. `eslint-plugin-pg` is its
node-postgres layer.

[ofriperetz.dev](https://ofriperetz.dev) · [LinkedIn](https://linkedin.com/in/ofri-peretz) · [GitHub](https://github.com/ofri-peretz)
