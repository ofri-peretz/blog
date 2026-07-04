---
title: "Your Express App Has No Helmet, No Rate Limit, and a ReDoS in Its Routes. 14 ESLint Rules Catch the Middleware You Forgot."
description: "Express ships nothing by default — no security headers, no rate limit, no CSRF, no body-size cap — and a route regex can DoS the event loop. The same blank skeleton your AI assistant generates. 14 CWE-mapped ESLint rules that catch the middleware you forgot, in CI."
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
  - "eslint"
  - "express"
  - "security"
  - "ai"
author:
  name: "Ofri Peretz"
  username: "ofri-peretz"
  avatar: "https://media2.dev.to/dynamic/image/width=640,height=640,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Fuser%2Fprofile_image%2F3669992%2F50a1f256-472c-48a1-85e8-149459647ea7.png"
  twitter: "ofriperetzdev"
series: "Server-Side Hardening"
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

**Why this survives code review:** a diff only shows the lines that changed. The
dangerous part of this file is the lines that aren't there. A reviewer reads four
clean lines, sees a working endpoint, and approves — because nothing on screen is
wrong. You can't review code that was never written. That's also exactly why
**AI assistants reproduce this skeleton verbatim**: ask Claude, Copilot, or
Gemini to "set up an Express server" and you get `app.use(express.json())` and a
route — never `helmet()`, never a rate limiter, never a body `limit`. The model
optimizes for "runs," not "hardened," and the hardening middleware is invisible
to a reviewer scanning a green diff.

