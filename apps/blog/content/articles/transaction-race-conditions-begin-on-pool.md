---
title: "BEGIN on a Postgres Pool Scatters Your Transaction Across Connections. One ESLint Rule Stops It."
description: "pool.query('BEGIN') runs on a different pooled client than the UPDATE that follows it — so your 'transaction' isn't atomic and corrupts data under load. The race condition (CWE-362), the dedicated-client fix, and the pg ESLint rule that catches every BEGIN/COMMIT on a pool."
slug: "transaction-race-conditions-begin-on-pool"
canonical_url: "https://ofriperetz.dev/articles/transaction-race-conditions-begin-on-pool"
devto_url: "https://dev.to/ofri-peretz/transaction-race-conditions-why-begin-on-pool-breaks-everything-117h"
devto_id: 3138993
published_at: "2025-12-31T21:38:13Z"
edited_at: "2026-01-11T10:21:47Z"
cover_image: "https://ofriperetz.dev/og/cover/transaction-race-conditions-begin-on-pool"
social_image: "https://ofriperetz.dev/og/article/transaction-race-conditions-begin-on-pool"
reading_time_minutes: 5
tags:
  - "eslint"
  - "node"
  - "ai"
  - "javascript"
author:
  name: "Ofri Peretz"
  username: "ofri-peretz"
  avatar: "https://media2.dev.to/dynamic/image/width=640,height=640,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Fuser%2Fprofile_image%2F3669992%2F50a1f256-472c-48a1-85e8-149459647ea7.png"
  twitter: "ofriperetzdev"
series: "Postgres Security Protocol"
---

This is the single most common Postgres transaction bug I find in Node.js
codebases — and the one an AI assistant will hand you the fastest. It passes
every test, works perfectly in development, and under real concurrency in
production it silently corrupts account balances:

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

## Why it corrupts data

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
rollback, no isolation. Two concurrent transfers interleave and the balance is
wrong. This is a textbook **race condition (CWE-362)** — and it's invisible until
concurrency is high enough to scatter the statements.

## Why this survives code review

Read the broken version again. It has a `BEGIN`, two `UPDATE`s, and a `COMMIT`,
in order, with `await` on every line. It _reads_ exactly like a transaction. The
reviewer is checking the business logic — debit one account, credit the other,
correct columns, parameterized values — and on all of that, it's right. Nothing
on the page says "these four statements run on four connections"; that fact lives
in the difference between `Pool` and `PoolClient`, two types away from the diff.

