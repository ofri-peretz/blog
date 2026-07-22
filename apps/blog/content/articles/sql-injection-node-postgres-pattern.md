---
title: "Your node-postgres Data Layer Fails 4 Ways in Production. SQL Injection Is Only the First."
description: "SQL injection is the famous node-postgres failure — but identifier hijacking, connection-pool exhaustion, and insecure transport page you at 3 AM just as hard. The four data-layer threat classes, the pg-specific ESLint rule for each, the one config that turns them all on — and why AI assistants get the database layer wrong (Gemini 2.5 Pro: up to 96% flagged in the database domain)."
slug: "sql-injection-node-postgres-pattern"
canonical_url: "https://ofriperetz.dev/articles/sql-injection-node-postgres-pattern"
tier: "TOPIC"
devto_url: "https://dev.to/ofri-peretz/sql-injection-in-node-postgres-the-pattern-everyone-gets-wrong-54mn"
devto_id: 3137480
published_at: "2025-12-31T05:50:50Z"
edited_at: "2026-01-11T10:22:01Z"
cover_image: "https://ofriperetz.dev/og/cover/sql-injection-node-postgres-pattern"
social_image: "https://ofriperetz.dev/og/article/sql-injection-node-postgres-pattern"
reading_time_minutes: 8
tags:
  - "security"
  - "node"
  - "database"
  - "devsecops"
author:
  name: "Ofri Peretz"
  username: "ofri-peretz"
  avatar: "https://media2.dev.to/dynamic/image/width=640,height=640,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Fuser%2Fprofile_image%2F3669992%2F50a1f256-472c-48a1-85e8-149459647ea7.png"
  twitter: "ofriperetzdev"
series: "Postgres Security Protocol"
---

The single most common Node.js security vulnerability in our corpus: string concatenation in a PostgreSQL query. It's been in the [OWASP Top 10](https://ofriperetz.dev/articles/owasp-top-10-explained) for 15 years. Your linter can catch it today. Most don't.

Ask a backend engineer how the database layer fails and you'll hear "SQL
injection." It's real, it's [CWE-89](https://ofriperetz.dev/articles/cwe-taxonomy-explained), and it's _one of four_ structural ways a
node-postgres data layer breaks in production. The other three — identifier
hijacking, connection-pool exhaustion, insecure transport — don't make the OWASP
headlines, but they page you at 3 AM all the same.

