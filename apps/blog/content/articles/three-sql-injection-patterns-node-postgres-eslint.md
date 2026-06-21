---
title: "Three SQL Injection Patterns That Still Ship in Node.js — And the ESLint Rule That Catches Them"
description: "Direct concatenation, template literals, and cross-line variable taint: the three structural forms of SQL injection in node-postgres codebases, why each survives code review, why AI assistants happily regenerate all three, and how a pg-specific ESLint rule catches them statically."
slug: "three-sql-injection-patterns-node-postgres-eslint"
canonical_url: "https://ofriperetz.dev/articles/three-sql-injection-patterns-node-postgres-eslint"
devto_url: "https://dev.to/ofri-peretz/three-sql-injection-patterns-that-still-ship-in-nodejs-and-the-linter-that-catches-them-onb"
devto_id: 3787090
published_at: null
cover_image: "https://media2.dev.to/dynamic/image/width=1000,height=420,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fofriperetz.dev%2Fcdn%2Fblog-cover-image%2Fthree-sql-injection-patterns-node-postgres-eslint.png"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/three-sql-injection-patterns-node-postgres-eslint.png"
reading_time_minutes: 7
tags:
  - "ai"
  - "security"
  - "node"
  - "postgres"
reactions: 0
comments: 0
views: 0
author:
  name: "Ofri Peretz"
  username: "ofri-peretz"
  avatar: "https://media2.dev.to/dynamic/image/width=640,height=640,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Fuser%2Fprofile_image%2F3669992%2F50a1f256-472c-48a1-85e8-149459647ea7.png"
  twitter: "ofriperetzdev"
series: null
---

TypeScript passed it clean. The code reviewer approved it. It shipped to production. Three months later, a penetration tester sent a report.

The vulnerable line:

```javascript
const result = await pool.query(
  "SELECT * FROM orders WHERE user_id = " + req.query.userId
);
```

SQL injection has been a known problem for decades. OWASP A03:2021. Parameterized queries are widely understood. And it still ships — not because developers don't know, but because the three structural forms that actually appear in node-postgres codebases look harmless in code review, one line at a time. ([CWE-89](https://cwe.mitre.org/data/definitions/89.html))

And now there's a second author on the team that reaches for those exact three forms by default: the coding assistant. Trained on the same corpus that produced this bug for twenty years, it regenerates it on demand — cleaner-looking, which makes it harder to catch.

Here are the three patterns, why each survives review, why AI assistants reproduce all three, and how a pg-specific ESLint rule catches them statically — no matter who (or what) wrote the line.

---

## Why a pg-specific rule — not a generic SQL injection linter

Most SQL injection detectors work on one signal: string concatenation near a SQL keyword. If they see `"SELECT" + variable`, they flag it. This produces false positives on non-query string building, and misses injection via template literals — which is syntactically distinct from `+` but equally dangerous.

A pg-specific rule knows three things a generic tool doesn't:

1. **The API surface.** Only fires on `.query()` calls — `pool.query()`, `client.query()`. Not on other string operations that happen to mention SQL keywords.

2. **The parameterization contract.** pg uses `$1, $2` positional placeholders, with values passed as the second argument array. If the second argument is a non-empty array, the rule treats the first argument as parameterized and stays silent. Note: `client.query("SELECT..." + x, [])` with an empty array would still be a vulnerability — the rule checks for the presence of a values argument, not that every dynamic part is covered by a placeholder.

3. **Cross-line assignment taint.** When a SQL string is built via concatenation and stored in a variable before `.query()`, the variable is marked tainted. The rule fires at the assignment — not just at the call site.

This is why the rule correctly classifies all six cases in its test suite: three vulnerable patterns flagged, three parameterized patterns silent. There is one known false-positive class — covered in the trade-offs section below — but the core patterns have no FPs on legitimate parameterized code. The rule is intraprocedural — taint tracking doesn't cross function boundaries — but the direct-access patterns below are the ones that actually appear in production code.