Then the tests pass. Of course they do — a test suite hits this function one call
at a time, the pool hands every query the same idle connection, and the
statements happen to line up on one client. The bug only exists when two requests
overlap, which is precisely the condition a unit test never creates. So it ships
green, reviewed, and broken, and waits for the first traffic spike to scatter the
statements. ([Ground truth caught what unit tests
missed](https://ofriperetz.dev/articles/what-ground-truth-caught-that-unit-tests-missed)
is the longer version of that last sentence.)

## The fix: one client for the whole transaction

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

Code review missed this once and will miss it again — the broken and correct
forms differ by one word (`pool` vs. `client`) that the diff doesn't explain. So
don't rely on every engineer (or every AI assistant) remembering pool-vs-client
semantics. Let the linter remember. The rule flags a transaction-control
statement issued on a pool:

```bash
npm install --save-dev eslint-plugin-pg
```

```js
// eslint.config.mjs — `configs` is a NAMED export (default export is the plugin)
import { configs } from "eslint-plugin-pg";

export default [configs.recommended];
```

```text
src/transfer.js
  3:9  error  ⚠️ Transactions should not be started on the Pool directly. | HIGH
             Fix: Use "await pool.connect()" to get a client, then start the transaction on the client.
```

(The ESLint CLI also appends the rule's doc URL to the `Fix:` line; trimmed
here.) It catches `BEGIN`, `COMMIT`, and `ROLLBACK` on a `pool.query()` — and
stays silent on a plain `pool.query('SELECT …')` (a single query needs no
transaction) and on `client.query('BEGIN')` (the correct form). (The rule's own
docs tag the narrower CWE-662, Improper Synchronization; the underlying bug class
is the race condition, CWE-362.) It keys on a string-literal first argument to a
`pool`-named object's `.query()`, so a transaction built from a template literal
or held in a differently-named variable still warrants a human look.

## The AI angle: this is the form an assistant reaches for first

Ask Claude, Copilot, or Gemini for "a Postgres transaction in Node," and watch
what comes back. The overwhelmingly common shape in the training data is
`pool.query('BEGIN') … pool.query('COMMIT')` — it's shorter, it has no
`connect()`/`release()` ceremony, and it looks right. An assistant optimizing for
the most-likely-next-token will hand you the exact pattern at the top of this
article, confidently, with no warning that it isn't atomic. I keep seeing it in
generated code for the same reason I keep seeing it from humans: it reads like a
transaction.

The encouraging part is that this is a clean handshake between the model and the
linter. The literal `pool.query('BEGIN')` an assistant emits is precisely the
string-literal-on-a-pool-named-object form the rule keys on — so the moment
AI-generated code lands in a repo with `eslint-plugin-pg` wired up, the bug
surfaces as a red squiggle instead of a 2 a.m. balance-mismatch page. The rule's
`Fix:` line even tells the model what to do next: switch to `pool.connect()`.
(The flip side is honest too — when an assistant hides the transaction inside a
`withTransaction` helper or builds the SQL from a template literal, the rule goes
quiet for the same structural reason a human reviewer would: the pool-name and
string-literal signals are gone. Static analysis catches the careless form, not
the disguised one.)

This is the recurring theme across this whole ecosystem: AI doesn't invent new
vulnerability classes, it mass-produces the old ones at the rate you can prompt
for them. I've watched it happen with [60 functions where 65–75% shipped a
security
hole](https://ofriperetz.dev/articles/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities)
and with a [NestJS service where the first lint run found 6
vulnerabilities](https://ofriperetz.dev/articles/claude-wrote-nestjs-service-eslint-found-6-security-holes).
A deterministic rule is how you keep a probabilistic author honest.

## Make it reusable

Wrap the borrow→begin→commit→release dance once, and every transaction is correct
by construction:

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

await withTransaction((client) =>
  Promise.all([
    client.query("UPDATE accounts SET balance = balance - $1 WHERE id = $2", [
      amount,
      from,
    ]),
    client.query("UPDATE accounts SET balance = balance + $1 WHERE id = $2", [
      amount,
      to,
    ]),
  ]),
);
```

## When to use what

| Scenario                       | Use                                  |
| ------------------------------ | ------------------------------------ |
| Single query                   | `pool.query()`                       |
| Multiple independent queries   | `pool.query()` (no atomicity needed) |
| Transaction (`BEGIN`/`COMMIT`) | `pool.connect()` → `client.query()`  |
| Long-running session           | `pool.connect()` → `client.query()`  |

---

## Compatibility

| Surface              | Support                                                                               |
| -------------------- | ------------------------------------------------------------------------------------- |
| **Package managers** | npm, yarn, pnpm, bun                                                                  |
| **Node**             | `>= 18.0.0`                                                                           |
| **ESLint**           | `^8.0.0 \|\| ^9.0.0 \|\| ^10.0.0`, flat config                                        |
| **`pg` driver**      | peer `^6 \|\| ^7 \|\| ^8`; AST-based, lints regardless of installed version           |
| **Module system**    | Plugin ships CommonJS; your config can be `eslint.config.js` or `.mjs`                |
| **Oxlint**           | Loads under Oxlint's JS-plugin runner via the `interlace-pg` port, parity-gated in CI |

---

## Where this fits

`no-transaction-on-pool` is the atomicity member of `eslint-plugin-pg`. The rest
of the data-layer threat model:

- [The 4 ways a node-postgres data layer fails](https://ofriperetz.dev/articles/sql-injection-node-postgres-pattern) — injection, identifier hijacking, exhaustion, transport
- [The connection leak that exhausted our pool](https://ofriperetz.dev/articles/database-connection-leak-production-outage) — the `finally`-release companion to this fix
- [All 13 rules of `eslint-plugin-pg`](https://ofriperetz.dev/articles/getting-started-eslint-plugin-pg)

---

What was the number that finally didn't add up for you — a wallet balance, an
inventory count, an idempotency key that double-fired — that traced back to a
"transaction" running on the pool? And was it a human or an AI assistant that
wrote the `pool.query("BEGIN")`? I want to hear the post-mortem in the comments.

---

## Links

- 📦 [npm: eslint-plugin-pg](https://www.npmjs.com/package/eslint-plugin-pg)
- 📖 [Rule docs: no-transaction-on-pool](https://eslint.interlace.tools/docs/security/plugin-pg/rules/no-transaction-on-pool)
- 💻 [Source on GitHub](https://github.com/ofri-peretz/eslint/tree/main/packages/eslint-plugin-pg)

::dev-to-cta{url="https://github.com/ofri-peretz/eslint"}
⭐ Star on GitHub if you've ever wrapped `pool.query("BEGIN")` and called it a transaction.
::

---

I'm **Ofri Peretz**, a security engineering leader and the author of the
Interlace ESLint ecosystem — domain-specific static analysis for security,
reliability, and performance on the Node.js stack. `eslint-plugin-pg` is its
node-postgres layer.

[ofriperetz.dev](https://ofriperetz.dev) · [LinkedIn](https://linkedin.com/in/ofri-peretz) · [GitHub](https://github.com/ofri-peretz)