This isn't a hunch. When I had Claude write 80 Node.js functions with no
security context,
[two out of every three shipped a vulnerability — 65-75%, consistent across Haiku 3.5, Sonnet 4.5, and Opus 4.5/4.6](https://ofriperetz.dev/articles/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities);
paying for the smartest model didn't move the number. And when I gave Claude one
prompt for a NestJS service, TypeScript compiled it clean and I'd have approved
it in review —
[then the linter found 6 security holes in 3 seconds](https://ofriperetz.dev/articles/claude-wrote-nestjs-service-eslint-found-6-security-holes),
including a route with no rate limit and an endpoint with no guard: the exact
omissions you'll see below, one framework over. Express is where this shows up
first, because the unopinionated skeleton _is_ the path of least resistance the
model takes. So the real test for these rules isn't your hand-written code —
it's the next `app.ts` your assistant generates. Point `recommended` at it
before you point it at your legacy services.

`eslint-plugin-express-security` writes the missing test for you. It's **14 rules**
(`v1.2.3`) that read your Express app and fail CI when the hardening middleware is
missing — or when a route pattern hides a ReDoS, or a redirect trusts user input —
each pinned to a CWE.

This guide covers the "middleware you forgot" rules, the regex that DoS-es your
event loop, the open redirect AI loves to write, the full 14-rule map, and exact
install/engine support.

---

## TL;DR

- **14 rules**, each carrying a `CWE` id and CVSS — the hardening middleware you
  forgot, a ReDoS in a route, an open redirect, CORS/cookie/CSRF defaults.
- **4 presets**: `recommended` (all 14; criticals are `error`, the
  easy-to-false-positive ones like rate-limit and CSRF default to `warn`) and
  `strict` (all 14 at `error`), plus `api` (5 rules — the REST hardening set:
  Helmet, CORS, CSRF, cookie flags, rate-limit) and `graphql` (1 rule —
  introspection in production).
- **Flat-config**, CommonJS, ESLint `8 || 9 || 10`, Node `>= 18`. AST-based —
  it reads your `app.use(...)` chain and route definitions; no Express install
  or running server required.

Install it now and let it grade the skeleton above:

```bash
npm install --save-dev eslint-plugin-express-security
```

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

## The open redirect your AI writes for you — `no-user-controlled-redirect`

Ask an assistant for a login flow with a "return to where you came from"
parameter and you reliably get this:

```ts
// ❌ no-user-controlled-redirect (CWE-601, open redirect)
app.get("/login", (req, res) => res.redirect(req.query.returnUrl));
```

`req.query.returnUrl` is attacker-controlled, so `?returnUrl=https://evil.tld`
turns your trusted domain into a phishing launch pad. It survives review for the
same reason as the missing middleware: the line looks like a feature ("we
support deep-link return"), not a hole. The rule fires on the AST shape
`res.redirect(req.<query|params|body>.*)` and passes when you allow-list:

```ts
// ✅ resolve against a known set — never reflect raw input
const ALLOWED = new Set(["/dashboard", "/settings"]);
app.get("/login", (req, res) =>
  res.redirect(ALLOWED.has(req.query.returnUrl) ? req.query.returnUrl : "/dashboard"),
);
```

This rule, plus `no-missing-cors-check` (CWE-346), `no-missing-csrf-protection`
(CWE-352), and `no-missing-security-headers` (CWE-693), is part of why the set
grew from its original 10 to **14** — the last three migrated in from
`eslint-plugin-browser-security` once it was clear they check server-side Express
wiring, not browser APIs.

---

## The rest of the surface

| Concern                                                | Rule                                  | CWE     |
| ------------------------------------------------------ | ------------------------------------- | ------- |
| Wildcard CORS origin                                   | `no-permissive-cors`                  | CWE-942 |
| CORS `origin:*` **with** credentials (forbidden combo) | `no-cors-credentials-wildcard`        | CWE-942 |
| Cookies without `Secure`/`HttpOnly`/`SameSite`         | `no-insecure-cookie-options`          | CWE-614 |
| Debug endpoints left enabled                           | `no-exposed-debug-endpoints`          | CWE-489 |
| GraphQL introspection on in production                 | `no-graphql-introspection-production` | CWE-200 |
| Origin header trusted without validation               | `no-missing-cors-check`               | CWE-346 |

---

## The full rule set

All 14, with each rule's declared CWE and its severity in the `recommended`
preset (`strict` sets every one to `error`):

| Rule                                  | Catches                                 | CWE      | `recommended` |
| ------------------------------------- | --------------------------------------- | -------- | ------------- |
| `require-helmet`                      | App missing `helmet()` security headers | CWE-693  | error         |
| `require-rate-limiting`               | No rate limiter → brute force / DoS     | CWE-770  | warn          |
| `require-csrf-protection`             | State-changing route, no CSRF           | CWE-352  | warn          |
| `require-express-body-parser-limits`  | Body parser with no size `limit`        | CWE-400  | warn          |
| `no-express-unsafe-regex-route`       | ReDoS in a route pattern                | CWE-1333 | error         |
| `no-permissive-cors`                  | `origin: '*'` / reflected origin        | CWE-942  | error         |
| `no-cors-credentials-wildcard`        | wildcard origin + credentials           | CWE-942  | error         |
| `no-insecure-cookie-options`          | missing `Secure`/`HttpOnly`/`SameSite`  | CWE-614  | error         |
| `no-exposed-debug-endpoints`          | debug routes reachable in prod          | CWE-489  | error         |
| `no-graphql-introspection-production` | introspection enabled in prod           | CWE-200  | warn          |
| `no-user-controlled-redirect`         | `res.redirect()` of raw user input      | CWE-601  | error         |
| `no-missing-cors-check`               | Origin trusted without validation       | CWE-346  | warn          |
| `no-missing-csrf-protection`          | State change with no CSRF guard          | CWE-352  | warn          |
| `no-missing-security-headers`         | response missing security headers       | CWE-693  | warn          |

---

## Install and run it in CI

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
  configs.recommended, // all 14, criticals at error
  // configs.strict,    // all 14, every rule at error
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
| **Oxlint**           | Loads under Oxlint's JS-plugin runner via the `interlace-express-security` port, with ESLint↔Oxlint parity gated in CI. The full 14-rule set runs on ESLint today. |

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
in a route, the open redirect, the CORS/cookie/CSRF defaults — each finding tagged
with a CWE and CVSS. It's the Express member of the
[Interlace](https://eslint.interlace.tools) family, one plugin per framework so
each rule knows its target SDK instead of pattern-matching every `.query()` or
`.redirect()` blindly.

**Series: Server-Side Hardening.** This is the Express entry. The same "the
framework hands you the guard, you ship without it" failure shows up at every
layer of a Node stack — and AI assistants reintroduce it at every one:

- **Next up — the framework above:** [NestJS Hands You Guards, Pipes, and Throttlers — You Ship Controllers Without Them](https://ofriperetz.dev/articles/nestjs-guards-pipes-throttlers-6-eslint-rules). Same absence-of-middleware failure; its 6-rule set is the direct sibling of these 14.
- **The auth layer behind your routes:** [The JWT `alg:none` Attack — Change One Header Field, Forge an Admin Token](https://ofriperetz.dev/articles/the-jwt-algorithm-none-attack-the-vulnerability-in-1-line-of-code-d9g). One ESLint rule blocks the one-line catastrophe sitting behind every Express login.
- **The whole family on one app:** [I Inherited a Codebase. One ESLint Run Found 26 Critical Security Bugs](https://ofriperetz.dev/articles/the-30-minute-security-audit-onboarding-a-new-codebase) — what running this entire ecosystem looks like on a real, inherited service.
- **Map it to the standard:** [Mapping Your Codebase to the OWASP Top 10 With 247 ESLint Rules](https://ofriperetz.dev/articles/mapping-your-codebase-to-owasp-top-10-with-247-eslint-rules) — where these 14 Express CWEs land in the bigger coverage picture.

And the AI thread that runs through this piece runs through the whole series:
[Claude wrote a NestJS service, TypeScript was happy, ESLint found 6 holes](https://ofriperetz.dev/articles/claude-wrote-nestjs-service-eslint-found-6-security-holes)
and [80 AI-written functions came back 65-75% vulnerable](https://ofriperetz.dev/articles/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities) —
different assistants, different frameworks, the same category of omission, all
caught by static analysis that knows the framework. If you want the full
cross-model picture: [we ranked 5 AI models by security and the leaderboard is
wrong](https://ofriperetz.dev/articles/we-ranked-5-ai-models-by-security-the-leaderboard-is-wrong),
and [aggregate benchmarks lie — here's what 700 AI-generated functions look like
by security domain](https://ofriperetz.dev/articles/aggregate-benchmarks-lie-heres-what-700-ai-functions-look-like-by-security-domain).
For a head-to-head comparison of every plugin competing for the Express-security
slot, see [benchmark: 17 ESLint security plugins
compared](https://ofriperetz.dev/articles/benchmark-17-eslint-security-plugins-compared).

---

## Links

- 📦 [npm: eslint-plugin-express-security](https://www.npmjs.com/package/eslint-plugin-express-security)
- 📖 [Full rule docs (per-rule CWE + examples)](https://eslint.interlace.tools/docs/security/plugin-express-security/rules)
- 💻 [Source on GitHub](https://github.com/ofri-peretz/eslint/tree/main/packages/eslint-plugin-express-security)

::dev-to-cta{url="https://github.com/ofri-peretz/eslint"}
⭐ Star on GitHub if your Express app is missing any of the above.
::

Run `configs.recommended` on two things and reply with both counts: your oldest
Express service, and the next `app.ts` your AI assistant generates. Which rule
fired that you'd have sworn was already handled — the missing Helmet, the
unbounded body, or the redirect someone (or something) wrote and nobody
re-reviewed? Drop the count and the rule in the comments — I read every one, and
the war stories are how I find the next rule worth writing.

---

I'm **Ofri Peretz**, a security engineering leader and the author of the
Interlace ESLint ecosystem — domain-specific static analysis for security,
reliability, and performance on the Node.js stack. `eslint-plugin-express-security`
is its Express layer.

[ofriperetz.dev](https://ofriperetz.dev) · [LinkedIn](https://linkedin.com/in/ofri-peretz) · [GitHub](https://github.com/ofri-peretz)
