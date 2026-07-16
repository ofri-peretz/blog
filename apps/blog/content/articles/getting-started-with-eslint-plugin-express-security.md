---
title: "Express.js Security Bugs Your Middleware Doesn't Stop — 14 ESLint Rules That Do"
description: "Missing helmet headers, CORS misconfiguration, unvalidated req.body, path traversal — each survived review because the dangerous thing was the code that wasn't there. 14 CWE-mapped ESLint rules that catch what your middleware and your reviewers miss, in CI."
slug: "getting-started-with-eslint-plugin-express-security"
canonical_url: "https://ofriperetz.dev/articles/getting-started-with-eslint-plugin-express-security"
devto_url: "https://dev.to/ofri-peretz/getting-started-with-eslint-plugin-express-security-2fb8"
devto_id: 3144099
published_at: "2026-01-02T19:40:18Z"
edited_at: "2026-02-05T05:33:03Z"
cover_image: "https://ofriperetz.dev/og/cover/getting-started-with-eslint-plugin-express-security"
social_image: "https://ofriperetz.dev/og/article/getting-started-with-eslint-plugin-express-security"
reading_time_minutes: 9
tags:
  - "security"
  - "node"
  - "devsecops"
  - "eslint"
author:
  name: "Ofri Peretz"
  username: "ofri-peretz"
  avatar: "https://media2.dev.to/dynamic/image/width=640,height=640,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Fuser%2Fprofile_image%2F3669992%2F50a1f256-472c-48a1-85e8-149459647ea7.png"
  twitter: "ofriperetzdev"
series: "Server-Side Hardening"
---

> **Most Express.js security vulnerabilities in production aren't bugs in your code — they're the middleware you forgot to add. And a diff review will never catch an absence.**

Four vulnerabilities will illustrate exactly why. Each one survived code review, shipped to production, and is sitting in your codebase right now if you haven't run static analysis that knows Express.

---

## Finding 1: Missing security headers (no Helmet)

**The vulnerable code:**

```ts
const app = express();
app.use(express.json());
app.post("/transfer", (req, res) => transfer(req.body));
app.listen(3000);
```

**Why it survived review:** A reviewer reads four clean lines, sees a working POST endpoint, and approves. Nothing on screen is wrong. The dangerous part is the lines that aren't there — no `helmet()` means the response ships without `X-Frame-Options` (clickjacking), `X-Content-Type-Options` (MIME-sniffing), `Strict-Transport-Security` (HTTPS enforcement), or a CSP. You can't review code that was never written, and a test for "did we forget Helmet?" is one nobody writes.

**The rule:** `require-helmet` (CWE-693)

**The fix:**

```ts
import helmet from "helmet";

const app = express();
app.use(helmet()); // X-Frame-Options, HSTS, X-Content-Type-Options, CSP — in one line
app.use(express.json());
app.post("/transfer", (req, res) => transfer(req.body));
app.listen(3000);
```

---

## Finding 2: CORS misconfiguration — wildcard origin with credentials

**The vulnerable code:**

```ts
app.use(cors({ origin: "*", credentials: true }));
```

**Why it survived review:** `origin: "*"` looks like a sensible "open to everyone" choice for a public API, and `credentials: true` looks like a feature ("we support authenticated requests"). Together they form a combination browsers explicitly forbid — and that an attacker exploiting `withCredentials` from any origin can abuse to make cross-origin requests that carry the victim's session cookies. The two options look like unrelated config knobs; nobody flags the combination.

**The rule:** `no-cors-credentials-wildcard` (CWE-942)

**The fix:**

```ts
// Option 1: Public API — no credentials
app.use(cors({ origin: "*" }));

// Option 2: Credentialed requests — explicit allowlist
const ALLOWED_ORIGINS = ["https://app.yourdomain.com", "https://admin.yourdomain.com"];
app.use(cors({
  origin: (origin, cb) => cb(null, ALLOWED_ORIGINS.includes(origin ?? "")),
  credentials: true,
}));
```

---

## Finding 3: Unvalidated `req.body` passed directly to a state-changing operation

**The vulnerable code:**

```ts
app.post("/transfer", async (req, res) => {
  await db.transfers.create(req.body); // req.body is attacker-controlled
  res.json({ ok: true });
});
```

**Why it survived review:** The line reads like a feature: "accept the transfer payload and persist it." The danger is invisible — no CSRF token check means any site can forge this POST from a victim's browser, using the victim's cookies, and your server will execute it. It also misses a body-size cap, so a 2GB JSON body is a free denial-of-service. Both look like omissions, not bugs. Both survive a diff.