And the database has become worse than a coin-flip in AI-generated code.
**Gemini 2.5 Pro shipped a flagged query in 96% of the database functions I
asked it for** — and even the _cleanest_ generator I tested still hit 39%, after
I ran 700 AI-written functions through these exact rules and broke the results
down by security domain ([the full per-domain breakdown is
here](https://ofriperetz.dev/articles/aggregate-benchmarks-lie-heres-what-700-ai-functions-look-like-by-security-domain)).
Whether the next data-layer bug is yours or your assistant's, it's the same four
shapes — so here's the map.

Only the first one looks dangerous. The other three survive code review because
**each line is correct in isolation** — a missing `client.release()`, one
`rejectUnauthorized: false`, a `SET search_path` that interpolates a variable.
Nobody approved a vulnerability; they approved lines that each read as fine —
which is also exactly why an AI assistant hands you these on request (more on
that at the end). Each is a **structural** pattern with a dedicated rule in
`eslint-plugin-pg`. Here's the threat model and the rule that closes it.

| #   | Failure mode              | What an attacker (or load) controls   | The pg rule                 | CWE     |
| --- | ------------------------- | ------------------------------------- | --------------------------- | ------- |
| 1   | Injection via **values**  | a value spliced into the query string | `no-unsafe-query`           | CWE-89  |
| 2   | **Identifier** hijacking  | a table/schema name (`search_path`)   | `no-unsafe-search-path`     | CWE-426 |
| 3   | Connection **exhaustion** | a leaked pool client → pool empties   | `no-missing-client-release` | CWE-404 |
| 4   | Insecure **transport**    | TLS turned off to the database        | `no-insecure-ssl`           | CWE-319 |

This article covers **5 vulnerable patterns** in the `pg` ecosystem. **4** are
closed by parameterized queries alone. **1** — the identifier injection class —
requires an additional ESLint rule to catch, because it looks syntactically clean
to a parameterization linter but isn't.

All four rules ship in one plugin — `npm i -D eslint-plugin-pg` now if you want
to lint along ([config is below](#one-config-turns-on-all-four)); otherwise read
on for the threat behind each rule.

---

## 1. Injection via values — `no-unsafe-query` (CWE-89)

The classic. A user-controlled **value** is concatenated or interpolated into the
SQL text instead of being passed as a parameter. In the `pg` ecosystem, this
surfaces in three distinct forms — and each one has a different reason it
survives review.

**Pattern 1a: `pool.query` with concatenation**

```js
// ❌ textbook SQL injection — also in 30% of Node.js PostgreSQL code we audit
pool.query("SELECT * FROM users WHERE id = " + userId);
```

`pool.query('SELECT * FROM users WHERE id = ' + userId)` is a textbook SQL
injection. It's also in 30% of Node.js PostgreSQL code we audit.

**Why it survives review:** the variable is clearly named `userId`, which makes
it feel type-safe even when it's a string. Dynamic WHERE clauses look like
business logic to a reviewer, not injection vectors. The reviewer trusts the
name, not the type contract.

**Pattern 1b: `client.query` with template literal**

```js
const client = await pool.connect();
client.query(
  `SELECT * FROM orders WHERE customer_id = ${customerId} AND status = '${status}'`,
); // ❌
```

**Why it survives review:** template literals read as declarative — they _look_
safer than `+` concatenation because there's no visible string surgery. But from
the driver's perspective, it's identical: one fully-constructed SQL string with
no bind protocol.

**Pattern 1c: Tagged template literals that feel safe but aren't**

This one is the sneaky variant. Some teams reach for a custom tag or a
third-party helper to make queries "feel" parameterized:

```js
// ❌ NOT parameterized — this is a tagged template that returns a plain string
const query = sql`SELECT * FROM users WHERE id = ${userId}`;
pool.query(query); // still injection if sql`` resolves to a string, not a {text, values} object
```

**Why it survives review:** the `sql` tag looks like a safe abstraction. Unless
you know that `pg` requires `{ text, values }` object form (not a plain string)
to actually use bind parameters, the tag reads as protection it isn't providing.

**The correct form for all three:**

```js
// ✅ pool.query — single-shot, no client acquire needed
pool.query("SELECT * FROM users WHERE id = $1", [userId]);

// ✅ client.query — explicit client, bound parameters
const client = await pool.connect();
try {
  await client.query(
    "SELECT * FROM orders WHERE customer_id = $1 AND status = $2",
    [customerId, status],
  );
} finally {
  client.release();
}
```

The `$1` placeholder + values array is pg's escaping contract — the driver
handles quoting and types, and the pattern can't be accidentally broken.

```text
src/users.js
  3:3  error  🔒 CWE-89 OWASP:A03-Injection CVSS:9.8 | Unsafe SQL query detected. Variable interpolation found. | CRITICAL [SOC2,PCI-DSS,NIST-CSF]
             Fix: Use parameterized queries ($1, $2) instead of string concatenation.
```

(The ESLint CLI also appends the rule's doc URL to the `Fix:` line; it's trimmed
here for width.) The rule fires on `+`-concatenation, `${…}` template
expressions, and cross-line [tainted](https://ofriperetz.dev/articles/taint-vs-heuristic-detection) variables in `.query()` calls — the full
taxonomy is in
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

`SET` rejects parameters because it's a server-side runtime command, not a query
— it executes before the bind protocol that fills `$1` ever runs, so there is no
placeholder slot to bind into.

**Why it survives review:** this is the trap for the engineer who _knows_
about SQL injection. They see `${tenant}` in a query, reach for "use a
parameter," and `SET` won't take one — so they conclude interpolation is
unavoidable here and move on. The reviewer trusts that judgment because the
author clearly knew the parameterization rule. The gap is that identifiers and
values have different escaping contracts, and almost nobody is taught the second
one.

This is also the **one pattern in this article that parameterized queries cannot
close** — it requires an ESLint rule (`no-unsafe-search-path`) specifically
because the fix isn't a bind parameter. It's identifier-escaping (`pg-format`'s
`%I`) or an allow-list:

```js
import pgFormat from "pg-format";
await client.query(pgFormat("SET search_path TO %I", tenant)); // ✅ %I escapes the identifier
```

The full attack and the defenses are in
[search_path Hijacking](https://ofriperetz.dev/articles/searchpath-hijacking-postgresql-attack).

```text
src/tenant.js
  7:24  error  🔒 CWE-426 OWASP:A05-Security CVSS:7.5 | Unsafe "SET search_path" detected. | CRITICAL [SOC2,PCI-DSS]
              Fix: Do not use dynamic values for search_path. Use static strings or strict validation.
```

Note the CWE flips to **CWE-426 (Untrusted Search Path)** — a different bug class
from CWE-89, which is exactly why a generic "SQL injection" rule misses it: the
query string is _parameterized-clean_, the danger is the identifier.

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

```text
src/orders.js
  4:9  error  ⚡ CWE-404 OWASP:A05-Injection | PG client acquired but not released. | HIGH
            Fix: Ensure "client.release()" is called in a finally block to return the client to the pool.
```

Note this one fires under the **⚡ reliability** icon, not the 🔒 security one —
`no-missing-client-release` is CWE-404 (resource exhaustion), a denial-of-service
shape, not an injection. The CWE is the signal to read here, not the OWASP label:
CWE-404 has no clean home in the OWASP Top 10, so the formatter slots it under
the plugin's catch-all bucket — a good reminder to gate on the precise
CWE/[CVSS](https://ofriperetz.dev/articles/cvss-scores-explained),
not the broad OWASP category.

I have shipped this exact line. Early in my career I wrote a reporting endpoint
that did `const client = await pool.connect()`, ran one query, returned the rows
— no `finally`, no `release()`. It passed code review, passed CI, and ran clean
for weeks. Then a scheduled job hammered that endpoint, the 20-connection pool
drained, and _every_ query in the service started timing out — including health
checks, so the orchestrator started cycling pods, which made it worse. The fix
was one line in a `finally`; finding it took the better part of a night staring
at `pg_stat_activity` watching idle connections never come back. This rule is the
test I wish that PR had.

**Why it survives review:** it passes every test. One request acquires one
client, runs one query, returns the right rows — green checkmark. The leak only
exists in aggregate, under concurrency, after the pool fills, which no unit test
and no PR reviewer reproduces. "Looks correct and the tests pass" is the exact
shape of a bug that ships, and resource lifecycle is invisible in a diff because
the `release()` is an _absence_, not a line you can point at.

## 4. Insecure transport — `no-insecure-ssl` (CWE-319)

The one-line config that ships secrets in cleartext to the database:

```js
new Pool({ ssl: { rejectUnauthorized: false } }); // ❌ accepts any cert (MITM)
```

`rejectUnauthorized: false` disables certificate validation — convenient against
a self-signed dev cert, catastrophic in production. `no-insecure-ssl` flags it;
use a real CA bundle (`ssl: { ca: fs.readFileSync(...) }`) instead.

```text
src/db.js
  12:32  error  🔒 CWE-319 OWASP:A05-Security | Insecure SSL configuration detected (rejectUnauthorized: false). | HIGH [SOC2,PCI-DSS,HIPAA,GDPR]
              Fix: Set "rejectUnauthorized: true" or use a valid CA bundle. Do not disable SSL verification in production.
```

The compliance tags aren't decoration — `rejectUnauthorized: false` on a database
that holds PII is a clear-text-transport finding under SOC2, PCI-DSS, HIPAA, and
GDPR all at once, which is why the rule lists all four.

**Why it survives review:** it was added on purpose. Someone hit a self-signed
cert locally, set `rejectUnauthorized: false` to unblock themselves, the
connection worked, and the line stayed. By the time it reaches review it reads as
intentional TLS config — `ssl` is even _set_, so the reviewer pattern-matches
"good, they enabled SSL" and never reads the nested flag that quietly turns
verification back off. The dev-fix that outlives the dev environment is one of
the most common ways insecure transport reaches production.

---

## Your AI assistant reintroduces all four

Here's why this threat map matters more in 2026 than it did in 2020: the model
writing your data layer learned from the same code these rules flag.

Ask Claude, Gemini, or Copilot for "a node-postgres repository function with a
tenant-scoped query" and watch which of the four it hands you. In my own runs the
pattern is consistent: parameterized values are now usually correct (that lesson
is everywhere in the training data) — but ask for a _dynamic schema_ and you get
`SET search_path TO ${tenant}`; ask for "a function that acquires a client and
runs a query" and the `release()` is frequently missing; ask it to "connect to a
Postgres instance with a self-signed cert" and `rejectUnauthorized: false` comes
back almost every time, presented as the fix. The model reproduces exactly the
three patterns that survive human review — because they survived human review in
its training set too.

That's not a vibe; it's measured. I ran 700 AI-generated functions across five
models (Claude Haiku/Sonnet/Opus, Gemini 2.5 Flash/Pro) through these rules and
[broke the results down by security
domain](https://ofriperetz.dev/articles/aggregate-benchmarks-lie-heres-what-700-ai-functions-look-like-by-security-domain).
**Database is the domain where senior-looking code hides the most bugs** — even
the cleanest generator (Haiku) still wrote a flagged query 39% of the time, and
Gemini 2.5 Pro hit 96%. Here's the twist that proves this article's whole thesis:
Gemini Pro's database code is the _most_ vulnerable precisely because it's the most
senior-looking — it ships the connection pool, the env-var credentials, the
column enumeration, all the signals a reviewer is trained to trust, and the
`pg/no-select-all` and injection findings ride in underneath. Production-shaped
code earns trust it hasn't proven yet. A human reviewer pattern-matches "this
person knows what they're doing" and waves it through; the lint rule reads the
AST and doesn't care how senior the code looks. (Same prompt, different model,
different blind spots: [Claude got 6 NestJS findings where Gemini got
2](https://ofriperetz.dev/articles/claude-vs-gemini-nestjs-security-same-prompt-different-errors)
— which is exactly why you gate on the rule, not the model.)

This is the part I want you to actually try, because it's reproducible on your
machine in five minutes: generate a data-access function, paste it into a file
the config below lints, and read the findings. The rule output is the
[ground truth](https://ofriperetz.dev/articles/ground-truth-in-security-testing)
the model's confidence isn't. I've run this experiment at scale on
AI-generated code — [I let Claude write 80 functions and 65–75% had a security
vulnerability](https://ofriperetz.dev/articles/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities)
— and the data layer is where the quiet ones cluster. The same lint gate that
catches your colleague's 3 AM leak catches the model's, with no extra work:
human review doesn't scale to code you didn't write, but a CI rule does.

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

These globs assume your data-access code lives in `db/`, `repositories/`, or
`models/` — if yours sits in `dao/`, `prisma/`, `src/server/`, or anywhere else,
swap the `files` array to match (or drop it entirely to lint the whole repo).
The rules are AST-based, so the only thing the glob controls is _where_ they run.

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
| **ESLint**           | `^8.0.0 \|\| ^9.0.0`, flat config                                                     |
| **`pg` driver**      | peer `^6 \|\| ^7 \|\| ^8`; AST-based, lints regardless of installed version           |
| **Module system**    | ESM or CommonJS flat config (`eslint.config.mjs`, `.js`, or `.cjs`)                   |
| **Oxlint**           | Loads under Oxlint's JS-plugin runner via the `interlace-pg` port, parity-gated in CI |

---

## Where this fits

This is the data-layer **threat map**, and the entry point to the _Postgres
Security Protocol_ series — start here, then drop into whichever failure mode is
live in your codebase. Each has a dedicated deep-dive, and the full plugin tour
covers the rest of the 13 rules:

- [Three SQL Injection Patterns](https://ofriperetz.dev/articles/three-sql-injection-patterns-node-postgres-eslint) — the `no-unsafe-query` detection in depth
- [COPY FROM Filesystem Access](https://ofriperetz.dev/articles/postgresql-copy-from-exploit-filesystem-access) — when user-controlled paths turn your DB into a file reader
- [search_path Hijacking](https://ofriperetz.dev/articles/searchpath-hijacking-postgresql-attack) — the identifier attack most teams have never heard of
- [The Connection Leak Outage](https://ofriperetz.dev/articles/database-connection-leak-production-outage) — the 3 AM pool-exhaustion post-mortem
- [Transaction Race Conditions](https://ofriperetz.dev/articles/transaction-race-conditions-begin-on-pool) — what happens when `BEGIN` runs on the pool instead of a client
- [Getting Started with `eslint-plugin-pg`](https://ofriperetz.dev/articles/getting-started-eslint-plugin-pg) — all 13 rules end to end
- [Plugin docs](https://eslint.interlace.tools) — full rule reference with CWE/CVSS mappings

---

## Links

- 📦 [npm: eslint-plugin-pg](https://www.npmjs.com/package/eslint-plugin-pg)
- 📖 [Full rule docs (per-rule CWE)](https://eslint.interlace.tools/docs/security/plugin-pg/rules)
- 💻 [Source on GitHub](https://github.com/ofri-peretz/eslint/tree/main/packages/eslint-plugin-pg)

My money's on the connection leak — the one that passed every test and still took
down the API at 3 AM. But I'm curious about the creative ones.

What's the most creative SQL injection you've seen in a Node.js codebase — the
one that wasn't `SELECT * FROM ... + userInput` but was still injectable? Drop it
in the comments.

::dev-to-cta{url="https://github.com/ofri-peretz/eslint"}
⭐ Star on GitHub if your data layer fails any of these four ways — or if a lint
rule would have saved you a 3 AM page.
::

---

_[eslint-plugin-pg](https://www.npmjs.com/package/eslint-plugin-pg) is part of the [Interlace ESLint ecosystem](https://eslint.interlace.tools). Source on [GitHub](https://github.com/ofri-peretz/eslint) · Follow: [Dev.to/ofri-peretz](https://dev.to/ofri-peretz)_
