---
title: "node-postgres Will Happily Build a CVSS 9.8 SQL Injection For You. 13 ESLint Rules Say No."
description: "SQL injection (CVSS 9.8), search_path schema hijacking (CVSS 9.5), and the missing client.release() that exhausts your pool — node-postgres bugs that pass tests, survive code review, and take down production. The same bugs AI assistants generate by default. 13 CWE-mapped ESLint rules that catch them in CI."
slug: "getting-started-eslint-plugin-pg"
canonical_url: "https://ofriperetz.dev/articles/getting-started-eslint-plugin-pg"
devto_url: "https://dev.to/ofri-peretz/getting-started-with-eslint-plugin-pg-43pj"
devto_id: 3138840
published_at: "2025-12-31T18:45:40Z"
edited_at: "2026-01-11T10:21:52Z"
cover_image: "https://ofriperetz.dev/og/cover/getting-started-eslint-plugin-pg"
social_image: "https://ofriperetz.dev/og/article/getting-started-eslint-plugin-pg"
reading_time_minutes: 9
tags:
  - "eslint"
  - "security"
  - "node"
  - "ai"
author:
  name: "Ofri Peretz"
  username: "ofri-peretz"
  avatar: "https://media2.dev.to/dynamic/image/width=640,height=640,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Fuser%2Fprofile_image%2F3669992%2F50a1f256-472c-48a1-85e8-149459647ea7.png"
  twitter: "ofriperetzdev"
series: "Postgres Security Protocol"
---

The query passed review. It passed CI. It passed every unit test. Six weeks
later it was a **CVSS 9.8** SQL injection in production, and the only thing
standing between it and the `users` table was the fact that nobody had found it
yet.

`node-postgres` (`pg`) is a thin, honest driver. That's the whole point of it —
and also the whole problem. It hands you a connection and runs the SQL you give
it, including the SQL you should never have built:

```ts
// SQL injection
pool.query(`SELECT * FROM users WHERE email = '${req.query.email}'`);

// connection leak — client never returned to the pool
const client = await pool.connect();
const rows = await client.query("SELECT ...");
return rows; // forgot client.release(); one of these per request and the pool dies
```

The first is **CWE-89**, a textbook injection (CVSS 9.8). The second is
**CWE-404**: a missing `client.release()` that leaks one connection per request
until the pool hits its limit and every subsequent request hangs — a
slow-motion outage that passes every unit test, because tests rarely exhaust a
10-connection pool.

