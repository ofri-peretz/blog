---
title: "pool.query('BEGIN') Scattered Our Transfer Across Four Connections. The ESLint Rule That Catches It."
description: "A Sentry alert about totals that didn't reconcile traced back to four lines that read exactly like a transaction. pool.query('BEGIN') runs on a different pooled client than the UPDATE after it, so nothing is atomic. The race condition (CWE-362), a reproduction you can run against your own pool, the dedicated-client fix, and the pg ESLint rule that flags every BEGIN/COMMIT on a pool."
slug: "transaction-race-conditions-begin-on-pool"
canonical_url: "https://ofriperetz.dev/articles/transaction-race-conditions-begin-on-pool"
tier: "TOPIC"
devto_url: "https://dev.to/ofri-peretz/transaction-race-conditions-why-begin-on-pool-breaks-everything-117h"
devto_id: 3138993
published_at: "2025-12-31T21:38:13Z"
edited_at: "2026-01-11T10:21:47Z"
cover_image: "https://ofriperetz.dev/cdn/blog-cover-image/transaction-race-conditions-begin-on-pool.jpg?v=b2"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/transaction-race-conditions-begin-on-pool-og.jpg?v=b2"
reading_time_minutes: 8
tags:
  - "node"
  - "eslint"
  - "security"
  - "devsecops"
author:
  name: "Ofri Peretz"
  username: "ofri-peretz"
  avatar: "https://media2.dev.to/dynamic/image/width=640,height=640,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Fuser%2Fprofile_image%2F3669992%2F50a1f256-472c-48a1-85e8-149459647ea7.png"
  twitter: "ofriperetzdev"
series: "Postgres Security Protocol"
---

> **Postgres Security Protocol** — the bugs that pass review and melt in production.
> **← Prev:** [The connection leak that exhausted our pool](https://ofriperetz.dev/articles/database-connection-leak-production-outage) · **You are here:** `BEGIN` on the pool · **Next →** [search_path hijacking](https://ofriperetz.dev/articles/searchpath-hijacking-postgresql-attack)

The alert wasn't a crash. It was a Sentry notice about daily totals that didn't
reconcile — an accounting report off by one transfer, on a balance-transfer
endpoint that had been live for six months. Pool size 5, so it took exactly one
unlucky overlap for the number to move at all.

The function was four statements long, and every statement was correct:

```javascript
// ❌ a "transaction" on the pool
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

It passes every test. It works perfectly in development. Under real concurrency
it quietly stops being a transaction — and it is the most common Postgres
transaction bug I find in Node.js codebases, whether a human or an assistant
wrote it.

## How `pool.query('BEGIN')` scatters a Postgres transaction across connections

A `Pool` is a _set_ of connections. Each `pool.query()` checks out **whatever
client is free at that moment** — so the four statements above can run on four
different connections:

```text
pool.query('BEGIN')      → Client A   (a transaction opens on A)
pool.query('UPDATE …')   → Client B   (runs outside A's transaction!)
pool.query('UPDATE …')   → Client C
pool.query('COMMIT')     → Client A   (commits an empty transaction)
```

The `BEGIN` and `COMMIT` land on a client that never saw the `UPDATE`s. The
updates run as autocommitted statements on other clients — no atomicity, no
rollback, no isolation. This is a textbook **race condition ([CWE-362](https://ofriperetz.dev/articles/cwe-taxonomy-explained))**.

### The exact interleaving that breaks your balance

Here's one way two `transferFunds` calls interleave on a busy pool of 5. The
other endpoints sharing those five connections aren't drawn, but they're what
takes the idle client out from under you between your own statements:

```text
Request A: pool.query('BEGIN')          → Client 1 opens transaction
Request B: pool.query('BEGIN')          → Client 2 opens transaction
Request A: pool.query('UPDATE …-50')    → Client 3 (autocommit! no transaction)
Request B: pool.query('UPDATE …-50')    → Client 4 (autocommit! no transaction)
Request A: pool.query('UPDATE …+50')    → Client 5 (autocommit! no transaction)
Request B: pool.query('UPDATE …+50')    → Client 3 (autocommit! no transaction)
Request A: pool.query('COMMIT')         → Client 1 commits empty transaction
Request B: pool.query('COMMIT')         → Client 2 commits empty transaction
```

Both debits landed. Both credits landed. But neither was atomic, there was no
rollback guard, and Postgres's isolation guarantees never applied because neither
`UPDATE` ever joined its `BEGIN`'s transaction. This isn't a high-concurrency
edge case — it's what a pool does the moment demand exceeds its size. A pool with
`max=1` accidentally serializes everything and hides the bug. A pool with `max=5`
starts splitting transactions as soon as a **sixth** request is waiting: from
then on every released client goes straight to whoever is queued, so the
connection you just used is gone before your next statement asks for one. Six
requests in flight against five connections is an ordinary Tuesday, not a load
test.

Before anyone reaches for `SERIALIZABLE`: PostgreSQL's default READ COMMITTED
isn't what failed here. No isolation level can help statements that never shared
a transaction in the first place — the race is structural, not an isolation
failure.

### Watch it scatter on your own pool

Don't take the diagram on faith. Postgres will name the connection for you:
`pg_backend_pid()` returns the process ID of the backend that served the
statement you just ran. Give a pool `transferFunds`' four-statement shape and
print where each statement landed ([reproducing it beats believing
it](https://ofriperetz.dev/articles/reproducibility-vs-replicability)):

```javascript
// scatter.js — pg 8.x, read-only, no schema required. Point it straight at
// Postgres (a transaction-pooling proxy like PgBouncer moves PIDs on its own).
const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });

// Give each backend PID a stable name, so the output reads like the diagram.
const names = new Map();
function nameOf(pid) {
  if (!names.has(pid)) names.set(pid, `Client ${names.size + 1}`);
  return names.get(pid);
}

// The shape of the broken transferFunds: four sequential pool.query() calls
// from one caller. Which statement runs doesn't matter — which connection
// serves it is the whole bug — so each call just asks Postgres who answered.
async function transfer(tag) {
  for (const step of ["BEGIN", "UPDATE -50", "UPDATE +50", "COMMIT"]) {
    const { rows } = await pool.query("SELECT pg_backend_pid() AS pid");
    console.log(`${tag} ${step.padEnd(10)} → ${nameOf(rows[0].pid)}`);
  }
}

(async () => {
  console.log("--- sequential: one transfer at a time ---");
  await transfer("A");
  console.log("--- concurrent: eight transfers, pool of five ---");
  await Promise.all("ABCDEFGH".split("").map((tag) => transfer(tag)));
  await pool.end();
})();
```

Run it and the two halves disagree. Sequentially, all four lines of transfer `A`
print the same client — the pool has one idle connection and keeps handing it
back, which is exactly why your test suite is green. Once eight callers contend
for five connections, the four lines of a single transfer stop agreeing: one
logical transaction, split across the pool, in the shape the diagram above
sketches. Which client gets which statement changes from run to run — that's the
race — but the splitting doesn't. Nothing throws. No query errors. The report is
still wrong.

## Why `pool.query('BEGIN')` passes code review without triggering a flag

Read the broken version again. It has a `BEGIN`, two `UPDATE`s, and a `COMMIT`,
in order, with `await` on every line. It _reads_ exactly like a transaction. The
reviewer is checking the business logic — debit one account, credit the other,
correct columns, parameterized values — and on all of that, it's right. Nothing
on the page says "these four statements run on four connections"; that fact lives
in the difference between `Pool` and `PoolClient`, two types away from the diff.
In chess you spend your longest think on the move that looks obviously good. Code
review has no equivalent habit.

**Race conditions pass all unit tests because unit tests run serially — and that's exactly why this bug ships green.** They pass
integration tests too, unless the suite deliberately generates concurrent
requests. They first appear in production under load, by which point real money
or real inventory is attached to the wrong number. That gap between "the suite is
green" and "the behavior is correct" is what a [ground-truth
corpus](https://ofriperetz.dev/articles/ground-truth-in-security-testing) exists
to close — and [it caught what unit tests
missed](https://ofriperetz.dev/articles/what-ground-truth-caught-that-unit-tests-missed)
on exactly this class of bug.

## The fix: one client for the whole transaction

The fix is to check out a single `PoolClient` and issue every statement —
`BEGIN`, the queries, and `COMMIT` — on that same client:

```javascript
// ✅ BEGIN, every query, and COMMIT on the SAME client
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
    client.release(); // always return the client to the pool
  }
}
```

A checked-out client is a single connection held for the duration — `BEGIN`,
every `UPDATE`, and `COMMIT` execute on it, so the transaction is atomic. (And
release it in `finally`, or you trade a race condition for a [connection
leak](https://ofriperetz.dev/articles/database-connection-leak-production-outage).)

## The rule: `no-transaction-on-pool`

Code review missed this once and will miss it again: the broken and correct forms
differ by one word (`pool` vs. `client`) that the diff doesn't explain. Don't rely
on every engineer — or every assistant — remembering pool-vs-client semantics. Let
the linter remember.

The honest origin story: I didn't write this rule after reading the
node-postgres docs. I wrote it after finding the same four lines a second time
and accepting that I was not going to remember on my own.

```bash
npm install --save-dev eslint-plugin-pg
```

```js
// eslint.config.mjs — `configs` is a NAMED export (default export is the plugin)
import { configs } from "eslint-plugin-pg";

