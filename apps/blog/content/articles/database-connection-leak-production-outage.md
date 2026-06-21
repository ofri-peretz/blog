---
title: "A Missing client.release() Exhausted Our Postgres Pool at 3 AM. The ESLint Rule That Catches It."
description: "A missing client.release() drained our node-postgres pool and every request started timing out. A 60-second reproduction (the 11th checkout hangs forever), the finally/pool.query fix, and the structural ESLint rule that flags a checked-out client that's never released — before it merges."
slug: "database-connection-leak-production-outage"
canonical_url: "https://ofriperetz.dev/articles/database-connection-leak-production-outage"
devto_url: "https://dev.to/ofri-peretz/the-connection-leak-that-took-down-our-production-database-3bal"
devto_id: 3138991
published_at: "2025-12-31T21:35:53Z"
edited_at: "2026-01-11T10:21:49Z"
cover_image: "https://ofriperetz.dev/og/cover/database-connection-leak-production-outage"
social_image: "https://ofriperetz.dev/og/article/database-connection-leak-production-outage"
reading_time_minutes: 5
tags:
  - "eslint"
  - "node"
  - "security"
  - "devsecops"
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
> in production. **← Prev:** [Getting started with `eslint-plugin-pg`](https://ofriperetz.dev/articles/getting-started-eslint-plugin-pg) · **You are here:** the connection leak · **Next →** [Transaction race conditions: `BEGIN` on the pool](https://ofriperetz.dev/articles/transaction-race-conditions-begin-on-pool)

3 AM. PagerDuty. Every API request returning 500.

The database was healthy — CPU fine, memory fine, disk fine. But every query
timed out against the same error:

```text
FATAL: too many connections for role "app_user"
```

We had a 100-connection pool and _normal_ traffic. So where had all 100
connections gone?

## The leak

After too long staring at logs, here it was — a single helper, called on a hot
path:

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
waiting for a client that never comes back**. That silent wait is why the symptom
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
was added, not what was forgotten. Reviewers catch wrong code; they rarely catch
absent code.

It also passed every test. A leak doesn't fail the first request, or the
hundredth. It fails the _N-thousandth_ concurrent checkout, after the pool is
drained — which never happens in a unit test, never happens in CI, and never
happens in a dev environment running one request at a time. The cost is paid
only under sustained production concurrency, which is exactly where you can't
afford it. This is a structural omission, and structural omissions are what
static analysis is built to catch — at write-time, in the editor, before the
diff is even opened. One line, before any of this pages you:

```bash
npm install --save-dev eslint-plugin-pg
```

The fix and the config that enforces it, in order.

## Reproduce it in 60 seconds

You don't need a 3 AM outage to see this — you need a pool with a small ceiling
and a loop that forgets to release. Here it is against a real Postgres
(`pg@8.21.0`, Node 25, `postgres:16` in Docker), with the pool capped at 10 so the
ceiling is obvious:

```bash
docker run -d --name pg-leak -e POSTGRES_PASSWORD=demo -e POSTGRES_DB=demo \
  -p 55432:5432 postgres:16 -c max_connections=15
```

```javascript
// leak.js — the exact bug, in a loop. pool max = 10.
const { Pool } = require("pg");
const pool = new Pool({
  host: "localhost", port: 55432, user: "postgres",
  password: "demo", database: "demo", max: 10,
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
forever**:

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
reproducible on your machine before you trust a word of the post-mortem.

## The fix: release in `finally`, or don't check out at all

Two patterns close the hole. First — if you need an explicit client, release it
in a `finally` so it returns **even when the query throws**:

```javascript
// ✅ finally guarantees the release
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
// eslint.config.js — `configs` is a NAMED export (default export is the plugin)
import { configs } from "eslint-plugin-pg";

export default [configs.recommended];
```

And the leak that hangs your pool now fails the lint run instead. This is the
verbatim message the rule emits — run on the `leak.js` from above:

```text
src/orders.js
  2:9  error  ⚡ CWE-404 OWASP:A05-Injection | PG client acquired but not released. | HIGH
             Fix: Ensure "client.release()" is called in a finally block to return the client to the pool. | https://node-postgres.com/features/pooling#checkout-use-and-return
```

> **A note on the OWASP tag.** A connection leak is fundamentally an
> _availability/resource_ bug (CWE-404), not injection — and yet the finding
> stamps `OWASP:A05-Injection`. That tag is faithfully reproduced from the
> plugin's own metadata: `eslint-plugin-pg` maps this rule's CWE to A05 under the
> 2025 OWASP numbering, where A05 is the Injection category. It's the plugin's
> taxonomy choice, not a claim that a leak _is_ injection. If that mapping bugs
> you as much as it bugs some reviewers, the CWE is the load-bearing identifier
> here; treat the OWASP label as a secondary cross-reference.

> **What it actually checks — and what it doesn't.** The rule is deliberately
> AST-structural: it finds `const client = await pool.connect()` and flags it
> when **no `client.release()` call references that client anywhere in scope** —
> the overwhelmingly common leak (the release that was simply never written). It
> does _not_ prove your release runs on every branch or sits in a `finally` —
> that's why you pair the rule with the patterns above. It catches the omission;
> the `finally`/`pool.query()` shape makes the placement correct. (It also keys
> off a plain `const client = …` assignment, so destructured checkouts are out
> of scope.)

## The AI assistant will write this leak for you

This pattern is not going away — it's accelerating. Ask any coding assistant
(Claude, Copilot, Gemini) for "a function that fetches a user's orders from a
Postgres pool" and a large share of the time you get the `pool.connect()` shape
back, often without the `finally`. The model learned from the same public
codebases that leaked connections for a decade; it reproduces the average of
what it saw, and the average has this bug.

Don't take my word for it — this one's a 30-second test you can run yourself:
paste that prompt into whatever assistant you have open, drop the answer into
`orders.js`, and run the rule on it (`npx eslint orders.js` with the config
above). Either it releases the client or the linter lights up at the assignment.
That's the point: you get a binary, AST-checked answer instead of squinting at
generated code and hoping.

The reassuring part: the rule does not care who typed the code. It is purely
AST-structural — it sees a checked-out client with no `release()` referencing it
in scope, and it flags the assignment, whether a human, a model, or
copy-paste-from-StackOverflow put it there. That's the whole argument for
running structural rules on AI-generated code: the assistant optimizes for "this
looks like working code," and a checked-out connection with no release _looks_
like working code. The lint rule is the layer that checks what the model can't —
that the resource you borrowed is the resource you returned. (I've written more
on [what happens when you point ESLint at AI-generated
code](https://ofriperetz.dev/articles/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities)
and [the six holes one lint run found in a Claude-written
service](https://ofriperetz.dev/articles/claude-wrote-nestjs-service-eslint-found-6-security-holes).)

## The connection-lifecycle family

`no-missing-client-release` is one of a small set in `eslint-plugin-pg` that
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
| **Module system**    | CommonJS — `eslint.config.js` or `.mjs`                                               |
| **Oxlint**           | Loads under Oxlint's JS-plugin runner via the `interlace-pg` port, parity-gated in CI |

```bash
# npm / yarn / pnpm / bun
npm install --save-dev eslint-plugin-pg
yarn add -D eslint-plugin-pg
pnpm add -D eslint-plugin-pg
bun add -d eslint-plugin-pg
```

---

## Where this fits

`no-missing-client-release` is the availability member of `eslint-plugin-pg` —
the same plugin that catches SQL injection and the N+1 insert loop. It's part of
the **Postgres Security Protocol** series; its closest sibling is the other way
a borrowed connection bites you in production:

- [Transaction race conditions: `BEGIN` on the pool](https://ofriperetz.dev/articles/transaction-race-conditions-begin-on-pool) — the same checkout lifecycle, the inverse failure: a transaction split across pooled connections
- [The N+1 insert loop](https://ofriperetz.dev/articles/n-plus-1-insert-loop-api-performance) — the other "fine in dev, melts in prod" pattern
- [The SQL-injection pattern in node-postgres](https://ofriperetz.dev/articles/sql-injection-node-postgres-pattern) — the confidentiality member of the same plugin, when the string you concatenated is the attack
- [`search_path` hijacking](https://ofriperetz.dev/articles/searchpath-hijacking-postgresql-attack) — the obscure A05 attack
- [The full `eslint-plugin-pg` set](https://ofriperetz.dev/articles/getting-started-eslint-plugin-pg) — all 13 rules

---

## Links

- 📦 [npm: eslint-plugin-pg](https://www.npmjs.com/package/eslint-plugin-pg)
- 📖 [Rule docs: no-missing-client-release](https://eslint.interlace.tools/docs/security/plugin-pg/rules/no-missing-client-release)
- 💻 [Source on GitHub](https://github.com/ofri-peretz/eslint/tree/main/packages/eslint-plugin-pg)

What drained your pool? I want the real story — the missing `release()`, the
transaction that never committed, the third-party client that quietly held a
connection per request. What was the symptom that finally pointed you at the
pool, and how long did it take to find? Drop it in the comments.

::dev-to-cta{url="https://github.com/ofri-peretz/eslint"}
⭐ Star on GitHub if a missing `client.release()` has ever paged you at 3 AM.
::

---

I'm **Ofri Peretz**, a security engineering leader and the author of the
Interlace ESLint ecosystem — domain-specific static analysis for security,
reliability, and performance on the Node.js stack. `eslint-plugin-pg` is its
node-postgres layer.

[ofriperetz.dev](https://ofriperetz.dev) · [LinkedIn](https://linkedin.com/in/ofri-peretz) · [GitHub](https://github.com/ofri-peretz)