Here's the part that should worry you more than your own typos: **this is also
the default output of every AI coding assistant.** I benchmarked it. When I
asked five frontier models — Claude Haiku/Sonnet/Opus _and_ Google's Gemini 2.5
Flash and Pro — to write database functions with `pg`, **the database category
was the bloodiest of all**: Gemini 2.5 Pro shipped a vulnerability in **96%** of
its database functions, Gemini Flash in **75%**, Sonnet in **71%** — and even
the best model on that axis still failed **39% of the time** ([full per-model,
per-domain breakdown across 700 functions](https://ofriperetz.dev/articles/we-ranked-5-ai-models-by-security-the-leaderboard-is-wrong)).
The very first prompt of an earlier run — _"query a PostgreSQL database to
return the user, use the pg library"_ — came back as string-interpolated
injection ([65–75% of those functions carried a vulnerability; CWE-89 tied for
the most common finding at 28 occurrences](https://ofriperetz.dev/articles/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities)).
The model learned from the same public code that ships these bugs. The driver
won't stop it, TypeScript won't stop it, the green test suite won't stop it —
and switching to a "smarter" model makes it _worse_, not better.

Both bugs are _shapes in the source_. `eslint-plugin-pg` is **13 rules** that
read your `pg` call sites and fail CI on those shapes — SQL injection,
`search_path` hijacking, connection leaks, transaction-on-pool mistakes — each
pinned to a CWE. If you want to point it at your own codebase (or your AI's
output) before reading further, it's one install — [config is below](#install):

```bash
npm install --save-dev eslint-plugin-pg
```

This guide covers the flagship injection rule, the one PostgreSQL attack almost
nobody guards against (`search_path` hijacking, CVSS 9.5), the
connection-lifecycle family, install/config across package managers, and exact
engine support.

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

**This is the rule that earns its keep against AI-generated code.** Prompt an
assistant for "get a user by email with node-postgres" and the template-literal
form isn't an edge case — it's the _modal_ answer (96% of Gemini Pro's database
functions, 71% of Sonnet's, in the benchmark above). The model is reproducing
the median of its training data, and the median ships injection. The fix is
non-negotiable and identical every time (`$1` placeholders), which is exactly
what makes it a good lint rule: no judgment call, no false-positive debate, just
a CI gate that the AI's output has to pass like everyone else's. **If your team
merges AI-drafted data-access code, this rule is the seatbelt — and the seatbelt
matters more the more capable your model gets, because capability and SQL-safety
turned out to be uncorrelated.** (For the deeper node-postgres injection
taxonomy — concat, identifiers, and the `IN (...)` trap — see [Three SQL
Injection Patterns in node-postgres](https://ofriperetz.dev/articles/three-sql-injection-patterns-node-postgres-eslint).)

---

## Point it at your AI's output, not just your own

The fastest way to feel why this plugin exists: make your AI assistant write the
`pg` code, then lint it before you read it.

```bash
# generate a data-access function with whatever assistant you use…
gemini -p "Write a Node.js function that looks up a user by email with pg" > user.ts
# (or: claude -p "…", or paste from Copilot)

# …then gate it on the way in
npx eslint user.ts
```

In my benchmark, the database category was where the _flagship_ model did worst:
Gemini 2.5 Pro at **96%** vulnerable, ahead of every Claude model, while the
smallest model (Haiku) led the category at 39%. More capability did not buy more
SQL-safety. That's not a knock on any one vendor; it's the whole point.
**The vulnerability rate is a property of AI code generation, not a property of
which model you picked.** So the gate has to live in CI, model-agnostic,
firing on the _shape_ — which is exactly what `no-unsafe-query` does. Swap the
`gemini -p` above for any model and the rule reads the AST the same way; the
[5-model leaderboard](https://ofriperetz.dev/articles/we-ranked-5-ai-models-by-security-the-leaderboard-is-wrong)
is just this loop run 700 times. And because fixing one AI-suggested bug often
surfaces the next, the linter is what keeps the [whack-a-mole bounded](https://ofriperetz.dev/articles/the-ai-hydra-problem-fix-one-ai-bug-get-two-more).

---

## The one almost nobody guards: `search_path` hijacking

This is the rule worth installing the plugin for, because the attack is
invisible to ORMs and code review alike.

```ts
// ❌ no-unsafe-search-path (CWE-426, CVSS 9.5, CRITICAL)
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

**Why this survives code review.** `tenant_${tenantId}` looks _more_ careful
than a raw query, not less. The reviewer sees a tenant id being scoped into its
own schema — that reads as multi-tenancy done right, the responsible thing. The
value is an internal tenant id, not obviously user input, so nobody pattern-matches
it to "SQL injection." And almost no JavaScript engineer carries the fact that
`search_path` is a name-resolution surface in working memory — it's a Postgres
internals detail, not a web-security checklist item. So it sails through: it
isn't `' OR 1=1`, it isn't obviously user-controlled, and the danger lives one
abstraction layer below where reviewers are looking. A linter doesn't get tired
or trust the variable name.

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
fine, then at 3pm everything hung" outage. It survives review for a brutally
simple reason: **the happy path returns the client, and the happy path is what
everyone reads.** The leak lives in the `catch` block, or the early `return`
when validation fails, or the `throw` three lines down — the branches your eye
skips because "the logic looks right." It also passes every test, because a
10-connection pool doesn't exhaust under the 3 requests an integration test
fires; it exhausts under production concurrency at 3pm. The rule makes the
omission visible at review time, not at peak traffic. (I walked a real version
of this outage — pool exhaustion, root cause, the one-line fix — in
[Database Connection Leak: Anatomy of a Production Outage](https://ofriperetz.dev/articles/database-connection-leak-production-outage).)

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

This is the install-and-config entry point for the **Postgres Security
Protocol** series. Each rule here has a deep-dive companion that walks the
attack end to end:

**→ The series (attack deep-dives):** [Three SQL Injection Patterns in node-postgres](https://ofriperetz.dev/articles/three-sql-injection-patterns-node-postgres-eslint) · [search_path Hijacking: A PostgreSQL Attack](https://ofriperetz.dev/articles/searchpath-hijacking-postgresql-attack) · [Database Connection Leak: Anatomy of a Production Outage](https://ofriperetz.dev/articles/database-connection-leak-production-outage) · [Transaction Race Conditions: BEGIN on a Pool](https://ofriperetz.dev/articles/transaction-race-conditions-begin-on-pool) · [COPY FROM: Filesystem Access via PostgreSQL](https://ofriperetz.dev/articles/postgresql-copy-from-exploit-filesystem-access)

**→ The AI angle (why this plugin matters more every quarter):** [We Ranked 5 AI Models by Security — the database numbers](https://ofriperetz.dev/articles/we-ranked-5-ai-models-by-security-the-leaderboard-is-wrong) · [I Let an AI Write 80 Functions: 65–75% Were Vulnerable](https://ofriperetz.dev/articles/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities) · [Claude Wrote a NestJS Service; ESLint Found 6 Holes](https://ofriperetz.dev/articles/claude-wrote-nestjs-service-eslint-found-6-security-holes) · [Same File, 4 Linters: How Much Your Plugin Actually Catches](https://ofriperetz.dev/articles/your-eslint-security-plugin-is-missing-80-of-vulnerabilities-i-have-proof)

---

## Links

- 📦 [npm: eslint-plugin-pg](https://www.npmjs.com/package/eslint-plugin-pg)
- 📖 [Full rule docs (per-rule CWE + examples)](https://eslint.interlace.tools/docs/security/plugin-pg/rules)
- 💻 [Source on GitHub](https://github.com/ofri-peretz/eslint/tree/main/packages/eslint-plugin-pg)

Run `configs.recommended` against your oldest `pg` service — the one written
before the team had conventions — and one of these 13 will almost certainly
fire. Then run it against the last data-access function your AI assistant wrote,
and watch the same rule fire again. **Which one would it be in your codebase:
the interpolated query nobody re-reads, the `release()` missing from a `catch`
block, or the dynamic `search_path` that looked like good multi-tenancy?** I
want the war story in the comments — especially the one that already cost you a
3pm outage, or the one your AI pair-programmer slipped past review last week.

::dev-to-cta{url="https://github.com/ofri-peretz/eslint"}
⭐ Star on GitHub if your `pg` code does any of the above.
::

---

I'm **Ofri Peretz**, a security engineering leader and the author of the
Interlace ESLint ecosystem — domain-specific static analysis for security,
reliability, and performance on the Node.js stack. `eslint-plugin-pg` is its
node-postgres layer.

[ofriperetz.dev](https://ofriperetz.dev) · [LinkedIn](https://linkedin.com/in/ofri-peretz) · [GitHub](https://github.com/ofri-peretz)