export default [configs.recommended];
```

`no-transaction-on-pool` is on as an error in `recommended` (eslint-plugin-pg
v1.4.6). One `npx eslint .` later:

```text
src/transfer.js
  3:20  error  ⚠️ Transactions should not be started on the Pool directly. | HIGH
              Fix: Use "await pool.connect()" to get a client, then start the transaction on the client.
```

(The `Fix:` line also carries a link to the node-postgres transactions guide,
trimmed here for width. `HIGH` is the rule's own severity label, not a
[CVSS](https://ofriperetz.dev/articles/cvss-scores-explained) score — different
measurements, and only one of them is calculated from a vector.)

It catches `BEGIN`, `COMMIT`, and `ROLLBACK` — including `BEGIN;` and
`BEGIN TRANSACTION`, because it matches on the first keyword — and stays silent
on a plain `pool.query('SELECT …')` (a single query needs no transaction) and on
`client.query('BEGIN')` (the correct form). The rule's docs tag CWE-662,
Improper Synchronization; the underlying bug class is the race condition,
CWE-362.

Where it stops: the check keys on a string literal passed to `.query()` on an
object whose name contains `pool` — `pool`, `myPool`, and `dbPool` all match. A
transaction assembled from a template literal, or opened on a pool someone stored
in a variable called `db`, is a [false
negative](https://ofriperetz.dev/articles/confusion-matrix-tp-fp-fn-tn) by
construction. That is a deliberate trade: name-and-literal matching is
[heuristic detection, not taint
analysis](https://ofriperetz.dev/articles/taint-vs-heuristic-detection), and it
buys [precision on the common
form](https://ofriperetz.dev/articles/precision-recall-f1-for-static-analysis) at
the cost of recall on the disguised ones.

## The AI angle: this is the form Gemini and Claude both reach for first

Ask Gemini, Claude, or Copilot for "a Postgres transaction in Node," and the
shape that turns up most often is `pool.query('BEGIN') … pool.query('COMMIT')`.
It's shorter, it skips the `connect()`/`release()` ceremony, and it arrives
confidently, with no warning that it isn't atomic. I keep seeing it in generated
code for the same reason I keep seeing it from humans: it reads like a
transaction.

The data layer is where models struggle most. Across [700 generated functions
from 5 Claude and Gemini
models](https://ofriperetz.dev/articles/aggregate-benchmarks-lie-heres-what-700-ai-functions-look-like-by-security-domain)
(run 2026-02-09), the **database domain topped out at a 96% vulnerability rate**
— Gemini 2.5 Pro's number; even the best, Haiku 4.5, sat at 39% — and the
adjacent File I/O domain was the hardest of all, **86–100% vulnerable across
every model**. Straight talk about what that proves: those findings came from
rules like `pg/no-unsafe-query` and `pg/no-select-all`, not from
`no-transaction-on-pool`, and "vulnerable" there means "flagged by my own
ruleset." The transaction shape is my field observation, not a benchmark result.
It sits in the same blind spot for the same reason, though: the correct form
lives in a type distinction (`Pool` vs `PoolClient`) that never appears as a
token in the SQL. A model that confidently emits `pool.query('BEGIN')` isn't
malfunctioning — it's reproducing the modal pattern, and on data-layer code the
modal pattern is wrong far more often than it's right.

That literal is exactly the form the rule keys on. Land generated code in a repo
with `eslint-plugin-pg` wired up and the bug surfaces as a red squiggle instead
of a reconciliation report — with a `Fix:` line that tells the model what to do
next.

And the same run says the model will _act_ on that line. Database code was not
just where the models failed hardest — it was where they _fixed_ best once handed
an exact defect: **Gemini 2.5 Pro corrected 93% (25 of 27) of data-layer findings
when each was named with its precise CWE**, the highest fix rate of any model in
the category models botch most. (93% of what the ruleset flagged, not 93% of
confirmed injections — the distinction matters, and the source article keeps it.)
That's the loop: the model writes the modal-but-broken form, the rule names the
exact defect — "start the transaction on the client" — and the model rewrites it
correctly because it now has a target instead of a vibe. The lint output is the
better prompt. The same loop, run head-to-head, is written up in [Same NestJS
prompt — Claude got 6 errors, Gemini got
2](https://ofriperetz.dev/articles/claude-vs-gemini-nestjs-security-same-prompt-different-errors).

[Static analysis](https://ofriperetz.dev/articles/static-analysis-vs-sast-vs-linting)
catches the careless form, not the disguised one — which is why the loop pairs
the rule with the model rather than trusting the rule alone. AI doesn't invent
new vulnerability classes; it mass-produces the old ones at the rate you can
prompt for them. I've watched it happen across [80 functions where 65–75% shipped
a security
hole](https://ofriperetz.dev/articles/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities)
and in a [NestJS service where the first lint run found 6
vulnerabilities](https://ofriperetz.dev/articles/claude-wrote-nestjs-service-eslint-found-6-security-holes).
A deterministic rule is how you keep a probabilistic author honest.

## How to wrap Postgres transactions in a `withTransaction` helper

A `withTransaction` helper eliminates the boilerplate and makes every
transaction correct by construction:

```javascript
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

