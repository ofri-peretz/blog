---
title: "PostgreSQL Injection in Node.js: 4 Patterns That Pass Code Review, and the 13 Rules That Catch Them"
description: "SQL injection (CVSS 9.8), search_path schema hijacking (CVSS 7.5), COPY FROM filesystem access (CVSS 9.5), and pool connection leaks (CWE-404) — four node-postgres patterns that survive review every time, and the 13 ESLint rules in eslint-plugin-postgresql-security v1.4.6 that turn all four into CI errors. Install, config, and what each finding means."
slug: "getting-started-eslint-plugin-pg"
canonical_url: "https://ofriperetz.dev/articles/getting-started-eslint-plugin-pg"
tier: "TUTORIAL"
devto_url: "https://dev.to/ofri-peretz/getting-started-with-eslint-plugin-pg-43pj"
devto_id: 3138840
published_at: "2025-12-31T18:45:40Z"
edited_at: "2026-07-28T00:00:00Z"
cover_image: "https://ofriperetz.dev/cdn/blog-cover-image/getting-started-eslint-plugin-pg.jpg?v=b2"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/getting-started-eslint-plugin-pg-og.jpg?v=b2"
reading_time_minutes: 12
tags:
  - "security"
  - "node"
  - "devsecops"
  - "eslint"
author:
  name: "Ofri Peretz"
  username: "ofri-peretz"
  avatar: "https://media2.dev.to/dynamic/image/width=640,height=640,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Fuser%2Fprofile_image%2F3669992%2F50a1f256-472c-48a1-85e8-149459647ea7.png"
  twitter: "ofriperetzdev"
series: "Postgres Security Protocol"
---

> **Four `pg` patterns that pass code review every time.** One dev dependency turns all four into CI errors. Here is the sixty-second install, then each pattern, why it survives review, and the rule that stops it.

`node-postgres` (`pg`) is a thin, honest driver. It hands you a connection and runs whatever SQL you give it, including the SQL you should never have built. It has no opinion about the difference — which means the opinion has to live somewhere else. Your linter is the cheapest place to put it.

---

## Install it first (60 seconds)

```bash
npm install --save-dev eslint-plugin-postgresql-security
```

Flat config (`eslint.config.js`):

```js
import { configs } from "eslint-plugin-postgresql-security";

export default [
  configs.recommended, // all 13 rules
];
```

Run it:

```bash
npx eslint .
```

That is the entire setup. Everything below is what the 13 rules are actually for.

---

## Pattern 1: String interpolation in `query()` (CVSS 9.8, CWE-89)

**The vulnerable code:**

```ts
// ❌ no-unsafe-query (CWE-89, CVSS 9.8)
pool.query(`SELECT * FROM users WHERE email = '${req.query.email}'`);
pool.query("SELECT * FROM users WHERE id = " + userId);
```

**Why it survived review.** Template literals look like TypeScript, not SQL injection. The reviewer mentally traces `req.query.email` and sees a string — which it is. What they don't see is that the string value `' OR '1'='1` is also valid SQL that changes the query's structure entirely. String interpolation in a template literal doesn't look like "SQL injection" unless you've already been burned by it; it looks like normal string formatting that developers do everywhere else.

**The ESLint rule:**

```ts
// ✅ no-unsafe-query: parameterized — values travel out-of-band, never parsed as SQL
pool.query("SELECT * FROM users WHERE email = $1", [req.query.email]);
pool.query("SELECT * FROM users WHERE id = $1", [userId]);
```

