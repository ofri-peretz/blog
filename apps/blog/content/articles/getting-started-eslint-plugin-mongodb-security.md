---
title: "Your MongoDB Login Can Be Bypassed With No Password and No Quotes. The ESLint Plugin That Catches It."
description: "{ \"$ne\": null } as a password bypasses MongoDB auth — no SQL string, no injection your generic linter understands. NoSQL operator injection, the $where RCE behind CVE-2025-23061, and the 16 CWE-mapped ESLint rules built specifically for MongoDB/Mongoose that flag all of it in CI."
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
  - "node"
  - "devsecops"
  - "ai"
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

That one line is the copy-paste that catches the auth-bypass above. Run `npx eslint .` and the operator-injection finding shows up at the exact `password: req.body.password` line, with the CWE and a suggested fix. If you want everything as an error (good for a CI gate that should block the merge, not just warn), use `configs.strict`; for a Mongoose-only project, `configs.mongoose`.

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

Detects `mongodb://` and `mongodb+srv://` connection strings with embedded credentials in source code. These get committed to git history and exposed in build artifacts.

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

Generic security linters (`eslint-plugin-security`, `eslint-plugin-sonarjs`) don't know the MongoDB query API. They can't distinguish `db.collection("users").find({ $where: userInput })` from `console.log({ $where: "debug" })`. The MongoDB-specific plugin knows:

- Which methods are query execution points (`.find()`, `.findOne()`, `.aggregate()`, `.updateMany()`, etc.)
- Which operators are dangerous (`$where`, `$expr`, `$function`, `$accumulator`)
- What constitutes user input in the MongoDB context

---

## The reason this rule matters more in 2026: your AI assistant writes this exact bug

Ask any coding assistant for "an Express login route with MongoDB" and watch what you get back. `findOne({ email: req.body.email, password: req.body.password })` is one of the most common shapes in the training data, because it's the shape in thousands of tutorials — and almost none of those tutorials sanitize the operator case. The model reproduces the *typical* code, and the typical code is vulnerable.

I ran the broader version of this experiment: [I let Claude write 80 common Node.js functions with zero security context](https://ofriperetz.dev/articles/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities), and 65–75% shipped with a vulnerability — operator injection and unsanitized request data among the most frequent. The uncomfortable part isn't that AI gets it wrong once. It's that it regenerates the same insecure shape every time you accept a completion, faster than any human reviewer can keep up.

This is why the rule lives in the linter and not in a wiki page. A static rule is the only reviewer that runs on every save, every paste, every AI completion — and it doesn't get tired on the 40th login route. The plugin's findings ship with CWE-tagged, fix-oriented messages precisely so the assistant can read its own error and correct the code on the next turn, instead of you playing whack-a-mole with the same bypass.

---

## All 16 rules

| Rule | Severity | CWE |
|---|---|---|
| `no-unsafe-query` | error | CWE-943 |
| `no-operator-injection` | error | CWE-943 |
| `no-hardcoded-connection-string` | error | CWE-798 |
| `no-hardcoded-credentials` | error | CWE-798 |
| `require-tls-connection` | warn | CWE-319 |
| `require-auth-mechanism` | warn | CWE-306 |
| `no-unsafe-regex-query` | error | CWE-1333 |
| `no-unsafe-where` | error | CWE-943 |
| `no-debug-mode-production` | warn | CWE-489 |
| `require-schema-validation` | warn | — |
| `no-select-sensitive-fields` | warn | CWE-312 |
| `no-bypass-middleware` | warn | CWE-284 |
| `no-unsafe-populate` | error | CWE-943 |
| `no-unbounded-find` | warn | CWE-400 |
| `require-projection` | warn | — |
| `require-lean-queries` | warn | — |

---

(Severities above are the `recommended` preset. `strict` promotes every rule to `error`.)

---

The auth bypass at the top of this article is one line of obvious-looking code that a reviewer waved through, a test suite covered with a string, and an AI assistant will hand you again tomorrow. The linter is the one reviewer that catches it on every one of those paths.

So I'll ask the question this article is really about: **what's the NoSQL bug that actually bit you — the `$where` someone left in, the `req.body` that turned into an operator, the connection string in a committed `.env.example`?** Drop it in the comments. The next person grepping for "MongoDB operator injection" at 2 AM will be grateful you did.

If this catches something in your codebase, [⭐ star the repo](https://github.com/ofri-peretz/eslint) — it keeps the rules maintained.

**More in the [ESLint Security Plugins](https://ofriperetz.dev/articles/getting-started-eslint-plugin-pg) series:**
- [Your node-postgres Data Layer Fails 4 Ways in Production](https://ofriperetz.dev/articles/sql-injection-node-postgres-pattern) — the SQL-side counterpart to this exact class of bug
- [I Let Claude Write 80 Functions. 65–75% Had Security Vulnerabilities](https://ofriperetz.dev/articles/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities) — the experiment behind the AI-reintroduction beat above

---

[![npm](https://img.shields.io/npm/v/eslint-plugin-mongodb-security.svg)](https://www.npmjs.com/package/eslint-plugin-mongodb-security) · [Rule docs](https://eslint.interlace.tools/docs/security/plugin-mongodb-security) · [⭐ GitHub](https://github.com/ofri-peretz/eslint)
