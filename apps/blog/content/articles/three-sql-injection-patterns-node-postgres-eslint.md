---
title: "Three SQL Injection Patterns That Still Ship in Node.js — And the ESLint Rule That Catches Them"
description: "Direct concatenation, template literals, and cross-line variable taint: the three structural forms of SQL injection in node-postgres codebases, why each survives code review, and how a pg-specific ESLint rule catches all three."
slug: "three-sql-injection-patterns-node-postgres-eslint"
canonical_url: "https://ofriperetz.dev/articles/three-sql-injection-patterns-node-postgres-eslint"
devto_url: "https://dev.to/ofri-peretz/three-sql-injection-patterns-that-still-ship-in-nodejs-and-the-linter-that-catches-them-onb"
devto_id: 3787090
published_at: null
cover_image: "https://media2.dev.to/dynamic/image/width=1000,height=420,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fofriperetz.dev%2Fcdn%2Fblog-cover-image%2Fthree-sql-injection-patterns-node-postgres-eslint.png"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/three-sql-injection-patterns-node-postgres-eslint.png"
reading_time_minutes: 5
tags:
  - "security"
  - "postgres"
  - "node"
  - "eslint"
reactions: 0
comments: 0
views: 0
author:
  name: "Ofri Peretz"
  username: "ofri-peretz"
  avatar: "https://media2.dev.to/dynamic/image/width=640,height=640,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Fuser%2Fprofile_image%2F3669992%2F50a1f256-472c-48a1-85e8-149459647ea7.png"
  twitter: "ofriperetzdev"
series: "Static Analysis in Production"
---

TypeScript passed it clean. The code reviewer approved it. It shipped to production. Three months later, a penetration tester sent a report.

The vulnerable line:

```javascript
const result = await pool.query(
  "SELECT * FROM orders WHERE user_id = " + req.query.userId
);
```

SQL injection has been a known problem for decades. OWASP A03:2021. Parameterized queries are widely understood. And it still ships — not because developers don't know, but because the three structural forms that actually appear in node-postgres codebases look harmless in code review, one line at a time. ([CWE-89](https://cwe.mitre.org/data/definitions/89.html))

Here are the three patterns, why each survives review, and how a pg-specific ESLint rule catches them statically.

---

## Why a pg-specific rule — not a generic SQL injection linter

Most SQL injection detectors work on one signal: string concatenation near a SQL keyword. If they see `"SELECT" + variable`, they flag it. This produces false positives on non-query string building, and misses injection via template literals — which is syntactically distinct from `+` but equally dangerous.

A pg-specific rule knows three things a generic tool doesn't:

1. **The API surface.** Only fires on `.query()` calls — `pool.query()`, `client.query()`. Not on other string operations that happen to mention SQL keywords.

2. **The parameterization contract.** pg uses `$1, $2` positional placeholders, with values passed as the second argument array. If the second argument is a non-empty array, the rule treats the first argument as parameterized and stays silent. Note: `client.query("SELECT..." + x, [])` with an empty array would still be a vulnerability — the rule checks for the presence of a values argument, not that every dynamic part is covered by a placeholder.

3. **Cross-line assignment taint.** When a SQL string is built via concatenation and stored in a variable before `.query()`, the variable is marked tainted. The rule fires at the assignment — not just at the call site.

This is why the rule correctly classifies all six cases in its test suite: three vulnerable patterns flagged, three parameterized patterns silent. There is one known false-positive class — covered in the config section — but the core patterns have no FPs on legitimate parameterized code. The rule is intraprocedural — taint tracking doesn't cross function boundaries — but the direct-access patterns below are the ones that actually appear in production code.

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

## What about ORM escape hatches?

Most production Node.js teams use Prisma, Drizzle, Knex, or TypeORM. Those ORMs parameterize by default — but they all have raw query escape hatches (`$queryRaw`, `knex.raw`, `sequelize.literal`) where Pattern 1 and 2 reappear. A pg-specific rule won't catch those; the relevant rules are in the ORM's own lint ecosystem.

For teams using pg directly — internal APIs, data pipelines, microservices — the three patterns above cover the injection surface. Prisma shops have different lint priorities.

---

## The config

```bash
npm install eslint-plugin-pg --save-dev
```

`eslint.config.mjs`:

```javascript
import pg from "eslint-plugin-pg";

export default [
  {
    plugins: { pg },
    rules: {
      "pg/no-unsafe-query": "error",
    },
  },
];
```

**vs. Semgrep/CodeQL:** Interprocedural SAST tools can trace taint across function boundaries. ESLint can't — it's intraprocedural. The trade-off: ESLint runs in your editor on every keystroke and in pre-commit hooks with no CI pipeline required. For a pg team that wants SQL injection feedback where they see TypeScript errors, that speed matters more than the wider taint scope.

Known false positive: `client.query("SELECT * FROM " + SCHEMA_NAME)` where `SCHEMA_NAME` is a hardcoded constant. The rule fires because it can't distinguish constants from dynamic inputs. Workaround: use `pg-format` for identifier quoting, or restructure to a parameterized form.

Full rule docs and configuration: [eslint.interlace.tools/docs/security/plugin-pg/rules/no-unsafe-query](https://eslint.interlace.tools/docs/security/plugin-pg/rules/no-unsafe-query)

---

_Has a parameterized query ever been "refactored" to concatenation in your codebase — by someone who thought they were cleaning it up? How far did it get before discovery?_

---

**→ Related:** [Hardening the Data Layer: The node-postgres Engineering Standard](https://dev.to/ofri-peretz/sql-injection-in-node-postgres-the-pattern-everyone-gets-wrong-54mn) · [Getting Started with eslint-plugin-pg](https://dev.to/ofri-peretz/getting-started-with-eslint-plugin-pg-43pj) · [The 30-Minute Security Audit Protocol](https://dev.to/ofri-peretz/the-30-minute-security-audit-onboarding-a-new-codebase-4f91)

---

[![npm](https://img.shields.io/npm/v/eslint-plugin-pg.svg)](https://www.npmjs.com/package/eslint-plugin-pg) · [Rule docs](https://eslint.interlace.tools/docs/security/plugin-pg/rules/no-unsafe-query) · [⭐ GitHub](https://github.com/ofri-peretz/eslint)
