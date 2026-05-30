---
title: "Zero-Trust Auth: The JWT Static Analysis Standard"
description: "Automated enforcement for bulletproof authentication. Use static analysis to detect algorithm confusion and weak secrets programmatically."
slug: "getting-started-eslint-plugin-jwt"
canonical_url: "https://ofriperetz.dev/articles/getting-started-eslint-plugin-jwt"
devto_url: "https://dev.to/ofri-peretz/getting-started-with-eslint-plugin-jwt-4l4p"
devto_id: 3143580
published_at: "2026-01-02T15:17:19Z"
edited_at: "2026-01-11T10:21:39Z"
cover_image: "https://media2.dev.to/dynamic/image/width=1000,height=420,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fofriperetz.dev%2Fcdn%2Fblog-cover-image%2Fgetting-started-eslint-plugin-jwt.png"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/getting-started-eslint-plugin-jwt.png"
reading_time_minutes: 3
tags:
  - "eslint"
  - "jwt"
  - "security"
  - "authentication"
reactions: 0
comments: 0
views: 0
author:
  name: "Ofri Peretz"
  username: "ofri-peretz"
  avatar: "https://media2.dev.to/dynamic/image/width=640,height=640,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Fuser%2Fprofile_image%2F3669992%2F50a1f256-472c-48a1-85e8-149459647ea7.png"
  twitter: "ofriperetzdev"
series: "The Hardened Stack"
---

**Authentication is the front door of your ecosystem. Weak JWT configurations are a gift to attackers. Here is the engineering standard for automated Zero-Trust authentication through static analysis.**

## Quick Install

```bash
npm install --save-dev eslint-plugin-jwt
```

## Flat Config

```javascript
// eslint.config.js
import jwt from "eslint-plugin-jwt";

export default [jwt.configs.recommended];
```

## Run ESLint

```bash
npx eslint .
```

You'll see output like:

```bash
src/auth.ts
  15:3  error  🔒 CWE-347 CVSS:9.8 | JWT algorithm 'none' is allowed
               Fix: Remove 'none' from algorithms: ['HS256']

src/verify.ts
  28:5  error  🔒 CWE-613 | JWT missing expiration
               Fix: Add expiresIn: '1h' or exp claim
```

## Rule Overview

| Rule                                                                                                                       | CWE                                                        | What it catches         |
| -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ----------------------- |
| [`no-algorithm-none`](https://eslint.interlace.tools/docs/security/plugin-jwt/rules/no-algorithm-none)                     | [CWE-347](https://cwe.mitre.org/data/definitions/347.html) | Algorithm 'none' bypass |
| [`no-algorithm-confusion`](https://eslint.interlace.tools/docs/security/plugin-jwt/rules/no-algorithm-confusion)           | [CWE-327](https://cwe.mitre.org/data/definitions/327.html) | RS256/HS256 confusion   |
| [`no-weak-secret`](https://eslint.interlace.tools/docs/security/plugin-jwt/rules/no-weak-secret)                           | [CWE-326](https://cwe.mitre.org/data/definitions/326.html) | Brute-forceable secrets |
| [`no-hardcoded-secret`](https://eslint.interlace.tools/docs/security/plugin-jwt/rules/no-hardcoded-secret)                 | [CWE-798](https://cwe.mitre.org/data/definitions/798.html) | Secrets in source code  |
| [`no-sensitive-payload`](https://eslint.interlace.tools/docs/security/plugin-jwt/rules/no-sensitive-payload)               | [CWE-312](https://cwe.mitre.org/data/definitions/312.html) | PII in token payload    |
| [`require-expiration`](https://eslint.interlace.tools/docs/security/plugin-jwt/rules/require-expiration)                   | [CWE-613](https://cwe.mitre.org/data/definitions/613.html) | Missing exp claim       |
| [`require-algorithm-whitelist`](https://eslint.interlace.tools/docs/security/plugin-jwt/rules/require-algorithm-whitelist) | [CWE-327](https://cwe.mitre.org/data/definitions/327.html) | No explicit algorithms  |
| [`require-issuer-validation`](https://eslint.interlace.tools/docs/security/plugin-jwt/rules/require-issuer-validation)     | [CWE-345](https://cwe.mitre.org/data/definitions/345.html) | Missing iss check       |
| [`require-audience-validation`](https://eslint.interlace.tools/docs/security/plugin-jwt/rules/require-audience-validation) | [CWE-345](https://cwe.mitre.org/data/definitions/345.html) | Missing aud check       |
| [`no-decode-without-verify`](https://eslint.interlace.tools/docs/security/plugin-jwt/rules/no-decode-without-verify)       | [CWE-347](https://cwe.mitre.org/data/definitions/347.html) | jwt.decode() misuse     |
| [`require-issued-at`](https://eslint.interlace.tools/docs/security/plugin-jwt/rules/require-issued-at)                     | [CWE-613](https://cwe.mitre.org/data/definitions/613.html) | Missing iat claim       |
| [`require-max-age`](https://eslint.interlace.tools/docs/security/plugin-jwt/rules/require-max-age)                         | [CWE-613](https://cwe.mitre.org/data/definitions/613.html) | No maxAge in verify     |
| [`no-timestamp-manipulation`](https://eslint.interlace.tools/docs/security/plugin-jwt/rules/no-timestamp-manipulation)     | [CWE-345](https://cwe.mitre.org/data/definitions/345.html) | Clock skew exploits     |

## Quick Wins

### Before

```javascript
// ❌ Algorithm none allowed
jwt.verify(token, secret, {
  algorithms: ["HS256", "none"],
});
```

### After

```javascript
// ✅ Explicit safe algorithm
jwt.verify(token, secret, {
  algorithms: ["HS256"],
});
```

### Before (no expiration)

```javascript
// ❌ No expiration
jwt.sign({ userId: 123 }, secret);
```

### After (short-lived token)

```javascript
// ✅ Short-lived token
jwt.sign({ userId: 123 }, secret, {
  expiresIn: "1h",
});
```

## Complete Secure Pattern

```javascript
// Signing
const token = jwt.sign({ userId: 123 }, process.env.JWT_SECRET, {
  expiresIn: "1h",
  algorithm: "HS256",
  issuer: "your-app",
  audience: "your-api",
});

// Verifying
const payload = jwt.verify(token, process.env.JWT_SECRET, {
  algorithms: ["HS256"],
  issuer: "your-app",
  audience: "your-api",
  maxAge: "1h",
});
```

## Available Presets

```javascript
// Security-focused configuration
jwt.configs.recommended;

// All rules enabled
jwt.configs.all;
```

## Quick Reference

```bash
# Install
npm install --save-dev eslint-plugin-jwt

# Config (eslint.config.js)
import jwt from 'eslint-plugin-jwt';
export default [jwt.configs.recommended];

# Run
npx eslint .
```

---

📦 [npm: eslint-plugin-jwt](https://www.npmjs.com/package/eslint-plugin-jwt)
📖 [Full Rule List](https://eslint.interlace.tools/docs/security/plugin-jwt/rules)

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
