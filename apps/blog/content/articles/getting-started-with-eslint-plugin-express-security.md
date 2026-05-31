---
title: "Your Express App Has No Helmet, No Rate Limit, and a ReDoS in Its Routes. 10 ESLint Rules Catch the Middleware You Forgot."
description: "Express ships nothing by default — no security headers, no rate limit, no CSRF, no body-size cap — and a route regex can DoS the event loop. 10 CWE-mapped ESLint rules that catch the middleware you forgot, in CI."
slug: "getting-started-with-eslint-plugin-express-security"
canonical_url: "https://ofriperetz.dev/articles/getting-started-with-eslint-plugin-express-security"
devto_url: "https://dev.to/ofri-peretz/getting-started-with-eslint-plugin-express-security-2fb8"
devto_id: 3144099
published_at: "2026-01-02T19:40:18Z"
edited_at: "2026-02-05T05:33:03Z"
cover_image: "https://ofriperetz.dev/cdn/blog-cover-image/getting-started-with-eslint-plugin-express-security.png"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/getting-started-with-eslint-plugin-express-security.png"
reading_time_minutes: 9
tags:
  - "eslint"
  - "express"
  - "security"
  - "node"
author:
  name: "Ofri Peretz"
  username: "ofri-peretz"
  avatar: "https://media2.dev.to/dynamic/image/width=640,height=640,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Fuser%2Fprofile_image%2F3669992%2F50a1f256-472c-48a1-85e8-149459647ea7.png"
  twitter: "ofriperetzdev"
series: null
---

Express is unopinionated, which is a polite way of saying it ships with **no
security by default**. This app is "done":

```ts
const app = express();
app.use(express.json());
app.post("/transfer", (req, res) => transfer(req.body));
app.listen(3000);
```

It has no security headers (clickjacking, MIME-sniffing, no HSTS), no rate limit
(credential stuffing, brute force), no CSRF protection on a state-changing
`POST`, and no body-size cap (a 2GB JSON body is a free DoS). None of that is a
bug you can _see_ — it's the middleware you **didn't write**. Absence doesn't
throw, and a test for "did we forget Helmet?" is one nobody writes.

`eslint-plugin-express-security` writes it for you. It's **10 rules** that read
your Express app and fail CI when the hardening middleware is missing — or when
a route pattern hides a ReDoS — each pinned to a CWE.

This guide covers the "middleware you forgot" rules, the regex that DoS-es your
event loop, the full 10-rule map, and exact install/engine support.

---

## TL;DR

- **10 rules**, each carrying a `CWE` id and CVSS.
- **4 presets**: `recommended` and `strict` (all 10), plus `api` (5 rules — the
  REST hardening set: Helmet, CORS, CSRF, cookie flags, rate-limit) and
  `graphql` (1 rule — introspection in production).
- **Flat-config**, CommonJS, ESLint `8 || 9 || 10`, Node `>= 18`. AST-based —
  it reads your `app.use(...)` chain and route definitions; no Express install
  or running server required.

---

## The middleware you forgot (require-\* rules)

These rules don't look for bad code — they look for **missing** code. An Express
app that never wires the middleware trips them:

```ts
// ❌ flags four absences on this app:
const app = express();
app.use(express.json()); // no { limit } → require-express-body-parser-limits (CWE-400)
// no app.use(helmet())  → require-helmet (CWE-693)
// no rate limiter        → require-rate-limiting (CWE-770)
// no CSRF middleware      → require-csrf-protection (CWE-352)
```

```ts
// ✅ the hardening baseline
import helmet from "helmet";
import rateLimit from "express-rate-limit";

const app = express();
app.use(helmet()); // security headers
app.use(rateLimit({ windowMs: 60_000, max: 100 })); // brute-force / DoS guard
app.use(express.json({ limit: "100kb" })); // bounded body
app.use(csrf()); // state-changing requests need a token
```

Each missing piece maps to a real weakness: no headers is **CWE-693** (clickjacking,
MIME-sniffing), no rate limit is **CWE-770** (resource exhaustion), an unbounded
body is **CWE-400**, and no CSRF is **CWE-352**. The fixes are the rules' own
guidance — e.g. _"Add helmet middleware: `app.use(helmet())`."_

---

## The ReDoS hiding in a route — `no-express-unsafe-regex-route`

Express lets you put a regular expression in a route path. A pattern with
nested quantifiers is a denial-of-service waiting for one crafted URL:

```ts
// ❌ no-express-unsafe-regex-route (CWE-1333, ReDoS)
app.get(/^\/api\/(\w+)+\/items$/, handler); // (\w+)+ → catastrophic backtracking
```

`(\w+)+` is the classic evil-regex shape: the engine can match the same input
exponentially many ways, so a long non-matching path string pins the event loop
at 100% CPU — and because Node is single-threaded, that one request stalls
**every** other request the process is handling.

```ts
// ✅ a string route with explicit params — linear matching
app.get("/api/:resource/items", handler);
```

The rule flags route patterns with nested quantifiers and overlapping
alternatives; its fix: _"Simplify the regex pattern. Avoid nested quantifiers
like `(a+)+`… Consider using a string route with explicit parameters."_

---

## The rest of the surface

| Concern                                                | Rule                                  | CWE     |
| ------------------------------------------------------ | ------------------------------------- | ------- |
| Wildcard CORS origin                                   | `no-permissive-cors`                  | CWE-942 |
| CORS `origin:*` **with** credentials (forbidden combo) | `no-cors-credentials-wildcard`        | CWE-942 |
| Cookies without `Secure`/`HttpOnly`/`SameSite`         | `no-insecure-cookie-options`          | CWE-614 |
| Debug endpoints left enabled                           | `no-exposed-debug-endpoints`          | CWE-489 |
| GraphQL introspection on in production                 | `no-graphql-introspection-production` | CWE-200 |

