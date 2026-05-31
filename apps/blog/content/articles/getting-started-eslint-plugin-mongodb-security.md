---
title: "Getting Started with eslint-plugin-mongodb-security"
description: "How to prevent MongoDB NoSQL injection, operator injection, and hardcoded connection strings with the only ESLint plugin built specifically for MongoDB/Mongoose."
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
  - "eslint"
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

`eslint-plugin-mongodb-security` is the only ESLint plugin built specifically for MongoDB/Mongoose codebases. Here's how to use it.

---

## Install

```bash
npm install eslint-plugin-mongodb-security --save-dev
```

`eslint.config.mjs`:

```javascript
import mongodbSecurity from "eslint-plugin-mongodb-security";

export default [
  {
    plugins: { "mongodb-security": mongodbSecurity },
    rules: mongodbSecurity.configs.flagship.rules,
  },
];
```

---

## The three rules you need most

### 1. `no-unsafe-query` — NoSQL operator injection (CWE-943, CVSS 9.8)

Fires when a `$where`, `$expr`, or `$function` operator receives a value directly from user input — the exact pattern that lets an attacker inject arbitrary query logic.

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

## All 16 rules

| Rule | Severity | CWE |
|---|---|---|
| `no-unsafe-query` | error | CWE-943 |
| `no-operator-injection` | error | CWE-943 |
| `no-hardcoded-connection-string` | error | CWE-798 |
| `no-hardcoded-credentials` | error | CWE-798 |
| `require-tls-connection` | error | CWE-319 |
| `require-auth-mechanism` | warn | CWE-306 |
| `no-unsafe-regex-query` | error | CWE-1333 |
| `no-unsafe-where` | error | CWE-943 |
| `no-debug-mode-production` | warn | CWE-489 |
| `require-schema-validation` | warn | — |
| `no-select-sensitive-fields` | warn | CWE-312 |
| `no-bypass-middleware` | warn | CWE-284 |
| `no-unsafe-populate` | warn | CWE-943 |
| `no-unbounded-find` | warn | CWE-400 |
| `require-projection` | warn | — |
| `require-lean-queries` | warn | — |

---

*If this catches something in your codebase, [⭐ star the repo](https://github.com/ofri-peretz/eslint) — it keeps the rules maintained.*

---

[![npm](https://img.shields.io/npm/v/eslint-plugin-mongodb-security.svg)](https://www.npmjs.com/package/eslint-plugin-mongodb-security) · [Rule docs](https://eslint.interlace.tools/docs/security/plugin-mongodb-security) · [⭐ GitHub](https://github.com/ofri-peretz/eslint)
