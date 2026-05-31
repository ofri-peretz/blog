---
title: "13 Security Questions Every JavaScript Interview Asks — and the ESLint Rule That Answers Each in CI"
description: "The 13 security concepts that come up in senior JavaScript/Node interviews — SQLi, XSS, CSRF, JWT, prototype pollution, ReDoS, timing attacks — each with the bad-vs-good code, the CWE, and the exact ESLint rule that enforces it automatically."
slug: "the-security-engineer-interview-cheat-sheet-for-javascript-developers-pgn"
canonical_url: "https://ofriperetz.dev/articles/the-security-engineer-interview-cheat-sheet-for-javascript-developers-pgn"
devto_url: "https://dev.to/ofri-peretz/the-security-engineer-interview-cheat-sheet-for-javascript-developers-pgn"
devto_id: 3137519
published_at: "2025-12-31T06:10:16Z"
edited_at: "2026-02-05T05:33:13Z"
cover_image: "https://media2.dev.to/dynamic/image/width=1000,height=420,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fofriperetz.dev%2Fcdn%2Fblog-cover-image%2Fthe-security-engineer-interview-cheat-sheet-for-javascript-developers-pgn.png"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/the-security-engineer-interview-cheat-sheet-for-javascript-developers-pgn.png"
reading_time_minutes: 6
tags:
  - "eslint"
  - "career"
  - "security"
  - "javascript"
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

I've interviewed 50+ backend and full-stack engineers. Security questions show
up in almost every loop now — even for roles that aren't labeled "security."
Here are the **13 questions** that come up the most, each with the answer in one
breath, the bad-vs-good code, the CWE, and — the part most cheat-sheets skip —
**the ESLint rule that enforces it so you never ship the bad version.**

The best answer to "how do you stay current?" isn't "I read CVEs." It's "I
enforce these in CI." This is how.

---

## The fundamentals (asked ~90% of the time)

### 1. SQL Injection

```javascript
db.query(`SELECT * FROM users WHERE id = ${userId}`); // ❌
db.query("SELECT * FROM users WHERE id = $1", [userId]); // ✅
```

**Say:** "Parameterized queries separate data from code." **CWE-89.** Enforced by
`pg/no-unsafe-query`.

### 2. XSS (and its three types)

Stored (saved to the DB), reflected (echoed from the URL), and DOM (written by
client JS). The browser-side fix is the same reflex:

```javascript
element.innerHTML = userInput; // ❌
element.textContent = userInput; // ✅
```

**CWE-79.** Enforced by `browser-security/no-innerhtml`.

### 3. Password storage

```javascript
crypto.createHash("md5").update(password); // ❌
await bcrypt.hash(password, 12); // ✅
```

**Say:** "bcrypt or argon2, per-user salt, a work factor." **CWE-916.** The weak
hash is caught by `node-security/no-weak-hash-algorithm`.

---

## Intermediate (asked ~70% of the time)

### 4. CSRF

Cross-Site Request Forgery rides an authenticated user's cookies to perform
actions they didn't intend. **Prevention:** synchronizer tokens, `SameSite`
cookies, origin checks. **CWE-352.** Enforced by
`express-security/require-csrf-protection`.

### 5. The Same-Origin Policy

Browsers isolate by origin (scheme + host + port). The controlled relaxations are
CORS, `postMessage`, and (legacy) JSONP — and an over-broad CORS policy
re-opens everything (**CWE-942**). `browser-security/no-permissive-cors` catches
the wildcard.

### 6. Timing attacks

```javascript
if (userToken === secretToken) {
} // ❌ leaks via comparison time
crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b)); // ✅ constant-time
```

**CWE-208.** Enforced by `node-security/no-timing-unsafe-compare`.

### 7. JWTs

Verify the signature, check `exp`, never accept `algorithm: "none"`, and store in
an `httpOnly` cookie — **not** `localStorage`. **CWE-347** for the `none` bypass
(`jwt/no-algorithm-none`); the storage mistake is `browser-security/no-jwt-in-storage`.

---

## Advanced (asked ~50% of the time)

### 8. Prototype pollution

```javascript
obj[key] = value; // ❌ key="__proto__" pollutes Object.prototype
if (key !== "__proto__" && key !== "constructor" && key !== "prototype")
  obj[key] = value; // ✅
```

**CWE-1321.** Caught by `secure-coding/detect-object-injection` (the rule's own
finding tags CWE-915; CWE-1321 is the canonical JS-prototype-pollution entry).

### 9. Content Security Policy

An HTTP header that restricts what can load: `default-src 'self'; script-src 'self' 'nonce-…'`.
**CWE-693.** `browser-security/require-csp-headers` flags its absence;
`no-unsafe-inline-csp` flags the `'unsafe-inline'` that defeats it.

### 10. ReDoS

```javascript
/^(a+)+$/.test("aaaaaaaaaaaaaaaaaaaaaaaa!"); // ❌ catastrophic backtracking
```

Regular-Expression Denial of Service. Caught by
`secure-coding/no-redos-vulnerable-regex`.

