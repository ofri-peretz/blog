---
title: "Your MongoDB Login Can Be Bypassed With No Password and No Quotes. The ESLint Plugin That Catches It."
description: "{ \"$ne\": null } as a password bypasses MongoDB auth — no SQL string, no injection your generic linter understands. Flagship Gemini ships this database bug in 96% of runs. NoSQL operator injection, the $where RCE behind CVE-2025-23061, and the 16 CWE-mapped ESLint rules built specifically for MongoDB/Mongoose that flag all of it in CI."
slug: "getting-started-eslint-plugin-mongodb-security"
canonical_url: "https://ofriperetz.dev/articles/getting-started-eslint-plugin-mongodb-security"
devto_url: "https://dev.to/ofri-peretz/getting-started-with-eslint-plugin-mongodb-security-ol6"
devto_id: 3790107
published_at: "2026-05-31"
cover_image: ""
social_image: ""
reading_time_minutes: 5
tags:
  - "security"
  - "ai"
  - "eslint"
  - "googleai"
series: "ESLint Security Plugins"
reactions: 0
comments: 0
views: 0
author:
  name: "Ofri Peretz"
  username: "ofri-peretz"
  avatar: "https://media2.dev.to/dynamic/image/width=640,height=640,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Fuser%2Fprofile_image%2F3669992%2F50a1f256-472c-48a1-85e8-149459647ea7.png"
  twitter: "ofriperetzdev"
---

In a benchmark of 700 AI-generated Node.js functions, **96% of database-layer outputs from the flagship Gemini model contained a security vulnerability** — and the most common class wasn't a typo or a forgotten `await`. It was operator injection: user-controlled request data flowing directly into a MongoDB query field with no sanitization. Generic linters don't flag it. Code review misses it. The type is `any` and the test suite posts a string, so the build stays green.

MongoDB stores JavaScript objects. Your query is already structured data — there is no "query string" to inject into. Which is exactly why NoSQL injection looks different from SQL injection, and why generic security linters miss it.

The attack isn't `; DROP TABLE users; --`. It's this:

```javascript
// POST body: { "username": "admin", "password": { "$ne": null } }
await db.collection("users").findOne({
  username: req.body.username,
  password: req.body.password,  // ← operator injection bypasses auth
});
```

No SQL string. No quotes. No payload your WAF recognizes. The attacker sends `{ "$ne": null }` as the password value, Express parses it into a real JavaScript object, and `findOne` happily matches the first user whose password is not null — which is every user. That's a full authentication bypass in valid JSON.