**The rules:** `require-csrf-protection` (CWE-352) + `require-express-body-parser-limits` (CWE-400)

**The fix:**

```ts
import csrf from "csurf";
import rateLimit from "express-rate-limit";

app.use(express.json({ limit: "100kb" })); // bounded body
app.use(csrf());                           // forged-request guard

app.post("/transfer", async (req, res) => {
  // req.csrfToken() verified by middleware above
  await db.transfers.create(req.body);
  res.json({ ok: true });
});
```

---

## Finding 4: Path traversal via `req.params`

**The vulnerable code:**

```ts
app.get("/files/:name", (req, res) => {
  res.redirect(req.query.returnUrl);       // open redirect (CWE-601)
  // or:
  res.sendFile(path.join(__dirname, "uploads", req.params.name)); // path traversal (CWE-22)
});
```

**Why it survived review:** `req.query.returnUrl` looks like a convenience feature — "return the user to where they came from after login." `req.params.name` looks like a straightforward file-serve. The redirect line survives because it reads like a feature, not a hole; the file-serve line survives because `path.join` looks like the safe thing to do (and it is — unless `name` is `../../etc/passwd`). Ask an AI assistant for a login flow with a return-URL parameter and you reliably get the first form verbatim.

**The rules:** `no-user-controlled-redirect` (CWE-601) + `no-express-unsafe-regex-route` (CWE-1333)

**The fix:**

```ts
// Redirect: resolve against an allowlist — never reflect raw input
const ALLOWED = new Set(["/dashboard", "/settings", "/profile"]);
app.get("/login", (req, res) =>
  res.redirect(ALLOWED.has(req.query.returnUrl as string) ? req.query.returnUrl as string : "/dashboard"),
);

// File serve: strip traversal before joining
app.get("/files/:name", (req, res) => {
  const safe = path.basename(req.params.name); // strips ../../../
  res.sendFile(path.join(__dirname, "uploads", safe));
});
```

---

## Here's the guard that catches all of this in CI

Every finding above — plus 10 more — is caught by `eslint-plugin-express-security` before the code reaches review. One install, one config line, 14 CWE-mapped rules running on every push.

```bash
npm install --save-dev eslint-plugin-express-security
```

Flat config (`eslint.config.js`):

```js
import { configs } from "eslint-plugin-express-security";

export default [
  configs.recommended, // all 14, criticals at error
  // configs.strict,    // all 14, every rule at error
  // configs.api,       // 5-rule REST hardening set
  // configs.graphql,   // introspection-in-production
];
```

Run it — findings carry the CWE, OWASP category, CVSS, and fix:

```text
src/routes/transfer.ts
  9:1  error  🔒 CWE-352 OWASP:A01-Broken CVSS:8.8 | Route handler for POST request lacks CSRF protection.
             Fix: Add CSRF middleware: app.use(csrf()) or use csurf package. Include csrfToken in forms.
```

**The plugin is AST-based.** It reads your `app.use(...)` chain and route definitions — no Express install or running server required. It recognizes the standard middleware (`helmet`, `express-rate-limit`, `csurf`/`csrf`, `cors`) on the `app` or router, and it fires the moment the pattern is absent.

---

## TL;DR — all 14 rules

**4 presets:** `recommended` (all 14; criticals at `error`, easy-to-false-positive rules like rate-limit and CSRF default to `warn`) · `strict` (all 14 at `error`) · `api` (5-rule REST hardening set) · `graphql` (introspection-in-production).

| Rule | Catches | CWE | `recommended` |
| ---- | ------- | --- | ------------- |
| `require-helmet` | App missing `helmet()` security headers | CWE-693 | error |
| `require-rate-limiting` | No rate limiter → brute force / DoS | CWE-770 | warn |
| `require-csrf-protection` | State-changing route, no CSRF | CWE-352 | warn |
| `require-express-body-parser-limits` | Body parser with no size `limit` | CWE-400 | warn |
| `no-express-unsafe-regex-route` | ReDoS in a route pattern | CWE-1333 | error |
| `no-permissive-cors` | `origin: '*'` / reflected origin | CWE-942 | error |
| `no-cors-credentials-wildcard` | Wildcard origin + credentials | CWE-942 | error |
| `no-insecure-cookie-options` | Missing `Secure`/`HttpOnly`/`SameSite` | CWE-614 | error |
| `no-exposed-debug-endpoints` | Debug routes reachable in prod | CWE-489 | error |
| `no-graphql-introspection-production` | Introspection enabled in prod | CWE-200 | warn |
| `no-user-controlled-redirect` | `res.redirect()` of raw user input | CWE-601 | error |
| `no-missing-cors-check` | Origin trusted without validation | CWE-346 | warn |
| `no-missing-csrf-protection` | State change with no CSRF guard | CWE-352 | warn |
| `no-missing-security-headers` | Response missing security headers | CWE-693 | warn |