---

## Pattern 1: Direct string concatenation

```javascript
// ❌ Flagged — string + user input in a .query() call
const result = await client.query(
  "SELECT * FROM users WHERE email = '" + email + "'"
);
```

**Why it survives code review:** The concatenation looks harmless in isolation. The reviewer sees string building. Their mental model doesn't ask "where does `email` come from?" — that context lives in the route handler, several stack frames up. Nobody holds the full data-flow in mind while reviewing a database layer.

```javascript
// ✅ Parameterized — rule stays silent
const result = await client.query(
  "SELECT * FROM users WHERE email = $1",
  [email]
);
```

The `$1` placeholder + second-argument values array is pg's escaping contract. The database driver handles quoting and type coercion. This pattern cannot be accidentally broken.

---

## Pattern 2: Template literal interpolation

```javascript
// ❌ Flagged — same vulnerability, different syntax
const result = await pool.query(
  `SELECT * FROM orders WHERE user_id = ${userId} AND status = '${status}'`
);
```

**Why this is especially dangerous:** Template literals feel like interpolation — "variables in a string." Developers who know concatenation is unsafe sometimes don't connect template expressions to the same risk. The syntax is cleaner, so the code feels safer. It isn't.

The detection here is unambiguous: any `${...}` expression inside the first argument to `.query()` — without a corresponding values array as the second argument — is a SQL injection surface.

```javascript
// ✅ Parameterized — stays silent
const result = await pool.query(
  "SELECT * FROM orders WHERE user_id = $1 AND status = $2",
  [userId, status]
);
```

Note: a concatenation with a sanitization wrapper — `client.query("WHERE id = " + sanitize(userId))` — is still flagged. The rule cannot verify that `sanitize()` is pg-safe. Parameterization is always the fix.

---

## Pattern 3: Cross-line variable assignment

This is the pattern that gets through code review most often.

```javascript
// ❌ Flagged at the assignment — variable is marked tainted
const sql = "SELECT * FROM products WHERE category = '" + category + "'";
const result = await client.query(sql);
```

At the `.query(sql)` call, `sql` looks like a named variable. Nothing at that call site suggests injection. The reviewer's eye is on the call — not on where `sql` was built two lines earlier.

The rule tracks this: when a SQL string is assigned via concatenation or template interpolation, the variable is tainted. If that variable is subsequently passed to `.query()`, the rule fires at the assignment — where injection was introduced.

```javascript
// ✅ Safe — stays silent
const sql = "SELECT * FROM products WHERE category = $1";
const result = await client.query(sql, [category]);
```

**The pentester's report? Pattern 3.** The `sql` variable nobody traced back to `req.query`.

---

## Your AI assistant ships all three by default

These three patterns predate AI. They got harder the moment a coding assistant joined the team — because the assistant was trained on the same corpus that produced them.

Ask Claude, Gemini, or Copilot to "write a function that fetches orders for a user id from Postgres," and watch which form it reaches for. In my runs it lands on Pattern 1 or Pattern 2 more often than parameterized `$1` — not because the model doesn't know parameterization, but because string-built SQL is the statistically dominant shape in its training data, and the prompt asked for a query, not for a *safe* query. Parameterization is a constraint. The prompt described behavior, so the model fulfilled behavior. (Try it yourself — the output is non-deterministic, so re-run a few times and watch the failure *class* stay constant even as the exact line changes.)

