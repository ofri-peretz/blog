---
title: "The OWASP Compliance Protocol: Mapping 247 Static Analysis Rules"
description: "A comprehensive engineering standard for OWASP Top 10 compliance. Map your entire Node.js fleet to security standards using automated static analysis."
slug: "mapping-your-codebase-to-owasp-top-10-with-247-eslint-rules"
canonical_url: "https://ofriperetz.dev/articles/mapping-your-codebase-to-owasp-top-10-with-247-eslint-rules"
devto_url: "https://dev.to/ofri-peretz/mapping-your-codebase-to-owasp-top-10-with-247-eslint-rules-25f0"
devto_id: 3138808
published_at: "2025-12-31T18:15:25Z"
edited_at: "2026-02-05T04:58:59Z"
cover_image: "https://ofriperetz.dev/cdn/blog-cover-image/mapping-your-codebase-to-owasp-top-10-with-247-eslint-rules.png"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/mapping-your-codebase-to-owasp-top-10-with-247-eslint-rules.png"
reading_time_minutes: 8
tags:
  - "eslint"
  - "security"
  - "owasp"
  - "devsecops"
reactions: 1
comments: 0
views: 0
author:
  name: "Ofri Peretz"
  username: "ofri-peretz"
  avatar: "https://media2.dev.to/dynamic/image/width=640,height=640,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Fuser%2Fprofile_image%2F3669992%2F50a1f256-472c-48a1-85e8-149459647ea7.png"
  twitter: "ofriperetzdev"
series: null
---

**Governance at scale requires more than a checklist. Here is the engineering standard for mapping your entire Node.js fleet to the OWASP Top 10 through 247 automated static analysis rules.**

Your security audit asks: "How do you address OWASP Top 10?"

Here's how to answer with **automated evidence** using 332 rules across 18 specialized ESLint plugins.

## The Multi-Plugin Approach

One plugin can't cover everything. SQL injection needs database-aware rules. JWT attacks need token-specific detection. Here's the complete mapping:

## OWASP Top 10 2025 → Plugin Coverage

