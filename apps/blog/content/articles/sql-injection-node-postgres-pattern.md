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
reading_time_minutes: 9
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

Every query in the service was timing out, and the SQL was flawless. No string
concatenation anywhere, every value bound to a `$1`, exactly the way the security
checklist says. The data layer had fallen over regardless — in a way that has
nothing to do with injection. It took me most of a night to find, and it's
failure mode #3 below.

String concatenation in a PostgreSQL query is still tied for the largest single
category in our benchmark corpus — 4 of 40 fixtures, all
[CWE-89](https://ofriperetz.dev/articles/cwe-taxonomy-explained) — and it has been
in the [OWASP Top 10](https://ofriperetz.dev/articles/owasp-top-10-explained) for
15 years. You don't need a
[SAST scan](https://ofriperetz.dev/articles/static-analysis-vs-sast-vs-linting)
to find it; an ESLint rule catches it on save. Most teams still don't run one.

But ask a backend engineer how the database layer fails and "SQL injection" is
the whole answer — when it's _one of four_ structural ways a node-postgres data
layer breaks in production. The other three — identifier hijacking,
connection-pool exhaustion, insecure transport — never make the OWASP headlines,
and they page you at 3 AM all the same.

The database has also become worse than a coin-flip in AI-generated code.
**Gemini 2.5 Pro shipped a flagged query in 96% of the database functions I asked
it for** — and even the _cleanest_ generator I tested still hit 39%, after I ran
700 AI-written functions through these exact rules and broke the results down by
security domain (five models, snapshot dated 2026-02-09; [the full per-domain
breakdown is
here](https://ofriperetz.dev/articles/aggregate-benchmarks-lie-heres-what-700-ai-functions-look-like-by-security-domain)).
Whether the next data-layer bug is yours or your assistant's, it's the same four
shapes — so here's the map.

Only the first one looks dangerous. The other three survive code review because
**each line is correct in isolation** — a missing `client.release()`, one
`rejectUnauthorized: false`, a `SET search_path` that interpolates a variable.
Nobody approved a vulnerability; they approved lines that each read as fine —
which is also why an AI assistant hands you these on request (more on that at the
end). Each one is structural, and each has a dedicated rule in `eslint-plugin-pg`.

| #   | Failure mode              | What an attacker (or load) controls   | The pg rule                 | CWE     |
| --- | ------------------------- | ------------------------------------- | --------------------------- | ------- |
| 1   | Injection via **values**  | a value spliced into the query string | `no-unsafe-query`           | CWE-89  |
| 2   | **Identifier** hijacking  | a table/schema name (`search_path`)   | `no-unsafe-search-path`     | CWE-426 |
| 3   | Connection **exhaustion** | a leaked pool client → pool empties   | `no-missing-client-release` | CWE-404 |
| 4   | Insecure **transport**    | TLS turned off to the database        | `no-insecure-ssl`           | CWE-319 |

Six concrete patterns follow, across those four classes. Parameterized queries
close **three** of them — all inside class 1. The other **three** each need a
different fix: identifier escaping, a `finally` block, a CA bundle. That gap is
why this is a threat map and not a "just use `$1`" reminder.

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
// ❌ textbook SQL injection — CWE-89, one of the most-fixtured classes in our corpus
pool.query("SELECT * FROM users WHERE id = " + userId);
```

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

Read that finding line left to right and it tells you what to do with it: the
CWE identifies the bug class, `A03-Injection` is the OWASP bucket, `9.8` is the
[CVSS](https://ofriperetz.dev/articles/cvss-scores-explained) severity, and the
bracketed tags are the compliance frameworks that care. (The ESLint CLI also
appends the rule's doc URL to the `Fix:` line; it's trimmed here for width.)

The rule fires on `+`-concatenation, `${…}` template expressions, and cross-line
[tainted](https://ofriperetz.dev/articles/taint-vs-heuristic-detection) variables
in `.query()` calls — the full taxonomy is in
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

This is the one **injection** pattern in this article that parameterized queries
cannot close — it needs a dedicated rule (`no-unsafe-search-path`) precisely
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

Now look closer at that same line: it prints `CVSS:7.5` _and_ the word
`CRITICAL`, and those disagree — 7.5 sits in the High band (7.0–8.9). The
mislabel is mine. When I audited our own 203 security rules,
[33 of them — 16% — printed a severity word their own CVSS score doesn't
support](https://ofriperetz.dev/articles/i-audited-203-of-our-own-eslint-security-rules-16-mislabel-their-own-cvss-score);
the cause is a metadata helper that forwards the score but not the severity. The
fix is filed, not shipped. Gate your CI on the number, not the adjective — mine
included.

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
shape, not an injection. Read the CWE, not the OWASP label: CWE-404 has no clean
home in the OWASP Top 10, so the formatter slots it under the plugin's catch-all
bucket. Same lesson as the section above, different field.

This is the timeout from the top of the article, and the line was mine. Early in
my career I wrote a reporting endpoint that called `pool.connect()`, ran one
query, and returned the rows — no `finally`, no `release()`. It passed code
review, passed CI, and ran clean for weeks. Then a scheduled job hammered that
endpoint, the 20-connection pool drained, and _every_ query in the service
started timing out — including health checks, so the orchestrator started
cycling pods, which made it worse. The fix was one line in a `finally`; finding
it took the better part of a night staring at `pg_stat_activity` watching idle
connections that never came back. This rule is the test I wish that PR had.

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
verification back off. A dev-fix that outlives the dev environment.

---

## Your AI assistant reintroduces all four

This threat map matters more in 2026 than it did in 2020 for one reason: the
model writing your data layer learned from the same code these rules flag.

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
models (Opus 4.6, Sonnet 4.5, Haiku 4.5, Gemini 2.5 Flash, Gemini 2.5 Pro —
snapshot dated 2026-02-09) through these rules and [broke the results down by
security
domain](https://ofriperetz.dev/articles/aggregate-benchmarks-lie-heres-what-700-ai-functions-look-like-by-security-domain).
**Database is the domain where senior-looking code hides the most bugs** — even
the cleanest generator (Haiku) still wrote a flagged query 39% of the time, and
Gemini 2.5 Pro hit 96%. And Gemini Pro's database code is the _most_ flagged
precisely because it's the most senior-looking: it ships the connection pool, the
env-var credentials, the column enumeration, all the signals a reviewer is
trained to trust, and the `pg/no-select-all` and injection findings ride in
underneath. Production-shaped code earns trust it hasn't proven yet. A human
reviewer pattern-matches "this person knows what they're doing" and waves it
through; the lint rule reads the AST and doesn't care how senior the code looks.
(Same prompt, different model, different blind spots: [Claude got 6 NestJS
findings where Gemini got
2](https://ofriperetz.dev/articles/claude-vs-gemini-nestjs-security-same-prompt-different-errors)
— which is exactly why you gate on the rule, not the model.)

One caveat I owe you, since I wrote the rules doing the counting: that 96% counts
every flag, and two of the rules behind it (`pg/no-select-all`,
`pg/prefer-pool-query`) are hardening rules, not injection sinks. Count only true
sinks and Gemini Pro's number falls toward Sonnet's 71%. A flag is not
automatically a [true
positive](https://ofriperetz.dev/articles/confusion-matrix-tp-fp-fn-tn), and one
flagged function means something different in a domain where 96% of functions
trip a rule than in a domain where 21% do — that's the [base
rate](https://ofriperetz.dev/articles/base-rate-problem-explained) doing the work,
not the model. The direction holds either way; the headline number is softer than
it looks.

Try it yourself — you can
[reproduce](https://ofriperetz.dev/articles/reproducibility-vs-replicability)
this in five minutes, the finding if not my exact percentages (model outputs
drift week to week). Generate a data-access function, paste it into a file the
config below lints, read the findings. The rule output is the
[ground truth](https://ofriperetz.dev/articles/ground-truth-in-security-testing)
the model's confidence isn't — and at larger scale, [65–75% of the functions I
asked Claude for carried a
vulnerability](https://ofriperetz.dev/articles/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities),
with the data layer holding the quiet ones. Human review doesn't scale to code
you didn't write. A CI rule does.

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

`configs.recommended` sets the nine security and resource rules to `error` — the
four in this article among them — and the four quality rules (`no-select-all`,
`prefer-pool-query`, `check-query-params`, `no-batch-insert-loop`) to `warn`, so
`--max-warnings 0` gates all 13. Drop that flag if you want only the errors to
block the build on day one.

Worth knowing what you're installing. On our 40-vulnerability benchmark corpus,
the Interlace rule set these four ship in scored 40 true positives, 0 false
positives, 0 false negatives — 100%
[precision and recall](https://ofriperetz.dev/articles/precision-recall-f1-for-static-analysis)
(v3.0.2, ESLint 9.39.2, Node v24.12.0, measured 2026-05-30). Now the
uncomfortable half: I wrote both the rules and that corpus, so a perfect score on
it is a regression test wearing a benchmark's clothes. Run it against your own
repository — that's the only number that decides anything.

---

## Compatibility

| Surface              | Support                                                                               |
| -------------------- | ------------------------------------------------------------------------------------- |
| **Plugin version**   | `eslint-plugin-pg@1.4.7`, 13 rules (npm latest, checked 2026-07-28)                   |
| **Package managers** | npm, yarn, pnpm, bun                                                                  |
| **Node**             | `>= 18.0.0`                                                                           |
| **ESLint**           | `^8.0.0 \|\| ^9.0.0 \|\| ^10.0.0`, flat config                                        |
| **`pg` driver**      | peer `^6 \|\| ^7 \|\| ^8`; AST-based, lints regardless of installed version           |
| **Module system**    | plugin is CommonJS; loads from `eslint.config.js`, `.mjs`, or `.cjs`                  |
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

If you read one more thing after this, make it
[The Connection Leak That Exhausted Our Pool](https://ofriperetz.dev/articles/database-connection-leak-production-outage)
— the same failure mode at production scale: a 100-connection pool, a 3:02 AM
pager, and three lines every code review had approved. Four is a short enough
list to close for good, and not one of the four needs a security team to close
it — each needs a rule that stays awake after the reviewer stops reading.

::dev-to-cta{url="https://www.npmjs.com/package/eslint-plugin-pg"}
📦 `npm i -D eslint-plugin-pg` — four rules for the four ways a node-postgres
data layer fails. Point them at your `db/` folder and see which one is already
live in your codebase.
::

---

_[eslint-plugin-pg](https://www.npmjs.com/package/eslint-plugin-pg) is part of the [Interlace ESLint ecosystem](https://eslint.interlace.tools). Source on [GitHub](https://github.com/ofri-peretz/eslint) · Follow: [Dev.to/ofri-peretz](https://dev.to/ofri-peretz)_