`no-unsafe-query` flags string concatenation and interpolated template literals in `query()` calls. Parameterized queries (`$1`, `$2`) send values over the wire separately from the statement, so they can never change its structure. The rule ships tagged [CWE-89](https://ofriperetz.dev/articles/cwe-taxonomy-explained) with a [CVSS](https://ofriperetz.dev/articles/cvss-scores-explained) base score of 9.8 (v1.4.6).

It also catches the split-line form, which is the one that actually reaches production:

```ts
// ❌ still flagged — the taint is tracked across the assignment
const sql = "SELECT * FROM users WHERE id = " + userId;
await client.query(sql);
```

That is [taint tracking](https://ofriperetz.dev/articles/taint-vs-heuristic-detection) across the assignment, not a pattern match on the `query()` argument — a generic "no string concatenation" rule cannot follow the variable, so it misses exactly the version a reviewer misses.

This is also the rule that earns its keep against AI-generated code. In [my five-model benchmark](https://ofriperetz.dev/articles/we-ranked-5-ai-models-by-security-the-leaderboard-is-wrong) (700 generated functions, run 2026-02-09), the database category was the bloodiest: Gemini 2.5 Pro shipped a flagged pattern in **96%** of its database functions, Claude Sonnet 4.5 in **71%**. Caveat worth stating: that 96% counts hardening rules like `no-select-all` alongside the real injection sinks, and [counting sinks only collapses it toward Sonnet's 71%](https://ofriperetz.dev/articles/aggregate-benchmarks-lie-heres-what-700-ai-functions-look-like-by-security-domain). Either way, the template-literal form is the modal answer, not an edge case — the models learned from the same public code that ships these bugs.

---

## Pattern 2: Dynamic `SET search_path` (CVSS 7.5, CWE-426)

**The vulnerable code:**

```ts
// ❌ no-unsafe-search-path (CWE-426, CVSS 7.5) — prints CRITICAL, see below
await client.query(`SET search_path TO tenant_${tenantId}`);
```

**Why it survived review.** This code looks more careful than a raw query, not less. The reviewer sees a tenant ID being scoped into its own schema — that reads as multi-tenancy done right, the responsible thing. The value is an internal tenant ID, not obviously user input, so nobody pattern-matches it to "SQL injection." And almost no JavaScript engineer carries the fact that `search_path` is a name-resolution surface in working memory — it's a PostgreSQL internals detail, not a web-security checklist item.

Here's the attack: when you reference a table unqualified — `SELECT * FROM accounts` — PostgreSQL resolves the name by walking `search_path`, schema by schema, and uses the first match. If an attacker influences `search_path` (via a tenant ID, a user-controlled value, or a schema they can create objects in), they put a malicious `accounts` table earlier in the path. Your query silently binds to their object and returns their data.

The additional trap: `SET` does **not** accept bind parameters. `SET search_path = $1` is a syntax error. So the usual "just parameterize it" reflex fails, and developers fall back to string interpolation.

**The ESLint rule:**

```ts
// ✅ make the identifier safe, or don't let it be dynamic at all
import format from "pg-format";
await client.query(format("SET search_path TO %I", tenantSchema)); // %I = quoted identifier

// or validate against an allow-list before it reaches SQL:
const schema = TENANT_SCHEMAS[tenantId]; // throws if unknown
await client.query(format("SET search_path TO %I", schema));
```

`no-unsafe-search-path` ([CWE-426](https://ofriperetz.dev/articles/cwe-taxonomy-explained)) makes the dynamic form a CI error. The durable fix is to remove the dynamic value: a static `search_path`, an allow-listed schema, or fully qualified names like `schema.accounts`.

You will notice something the moment this rule fires: it prints `CRITICAL` next to a base score of 7.5, which is the High band. [My own audit of 203 rules caught that](https://ofriperetz.dev/articles/i-audited-203-of-our-own-eslint-security-rules-16-mislabel-their-own-cvss-score) — 16% of our severity words had drifted from their scores, in both directions, and this is one of them. Fix filed, not yet shipped. So: gate CI on the numeric score, never on the severity word. Advice worth taking from a linter that just failed its own spelling test.

---

## Pattern 3: `COPY FROM` with untrusted path (CVSS 9.5, CWE-73)

**The vulnerable code:**

```ts
// ❌ no-unsafe-copy-from (CWE-73, CVSS 9.5)
await client.query(`COPY staging FROM '${req.body.filePath}'`);
```

**Why it survived review.** `COPY FROM` is a legitimate PostgreSQL command for bulk data loading, and the reviewer understands that. What's easy to miss: when running as a superuser, `COPY FROM` reads directly from the server's filesystem — not the client's. An attacker who controls `filePath` can read `/etc/passwd`, private keys, or any file the PostgreSQL process has access to. The command looks like an import operation; it reads like file access from the database server's perspective.

**The ESLint rule:**

```ts
// ✅ COPY FROM STDIN — the client streams the bytes, the server
//    never touches its own filesystem
import { from as copyFrom } from "pg-copy-streams";
import { createReadStream } from "node:fs";
import { resolve } from "node:path";
import { pipeline } from "node:stream/promises";

const IMPORT_DIR = "/var/app/imports/";
const filePath = resolve(IMPORT_DIR, req.body.fileName); // resolve first
if (!filePath.startsWith(IMPORT_DIR)) throw new Error("Disallowed import path");

await pipeline(
  createReadStream(filePath),
  client.query(copyFrom("COPY staging FROM STDIN")),
);
```

Two details bite people here. `COPY` is a utility statement, so it takes no bind parameters at all — `COPY staging FROM $1` is a syntax error, the same trap as `SET search_path = $1` in Pattern 2, and the same reason people fall back to interpolation. And resolve the path _before_ comparing it: a raw `filePath.startsWith(dir)` check happily accepts `/var/app/imports/../../etc/passwd`.

`no-unsafe-copy-from` (CWE-73, CVSS 9.5) flags dynamic path values in `COPY FROM`. `STDIN` is the durable fix because it moves the read to the client, where the file paths are yours.

---

## Pattern 4: Missing `client.release()` (CWE-404)

**The vulnerable code:**

```ts
// ❌ no-missing-client-release (CWE-404) — pool exhaustion
const client = await pool.connect();
try {
  const result = await client.query("SELECT ...");
  return result.rows;
} catch (err) {
  throw err; // client never released — one of these per request and the pool dies
}
```

**Why it survived review.** The happy path returns correctly, and the happy path is what reviewers read. The missing `client.release()` lives in the `catch` block, the early `return` when validation fails, or the `throw` three lines down — the branches your eye skips because "the logic looks right." This also passes every test because a 10-connection pool doesn't exhaust under 3 requests in an integration test. It exhausts under production concurrency at 3pm. The outage is slow-motion: the first few connections drain silently, and then every subsequent request hangs indefinitely.

**The ESLint rule:**

```ts
// ✅ release in finally — runs on return, on throw, on every branch
const client = await pool.connect();
try {
  const result = await client.query("SELECT ...");
  return result.rows;
} finally {
  client.release(); // guaranteed
}

// or: use pool.query() for one-shot queries and skip the lifecycle entirely
const result = await pool.query("SELECT ...");
return result.rows;
```

`no-missing-client-release` (CWE-404) catches the omission at lint time, not at peak traffic. If you're using `pool.connect()` for a single query, `prefer-pool-query` will also flag it — `pool.query()` handles acquire-and-release internally.

---

## Picking a preset, and reading the output

Three presets ship, and the one you want depends on whether you are adopting or gating:

```js
import { configs } from "eslint-plugin-postgresql-security";

export default [
  configs.recommended, // all 13 rules — 9 error, 4 warn
  // configs.flagship,  // just no-unsafe-query — the CI-gate subset
  // configs.strict,    // all 13 as errors
];
```

Before you wire this into a pipeline: `recommended` sets the four quality rules (`check-query-params`, `no-select-all`, `prefer-pool-query`, `no-batch-insert-loop`) to `warn`, so they surface without failing a build that only blocks on errors. A first run on an old service should not be a wall. Switch to `strict` when you want them to gate.

Findings carry the CWE, [OWASP](https://ofriperetz.dev/articles/owasp-top-10-explained) category, [CVSS](https://ofriperetz.dev/articles/cvss-scores-explained), and fix:

```text
src/users.ts
  8:18  error  🔒 CWE-89 OWASP:A03-Injection CVSS:9.8 | Unsafe SQL query detected. Variable interpolation found. | CRITICAL
              Fix: Use parameterized queries ($1, $2) instead of string concatenation.
```

---

## The full rule set (all 13, v1.4.6, CWE-tagged)

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

- **Source patterns, not the database.** It flags interpolated SQL, dynamic `SET search_path`, and missing `release()`. It can't see your actual schema, your `GRANT`s, or whether a tenant value is _really_ attacker-controlled.
- **It errs toward flagging dynamic SQL.** A deliberate trade: it buys [recall](https://ofriperetz.dev/articles/precision-recall-f1-for-static-analysis) with the occasional [false positive](https://ofriperetz.dev/articles/confusion-matrix-tp-fp-fn-tn) on a value you know is safe. A missed injection ships; a wrong flag costs thirty seconds and an `eslint-disable` line with a reason on it. Budget for a handful on the first run of an old codebase.
- **Pair it with the database's own defenses.** Least-privilege roles, `REVOKE CREATE ON SCHEMA public`, and qualified names are the runtime half; the linter ensures the source half never regresses.

---

## Where this fits in the broader picture

For where static analysis fits into the broader security workflow across an onboarding sprint, see [The 30-Minute Security Audit: A Static Analysis Protocol for Onboarding](https://ofriperetz.dev/articles/the-30-minute-security-audit-onboarding-a-new-codebase).

Generic security linters flag `eval` and obvious string-built SQL, but they don't know what a `Pool`, a `client.release()`, or `SET search_path` _is_ — that gap between a general-purpose linter and a driver-aware one is [the whole static-analysis-versus-linting question](https://ofriperetz.dev/articles/static-analysis-vs-sast-vs-linting) in miniature. `eslint-plugin-postgresql-security` is the dedicated node-postgres layer — injection, the `search_path` resolution attack, the `COPY FROM` filesystem path, and the connection-lifecycle bugs that cause outages — each finding tagged with a CWE and CVSS.

This is the install-and-config entry point for the **Postgres Security Protocol** series. Each rule here has a deep-dive companion:

**→ The series (attack deep-dives):** [Three SQL Injection Patterns in node-postgres](https://ofriperetz.dev/articles/three-sql-injection-patterns-node-postgres-eslint) · [search_path Hijacking: A PostgreSQL Attack](https://ofriperetz.dev/articles/searchpath-hijacking-postgresql-attack) · [Database Connection Leak: Anatomy of a Production Outage](https://ofriperetz.dev/articles/database-connection-leak-production-outage) · [Transaction Race Conditions: BEGIN on a Pool](https://ofriperetz.dev/articles/transaction-race-conditions-begin-on-pool) · [COPY FROM: Filesystem Access via PostgreSQL](https://ofriperetz.dev/articles/postgresql-copy-from-exploit-filesystem-access)

**→ The AI angle:** [We Ranked 5 AI Models by Security — the database numbers](https://ofriperetz.dev/articles/we-ranked-5-ai-models-by-security-the-leaderboard-is-wrong) · [I Let an AI Write 80 Functions: 65–75% Were Vulnerable](https://ofriperetz.dev/articles/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities)

---

## Links

- 📦 [npm: eslint-plugin-postgresql-security](https://www.npmjs.com/package/eslint-plugin-postgresql-security)
- 📖 [Full rule docs (per-rule CWE + examples)](https://eslint.interlace.tools/docs/security/plugin-pg/rules)
- 💻 [Source on GitHub](https://github.com/ofri-peretz/eslint/tree/main/packages/eslint-plugin-postgresql-security)

Run `configs.recommended` against your oldest `pg` service — the one written before the team had conventions — and one of these 13 will almost certainly fire. That is the good outcome: the patterns were already there, and now they have names, scores, and line numbers. Fix the errors, read the warnings, ship. Then read [Three SQL Injection Patterns in node-postgres](https://ofriperetz.dev/articles/three-sql-injection-patterns-node-postgres-eslint) for the layer underneath this one — the identifier case and the `IN (...)` trap that survive a naive parameterization pass.

**Have you ever had a SQL injection close call in a `pg` codebase — a query that got as far as staging before someone caught it? What pattern was it?** Drop it in the comments.

::dev-to-cta{url="https://www.npmjs.com/package/eslint-plugin-postgresql-security"}
📦 `npm install --save-dev eslint-plugin-postgresql-security` — 13 rules, one dev dependency.
::

---

_[eslint-plugin-postgresql-security](https://www.npmjs.com/package/eslint-plugin-postgresql-security) is part of the [Interlace ESLint ecosystem](https://eslint.interlace.tools). Source on [GitHub](https://github.com/ofri-peretz/eslint) · Follow: [Dev.to/ofri-peretz](https://dev.to/ofri-peretz)_