---

## Compatibility

| Surface | Support |
| ------- | ------- |
| **Node** | `>= 18.0.0` |
| **ESLint** | `^8.0.0 \|\| ^9.0.0 \|\| ^10.0.0`, flat config |
| **Express** | Detects Express 4/5 `app.use(...)` chains, route definitions, and `cors`/`helmet`/`csrf`/`express-rate-limit` usage |
| **Module system** | CommonJS — loads from both `eslint.config.js` and `eslint.config.mjs` |
| **Oxlint** | Loads under Oxlint's JS-plugin runner via the `interlace-express-security` port |

---

## What it sees — and doesn't

- **Presence, not correctness.** `require-helmet` proves you called `helmet()`; it can't prove your `contentSecurityPolicy` is tight, or that your rate-limit `max` is sane. It removes the "we forgot entirely" failure mode — the most common one — not the "our config is weak" one.
- **It reads the obvious wiring.** A bespoke homegrown CSRF layer it doesn't recognize may need an inline disable with a comment explaining why.

---

## Context: where this fits the bigger picture

If you want the static-analysis protocol that runs this plugin as part of a full onboarding audit, see: [The 30-Minute Security Audit — A Static Analysis Protocol for Onboarding](https://dev.to/ofri-peretz/the-30-minute-security-audit-onboarding-a-new-codebase-4f91).

For a head-to-head comparison of every plugin competing for the Express-security slot: [Benchmark: 17 ESLint Security Plugins Compared](https://dev.to/ofri-peretz/i-benchmarked-17-eslint-security-plugins-only-one-found-every-vulnerability-c83).

The same "framework hands you the guard, you ship without it" failure shows up at every layer of a Node stack:

- **The framework above:** [NestJS Hands You Guards, Pipes, and Throttlers — You Ship Controllers Without Them](https://ofriperetz.dev/articles/nestjs-guards-pipes-throttlers-6-eslint-rules). Six-rule sibling set, same absence-of-middleware failure.
- **The auth layer:** [The JWT `alg:none` Attack — Change One Header Field, Forge an Admin Token](https://ofriperetz.dev/articles/the-jwt-algorithm-none-attack-the-vulnerability-in-1-line-of-code-d9g). One ESLint rule blocks the one-line catastrophe behind every Express login.
- **The whole family on one app:** [I Inherited a Codebase. One ESLint Run Found 26 Critical Security Bugs](https://ofriperetz.dev/articles/the-30-minute-security-audit-onboarding-a-new-codebase).
- **Map it to the standard:** [Mapping Your Codebase to the OWASP Top 10 With 247 ESLint Rules](https://ofriperetz.dev/articles/mapping-your-codebase-to-owasp-top-10-with-247-eslint-rules).

And the AI data that runs through this piece: [80 AI-written functions came back 65-75% vulnerable](https://ofriperetz.dev/articles/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities) — different assistants, different frameworks, the same category of omission, all caught by static analysis that knows the framework.

---

## Links

- 📦 [npm: eslint-plugin-express-security](https://www.npmjs.com/package/eslint-plugin-express-security)
- 📖 [Full rule docs (per-rule CWE + examples)](https://eslint.interlace.tools/docs/security/plugin-express-security/rules)
- 💻 [Source on GitHub](https://github.com/ofri-peretz/eslint/tree/main/packages/eslint-plugin-express-security)

::dev-to-cta{url="https://github.com/ofri-peretz/eslint"}
⭐ Star on GitHub if your Express app is missing any of the above.
::

Run `configs.recommended` on two things and reply with both counts: your oldest Express service, and the next `app.ts` your AI assistant generates. Which gap surprised you — the missing Helmet, the unbounded body, the redirect that looked like a feature? Drop the rule name and the service age in the comments.

---

*[eslint-plugin-express-security](https://www.npmjs.com/package/eslint-plugin-express-security) is part of the [Interlace ESLint ecosystem](https://eslint.interlace.tools). Source on [GitHub](https://github.com/ofri-peretz/eslint) · Follow: [Dev.to/ofri-peretz](https://dev.to/ofri-peretz)*