---

## The full rule set

All 10, with each rule's declared CWE:

| Rule                                  | Catches                                 | CWE      |
| ------------------------------------- | --------------------------------------- | -------- |
| `require-helmet`                      | App missing `helmet()` security headers | CWE-693  |
| `require-rate-limiting`               | No rate limiter → brute force / DoS     | CWE-770  |
| `require-csrf-protection`             | State-changing route, no CSRF           | CWE-352  |
| `require-express-body-parser-limits`  | Body parser with no size `limit`        | CWE-400  |
| `no-express-unsafe-regex-route`       | ReDoS in a route pattern                | CWE-1333 |
| `no-permissive-cors`                  | `origin: '*'` / reflected origin        | CWE-942  |
| `no-cors-credentials-wildcard`        | wildcard origin + credentials           | CWE-942  |
| `no-insecure-cookie-options`          | missing `Secure`/`HttpOnly`/`SameSite`  | CWE-614  |
| `no-exposed-debug-endpoints`          | debug routes reachable in prod          | CWE-489  |
| `no-graphql-introspection-production` | introspection enabled in prod           | CWE-200  |

---

## Install

```bash
# npm
npm install --save-dev eslint-plugin-express-security
# yarn
yarn add --dev eslint-plugin-express-security
# pnpm
pnpm add --save-dev eslint-plugin-express-security
# bun
bun add --dev eslint-plugin-express-security
```

Flat config (`eslint.config.js`):

```js
// `configs` is a NAMED export; the default export is the plugin object.
import { configs } from "eslint-plugin-express-security";

export default [
  configs.recommended, // all 10
  // configs.strict,    // all 10, max severity
  // configs.api,       // 5-rule REST hardening set
  // configs.graphql,   // introspection-in-production
];
```

Run it — findings carry the CWE, OWASP category, CVSS, and fix:

```text
src/routes/transfer.ts
  9:1  error  🔒 CWE-352 OWASP:A01-Broken CVSS:8.8 | Route handler for POST request lacks CSRF protection. Attackers can forge requests from malicious sites. | HIGH
             Fix: Add CSRF middleware: app.use(csrf()) or use csurf package. Include csrfToken in forms.
```

---

## Compatibility

| Surface              | Support                                                                                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Package managers** | npm, yarn, pnpm, bun — plain dev dependency                                                                                                                        |
| **Node**             | `>= 18.0.0`                                                                                                                                                        |
| **ESLint**           | `^8.0.0 \|\| ^9.0.0 \|\| ^10.0.0`, flat config                                                                                                                     |
| **Express**          | detects Express 4/5 `app.use(...)` chains, route definitions, and `cors`/`helmet`/`csrf`/`express-rate-limit` usage — it reads source, so no Express version pin   |
| **Module system**    | CommonJS — loads from both `eslint.config.js` and `eslint.config.mjs`                                                                                              |
| **Runtime peers**    | None — it lints source AST                                                                                                                                         |
| **Oxlint**           | Loads under Oxlint's JS-plugin runner via the `interlace-express-security` port, with ESLint↔Oxlint parity gated in CI. The full 10-rule set runs on ESLint today. |

---

## What it does — and doesn't — see

- **Presence, not correctness.** `require-helmet` proves you called `helmet()`;
  it can't prove your `contentSecurityPolicy` is tight, or that your rate-limit
  `max` is sane. It removes the "we forgot entirely" failure mode — the most
  common one — not the "our config is weak" one.
- **It reads the obvious wiring.** It recognizes the standard middleware
  (`helmet`, `express-rate-limit`, `csurf`/`csrf`, `cors`) on the `app`/router.
  A bespoke homegrown CSRF layer it doesn't recognize may need an inline
  disable with a comment explaining why.

---

## Where this sits in the ecosystem

Generic linters flag `eval` and obvious injection; they don't know what
`app.use`, a route regex, or a `cors()` call _is_. `eslint-plugin-express-security`
is the dedicated Express layer — the hardening middleware you forgot, the ReDoS
in a route, the CORS/cookie/CSRF defaults — each finding tagged with a CWE and
CVSS. It's the Express member of the [Interlace](https://eslint.interlace.tools)
family, complementary to the generic set and to the other server-side plugins
(`eslint-plugin-jwt`, `eslint-plugin-nestjs-security`, …).

---

## Links

- 📦 [npm: eslint-plugin-express-security](https://www.npmjs.com/package/eslint-plugin-express-security)
- 📖 [Full rule docs (per-rule CWE + examples)](https://eslint.interlace.tools/docs/security/plugin-express-security/rules)
- 💻 [Source on GitHub](https://github.com/ofri-peretz/eslint/tree/main/packages/eslint-plugin-express-security)

::dev-to-cta{url="https://github.com/ofri-peretz/eslint"}
⭐ Star on GitHub if your Express app is missing any of the above.
::

---

I'm **Ofri Peretz**, a security engineering leader and the author of the
Interlace ESLint ecosystem — domain-specific static analysis for security,
reliability, and performance on the Node.js stack. `eslint-plugin-express-security`
is its Express layer.

[ofriperetz.dev](https://ofriperetz.dev) · [LinkedIn](https://linkedin.com/in/ofri-peretz) · [GitHub](https://github.com/ofri-peretz)