await withTransaction(async (client) => {
  // sequential, not Promise.all — pg serializes queries on a single
  // client anyway, and sequential awaits don't imply a parallelism
  // that doesn't exist in a financial transaction
  await client.query(
    "UPDATE accounts SET balance = balance - $1 WHERE id = $2",
    [amount, from],
  );
  await client.query(
    "UPDATE accounts SET balance = balance + $1 WHERE id = $2",
    [amount, to],
  );
});
```

---

## Compatibility

| Surface              | Support                                                                               |
| -------------------- | ------------------------------------------------------------------------------------- |
| **Plugin**           | `eslint-plugin-pg@1.4.6` — rule is `error` in `recommended` and `strict`              |
| **Package managers** | npm, yarn, pnpm, bun                                                                  |
| **Node**             | `>= 18.0.0`                                                                           |
| **ESLint**           | `^8.0.0 \|\| ^9.0.0 \|\| ^10.0.0`, flat config                                        |
| **`pg` driver**      | peer `^6 \|\| ^7 \|\| ^8`; AST-based, lints regardless of installed version           |
| **Module system**    | Plugin ships CommonJS; your config can be `eslint.config.js` or `.mjs`                |
| **Oxlint**           | Loads under Oxlint's JS-plugin runner via the `interlace-pg` port, parity-gated in CI |

---

## How `no-transaction-on-pool` fits into the `eslint-plugin-pg` threat model

`no-transaction-on-pool` is the atomicity member of `eslint-plugin-pg`. The rest
of the data-layer threat model:

- [The 4 ways a node-postgres data layer fails](https://ofriperetz.dev/articles/sql-injection-node-postgres-pattern) — injection, identifier hijacking, exhaustion, transport
- [The connection leak that exhausted our pool](https://ofriperetz.dev/articles/database-connection-leak-production-outage) — the `finally`-release companion to this fix
- [search_path Hijacking: the PostgreSQL attack that turns `SELECT * FROM users` into the attacker's table](https://ofriperetz.dev/articles/searchpath-hijacking-postgresql-attack) — identifier-resolution hijacking, the same threat model from a different angle
- [PostgreSQL's COPY FROM can read /etc/passwd into your database](https://ofriperetz.dev/articles/postgresql-copy-from-exploit-filesystem-access) — the filesystem-access member of the same plugin
- [N+1 insert loops and API performance](https://ofriperetz.dev/articles/n-plus-1-insert-loop-api-performance) — the throughput failure pattern that pairs with this race condition fix
- [All 13 rules of `eslint-plugin-pg`](https://ofriperetz.dev/articles/getting-started-eslint-plugin-pg)

---

The encouraging part is how cheap the fix is. One `pool.connect()`, one
`finally`, one rule in CI, and the whole class stops reaching production — no
architecture change, no isolation-level tuning, no runtime cost. Run `scatter.js`
against your own pool before taking my word for any of it. The sequential half
will look completely fine. That is the entire problem.

**Next in the Postgres Security Protocol:** [search_path hijacking — the
PostgreSQL attack that turns `SELECT * FROM users` into the attacker's
table](https://ofriperetz.dev/articles/searchpath-hijacking-postgresql-attack).
Same connection, different failure: this article is about _which client_ runs
your statement; that one is about _which schema_ answers it.

Caught a balance mismatch that traced back to `pool.query('BEGIN')`? Drop the
wrong number in the comments — and say whether a human or an assistant wrote the
line.

---

## Links

- 📦 [npm: eslint-plugin-pg](https://www.npmjs.com/package/eslint-plugin-pg)
- 📖 [Rule docs: no-transaction-on-pool](https://eslint.interlace.tools/docs/security/plugin-pg/rules/no-transaction-on-pool)
- 💻 [Source on GitHub](https://github.com/ofri-peretz/eslint/tree/main/packages/eslint-plugin-pg)
- 🔗 [Database connection leak — production outage](https://ofriperetz.dev/articles/database-connection-leak-production-outage)
- 🔗 [N+1 insert loop — API performance](https://ofriperetz.dev/articles/n-plus-1-insert-loop-api-performance)
- 🔗 [We ranked 5 AI models by security — the leaderboard is wrong](https://ofriperetz.dev/articles/we-ranked-5-ai-models-by-security-the-leaderboard-is-wrong)
- 🔗 [All Interlace ESLint rules](https://eslint.interlace.tools)
- 𝕏 [@ofriperetzdev](https://x.com/ofriperetzdev)

::dev-to-cta{url="https://www.npmjs.com/package/eslint-plugin-pg"}
📦 `npm install --save-dev eslint-plugin-pg` — 13 rules for the `pg` driver, including the one that flags `pool.query("BEGIN")` before it reaches a balance sheet.
::

---

_Part of the [Interlace ESLint ecosystem](https://eslint.interlace.tools). Source on [GitHub](https://github.com/ofri-peretz/eslint) · Follow: [Dev.to/ofri-peretz](https://dev.to/ofri-peretz)_
