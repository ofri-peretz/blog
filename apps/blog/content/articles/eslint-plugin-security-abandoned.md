---
devto_url: "https://dev.to/ofri-peretz/eslint-plugin-security-is-unmaintained-heres-what-nobody-tells-you-96h"
devto_id: 3237157
title: "eslint-plugin-security Is Unmaintained. Here's What Nobody Tells You."
description: "eslint-plugin-security has 1.5M weekly downloads but only 13 rules and no meaningful updates since 2020. Learn why it misses 90% of vulnerabilities—including SQL injection, JWT attacks, and AI/LLM security—and what modern ESLint security plugins to use instead."
slug: eslint-plugin-security-abandoned
published: true
date: 2026-02-05
cover_image: https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1200&h=630&fit=crop
tags:
  - security
  - eslint
  - javascript
  - node
series: "ESLint Security"
canonical_url: https://ofriperetz.dev/articles/eslint-plugin-security-abandoned
reading_time_minutes: 9
author:
  name: Ofri Peretz
  avatar: https://avatars.githubusercontent.com/u/46347627
  title: Security Engineering Leader
---

**Skip to:** [What It Misses](#what-does-eslint-plugin-security-miss) | [The Alternative](#what-should-i-use-instead-of-eslint-plugin-security) | [Migration Guide](#rule-by-rule-migration) | [OWASP Coverage](#owasp-top-10-coverage)

## TL;DR — Migrate in 60 Seconds

```bash
npm uninstall eslint-plugin-security
npm install -D eslint-plugin-secure-coding
```

That's it. You now have **27 rules instead of 13**, with full OWASP Top 10 mapping. Add the full security ecosystem and you get **194 security rules**.

**Want the full story?** Keep reading.

---

Let's talk about the elephant in the Node.js security room.

**`eslint-plugin-security`** is the most-installed ESLint security plugin. It has 1.5M+ weekly downloads. It's recommended by countless tutorials. And it's been effectively unmaintained for years.

This isn't a hit piece—it's a reality check. And a thank you.

`eslint-plugin-security` **pioneered** JavaScript security linting. When it launched, it was the only game in town. The maintainers did important work that inspired everything that came after.

But the threat landscape has changed. Let's see where we are in 2026.

## The Numbers Don't Lie

| Metric                     | eslint-plugin-security | Modern Alternative |
| -------------------------- | ---------------------- | ------------------ |
| **Total Rules**            | 13                     | 194                |
| **Last Meaningful Update** | 2020                   | Weekly             |
| **OWASP Top 10 Coverage**  | Partial (~20%)         | 100%               |
| **Flat Config Support**    | ⚠️ Limited             | ✅ Native          |
| **AI/LLM Security Rules**  | ❌ None                | ✅ 19 rules        |
| **PostgreSQL Rules**       | ❌ None                | ✅ 13 rules        |
| **JWT Security Rules**     | ❌ None                | ✅ 13 rules        |

The plugin was groundbreaking when it launched. But the JavaScript security landscape has changed dramatically since 2020.

## Is eslint-plugin-security Still Maintained?

Let's look at the actual repository:

| Metric                     | Value      | What It Means                       |
| -------------------------- | ---------- | ----------------------------------- |
| **Last meaningful commit** | 2020       | Core rules haven't evolved          |
| **Open issues**            | 45+        | Many from 2021-2022, unaddressed    |
| **Open PRs**               | 12+        | Several with no maintainer response |
| **ESLint 9 support**       | ⚠️ Partial | No native flat config exports       |

> **Note:** The plugin was transferred to `eslint-community` in 2023, which extended its life. But activity remains minimal, and the rule set hasn't grown.

## What Does eslint-plugin-security Miss?

Let's be specific. Here are vulnerability categories the plugin **cannot detect**:

### 1. Modern SQL Injection Patterns

```javascript
// ❌ NOT detected by eslint-plugin-security
const query = `SELECT * FROM users WHERE email = '${userInput}'`;
await pool.query(query);
```

The plugin has no PostgreSQL-aware rules. No understanding of parameterized queries. No detection of string concatenation in database contexts.

**Detection:** [eslint-plugin-pg](https://eslint.interlace.tools/docs/security/plugin-pg) catches this with `pg/no-unsafe-query`.

### 2. AI/LLM Vulnerabilities

```javascript
// ❌ NOT detected by eslint-plugin-security
import { generateText } from "ai";

const response = await generateText({
  model: openai("gpt-4"),
  prompt: userInput, // Prompt injection - no system prompt protection
});
```

AI security didn't exist when the plugin was written. There are zero rules for prompt injection, system prompt leakage, or tool abuse.

**Detection:** [eslint-plugin-vercel-ai-security](https://eslint.interlace.tools/docs/security/plugin-vercel-ai-security) provides 19 rules for Vercel AI SDK patterns.

### 3. JWT Security Issues

```javascript
// ❌ NOT detected by eslint-plugin-security
jwt.verify(token, secret, { algorithms: ["none"] }); // Algorithm confusion attack
```

JWT attacks are some of the most common vulnerabilities in Node.js applications. The plugin has no JWT-specific rules.

**Detection:** [eslint-plugin-jwt](https://eslint.interlace.tools/docs/security/plugin-jwt) catches algorithm confusion, missing expiration, and weak secrets.

### 4. Connection Leaks

```javascript
// ❌ NOT detected by eslint-plugin-security
async function getUser(id) {
  const client = await pool.connect();
  return client.query("SELECT * FROM users WHERE id = $1", [id]);
  // client.release() never called - connection leak
}
```

Production outages from connection exhaustion are common. No detection.

**Detection:** [`pg/no-missing-client-release`](https://eslint.interlace.tools/docs/security/plugin-pg/rules/no-missing-client-release) ensures every `connect()` has a matching `release()`.

### 5. Path Traversal with Modern APIs

```javascript
// ❌ NOT detected by eslint-plugin-security
import { readFile } from "node:fs/promises";
const content = await readFile(`./uploads/${filename}`);
```

The plugin's path traversal detection is limited to older `fs` patterns.

**Detection:** [`node-security/detect-non-literal-fs-filename`](https://eslint.interlace.tools/docs/security/plugin-node-security/rules/detect-non-literal-fs-filename) understands modern `node:fs/promises` imports and validates path safety.

## The 13 Rules, Reviewed

Let's look at what `eslint-plugin-security` actually provides:

| Rule                                                                                                                                       | Purpose             | Still Relevant?          |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------- | ------------------------ |
| `detect-unsafe-regex`                                                                                                                      | ReDoS prevention    | ✅ Yes                   |
| [`detect-non-literal-regexp`](https://eslint.interlace.tools/docs/security/plugin-secure-coding/rules/detect-non-literal-regexp)           | Dynamic regex       | ⚠️ Partial               |
| `detect-buffer-noassert`                                                                                                                   | Buffer safety       | ❌ Deprecated in Node.js |
| [`detect-child-process`](https://eslint.interlace.tools/docs/security/plugin-node-security/rules/detect-child-process)                     | Command injection   | ⚠️ Too broad             |
| `detect-disable-mustache-escape`                                                                                                           | XSS in templates    | ⚠️ Framework-specific    |
| [`detect-eval-with-expression`](https://eslint.interlace.tools/docs/security/plugin-node-security/rules/detect-eval-with-expression)       | eval() detection    | ✅ Yes                   |
| `detect-no-csrf-before-method-override`                                                                                                    | CSRF ordering       | ⚠️ Express 3.x era       |
| [`detect-non-literal-fs-filename`](https://eslint.interlace.tools/docs/security/plugin-node-security/rules/detect-non-literal-fs-filename) | Path traversal      | ⚠️ Partial               |
| `detect-non-literal-require`                                                                                                               | Dynamic requires    | ⚠️ ESM era issue         |
| [`detect-object-injection`](https://eslint.interlace.tools/docs/security/plugin-secure-coding/rules/detect-object-injection)               | Prototype pollution | ✅ Yes                   |
| `detect-possible-timing-attacks`                                                                                                           | Timing attacks      | ⚠️ High false positives  |
| `detect-pseudoRandomBytes`                                                                                                                 | Insecure random     | ⚠️ Outdated API name     |
| `detect-bidi-characters`                                                                                                                   | Trojan source       | ✅ Yes                   |

**Verdict:** ~4 rules are still fully relevant. ~5 are partially useful. ~4 are obsolete.

## Why This Matters

If you're using `eslint-plugin-security` as your primary security linting:

1. **You're missing ~90% of detectable vulnerabilities**
2. **You have no OWASP Top 10 coverage map** for compliance
3. **You have no AI/LLM protection** as your team adopts AI tools
4. **You're running on 2020-era detection** in a 2026 threat landscape

## What Should I Use Instead of eslint-plugin-security?

The modern approach is **domain-specific security plugins** that understand context. Think of it as a layered security architecture:

### The Security Ecosystem: 10 Plugins, 194 Rules

| Category           | Plugin                                                                                                       | Rules | What It Catches                                |
| ------------------ | ------------------------------------------------------------------------------------------------------------ | ----- | ---------------------------------------------- |
| **🛡️ Core**        | [`eslint-plugin-secure-coding`](https://eslint.interlace.tools/docs/security/plugin-secure-coding)           | 27    | Injection, XSS, secrets, prototype pollution   |
| **🖥️ Environment** | [`eslint-plugin-node-security`](https://eslint.interlace.tools/docs/security/plugin-node-security)           | 31    | Node.js: fs, child_process, crypto, vm, Buffer |
|                    | [`eslint-plugin-browser-security`](https://eslint.interlace.tools/docs/security/plugin-browser-security)     | 45    | Browser: DOM XSS, postMessage, storage, CSP    |
| **🚂 Framework**   | [`eslint-plugin-express-security`](https://eslint.interlace.tools/docs/security/plugin-express-security)     | 10    | Express: cookies, CORS, CSRF, GraphQL          |
|                    | [`eslint-plugin-nestjs-security`](https://eslint.interlace.tools/docs/security/plugin-nestjs-security)       | 6     | NestJS: guards, validation, throttling         |
|                    | [`eslint-plugin-lambda-security`](https://eslint.interlace.tools/docs/security/plugin-lambda-security)       | 14    | AWS Lambda: API Gateway, headers, input        |
| **🔐 Domain**      | [`eslint-plugin-jwt`](https://eslint.interlace.tools/docs/security/plugin-jwt)                               | 13    | JWT: algorithm confusion, secrets, validation  |
|                    | [`eslint-plugin-pg`](https://eslint.interlace.tools/docs/security/plugin-pg)                                 | 13    | PostgreSQL: SQL injection, connection leaks    |
|                    | [`eslint-plugin-mongodb-security`](https://eslint.interlace.tools/docs/security/plugin-mongodb-security)     | 16    | MongoDB: NoSQL injection, operator attacks     |
| **🤖 AI/LLM**      | [`eslint-plugin-vercel-ai-security`](https://eslint.interlace.tools/docs/security/plugin-vercel-ai-security) | 19    | AI SDK: prompt injection, tool safety          |

### Quick Start: Choose Your Stack

**Node.js Backend (Express/Fastify):**

```bash
npm install -D eslint-plugin-secure-coding \
              eslint-plugin-node-security \
              eslint-plugin-express-security \
              eslint-plugin-pg \
              eslint-plugin-jwt
```

**Serverless (AWS Lambda):**

```bash
npm install -D eslint-plugin-secure-coding \
              eslint-plugin-lambda-security \
              eslint-plugin-pg
```

**MongoDB/Mongoose Backend:**

```bash
npm install -D eslint-plugin-secure-coding \
              eslint-plugin-mongodb-security \
              eslint-plugin-node-security \
              eslint-plugin-jwt
```

**AI/LLM Applications:**

```bash
npm install -D eslint-plugin-secure-coding \
              eslint-plugin-vercel-ai-security \
              eslint-plugin-node-security
```

**Browser/Frontend:**

```bash
npm install -D eslint-plugin-secure-coding \
              eslint-plugin-browser-security
```

### Does This Support ESLint 9 Flat Config?

Yes. All 10 security plugins are built for the modern ESLint ecosystem with native flat config support:

```javascript
// eslint.config.js - Full security suite
import secureCoding from "eslint-plugin-secure-coding";
import nodeSecurity from "eslint-plugin-node-security";
import express from "eslint-plugin-express-security";
import pg from "eslint-plugin-pg";
import jwt from "eslint-plugin-jwt";

export default [
  secureCoding.configs.recommended,
  nodeSecurity.configs.recommended,
  express.configs.recommended,
  pg.configs.recommended,
  jwt.configs.recommended,
];
```

## Rule-by-Rule Migration

Every `eslint-plugin-security` rule has a modern replacement:

| eslint-plugin-security           | Modern Replacement                                                                                                                                       | Plugin        |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| `detect-unsafe-regex`            | [`secure-coding/no-redos-vulnerable-regex`](https://eslint.interlace.tools/docs/security/plugin-secure-coding/rules/no-redos-vulnerable-regex)           | secure-coding |
| `detect-eval-with-expression`    | [`node-security/detect-eval-with-expression`](https://eslint.interlace.tools/docs/security/plugin-node-security/rules/detect-eval-with-expression)       | node-security |
| `detect-child-process`           | [`node-security/detect-child-process`](https://eslint.interlace.tools/docs/security/plugin-node-security/rules/detect-child-process)                     | node-security |
| `detect-non-literal-fs-filename` | [`node-security/detect-non-literal-fs-filename`](https://eslint.interlace.tools/docs/security/plugin-node-security/rules/detect-non-literal-fs-filename) | node-security |
| `detect-object-injection`        | [`secure-coding/detect-object-injection`](https://eslint.interlace.tools/docs/security/plugin-secure-coding/rules/detect-object-injection)               | secure-coding |
| `detect-possible-timing-attacks` | [`node-security/no-timing-unsafe-compare`](https://eslint.interlace.tools/docs/security/plugin-node-security/rules/no-timing-unsafe-compare)             | node-security |
| `detect-non-literal-regexp`      | [`secure-coding/detect-non-literal-regexp`](https://eslint.interlace.tools/docs/security/plugin-secure-coding/rules/detect-non-literal-regexp)           | secure-coding |

**But that's just the migration.** The real value is the **181 additional security rules** you gain:

| Category            | Rules | Examples                                               |
| ------------------- | ----- | ------------------------------------------------------ |
| Browser Security    | 45    | DOM XSS, postMessage, storage, CSP                     |
| Node.js Security    | 31    | fs, child_process, crypto, vm, Buffer                  |
| AI/LLM Security     | 19    | Prompt injection, tool safety, streaming               |
| MongoDB Security    | 16    | NoSQL injection, operator attacks, ODM vulnerabilities |
| PostgreSQL          | 13    | Connection leaks, COPY exploits, search_path hijacking |
| JWT Vulnerabilities | 13    | Algorithm 'none', missing exp, weak secrets            |
| AWS Lambda          | 14    | API Gateway, headers, input validation                 |
| Express.js          | 10    | Cookies, CORS, CSRF, GraphQL                           |
| NestJS              | 6     | Guards, validation, throttling                         |

## OWASP Top 10 Coverage

The ultimate test of a security plugin is OWASP coverage:

| OWASP 2021 Category            | eslint-plugin-security | Interlace Ecosystem |
| ------------------------------ | ---------------------- | ------------------- |
| A01: Broken Access Control     | ❌                     | ✅ 12 rules         |
| A02: Cryptographic Failures    | ⚠️ 1 rule              | ✅ 15 rules         |
| A03: Injection                 | ⚠️ 3 rules             | ✅ 45 rules         |
| A04: Insecure Design           | ❌                     | ✅ 8 rules          |
| A05: Security Misconfiguration | ❌                     | ✅ 18 rules         |
| A06: Vulnerable Components     | ❌                     | ⚠️ External\*       |
| A07: Auth Failures             | ❌                     | ✅ 22 rules         |
| A08: Software/Data Integrity   | ⚠️ 1 rule              | ✅ 12 rules         |
| A09: Logging Failures          | ❌                     | ✅ 6 rules          |
| A10: SSRF                      | ❌                     | ✅ 8 rules          |

_\*A06 (Vulnerable Components) requires Software Composition Analysis (SCA) tools like `npm audit`, Snyk, or Socket—not static analysis. ESLint can't detect outdated dependencies._

**Total coverage:** `eslint-plugin-security` ~20% | Interlace ~100%

## Ready to Upgrade?

**Option 1: Quick Migration (60 seconds)**

```bash
npm uninstall eslint-plugin-security
npm install -D eslint-plugin-secure-coding
npx eslint . --max-warnings 0
```

**Option 2: Full Security Suite (5 minutes)**

```bash
npm install -D eslint-plugin-secure-coding eslint-plugin-pg \
              eslint-plugin-jwt eslint-plugin-node-security
```

**Option 3: See What You're Missing First**

Run ESLint with the new plugins on your codebase. You'll likely find vulnerabilities that were invisible before.

```bash
npx eslint . --format stylish
```

---

## A Note on Open Source Maintenance

Maintaining open-source projects is hard, often thankless work. The `eslint-plugin-security` maintainers gave the community years of value. This article isn't criticism—it's recognition that **the community has evolved**, and our tools should too.

If you use and benefit from open-source security tooling, consider [sponsoring maintainers](https://github.com/sponsors) who keep the ecosystem alive.

---

## The Bottom Line

`eslint-plugin-security` was important. It pioneered JavaScript security linting. But we owe it to our codebases to use tools that match today's threat landscape.

**13 rules from 2020 aren't enough for 2026.**

---

## Explore the Full Ecosystem

> **194 security rules. 10 specialized plugins. 100% OWASP Top 10 coverage.**
>
> The Interlace ESLint Ecosystem provides comprehensive security static analysis for modern Node.js applications.
>
> [📖 Documentation](https://eslint.interlace.tools) | [⭐ GitHub](https://github.com/ofri-peretz/eslint) | [📦 NPM](https://npmjs.com/~ofriperetz)

---

**Part of the ESLint Security Benchmark Series:**

- [📊 17 ESLint Security Plugins Benchmarked](/articles/benchmark-17-eslint-security-plugins-compared)
- [SonarJS vs Interlace: 269 Rules, 65% Missed](/articles/benchmark-sonarjs-vs-interlace)
- [Microsoft SDL vs Interlace: Enterprise Security Benchmark](/articles/benchmark-microsoft-sdl-vs-interlace)

**Related Articles:**

- [Getting Started with eslint-plugin-secure-coding](/articles/getting-started-eslint-plugin-secure-coding)
- [SQL Injection in Node.js: The Pattern 80% Get Wrong](/articles/sql-injection-node-postgres-pattern)
- [The JWT Algorithm 'None' Attack](/articles/the-jwt-algorithm-none-attack-the-vulnerability-in-1-line-of-code-d9g)
- [Mapping Your Codebase to OWASP Top 10](/articles/mapping-your-codebase-to-owasp-top-10-with-247-eslint-rules)
- [The 30-Minute Security Audit](/articles/the-30-minute-security-audit-onboarding-a-new-codebase)

---

**Build Securely.**

I'm Ofri Peretz, a Security Engineering Leader and the architect of the Interlace Ecosystem. I build static analysis standards that automate security and performance for Node.js fleets at scale.

[ofriperetz.dev](https://ofriperetz.dev?utm_source=devto&utm_medium=article&utm_campaign=security-plugin-abandoned) | [LinkedIn](https://linkedin.com/in/ofri-peretz) | [GitHub](https://github.com/ofri-peretz)