---

## Architecture (asked ~40% of the time)

### 11. Designing secure authentication

- Password hashing (bcrypt/argon2)
- Rate limiting on login + account lockout after repeated failures
- MFA
- Secure session management
- Password reset via time-limited tokens

Most of this is architectural, but the enforceable slice is real: the rate-limit
gap on the login route is `express-security/require-rate-limiting` (**CWE-307**).

### 12. Secrets management

Environment variables at minimum; a secrets manager (Vault, AWS Secrets Manager)
in production; nothing in code or git history; a rotation policy. **CWE-798** —
`secure-coding/no-hardcoded-credentials` is the backstop for the last one.

### 13. Securing a REST API

AuthN (JWT/OAuth2), AuthZ (RBAC/ABAC), input validation, rate limiting, HTTPS
only, and a tight CORS policy — `express-security/require-helmet` plus the rate
and CORS rules above cover the configuration half.

---

## Quick-reference: the six with a one-line code fix

| Vulnerability      | Prevention            | CWE                                                          | Enforced by                                |
| ------------------ | --------------------- | ------------------------------------------------------------ | ------------------------------------------ |
| SQL Injection      | Parameterized queries | [CWE-89](https://cwe.mitre.org/data/definitions/89.html)     | `pg/no-unsafe-query`                       |
| XSS                | Output encoding       | [CWE-79](https://cwe.mitre.org/data/definitions/79.html)     | `browser-security/no-innerhtml`            |
| CSRF               | Tokens + SameSite     | [CWE-352](https://cwe.mitre.org/data/definitions/352.html)   | `express-security/require-csrf-protection` |
| Weak password hash | bcrypt / argon2       | [CWE-916](https://cwe.mitre.org/data/definitions/916.html)   | `node-security/no-weak-hash-algorithm`     |
| Prototype poll.    | Key allow-list        | [CWE-1321](https://cwe.mitre.org/data/definitions/1321.html) | `secure-coding/detect-object-injection`    |
| ReDoS              | Linear-time regex     | [CWE-1333](https://cwe.mitre.org/data/definitions/1333.html) | `secure-coding/no-redos-vulnerable-regex`  |

---

## The "great" answer: enforce it, don't memorize it

Reciting these in an interview proves you know them. Wiring them into CI proves
you'll never ship them. Each concept above maps to a rule in a domain-specific
[Interlace](https://eslint.interlace.tools) plugin — install the layers your
stack uses and the bad version gets flagged (run with `--max-warnings 0` in CI so
every finding blocks, not just the `error`-tier ones):

```bash
# npm (yarn/pnpm/bun: same packages, that manager's -D/--dev flag)
npm install --save-dev eslint-plugin-secure-coding eslint-plugin-node-security \
  eslint-plugin-jwt eslint-plugin-pg eslint-plugin-browser-security eslint-plugin-express-security
```

```js
// eslint.config.mjs — `configs` is a NAMED export (default export is the plugin)
import { configs as secureCoding } from "eslint-plugin-secure-coding";
import { configs as nodeSecurity } from "eslint-plugin-node-security";

export default [secureCoding.recommended, nodeSecurity.recommended];
```

| Surface              | Support                                                    |
| -------------------- | ---------------------------------------------------------- |
| **Package managers** | npm, yarn, pnpm, bun                                       |
| **Node**             | `>= 18.0.0`                                                |
| **ESLint**           | `^8.0.0 \|\| ^9.0.0 \|\| ^10.0.0`, flat config             |
| **Module system**    | CommonJS — `eslint.config.js` or `.mjs`                    |
| **Oxlint**           | flagship rules wired via the `interlace-*` ports, CI-gated |

For the full OWASP picture (and the two categories static analysis honestly
can't reach), see
[the OWASP Top 10 mapping](https://ofriperetz.dev/articles/mapping-your-codebase-to-owasp-top-10-with-247-eslint-rules).

---

## Links

- 📦 [eslint-plugin-secure-coding](https://www.npmjs.com/package/eslint-plugin-secure-coding) · [node-security](https://www.npmjs.com/package/eslint-plugin-node-security) · [jwt](https://www.npmjs.com/package/eslint-plugin-jwt) · [pg](https://www.npmjs.com/package/eslint-plugin-pg) · [browser-security](https://www.npmjs.com/package/eslint-plugin-browser-security)
- 📖 [Full rule docs (per-rule CWE)](https://eslint.interlace.tools)
- 💻 [Source on GitHub](https://github.com/ofri-peretz/eslint)

::dev-to-cta{url="https://github.com/ofri-peretz/eslint"}
⭐ Star on GitHub if you'd rather enforce this list than memorize it for the next interview.
::

---

I'm **Ofri Peretz**, a security engineering leader and the author of the
Interlace ESLint ecosystem — domain-specific static analysis for security,
reliability, and performance on the Node.js stack.

[ofriperetz.dev](https://ofriperetz.dev) · [LinkedIn](https://linkedin.com/in/ofri-peretz) · [GitHub](https://github.com/ofri-peretz)