This is the same negative-space failure I measured at scale. When I let [Claude write 80 functions, 65–75% carried at least one security defect](https://ofriperetz.dev/articles/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities). And when I broke a [700-function benchmark down by security domain across five Claude and Gemini models](https://ofriperetz.dev/articles/aggregate-benchmarks-lie-heres-what-700-ai-functions-look-like-by-security-domain), database operations were a weak spot for every model — and, tellingly, the model that "won" generation did so by writing *simple, parameterized* queries, while the ones that generated more elaborate, senior-looking database code triggered more pg rules. It's the database-layer cousin of the [NestJS service Claude shipped with six holes](https://ofriperetz.dev/articles/claude-wrote-nestjs-service-eslint-found-6-security-holes): correct, compiling, and quietly unsafe.

The uncomfortable part for review: AI-generated SQL looks *more* trustworthy than the human kind. It's clean, consistently formatted, and uses a tidy template literal. Pattern 2 — the template-literal form — is exactly what a reviewer skims past as "modern, readable code." The linter doesn't skim. It sees `${userId}` inside the first argument to `.query()` and fires, whether a human or a model typed it.

**Run it on your assistant's output before you run it on your colleague's.** Same rule, same install, no model-specific tuning:

```bash
npm install eslint-plugin-pg --save-dev
```

```javascript
// eslint.config.mjs
import pg from "eslint-plugin-pg";

export default [
  {
    plugins: { pg },
    rules: { "pg/no-unsafe-query": "error" },
  },
];
```

Because the rule is structural — not model-aware — the methodology transfers to any assistant. Paste the same prompt into Gemini via the Gemini CLI, scan the output with `pg/no-unsafe-query`, and compare the count to Claude's. The model changes; the three patterns don't.

---

## What about ORM escape hatches?

Most production Node.js teams use Prisma, Drizzle, Knex, or TypeORM. Those ORMs parameterize by default — but they all have raw query escape hatches (`$queryRaw`, `knex.raw`, `sequelize.literal`) where Pattern 1 and 2 reappear. A pg-specific rule won't catch those; the relevant rules are in the ORM's own lint ecosystem.

For teams using pg directly — internal APIs, data pipelines, microservices — the three patterns above cover the injection surface. Prisma shops have different lint priorities.

---

## The trade-offs (and the one false positive)

The install and config are above — `pg/no-unsafe-query` set to `error` is the whole setup. Two things worth knowing before you turn it on in CI:

**vs. Semgrep/CodeQL:** Interprocedural SAST tools can trace taint across function boundaries. ESLint can't — it's intraprocedural. The trade-off: ESLint runs in your editor on every keystroke and in pre-commit hooks with no CI pipeline required. For a pg team that wants SQL injection feedback where they see TypeScript errors — including on the SQL an AI assistant just generated — that speed matters more than the wider taint scope.

Known false positive: `client.query("SELECT * FROM " + SCHEMA_NAME)` where `SCHEMA_NAME` is a hardcoded constant. The rule fires because it can't distinguish constants from dynamic inputs. Workaround: use `pg-format` for identifier quoting, or restructure to a parameterized form.

Full rule docs and configuration: [eslint.interlace.tools/docs/security/plugin-pg/rules/no-unsafe-query](https://eslint.interlace.tools/docs/security/plugin-pg/rules/no-unsafe-query)

---

_Has a parameterized query ever been "refactored" back into concatenation in your codebase — by a teammate who thought they were cleaning it up, or by an AI assistant that "simplified" the `$1` away? Which pattern was it, and how far did it get before someone caught it?_

---

**→ Related:** [Your node-postgres Data Layer Fails 4 Ways in Production — SQL injection is only the first](https://ofriperetz.dev/articles/sql-injection-node-postgres-pattern) · [node-postgres will happily build a CVSS 9.8 SQL injection for you — 13 ESLint rules say no](https://ofriperetz.dev/articles/getting-started-eslint-plugin-pg) · [30 minutes of ESLint found 26 critical bugs in an inherited codebase](https://ofriperetz.dev/articles/the-30-minute-security-audit-onboarding-a-new-codebase)

---

[![npm](https://img.shields.io/npm/v/eslint-plugin-pg.svg)](https://www.npmjs.com/package/eslint-plugin-pg) · [Rule docs](https://eslint.interlace.tools/docs/security/plugin-pg/rules/no-unsafe-query) · [⭐ GitHub](https://github.com/ofri-peretz/eslint)