| #                                                                                        | Category                  | Risk     | Plugins                                                  | Key Rules                                                                                                                                                                                                                                                                                                                                                                                |
| ---------------------------------------------------------------------------------------- | ------------------------- | -------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [A01](https://owasp.org/Top10/A01_2021-Broken_Access_Control/)                      | Broken Access Control     | High     | `secure-coding`, `nestjs-security`, `lambda-security`    | [`no-privilege-escalation`](https://eslint.interlace.tools/docs/security/plugin-secure-coding/rules/no-privilege-escalation), [`require-guards`](https://eslint.interlace.tools/docs/security/plugin-nestjs-security/rules/require-guards), [`no-missing-authorization-check`](https://eslint.interlace.tools/docs/security/plugin-lambda-security/rules/no-missing-authorization-check) |
| [A02](https://owasp.org/Top10/A02_2021-Cryptographic_Failures/)                     | Cryptographic Failures    | High     | `node-security`, `pg`, `jwt`                             | [`no-weak-hash-algorithm`](https://eslint.interlace.tools/docs/security/plugin-node-security/rules/no-weak-hash-algorithm), [`no-hardcoded-credentials`](https://eslint.interlace.tools/docs/security/plugin-secure-coding/rules/no-hardcoded-credentials), [`no-weak-secret`](https://eslint.interlace.tools/docs/security/plugin-jwt/rules/no-weak-secret)                             |
| [A03](https://owasp.org/Top10/A03_2021-Injection/)                                  | Injection                 | Critical | `secure-coding`, `pg`, `browser-security`                | [`detect-eval-with-expression`](https://eslint.interlace.tools/docs/security/plugin-node-security/rules/detect-eval-with-expression), [`no-unsafe-query`](https://eslint.interlace.tools/docs/security/plugin-mongodb-security/rules/no-unsafe-query), [`no-innerhtml`](https://eslint.interlace.tools/docs/security/plugin-browser-security/rules/no-innerhtml)                         |
| [A04](https://owasp.org/Top10/A04_2021-Insecure_Design/)                            | Insecure Design           | Medium   | `secure-coding`, `nestjs-security`                       | [`no-improper-type-validation`](https://eslint.interlace.tools/docs/security/plugin-secure-coding/rules/no-improper-type-validation), [`no-missing-validation-pipe`](https://eslint.interlace.tools/docs/security/plugin-nestjs-security/rules/no-missing-validation-pipe)                                                                                                               |
| [A05](https://owasp.org/Top10/A05_2021-Security_Misconfiguration/)                  | Security Misconfiguration | High     | `express-security`, `lambda-security`                    | [`require-helmet`](https://eslint.interlace.tools/docs/security/plugin-express-security/rules/require-helmet), [`no-permissive-cors`](https://eslint.interlace.tools/docs/security/plugin-browser-security/rules/no-permissive-cors), [`no-exposed-error-details`](https://eslint.interlace.tools/docs/security/plugin-lambda-security/rules/no-exposed-error-details)                   |
| [A06](https://owasp.org/Top10/A06_2021-Vulnerable_and_Outdated_Components/)         | Vulnerable Components     | Medium   | `secure-coding`, `import-next`                           | [`detect-suspicious-dependencies`](https://eslint.interlace.tools/docs/security/plugin-node-security/rules/detect-suspicious-dependencies), [`no-extraneous-dependencies`](https://eslint.interlace.tools/docs/quality/plugin-import-next/rules/no-extraneous-dependencies)                                                                                                              |
| [A07](https://owasp.org/Top10/A07_2021-Identification_and_Authentication_Failures/) | Auth Failures             | High     | `jwt`, `express-security`                                | [`no-algorithm-none`](https://eslint.interlace.tools/docs/security/plugin-jwt/rules/no-algorithm-none), [`no-algorithm-confusion`](https://eslint.interlace.tools/docs/security/plugin-jwt/rules/no-algorithm-confusion), [`no-insecure-cookie-options`](https://eslint.interlace.tools/docs/security/plugin-express-security/rules/no-insecure-cookie-options)                          |
| [A08](https://owasp.org/Top10/A08_2021-Software_and_Data_Integrity_Failures/)       | Integrity Failures        | Medium   | `secure-coding`                                          | [`no-unsafe-deserialization`](https://eslint.interlace.tools/docs/security/plugin-secure-coding/rules/no-unsafe-deserialization), [`no-unsafe-dynamic-require`](https://eslint.interlace.tools/docs/security/plugin-node-security/rules/no-unsafe-dynamic-require)                                                                                                                       |
| [A09](https://owasp.org/Top10/A09_2021-Security_Logging_and_Monitoring_Failures/)   | Logging Failures          | Medium   | `secure-coding`, `lambda-security`                       | [`no-pii-in-logs`](https://eslint.interlace.tools/docs/security/plugin-node-security/rules/no-pii-in-logs), [`no-error-swallowing`](https://eslint.interlace.tools/docs/security/plugin-lambda-security/rules/no-error-swallowing)                                                                                                                                                       |
| [A10](https://owasp.org/Top10/A10_2021-Server-Side_Request_Forgery_SSRF/)           | SSRF                      | High     | `secure-coding`, `lambda-security`, `vercel-ai-security` | [`require-url-validation`](https://eslint.interlace.tools/docs/security/plugin-browser-security/rules/require-url-validation), [`no-user-controlled-requests`](https://eslint.interlace.tools/docs/security/plugin-lambda-security/rules/no-user-controlled-requests)                                                                                                                    |

## Modular Installation: Build your Security Protocol

Don't install everything—choose the layers that match your stack. Every protocol starts with the Core, then adds specialized coverage.

### 1. The Core (Mandatory)

```bash
# General OWASP coverage (89 rules)
npm install -D eslint-plugin-secure-coding
```

### 2. Specialized Security (Add as needed)

```bash
npm install -D eslint-plugin-node-security    # Cryptography & System leaks
npm install -D eslint-plugin-jwt            # Token security
npm install -D eslint-plugin-pg             # PostgreSQL hardening
```

### 3. Environment & Framework (Choose your stack)

```bash
# Frontend
npm install -D eslint-plugin-browser-security  # DOM/XSS prevention

# Backend Frameworks
npm install -D eslint-plugin-express-security  # Express.js protocols
npm install -D eslint-plugin-nestjs-security   # NestJS security pipes
npm install -D eslint-plugin-lambda-security   # Serverless/AWS Lambda
```

## The Complete Config

```javascript
// eslint.config.js - Full OWASP Top 10 Coverage
import secureCoding from "eslint-plugin-secure-coding";
import nodeSecurity from "eslint-plugin-node-security";
import jwt from "eslint-plugin-jwt";
import pg from "eslint-plugin-pg";
import browserSecurity from "eslint-plugin-browser-security";
import expressSecurity from "eslint-plugin-express-security";

export default [
  // Core OWASP preset (A01-A10 general coverage)
  secureCoding.configs["owasp-top-10"],

  // A02: Cryptographic Failures - specialized detection
  nodeSecurity.configs.recommended,

  // A07: Authentication Failures - JWT-specific
  jwt.configs.recommended,

  // A03: Injection - PostgreSQL-specific SQL injection
  {
    files: ["**/db/**", "**/repositories/**", "**/models/**"],
    ...pg.configs.recommended,
  },

  // A03: Injection - DOM XSS for frontend
  {
    files: ["**/components/**", "**/pages/**", "src/**/*.tsx"],
    ...browserSecurity.configs.recommended,
  },

  // A05: Security Misconfiguration - Express-specific
  {
    files: ["**/routes/**", "**/middleware/**", "app.ts", "server.ts"],
    ...expressSecurity.configs.recommended,
  },
];
```

## Example Output

```bash
src/db/users.ts
  42:15  error  🔒 CWE-89 OWASP:A03 | SQL Injection detected
                [pg/no-unsafe-query] Use parameterized query: client.query($1, [id])

src/auth/jwt.ts
  18:3   error  🔒 CWE-347 OWASP:A07 | Algorithm confusion vulnerability
                [jwt/no-algorithm-confusion] Specify algorithms: { algorithms: ['RS256'] }

src/api/crypto.ts
  55:10  error  🔒 CWE-328 OWASP:A02 | Weak hash algorithm: MD5
                [node-security/no-weak-hash-algorithm] Use SHA-256 or SHA-3

src/components/Comment.tsx
  12:5   error  🔒 CWE-79 OWASP:A03 | XSS via innerHTML
                [browser-security/no-innerhtml] Use textContent or sanitize with DOMPurify
```

## A03 Injection: Multi-Layer Protection

Injection is #1 for a reason. Here's complete coverage:

| Attack Vector              | Plugin               | Rule                                                                                                                                                                                                       |
| -------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SQL Injection (PostgreSQL) | `pg`                 | [`no-unsafe-query`](https://eslint.interlace.tools/docs/security/plugin-mongodb-security/rules/no-unsafe-query)                                                                                            |
| SQL Injection (general)    | `secure-coding`      | [`detect-eval-with-expression`](https://eslint.interlace.tools/docs/security/plugin-node-security/rules/detect-eval-with-expression)                                                                       |
| Command Injection          | `secure-coding`      | [`detect-child-process`](https://eslint.interlace.tools/docs/security/plugin-node-security/rules/detect-child-process)                                                                                     |
| LDAP Injection             | `secure-coding`      | [`no-ldap-injection`](https://eslint.interlace.tools/docs/security/plugin-secure-coding/rules/no-ldap-injection)                                                                                           |
| XPath Injection            | `secure-coding`      | [`no-xpath-injection`](https://eslint.interlace.tools/docs/security/plugin-secure-coding/rules/no-xpath-injection)                                                                                         |
| XXE Injection              | `secure-coding`      | [`no-xxe-injection`](https://eslint.interlace.tools/docs/security/plugin-secure-coding/rules/no-xxe-injection)                                                                                             |
| DOM XSS                    | `browser-security`   | [`no-innerhtml`](https://eslint.interlace.tools/docs/security/plugin-browser-security/rules/no-innerhtml), [`no-eval`](https://eslint.interlace.tools/docs/security/plugin-browser-security/rules/no-eval) |
| Prompt Injection           | `vercel-ai-security` | [`require-validated-prompt`](https://eslint.interlace.tools/docs/security/plugin-vercel-ai-security/rules/require-validated-prompt)                                                                        |

## A02 Cryptographic Failures: 31 Specialized Rules

```javascript
// node-security plugin catches what generic plugins miss
import nodeSecurity from "eslint-plugin-node-security";

// Detects:
// - CVE-2023-46809 (Marvin Attack) via no-insecure-rsa-padding
// - CVE-2020-36732 (CryptoJS) via no-cryptojs-weak-random
// - Weak algorithms: MD5, SHA1, DES, RC4, Blowfish
// - Static IVs, ECB mode, predictable salts
```

## A07 Auth Failures: JWT-Specific Detection

```javascript
// jwt plugin catches token-specific vulnerabilities
import jwt from "eslint-plugin-jwt";

// Detects:
// - Algorithm "none" attack
// - Algorithm confusion (CVE-2022-23540)
// - jwt.decode() without verify
// - Weak/hardcoded secrets
// - Missing expiration
```

## For OWASP Mobile Top 10

```javascript
import secureCoding from "eslint-plugin-secure-coding";

export default [
  {
    files: ["apps/mobile/**", "**/*.native.ts"],
    ...secureCoding.configs["owasp-mobile-top-10"],
  },
];
```

Covers all 10 mobile categories:

| #   | Category                    | Rules                                                                                                                                                                                                                                                                                                                                                               |
| --- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1  | Improper Credential Usage   | [`require-secure-credential-storage`](https://eslint.interlace.tools/docs/security/plugin-node-security/rules/require-secure-credential-storage)                                                                                                                                                                                                                    |
| M2  | Inadequate Supply Chain     | [`detect-suspicious-dependencies`](https://eslint.interlace.tools/docs/security/plugin-node-security/rules/detect-suspicious-dependencies), `require-package-lock`                                                                                                                                                                                                  |
| M3  | Insecure Auth               | [`no-client-side-auth-logic`](https://eslint.interlace.tools/docs/security/plugin-browser-security/rules/no-client-side-auth-logic), [`require-backend-authorization`](https://eslint.interlace.tools/docs/security/plugin-secure-coding/rules/require-backend-authorization)                                                                                       |
| M4  | Insufficient I/O Validation | `no-unvalidated-user-input`, [`no-unvalidated-deeplinks`](https://eslint.interlace.tools/docs/security/plugin-browser-security/rules/no-unvalidated-deeplinks)                                                                                                                                                                                                      |
| M5  | Insecure Communication      | [`no-http-urls`](https://eslint.interlace.tools/docs/security/plugin-browser-security/rules/no-http-urls), [`require-https-only`](https://eslint.interlace.tools/docs/security/plugin-browser-security/rules/require-https-only), [`no-allow-arbitrary-loads`](https://eslint.interlace.tools/docs/security/plugin-browser-security/rules/no-allow-arbitrary-loads) |
| M6  | Inadequate Privacy          | [`no-pii-in-logs`](https://eslint.interlace.tools/docs/security/plugin-node-security/rules/no-pii-in-logs), [`no-tracking-without-consent`](https://eslint.interlace.tools/docs/security/plugin-browser-security/rules/no-tracking-without-consent)                                                                                                                 |
| M7  | Binary Protection           | [`require-code-minification`](https://eslint.interlace.tools/docs/quality/plugin-operability/rules/require-code-minification)                                                                                                                                                                                                                                       |
| M8  | Security Misconfiguration   | [`require-secure-defaults`](https://eslint.interlace.tools/docs/security/plugin-secure-coding/rules/require-secure-defaults), [`no-verbose-error-messages`](https://eslint.interlace.tools/docs/quality/plugin-operability/rules/no-verbose-error-messages)                                                                                                         |
| M9  | Insecure Data Storage       | [`require-storage-encryption`](https://eslint.interlace.tools/docs/security/plugin-node-security/rules/require-storage-encryption), [`no-data-in-temp-storage`](https://eslint.interlace.tools/docs/security/plugin-node-security/rules/no-data-in-temp-storage)                                                                                                    |
| M10 | Insufficient Crypto         | Use `eslint-plugin-node-security`                                                                                                                                                                                                                                                                                                                                   |

## For OWASP LLM Top 10

Building AI applications? Add the Vercel AI Security plugin:

```javascript
import vercelAI from "eslint-plugin-vercel-ai-security";

export default [
  {
    files: ["**/ai/**", "**/agents/**"],
    ...vercelAI.configs.recommended,
  },
];
```

**100% OWASP LLM Top 10 2025 coverage** with 22 rules.

## Getting Audit Evidence

Run ESLint with JSON output:

```bash
npx eslint . --format json > security-report.json
```

Parse for OWASP tags:

```javascript
const report = require("./security-report.json");

const owaspFindings = report
  .flatMap((file) => file.messages)
  .filter((msg) => msg.message.includes("OWASP:"));

// Group by OWASP category
const byCategory = owaspFindings.reduce((acc, finding) => {
  const match = finding.message.match(/OWASP:(A\d+)/);
  if (match) {
    acc[match[1]] = (acc[match[1]] || 0) + 1;
  }
  return acc;
}, {});

console.log("OWASP Coverage Report:", byCategory);
```

## Rule Count Summary

| Plugin                             | Rules   | Focus               |
| ---------------------------------- | ------- | ------------------- |
| `eslint-plugin-secure-coding`      | 89      | Core OWASP coverage |
| `eslint-plugin-node-security`      | 31      | Cryptography        |
| `eslint-plugin-jwt`                | 13      | JWT/Authentication  |
| `eslint-plugin-pg`                 | 15      | PostgreSQL          |
| `eslint-plugin-browser-security`   | 52      | Browser/DOM         |
| `eslint-plugin-vercel-ai-security` | 22      | AI/LLM              |
| `eslint-plugin-express-security`   | 14      | Express.js          |
| `eslint-plugin-lambda-security`    | 16      | AWS Lambda          |
| `eslint-plugin-nestjs-security`    | 10      | NestJS              |
| `eslint-plugin-import-next`        | 61      | Import/Dependencies |
| **Total**                          | **332** |                     |

Turn compliance questions into automated answers.

---

📦 **All Plugins:**

- [eslint-plugin-secure-coding](https://www.npmjs.com/package/eslint-plugin-secure-coding) — Core OWASP coverage
- [eslint-plugin-node-security](https://www.npmjs.com/package/eslint-plugin-node-security) — Cryptography
- [eslint-plugin-jwt](https://www.npmjs.com/package/eslint-plugin-jwt) — JWT security
- [eslint-plugin-pg](https://www.npmjs.com/package/eslint-plugin-pg) — PostgreSQL
- [eslint-plugin-browser-security](https://www.npmjs.com/package/eslint-plugin-browser-security) — Browser/DOM
- [eslint-plugin-vercel-ai-security](https://www.npmjs.com/package/eslint-plugin-vercel-ai-security) — AI/LLM
- [eslint-plugin-express-security](https://www.npmjs.com/package/eslint-plugin-express-security) — Express.js
- [eslint-plugin-lambda-security](https://www.npmjs.com/package/eslint-plugin-lambda-security) — AWS Lambda
- [eslint-plugin-nestjs-security](https://www.npmjs.com/package/eslint-plugin-nestjs-security) — NestJS
- [eslint-plugin-import-next](https://www.npmjs.com/package/eslint-plugin-import-next) — Import management

**[⭐ Star on GitHub — 18 plugins, 332 rules](https://github.com/ofri-peretz/eslint)**

---

**The Interlace ESLint Ecosystem**
Interlace is a high-fidelity suite of static code analyzers designed to automate security, performance, and reliability for the modern Node.js stack. With over 330 rules across 18 specialized plugins, it provides 100% coverage for OWASP Top 10, LLM Security, and Database Hardening.

[Explore the full Documentation](https://eslint.interlace.tools)
---

© 2026 Ofri Peretz. All rights reserved.

---

**Build Securely.**
I'm Ofri Peretz, a Security Engineering Leader and the architect of the Interlace Ecosystem. I build static analysis standards that automate security and performance for Node.js fleets at scale.

[ofriperetz.dev](https://ofriperetz.dev) | [LinkedIn](https://linkedin.com/in/ofri-peretz) | [GitHub](https://github.com/ofri-peretz)
