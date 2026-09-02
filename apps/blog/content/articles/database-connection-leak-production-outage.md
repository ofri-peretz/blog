---
title: "A Missing client.release() Exhausted Our Postgres Pool at 3 AM. The ESLint Rule That Catches It."
description: "A missing client.release() drained our node-postgres pool and every request started timing out. A 60-second reproduction (the 11th checkout hangs forever), the finally/pool.query fix, and the structural ESLint rule that flags a checked-out client that's never released — before it merges."
slug: "database-connection-leak-production-outage"
canonical_url: "https://ofriperetz.dev/articles/database-connection-leak-production-outage"
tier: "TOPIC"
devto_url: "https://dev.to/ofri-peretz/the-connection-leak-that-took-down-our-production-database-3bal"
devto_id: 3138991
published_at: "2025-12-31T21:35:53Z"
edited_at: "2026-01-11T10:21:49Z"
cover_image: "https://ofriperetz.dev/cdn/blog-cover-image/database-connection-leak-production-outage.jpg?v=b2"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/database-connection-leak-production-outage-og.jpg?v=b2"
reading_time_minutes: 9
tags:
  - "node"
  - "eslint"
  - "devsecops"
  - "security"
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

> **Postgres Security Protocol** — a series on the bugs that pass review and melt
> in production. **← Prev:** [Getting started with `eslint-plugin-postgresql-security`](https://ofriperetz.dev/articles/getting-started-eslint-plugin-postgresql-security) · **You are here:** the connection leak · **Next →** [Transaction race conditions: `BEGIN` on the pool](https://ofriperetz.dev/articles/transaction-race-conditions-begin-on-pool)

At 3:02 AM, PagerDuty fired. API response time had climbed to 18 seconds. Then the 500s started — every endpoint, every user. The database was healthy: CPU at 12%, memory nominal, disk fine. But every query returned the same error:

```text
FATAL: too many connections for role "app_user"
```

We had a 100-connection pool and normal traffic. 47 minutes later — after ruling out a Postgres config change, a traffic spike, and a memory leak in the wrong service — we had the root cause: **3 lines of code that every code review had approved, running quietly in production for months.**

A single missing `client.release()` is enough to exhaust a 10-connection pool under production load — and TypeScript won't catch it.

## The leak

Here it was — a single helper, called on a hot path:

```javascript
// ❌ the leak
async function getUserOrders(userId) {
  const client = await pool.connect();
  const orders = await client.query("SELECT * FROM orders WHERE user_id = $1", [
    userId,
  ]);
  return orders.rows;
  // client.release() never runs — the connection is gone for good
}
```

`pool.connect()` checks a connection _out_ of the pool. Without
`client.release()`, it's never returned. Every call permanently burns one slot,
and when the pool is empty the next `pool.connect()` doesn't error — it **blocks,
waiting for a client that never comes back** (assuming the default `connectionTimeoutMillis: 0`, which disables the timeout and waits indefinitely; if you've set a positive value, you'll get an error instead of a hang — but you still leak the connection). That silent wait is why the symptom
is timeouts, not a stack trace: the leak strangles the pool, and everything else
that needs the database queues behind it. The blast radius of one missing line is
the whole service.

You don't have to take the arithmetic on faith — it reproduces in under a minute,
and the exact numbers are below.

### Why this survived code review

Nobody waved this through because they were careless. They waved it through
because the function is _correct in isolation_. Read it top to bottom: it
connects, it queries, it returns the rows. Every line that's present does the
right thing. The bug is a line that **isn't there** — and a diff shows you what
was added, not what was forgotten.

There's a subtler reason too — and it's the one that outlives even a careful
reviewer. The function above leaks on _every_ call: the release was never
written at all. But picture the disciplined fix — someone adds
`client.release()` right after the query, before the `return`. The happy path is
now spotless. Then `client.query()` throws — a constraint violation, a dropped
socket, a statement timeout — and control jumps straight over that release to
the caller. The client is gone, this time only when a query fails under load:
the one condition your tests never simulate. A `release()` that isn't in a
`finally` is one that runs precisely when you didn't need the guarantee — which
is why the fix below is a `finally`, not a line pasted before `return`.

It also passed every test. A leak doesn't fail the first request, or the
hundredth. It fails the _N-thousandth_ concurrent checkout, after the pool is
drained — which never happens in a unit test, never happens in CI, and never
happens in a dev environment running one request at a time. The cost is paid
only under sustained production concurrency, which is exactly where you can't
afford it.

Before you pair this with a [security audit protocol](https://ofriperetz.dev/articles/the-30-minute-security-audit-onboarding-a-new-codebase), make sure [static analysis](https://ofriperetz.dev/articles/static-analysis-vs-sast-vs-linting) has already closed this class of bug. One line, before any of this pages you:

```bash
npm install --save-dev eslint-plugin-postgresql-security
```

The fix and the config that enforces it, in order.

## Reproduce it in 60 seconds

You don't need a 3 AM outage to see this — you need a pool with a small ceiling
and a loop that forgets to release. Here it is against a real Postgres
(`pg@8.21.0`, Node 25, `postgres:16` in Docker), with the pool capped at 10 so the
ceiling is obvious. Two different limits are in play: the Postgres server's
`max_connections=15` is the hard wall the _database_ enforces; the pool's `max: 10`
(set in the client below) is the lower ceiling the _application_ hits first — so
the pool starves at 10 long before Postgres would reject anything:

```bash
docker run -d --name pg-leak -e POSTGRES_PASSWORD=demo -e POSTGRES_DB=demo \
  -p 55432:5432 postgres:16 -c max_connections=15
```

```javascript
// leak.js — the exact bug, in a loop. pool max = 10.
const { Pool } = require("pg");
const pool = new Pool({
  host: "localhost",
  port: 55432,
  user: "postgres",
  password: "demo",
  database: "demo",
  max: 10,
  connectionTimeoutMillis: 0, // default: wait forever (no timeout)
});

async function getUserOrders(userId) {
  const client = await pool.connect();
  const orders = await client.query("SELECT $1::int AS id", [userId]);
  return orders.rows; // client.release() never runs
}

(async () => {
  for (let i = 1; i <= 12; i++) {
    await getUserOrders(i);
    console.log(`call ${i}: ok (${i} clients checked out, 0 returned)`);
  }
})();
```

```bash
node leak.js
```

The measured result — the pool serves **exactly 10 calls, then call 11 hangs
forever** (with `connectionTimeoutMillis: 0`):

```text
call 1: ok (1 clients checked out, 0 returned)
...
call 10: ok (10 clients checked out, 0 returned)
# call 11 never prints. pool.connect() is blocked on a client
# that will never be released. Ctrl-C is the only way out.
```

That hang _is_ the production symptom in miniature: not an exception you can grep
for, just requests that stop completing. Swap `getUserOrders` for the `finally`
version below and the same loop runs **50 calls clean and `pool.end()` returns
immediately** — same pool ceiling, zero leaked. One number, two outcomes,
[reproducible](https://ofriperetz.dev/articles/reproducibility-vs-replicability) on your machine before you trust a word of the post-mortem.

## The fix: release in `finally`, or don't check out at all

Two patterns close the hole. First — if you need an explicit client, release it
in a `finally` so it returns **even when the query throws**:

```javascript
// ✅ finally guarantees the release — even when client.query() throws
async function getUserOrders(userId) {
  const client = await pool.connect();
  try {
    const orders = await client.query(
      "SELECT * FROM orders WHERE user_id = $1",
      [userId],
    );
    return orders.rows;
  } finally {
    client.release();
  }
}
```

The `finally` is the key: if `client.query()` throws, the `finally` block still
runs `client.release()` before the error propagates. Without it, the throwing
path leaks the client permanently.

Better still — a single-shot query doesn't need a manual checkout at all.
`pool.query()` borrows and returns a connection for you:

```javascript
// ✅ best for single queries — no client to leak
async function getUserOrders(userId) {
  const { rows } = await pool.query("SELECT * FROM orders WHERE user_id = $1", [
    userId,
  ]);
  return rows;
}
```

## The rule: `no-missing-client-release` (CWE-404)

You don't find this leak at 3 AM. You find it at write-time. With the plugin
installed (above), wire the recommended config:

```js
// eslint.config.js — requires ESM. For CommonJS projects, save as
// eslint.config.mjs or add "type": "module" to package.json first.
import { configs } from "eslint-plugin-postgresql-security";

export default [configs.recommended];
```

> **CommonJS projects:** If your project doesn't have `"type": "module"` in `package.json`, the `import` above throws a `SyntaxError`. Either rename the file to `eslint.config.mjs` (works in any project) or add `"type": "module"` to `package.json`. Both produce identical behavior; the `.mjs` rename is the safer zero-risk path.

And the leak that hangs your pool now fails the lint run instead. This is the
verbatim message the rule emits — run on the `leak.js` from above:

```text
leak.js
  9:9  error  ⚡ CWE-404 OWASP:A05 | PG client acquired but not released. | HIGH
             Fix: Ensure "client.release()" is called in a finally block to return the client to the pool. | https://node-postgres.com/features/pooling#checkout-use-and-return
```

> **A note on the OWASP tag.** A connection leak is fundamentally an
> _availability/resource_ bug ([CWE-404](https://ofriperetz.dev/articles/cwe-taxonomy-explained)), not injection. The finding stamps
> `OWASP:A05` — which in the only published [OWASP Top 10](https://ofriperetz.dev/articles/owasp-top-10-explained) (2021) maps to
> **Security Misconfiguration**, not Injection (that's A03). The `A05` label is
> faithfully reproduced from the plugin's own metadata; it's arguably defensible
> for an unclosed resource under Security Misconfiguration, but the plugin's
> internal labeling calls it `A05-Injection`, which is an acknowledged
> metadata bug in the plugin, not a taxonomy claim. If that mapping bugs you
> as much as it bugs some reviewers, treat the CWE-404 as the load-bearing
> identifier; the OWASP label is a secondary cross-reference.

> **What it actually checks — and what it doesn't.** The rule is deliberately
> AST-structural — a [structural heuristic, not taint tracking](https://ofriperetz.dev/articles/taint-vs-heuristic-detection) — it finds `const client = await pool.connect()` and flags it
> when **no `client.release()` call references that client anywhere in scope** —
> the overwhelmingly common leak (the release that was simply never written). It
> does _not_ prove your release runs on every branch or sits in a `finally` —
> that's why you pair the rule with the patterns above. It catches the omission;
> the `finally`/`pool.query()` shape makes the placement correct. (It also keys
> off a plain `const client = …` assignment, so destructured checkouts are out
> of scope.)

> **Why a static check, when you could just monitor the pool?** The senior
> instinct here is runtime telemetry — `pool.on('error')`, a Prometheus gauge on
> `pool.waitingCount`/`pool.totalCount`, an alert when idle connections trend to
> zero. Keep those; they're how you catch the leak a third-party client opens
> that no AST can see. But every one of them fires _after_ the leaked checkout is
> already running in production — the gauge climbs, the alert pages, and now
> you're diffing deploys at 3 AM. The static rule moves the same catch to the one
> moment it's free: the keystroke. `pool.waitingCount > 0` tells you a release is
> missing _somewhere, right now, under load_; `no-missing-client-release` tells
> you it's missing _on line 9, before you commit_. Runtime metrics are the safety
> net for the leaks you can't see statically; the rule is how you stop writing
> the ones you can.

## Your AI assistant writes this shape too — and up to 96% of one model's database code trips a rule

This pattern is not going away — it's accelerating, and I have the numbers. Ask
any coding assistant (Claude, Copilot, Gemini) for "a function that fetches a
user's orders from a Postgres pool" and a large share of the time you get the
`pool.connect()` shape back, often without the `finally`. The model learned from
the same public codebases that leaked connections for a decade; it reproduces the
average of what it saw, and the average has this bug.

How large a share? I benchmarked it. Across [700 AI-generated functions from 5
models, scanned by 332 ESLint
rules](https://ofriperetz.dev/articles/we-ranked-5-ai-models-by-security-the-leaderboard-is-wrong),
the **database** domain — the one this article lives in — is where models break
down worst: the per-model vulnerability rate runs from **39% (Claude Haiku) to
96% (Gemini 2.5 Pro)** on database tasks. And the reason the flagship models
score _worse_ is the tell: Gemini Pro writes the most elaborate database code —
explicit connection pooling, credential handling, column enumeration — which is
exactly the surface where a forgotten `release()` hides. The more "production-
shaped" the generated code looks, the more likely it is to check a client out of
the pool, and the more places that checkout has to leak.

If you haven't yet benchmarked your own ESLint security plugin stack against competitors, the [17-plugin comparison](https://ofriperetz.dev/articles/benchmark-17-eslint-security-plugins-compared) gives you a framework to do it honestly — including where `eslint-plugin-postgresql-security` ranks on database-specific rules.

Don't take my word for any of it — here's the whole loop as four commands you
can run right now against Gemini, the model with the 96% database rate. This is
the experiment behind the numbers above, shrunk to one function so you can
reproduce the _shape_ of the finding on your own machine in a minute:

```bash
# 1. generate — ask the 96% model for the exact function from the post-mortem
gemini -p 'Write a Node.js function getUserOrders(userId) that fetches a
  user'\''s orders from a Postgres connection pool using the pg library.' \
  > orders.js

# 2. scan — point the rule at what it just wrote
npx eslint orders.js   # eslint.config.js = the configs.recommended block above

# 3. (if it leaked) feed the exact CWE back — the deterministic repair channel
gemini -p "$(cat orders.js)

The linter reports: CWE-404 — PG client acquired but not released.
Fix it so the client is always returned to the pool." > orders.fixed.js

# 4. re-scan — prove the finding is gone
npx eslint orders.fixed.js
```

Step 2 gives you a binary, AST-checked verdict instead of squinting at generated
code and hoping: either the function released the client or the linter lights up
at the assignment. Step 3–4 is the part the benchmark measured at scale —
Gemini Pro restructures correctly **25 of 27 times** when the feedback is a
specific CWE, not a vague "make it more secure." Swap `gemini` for `claude` and
you've got the same harness across models; that's the entire methodology of the
[700-function benchmark](https://ofriperetz.dev/articles/we-ranked-5-ai-models-by-security-the-leaderboard-is-wrong),
collapsed to a single file you control.

The reassuring part: the rule does not care who typed the code. It is purely
AST-structural — it sees a checked-out client with no `release()` referencing it
in scope, and it flags the assignment, whether a human, a model, or
copy-paste-from-StackOverflow put it there. That's the whole argument for
running structural rules on AI-generated code: the assistant optimizes for "this
looks like working code," and a checked-out connection with no release _looks_
like working code. The lint rule is the layer that checks what the model can't —
that the resource you borrowed is the resource you returned.

That repair channel in step 3 is the part that makes the rule worth more than a
one-time catch, and it's why the bare `CWE-404: PG client acquired but not
released` string matters as much as the block it prevents: a specific,
machine-checkable finding is the only kind of feedback the model reliably acts on.
So the rule isn't just a gate that blocks the bad checkout; it's the deterministic
feedback channel that lets the assistant repair its own leak.

## The connection-lifecycle family

`no-missing-client-release` is one of a small set in `eslint-plugin-postgresql-security` that
guard the borrow→use→return lifecycle:

| Rule                                                                                                                  | CWE _in the finding_ | Catches                                                           |
| --------------------------------------------------------------------------------------------------------------------- | -------------------- | ----------------------------------------------------------------- |
| [`no-missing-client-release`](https://eslint.interlace.tools/docs/security/plugin-pg/rules/no-missing-client-release) | CWE-404              | a checked-out client that's never released                        |
| [`prefer-pool-query`](https://eslint.interlace.tools/docs/security/plugin-pg/rules/prefer-pool-query)                 | CWE-400              | a manual checkout for a single-shot query — use `pool.query()`    |
| [`no-floating-query`](https://eslint.interlace.tools/docs/security/plugin-pg/rules/no-floating-query)                 | CWE-391              | a query promise neither `await`ed nor `return`ed                  |
| [`prevent-double-release`](https://eslint.interlace.tools/docs/security/plugin-pg/rules/prevent-double-release)       | —                    | `client.release()` called more than once on the same client       |
| [`no-transaction-on-pool`](https://eslint.interlace.tools/docs/security/plugin-pg/rules/no-transaction-on-pool)       | —                    | `BEGIN`/`COMMIT` issued on the pool instead of a dedicated client |

The column is the CWE **in the emitted lint message**, not the one in metadata —
they differ, and the difference is deliberate. I verified it by running each rule
(ESLint 10.4.1): the first three pass a `cwe` into `formatLLMMessage`, so their
findings print `CWE-…`; `prevent-double-release` and `no-transaction-on-pool` do
**not** pass one to the formatter, so their messages carry no CWE — even though
both _do_ set one in `meta.docs` (CWE-415 Double Free and CWE-662 Improper
Synchronization, respectively). If you grep the source you'll see those IDs; if
you read the lint output you won't. The table reports what the developer actually
sees in the terminal.

---

## Compatibility

| Surface              | Support                                                                               |
| -------------------- | ------------------------------------------------------------------------------------- |
| **Package managers** | npm, yarn, pnpm, bun                                                                  |
| **Node**             | `>= 18.0.0`                                                                           |
| **ESLint**           | `^8.0.0 \|\| ^9.0.0 \|\| ^10.0.0`, flat config                                        |
| **`pg` driver**      | peer `^6 \|\| ^7 \|\| ^8`; AST-based, lints regardless of installed version           |
| **Module system**    | ESM native; CommonJS — save config as `eslint.config.mjs`                             |
| **Oxlint**           | Loads under Oxlint's JS-plugin runner via the `interlace-pg` port, parity-gated in CI |

```bash
# npm / yarn / pnpm / bun
npm install --save-dev eslint-plugin-postgresql-security
yarn add -D eslint-plugin-postgresql-security
pnpm add -D eslint-plugin-postgresql-security
bun add -d eslint-plugin-postgresql-security
```

---

## Where this fits

`no-missing-client-release` is the availability member of `eslint-plugin-postgresql-security` —
the same plugin that catches SQL injection and the N+1 insert loop. It's part of
the **Postgres Security Protocol** series; its closest sibling is the other way
a borrowed connection bites you in production:

- [Transaction race conditions: `BEGIN` on the pool](https://ofriperetz.dev/articles/transaction-race-conditions-begin-on-pool) — the same checkout lifecycle, the inverse failure: a transaction split across pooled connections
- [The SQL-injection pattern in node-postgres](https://ofriperetz.dev/articles/sql-injection-node-postgres-pattern) — the confidentiality member of the same plugin, when the string you concatenated is the attack
- [Getting started with `eslint-plugin-postgresql-security`](https://ofriperetz.dev/articles/getting-started-eslint-plugin-postgresql-security) — all 13 rules

---

## Links

- 📦 [npm: eslint-plugin-postgresql-security](https://www.npmjs.com/package/eslint-plugin-postgresql-security)
- 📖 [Rule docs: no-missing-client-release](https://eslint.interlace.tools/docs/security/plugin-pg/rules/no-missing-client-release)
- 💻 [Source on GitHub](https://github.com/ofri-peretz/eslint/tree/main/packages/eslint-plugin-postgresql-security)

Have you ever traced a production incident to a resource leak that passed all your code reviews — and what was the reviewer's reaction when you showed them the root cause?

::dev-to-cta{url="https://github.com/ofri-peretz/eslint"}
⭐ Star on GitHub if a missing `client.release()` has ever paged you at 3 AM.
::

---

_Part of the [Interlace ESLint ecosystem](https://eslint.interlace.tools). Source on [GitHub](https://github.com/ofri-peretz/eslint) · Follow: [Dev.to/ofri-peretz](https://dev.to/ofri-peretz)_
