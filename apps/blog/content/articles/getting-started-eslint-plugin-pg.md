---
title: "Hardening the Data Layer: The node-postgres Static Analysis Standard"
description: "Eliminate the #1 database vulnerability. An automated static analysis protocol for preventing SQL injection and connection leaks in production."
slug: "getting-started-eslint-plugin-pg"
canonical_url: "https://ofriperetz.dev/articles/getting-started-eslint-plugin-pg"
devto_url: "https://dev.to/ofri-peretz/getting-started-with-eslint-plugin-pg-43pj"
devto_id: 3138840
published_at: "2025-12-31T18:45:40Z"
edited_at: "2026-01-11T10:21:52Z"
cover_image: "https://dev-to-uploads.s3.amazonaws.com/uploads/articles/7xvyy2px23d7rolvt8kf.png"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/getting-started-eslint-plugin-pg.png"
reading_time_minutes: 2
tags:
  - "eslint"
  - "postgres"
  - "node"
  - "database"
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

**Postgres is the backbone of your production infrastructure. For engineering leaders, database security isn't a training problem—it's a governance problem. Here is the automated static analysis standard for node-postgres.**

## Quick Install

```bash
npm install --save-dev eslint-plugin-pg
```

## Flat Config

```javascript
// eslint.config.js
import pg from "eslint-plugin-pg";

export default [pg.configs.recommended];
```

## Run ESLint

```bash
npx eslint .
```

You'll see output like:

```bash
src/users.ts
  15:3  error  🔒 CWE-89 OWASP:A03 CVSS:9.8 | Unsafe SQL query detected
               Fix: Use parameterized query: client.query('SELECT * FROM users WHERE id = $1', [id])

src/orders.ts
  28:5  error  🔒 CWE-772 | pool.connect() without client.release()
               Fix: Add client.release() in finally block
```

## Rule Overview

| Rule                                                                                                                  | CWE                                                                                | What it catches                        |
| --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------- |
| [`no-unsafe-query`](https://eslint.interlace.tools/docs/security/plugin-pg/rules/no-unsafe-query)                     | [CWE-89](https://cwe.mitre.org/data/definitions/89.html)                           | SQL injection via string concatenation |
| [`no-missing-client-release`](https://eslint.interlace.tools/docs/security/plugin-pg/rules/no-missing-client-release) | [CWE-772](https://cwe.mitre.org/data/definitions/772.html)                         | Connection pool leaks                  |
| [`prevent-double-release`](https://eslint.interlace.tools/docs/security/plugin-pg/rules/prevent-double-release)       | [CWE-415](https://cwe.mitre.org/data/definitions/415.html)                         | Double release crashes                 |
| [`no-transaction-on-pool`](https://eslint.interlace.tools/docs/security/plugin-pg/rules/no-transaction-on-pool)       | [CWE-362](https://cwe.mitre.org/data/definitions/362.html)                         | Transaction race conditions            |
| [`prefer-pool-query`](https://eslint.interlace.tools/docs/security/plugin-pg/rules/prefer-pool-query)                 | [CWE-400](https://cwe.mitre.org/data/definitions/400.html)                         | Unnecessary connect/release            |
| [`no-unsafe-copy-from`](https://eslint.interlace.tools/docs/security/plugin-pg/rules/no-unsafe-copy-from)             | [CWE-22](https://cwe.mitre.org/data/definitions/22.html)                           | Path traversal in COPY FROM            |
| [`no-unsafe-search-path`](https://eslint.interlace.tools/docs/security/plugin-pg/rules/no-unsafe-search-path)         | [CWE-426](https://cwe.mitre.org/data/definitions/426.html)                         | search_path hijacking                  |
| [`no-batch-insert-loop`](https://eslint.interlace.tools/docs/security/plugin-pg/rules/no-batch-insert-loop)           | [Perf](https://planetscale.com/blog/what-is-n-1-query-problem-and-how-to-solve-it) | N+1 query patterns                     |
| Plus 5 more...                                                                                                        |                                                                                    |                                        |

## Quick Wins

### Before

```javascript
// ❌ SQL Injection
const query = `SELECT * FROM users WHERE id = '${userId}'`;
await pool.query(query);
```

### After

```javascript
// ✅ Parameterized Query
const query = "SELECT * FROM users WHERE id = $1";
await pool.query(query, [userId]);
```

### Before (connection leak)

```javascript
// ❌ Connection Leak
const client = await pool.connect();
const result = await client.query("SELECT * FROM users");
return result.rows;
// Missing client.release()!
```

### After (guaranteed release)

```javascript
// ✅ Guaranteed Release
const client = await pool.connect();
try {
  const result = await client.query("SELECT * FROM users");
  return result.rows;
} finally {
  client.release();
}
```

## Available Presets

```javascript
// Security + best practices
pg.configs.recommended;

// All rules enabled
pg.configs.all;
```

## Customizing Rules

```javascript
// eslint.config.js
import pg from "eslint-plugin-pg";

export default [
  pg.configs.recommended,
  {
    rules: {
      // Downgrade to warning
      "pg/prefer-pool-query": "warn",

      // Increase strictness
      "pg/no-unsafe-query": [
        "error",
        {
          allowLiteral: false,
        },
      ],
    },
  },
];
```

## Performance

```text
┌─────────────────────────────────────────────────────┐
│ Benchmark: 1000 files                               │
├─────────────────────────────────────────────────────┤
│ eslint-plugin-pg:          785ms                    │
│ 100% precision (0 false positives in tests)         │
└─────────────────────────────────────────────────────┘
```

## Combine with Other Plugins

```javascript
import pg from "eslint-plugin-pg";
import secureCoding from "eslint-plugin-secure-coding";

export default [pg.configs.recommended, secureCoding.configs.recommended];
```

## Quick Reference

```bash
# Install
npm install --save-dev eslint-plugin-pg

# Config (eslint.config.js)
import pg from 'eslint-plugin-pg';
export default [pg.configs.recommended];

# Run
npx eslint .
```

---

📦 [npm: eslint-plugin-pg](https://www.npmjs.com/package/eslint-plugin-pg)
📖 [Full Rule List](https://eslint.interlace.tools/docs/security/plugin-pg/rules)

🚀 **Using node-postgres? Drop a star on GitHub!**

::dev-to-cta{url="https://github.com/ofri-peretz/eslint"}
⭐ Star on GitHub
::

---

**The Interlace ESLint Ecosystem**
Interlace is a high-fidelity suite of static code analyzers designed to automate security, performance, and reliability for the modern Node.js stack. With over 330 rules across 18 specialized plugins, it provides 100% coverage for OWASP Top 10, LLM Security, and Database Hardening.

## [Explore the full Documentation](https://eslint.interlace.tools)

© 2026 Ofri Peretz. All rights reserved.

---

**Build Securely.**
I'm Ofri Peretz, a Security Engineering Leader and the architect of the Interlace Ecosystem. I build static analysis standards that automate security and performance for Node.js fleets at scale.

[ofriperetz.dev](https://ofriperetz.dev) | [LinkedIn](https://linkedin.com/in/ofri-peretz) | [GitHub](https://github.com/ofri-peretz)
