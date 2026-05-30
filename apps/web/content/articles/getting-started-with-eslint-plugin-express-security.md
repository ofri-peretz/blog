---
title: "Securing Middleware: The Express.js Static Analysis Standard"
description: "The professional standard for Express.js platform security. Automate protection for Node.js services through static middleware auditing."
slug: "getting-started-with-eslint-plugin-express-security"
canonical_url: "https://ofriperetz.dev/articles/getting-started-with-eslint-plugin-express-security"
devto_url: "https://dev.to/ofri-peretz/getting-started-with-eslint-plugin-express-security-2fb8"
devto_id: 3144099
published_at: "2026-01-02T19:40:18Z"
edited_at: "2026-02-05T05:33:03Z"
cover_image: "https://ofriperetz.dev/cdn/blog-cover-image/getting-started-with-eslint-plugin-express-security.png"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/getting-started-with-eslint-plugin-express-security.png"
reading_time_minutes: 3
tags:
  - "eslint"
  - "express"
  - "security"
  - "node"
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

**Middleware is where security usually fails. Here is the professional engineering standard for Express.js platform security, using automated static analysis to audit every route and middleware layer.**

> This plugin is for **Node.js teams** building web applications with [Express.js](https://expressjs.com/).

## Quick Install

```bash
npm install --save-dev eslint-plugin-express-security
```

## Flat Config

```javascript
// eslint.config.js
import expressSecurity from 'eslint-plugin-express-security';

export default [expressSecurity.configs.recommended];
```

## Rule Overview

| Rule                                                                                                                                                                               | CWE      | What it catches          |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------ |
| [`require-helmet`](https://eslint.interlace.tools/docs/security/plugin-express-security/rules/require-helmet)                                           | [CWE-693](https://cwe.mitre.org/data/definitions/693.html)  | Missing security headers |
| [`no-cors-credentials-wildcard`](https://eslint.interlace.tools/docs/security/plugin-express-security/rules/no-cors-credentials-wildcard)               | [CWE-346](https://cwe.mitre.org/data/definitions/346.html)  | CORS \* + credentials    |
| [`no-permissive-cors`](https://eslint.interlace.tools/docs/security/plugin-express-security/rules/no-permissive-cors)                                   | [CWE-942](https://cwe.mitre.org/data/definitions/942.html)  | Overly permissive CORS   |
| [`no-insecure-cookie-options`](https://eslint.interlace.tools/docs/security/plugin-express-security/rules/no-insecure-cookie-options)                   | [CWE-614](https://cwe.mitre.org/data/definitions/614.html)  | Missing cookie flags     |
| [`require-csrf-protection`](https://eslint.interlace.tools/docs/security/plugin-express-security/rules/require-csrf-protection)                         | [CWE-352](https://cwe.mitre.org/data/definitions/352.html)  | No CSRF protection       |
| [`require-rate-limiting`](https://eslint.interlace.tools/docs/security/plugin-express-security/rules/require-rate-limiting)                             | [CWE-307](https://cwe.mitre.org/data/definitions/307.html)  | No rate limiting         |
| [`require-express-body-parser-limits`](https://eslint.interlace.tools/docs/security/plugin-express-security/rules/require-express-body-parser-limits)   | [CWE-400](https://cwe.mitre.org/data/definitions/400.html)  | Unlimited body size      |
| [`no-express-unsafe-regex-route`](https://eslint.interlace.tools/docs/security/plugin-express-security/rules/no-express-unsafe-regex-route)             | [CWE-1333](https://cwe.mitre.org/data/definitions/1333.html) | ReDoS in routes          |
| [`no-graphql-introspection-production`](https://eslint.interlace.tools/docs/security/plugin-express-security/rules/no-graphql-introspection-production) | [CWE-200](https://cwe.mitre.org/data/definitions/200.html)  | Schema exposed           |

## Run ESLint

```bash
npx eslint .
```

You'll see output like:

```bash
src/app.ts
  15:1  error  🔒 CWE-693 | Missing Helmet middleware
               Fix: Add app.use(helmet()) before routes

src/routes/api.ts
  8:1   error  🔒 CWE-346 | CORS with credentials and wildcard origin
               Fix: Specify explicit origin when using credentials

src/middleware/auth.ts
  22:3  error  🔒 CWE-614 | Cookie missing secure/httpOnly flags
               Fix: Add { secure: true, httpOnly: true, sameSite: 'strict' }
```

## Quick Wins

### Security Headers

```javascript
// ❌ Missing security headers
const app = express();
app.use(cors());

// ✅ Safe: Helmet adds security headers
import helmet from 'helmet';
const app = express();
app.use(helmet());
app.use(cors({ origin: 'https://app.example.com' }));
```

### Cookie Security

```javascript
// ❌ Insecure cookie
res.cookie('session', token);

// ✅ Safe: All security flags
res.cookie('session', token, {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  maxAge: 3600000,
});
```

## Custom Configuration

```javascript
// eslint.config.js
import expressSecurity from 'eslint-plugin-express-security';

export default [
  expressSecurity.configs.recommended,
  {
    rules: {
      // Override severity
      'express-security/require-rate-limiting': 'warn',

      // Configure with options
      'express-security/require-express-body-parser-limits': [
        'error',
        {
          maxBodySize: '1mb',
        },
      ],
    },
  },
];
```

## Strongly-Typed Options (TypeScript)

```typescript
// eslint.config.ts
import expressSecurity, {
  type RuleOptions,
} from 'eslint-plugin-express-security';

const corsOptions: RuleOptions['no-permissive-cors'] = {
  allowedOrigins: ['https://app.example.com'],
};

export default [
  expressSecurity.configs.recommended,
  {
    rules: {
      'express-security/no-permissive-cors': ['error', corsOptions],
    },
  },
];
```

## Quick Reference

```bash
# Install
npm install --save-dev eslint-plugin-express-security

# Config (eslint.config.js)
import expressSecurity from 'eslint-plugin-express-security';
export default [expressSecurity.configs.recommended];

# Run
npx eslint .
```

---

📦 [npm: eslint-plugin-express-security](https://www.npmjs.com/package/eslint-plugin-express-security)
📖 [Full Rule List](https://eslint.interlace.tools/docs/security/plugin-express-security/rules)

**[⭐ Star on GitHub](https://github.com/ofri-peretz/eslint)**

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