And it is no longer a bug you write by hand once and learn from. When I benchmarked AI-generated database code across five Claude and Gemini models, the *flagship* Gemini model shipped a database-layer vulnerability in **96% of runs** — operator injection and unsanitized request data chief among them ([full leaderboard here](https://ofriperetz.dev/articles/we-ranked-5-ai-models-by-security-the-leaderboard-is-wrong)). Your assistant will hand you the exact line below, today, and call it done.

**Why this survives code review:** the line `password: req.body.password` is the obvious, correct-looking thing to write. A reviewer reads it as "compare the submitted password to the stored one." It only becomes a vulnerability when `req.body.password` stops being a string and becomes an operator object — and nothing in the diff signals that the field is attacker-shaped. The type is `any`, the test suite posts a string, and the bug ships green. You can't catch this in review by reading harder; you catch it by encoding the rule "request data must never reach a query field unsanitized" into the linter.

`eslint-plugin-mongodb-security` is the only ESLint plugin built specifically for MongoDB/Mongoose codebases — 16 rules, each mapped to a CWE and the relevant CVE. Here's how to use it.

> This is part of my [ESLint Security Plugins](https://ofriperetz.dev/articles/getting-started-eslint-plugin-pg) series — one plugin per data layer. The [node-postgres edition](https://ofriperetz.dev/articles/sql-injection-node-postgres-pattern) covers the SQL side of the same class of bug.

---

## Install

```bash
npm install eslint-plugin-mongodb-security --save-dev
```

`eslint.config.mjs` — the `recommended` preset wires up the plugin and turns on every rule that matters, NoSQL-injection rules as errors:

```javascript
import mongodbSecurity from "eslint-plugin-mongodb-security";

export default [
  mongodbSecurity.configs.recommended,
];
```

That one line is the copy-paste that catches the auth-bypass above. Run `npx eslint .` and the finding shows up at the exact `password: req.body.password` line, tagged `no-unsafe-query` / CWE-943, with a suggested fix. If you want everything as an error (good for a CI gate that should block the merge, not just warn), use `configs.strict`; for a Mongoose-only project, `configs.mongoose`.

---

## What the `recommended` preset actually flags — run it yourself

I don't want you to take "it catches the bug" on faith, so here's a reproducible run you can replicate in under a minute. I put the auth-bypass route, the `$where` example, and the hardcoded-connection-string example into one 23-line `login-route.js` — the kind of file an AI assistant hands you when you ask for "an Express login route with MongoDB" — and ran the **shipped `recommended` preset** (plugin v8.2.3, ESLint 10.4.1) over it:

```bash
npm i -D eslint eslint-plugin-mongodb-security
# eslint.config.mjs = the recommended block above
npx eslint login-route.js
```

**Result: 8 findings on 23 lines — 5 errors, 3 warnings, across 5 distinct rules.**

| Line | Severity | Rule | CWE |
|---|---|---|---|
| `findOne({ … password: req.body.password })` | error | `no-unsafe-query` | CWE-943 |
| `$where: \`this.total > ${req.query.minTotal}\`` | error | `no-unsafe-query` + `no-unsafe-where` | CWE-943 |
| `new MongoClient("mongodb+srv://admin:hunter2@…")` | error | `no-hardcoded-connection-string` | CWE-798 |
| unprojected `.find()` returning every field | warn | `no-select-sensitive-fields`, `no-unbounded-find` | CWE-200, CWE-400 |

Two things worth calling out from the actual output. First, the auth-bypass line fires as `no-unsafe-query` (CWE-943) under the preset, not a separate "operator-injection" finding — `no-unsafe-query` is the broader rule and it owns that node, so don't go looking for two errors on one line. Second, the three `error`-level findings are exactly the ones that should fail a CI gate; the two `warn`s are information-disclosure hygiene you can triage later. That's a 5:3 error-to-warning ratio on code that reads as completely ordinary — which is the whole point.

Reproduce it: drop those three snippets into a file, install the plugin, run the command. Same machine, same `recommended` preset, same eight findings. The methodology is the file plus the config block above — there's nothing to take on trust.

> **Why this isn't a 5,000-repo scan (yet):** these numbers come from the canonical vulnerable shapes, not a sweep of public Mongo/Mongoose repos. A corpus scan is the natural next entry in this series; the per-snippet run is what's reproducible on your machine today.

---

## The three rules you need most

### 1. `no-unsafe-query` — NoSQL operator injection (CWE-943, CVSS 9.8)

Fires when a `$where`, `$expr`, or `$function` operator receives a value directly from user input — the exact pattern that lets an attacker inject arbitrary query logic. This isn't theoretical: `$where` runs server-side JavaScript, and a user-controlled `$where` is the root of [CVE-2025-23061](https://nvd.nist.gov/vuln/detail/CVE-2025-23061) and [CVE-2024-53900](https://nvd.nist.gov/vuln/detail/CVE-2024-53900) in Mongoose. The plugin's `no-unsafe-where` rule links straight to those NVD entries in its finding.

```javascript
// ❌ Flagged — $where with user-controlled JavaScript
db.collection("orders").find({
  $where: `this.total > ${req.query.minTotal}`,
});
```

```javascript
// ✅ Safe — use $gt instead of $where
db.collection("orders").find({
  total: { $gt: Number(req.query.minTotal) },
});
```

### 2. `no-operator-injection` — Query operator in request body (CWE-943, CVSS 9.1)

When `req.body` (or any request property) is used directly in a MongoDB query field, an attacker can send `{ "$ne": null }` or `{ "$gt": "" }` as the field value to bypass authentication or extract unauthorized data.

```javascript
// ❌ Flagged — req.body.password could be { "$ne": null }
const user = await User.findOne({
  email: req.body.email,
  password: req.body.password,
});
```

```javascript
// ✅ Safe — hash and compare separately
const user = await User.findOne({ email: req.body.email });
const valid = await bcrypt.compare(req.body.password, user.passwordHash);
```

### 3. `no-hardcoded-connection-string` — Credentials in source (CWE-798, CVSS 7.5)

Detects `mongodb://` and `mongodb+srv://` connection strings with embedded credentials in source code. These get committed to git history and exposed in build artifacts. (Entropy-based detection alone isn't enough for catching hardcoded secrets — see [No Hardcoded Credentials: Entropy Isn't Enough](https://ofriperetz.dev/articles/no-hardcoded-credentials-entropy-isnt-enough) for why pattern-matching on MongoDB URIs catches more than a general entropy scanner.)

```javascript
// ❌ Flagged — credentials in source
const client = new MongoClient(
  "mongodb+srv://admin:hunter2@cluster0.example.com/mydb"
);
```

```javascript
// ✅ Safe — from environment variable
const client = new MongoClient(process.env.MONGODB_URI);
```

---

## Why a MongoDB-specific plugin

Generic security linters (`eslint-plugin-security`, `eslint-plugin-sonarjs`) don't know the MongoDB query API. They can't distinguish `db.collection("users").find({ $where: userInput })` from `console.log({ $where: "debug" })`. (I benchmarked 17 security-adjacent ESLint plugins head-to-head in [Benchmark: 17 ESLint Security Plugins Compared](https://ofriperetz.dev/articles/benchmark-17-eslint-security-plugins-compared) — `eslint-plugin-security` misses every MongoDB-specific finding.) The MongoDB-specific plugin knows:

- Which methods are query execution points (`.find()`, `.findOne()`, `.aggregate()`, `.updateMany()`, etc.)
- Which operators are dangerous (`$where`, `$expr`, `$function`, `$accumulator`)
- What constitutes user input in the MongoDB context

---

## The reason this rule matters more in 2026: your AI assistant writes this exact bug — Claude *and* Gemini

Ask any coding assistant for "an Express login route with MongoDB" and watch what you get back. `findOne({ email: req.body.email, password: req.body.password })` is one of the most common shapes in the training data, because it's the shape in thousands of tutorials — and almost none of those tutorials sanitize the operator case. The model reproduces the *typical* code, and the typical code is vulnerable. This isn't a one-model quirk: I benchmarked [700 AI-generated functions across 5 models from Claude and Gemini](https://ofriperetz.dev/articles/we-ranked-5-ai-models-by-security-the-leaderboard-is-wrong) — 7 runs each, 332 ESLint security rules scoring the output — and every model shipped insecure code. The interesting part is what happens when you slice it to the **database** domain, which is exactly the layer this plugin guards:

| Model (database tasks) | Vulnerability rate |
|---|--:|
| Claude Haiku 4.5 | 39% |
| Claude Opus 4.6 | 61% |
| Claude Sonnet 4.5 | 71% |
| Gemini 2.5 Flash | 75% |
| Gemini 2.5 Pro | **96%** |

Read the bottom row again. The *flagship* Gemini model — the one you reach for when the task is hard — shipped a database-layer vulnerability in **96% of runs**. Not a weak model having a bad day; the strongest one, precisely because it writes the elaborate, production-shaped query code that has the most surface area to get wrong. Operator injection and unsanitized request data are the kind of finding this slice is made of, and they sit right under the `no-unsafe-query` / `no-operator-injection` rules above. (The Claude-only baseline that started this series — [I let Claude write 80 functions, 65–75% had a vulnerability](https://ofriperetz.dev/articles/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities) — landed in the same range.)

Here's the twist that makes the linter the hero instead of the villain. That same Gemini Pro — 96% vulnerable on the first pass — **fixed 93% of its database bugs the moment it was handed the exact CWE-tagged violation**, restructuring the query correctly 25 out of 27 times in the worked case. It didn't need a security expert; it needed a machine-readable finding that named the rule, the CWE, and the line — the same shape `no-unsafe-query` (CWE-943) emits when it catches the operator injection above. That is the entire premise of the [Guardian Layer loop](https://ofriperetz.dev/articles/the-ai-hydra-problem-fix-one-ai-bug-get-two-more): the model generates the bug, the linter names it in the model's own language, the model fixes it — and the cycle closes on every save instead of every code review.

This is why the rule lives in the linter and not in a wiki page. A static rule is the only reviewer that runs on every save, every paste, every AI completion — and it doesn't get tired on the 40th login route. `eslint-plugin-mongodb-security` ships its findings with CWE-tagged, fix-oriented messages for exactly that reason: so the assistant that *wrote* the bypass can read its own error and correct the code on the next turn, instead of you playing whack-a-mole with the same `$ne` at 2 AM.

---

## All 16 rules

| Rule | Severity | CWE |
|---|---|---|
| `no-unsafe-query` | error | CWE-943 |
| `no-operator-injection` | error | CWE-943 |
| `no-hardcoded-connection-string` | error | CWE-798 |
| `no-hardcoded-credentials` | error | CWE-798 |
| `no-unsafe-where` | error | CWE-943 |
| `no-unsafe-regex-query` | error | CWE-400 |
| `no-unsafe-populate` | error | CWE-943 |
| `no-debug-mode-production` | error | CWE-489 |
| `require-tls-connection` | warn | CWE-295 |
| `require-auth-mechanism` | warn | CWE-287 |
| `require-schema-validation` | warn | CWE-20 |
| `no-select-sensitive-fields` | warn | CWE-200 |
| `no-bypass-middleware` | warn | CWE-284 |
| `no-unbounded-find` | warn | CWE-400 |
| `require-projection` | off | CWE-200 |
| `require-lean-queries` | off | CWE-400 |

---

The Severity column is the **shipped `recommended` preset**, verified against `src/index.ts` at v8.2.3 — the eight `error` rules block CI, the six `warn` rules surface without failing the build, and `require-projection` / `require-lean-queries` are `off` by default (they are perf hygiene, not security, so the preset doesn't fire them — turn them on explicitly or use `strict`). `strict` promotes all 16 to `error`; `mongoose` narrows to the ODM-relevant subset.

---

The auth bypass at the top of this article is one line of obvious-looking code that a reviewer waved through, a test suite covered with a string, and a flagship AI model hands back 96 times out of 100. **`{ "$ne": null }` is the password every database in this benchmark accepted — the linter is the one reviewer that rejects it on every save, paste, and AI completion.** That's the line worth pasting into your team channel.

So I'll ask the question this article is really about: **what's the NoSQL bug that actually bit you — the `$where` someone left in, the `req.body` that turned into an operator, the connection string in a committed `.env.example`?** Drop it in the comments. The next person grepping for "MongoDB operator injection" at 2 AM will be grateful you did.

If this catches something in your codebase, [⭐ star the repo](https://github.com/ofri-peretz/eslint) — it keeps the rules maintained.

**More in the [ESLint Security Plugins](https://ofriperetz.dev/articles/getting-started-eslint-plugin-pg) series — one plugin per data layer:**
- [Your node-postgres Data Layer Fails 4 Ways in Production](https://ofriperetz.dev/articles/sql-injection-node-postgres-pattern) — the SQL-side counterpart to this exact class of bug
- [I Let Claude Write 80 Functions. 65–75% Had Security Vulnerabilities](https://ofriperetz.dev/articles/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities) — the experiment behind the AI-reintroduction beat above
- [We Ranked 5 AI Models by Security. The Leaderboard Is Wrong.](https://ofriperetz.dev/articles/we-ranked-5-ai-models-by-security-the-leaderboard-is-wrong) — where the 96% database number (and the 93% fix rate) come from
- [The AI Hydra Problem: Fix One AI Bug, Get Two More](https://ofriperetz.dev/articles/the-ai-hydra-problem-fix-one-ai-bug-get-two-more) — why the ESLint→AI remediation loop is the only thing that keeps up

---

[![npm](https://img.shields.io/npm/v/eslint-plugin-mongodb-security.svg)](https://www.npmjs.com/package/eslint-plugin-mongodb-security) · [Rule docs](https://eslint.interlace.tools/docs/security/plugin-mongodb-security) · [⭐ GitHub](https://github.com/ofri-peretz/eslint)
