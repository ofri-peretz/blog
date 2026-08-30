---
title: "The Express.js Vulnerability Is the Middleware You Forgot — 14 ESLint Rules That Catch What Isn't There"
description: "No helmet, a CORS origin that reflects the caller, an unbounded req.body, a redirect that echoes user input — four Express apps with nothing wrong on screen. The install, the flat config, and the 14 CWE-mapped ESLint rules that catch the missing middleware in CI."
slug: "getting-started-with-eslint-plugin-express-security"
canonical_url: "https://ofriperetz.dev/articles/getting-started-with-eslint-plugin-express-security"
tier: "TUTORIAL"
devto_url: "https://dev.to/ofri-peretz/getting-started-with-eslint-plugin-express-security-2fb8"
devto_id: 3144099
published_at: "2026-01-02T19:40:18Z"
edited_at: "2026-02-05T05:33:03Z"
cover_image: "https://ofriperetz.dev/cdn/blog-cover-image/getting-started-with-eslint-plugin-express-security.jpg?v=b2"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/getting-started-with-eslint-plugin-express-security-og.jpg?v=b2"
reading_time_minutes: 10
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
series: "The Hardened Stack"
---

This Express app is vulnerable four separate ways. There is not one line in it you could point at in review.

```ts
const app = express(); // no helmet()       → CWE-693
app.use(cors({ origin: true, credentials: true })); // reflected origin  → CWE-942
app.use(express.json()); // no size limit     → CWE-400
app.post("/transfer", (req, res) => transfer(req.body)); // no CSRF guard     → CWE-352
```

Every one of those is an **absence**. A diff shows you what changed; it cannot show you the middleware nobody wrote. That is why this class of bug survives review, survives the test suite (the test sends a well-formed request from a trusted origin), and then survives all the way to production — unless you run [static analysis](https://ofriperetz.dev/articles/static-analysis-vs-sast-vs-linting) that knows what an Express app is supposed to have.

`eslint-plugin-express-security` reads that same file and fires on the gaps. Below: what each absence costs, which rule catches it, and the two steps that put all 14 rules on your next push. Setup, from `npm install` to a red pipeline, takes about a minute.

> **The Hardened Stack series** · [`eslint-plugin-node-security`](https://ofriperetz.dev/articles/getting-started-eslint-plugin-node-security) → **`eslint-plugin-express-security` (you are here)** → [`eslint-plugin-nestjs-security`](https://ofriperetz.dev/articles/nestjs-guards-pipes-throttlers-6-eslint-rules) → [`eslint-plugin-jwt-security`](https://ofriperetz.dev/articles/getting-started-eslint-plugin-jwt-security). Express is the HTTP layer; `node-security` is the standard-library floor underneath it.

---

## Finding 1: Missing security headers (`require-helmet`, CWE-693)

**The vulnerable code:**

```ts
const app = express();
app.use(express.json());
app.post("/transfer", (req, res) => transfer(req.body));
app.listen(3000);
```

**Why it survived review:** A reviewer reads four clean lines, sees a working POST endpoint, and approves. Nothing on screen is wrong. The dangerous part is the lines that aren't there — no `helmet()` means the response ships without `X-Frame-Options` (clickjacking), `X-Content-Type-Options` (MIME-sniffing), `Strict-Transport-Security` (HTTPS enforcement), or a CSP. You can't review code that was never written, and a test for "did we forget Helmet?" is one nobody writes. The rule files it under [CWE-693](https://ofriperetz.dev/articles/cwe-taxonomy-explained), Protection Mechanism Failure — the weakness class for a defense that was available and simply not switched on.

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

## Finding 2: CORS that reflects the caller's origin (`no-cors-credentials-wildcard` + `no-permissive-cors`, CWE-942)

**The vulnerable code:**

```ts
app.use(cors({ origin: "*", credentials: true })); // fails loudly
app.use(cors({ origin: true, credentials: true })); // fails silently — this is the dangerous one
```

**Why it survived review:** The first line is the one everybody expects to be wrong, and browsers do reject it — the spec forbids `Access-Control-Allow-Origin: *` alongside credentials, so the requests simply break. What happens next is the actual vulnerability. Someone debugs the broken feature, finds that the `cors` package accepts `origin: true`, sets it, and the feature works again. `origin: true` means _reflect whatever origin asked_ — so every site on the internet is now an allowed origin, with the victim's cookies attached. The diff reads `- "*"` / `+ true`. It looks like a fix. It is the hole.

**The fix:**

```ts
// Option 1: Public API — no cookies, no credentials, wildcard is honest.
// The rule flags this anyway (see below), so make the exception explicit:
// eslint-disable-next-line express-security/no-permissive-cors -- public read-only API, no credentials
app.use(cors({ origin: "*" }));

// Option 2: Credentialed requests — explicit allowlist, never reflection
const ALLOWED_ORIGINS = [
  "https://app.yourdomain.com",
  "https://admin.yourdomain.com",
];
app.use(
  cors({
    origin: (origin, cb) => cb(null, ALLOWED_ORIGINS.includes(origin ?? "")),
    credentials: true,
  }),
);
```

`no-cors-credentials-wildcard` catches the wildcard-plus-credentials form; `no-permissive-cors` catches the reflected form _and_ a bare `origin: "*"`, credentials or not. That second part is why Option 1 carries a disable comment: the browser only rejects `*` when credentials ride along, but the rule rejects `*` full stop. It is enforcing policy rather than the spec — "public, no cookies" is how most APIs describe themselves right up until someone adds a session, and at that moment the wildcard becomes the credential leak with nobody having touched the CORS line. If your API really is public, the disable comment is how you say so: one reviewable line naming the assumption, instead of a config that quietly stops being true. Two rules, because the two mistakes arrive at different times — one at design, one during the debugging that follows.

---

## Finding 3: State-changing route with no CSRF guard and no body cap (`require-csrf-protection` + `require-express-body-parser-limits`, CWE-352 / CWE-400)

**The vulnerable code:**

```ts
app.post("/transfer", async (req, res) => {
  await db.transfers.create(req.body); // req.body is attacker-controlled
  res.json({ ok: true });
});
```

**Why it survived review:** The line reads like a feature: "accept the transfer payload and persist it." The danger is invisible — no CSRF token check means any site can forge this POST from a victim's browser, using the victim's cookies, and your server will execute it. It also misses a body-size cap, so a 2 GB JSON body is a free denial-of-service. Both look like omissions, not bugs. Both survive a diff. `require-csrf-protection` carries a declared [CVSS](https://ofriperetz.dev/articles/cvss-scores-explained) of 8.8 — the highest in the plugin.

**The fix:**

```ts
import { doubleCsrf } from "csrf-csrf";

const { doubleCsrfProtection } = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET!,
  getSessionIdentifier: (req) => req.session.id,
});

app.use(express.json({ limit: "100kb" })); // bounded body
app.use(doubleCsrfProtection); // forged-request guard

app.post("/transfer", async (req, res) => {
  // token already verified by the middleware above
  await db.transfers.create(req.body);
  res.json({ ok: true });
});
```

One note before you copy that: the old standard here was `csurf`, and `csurf` was deprecated in 2022. `csrf-csrf` is the maintained double-submit-cookie replacement, and the rule accepts it — it matches any middleware identifier containing `csrf`, so `doubleCsrfProtection` satisfies it, as does `lusca.csrf()` or your own `csrfMiddleware`. The rule's _own_ fix hint, however, still tells you to install `csurf`. I wrote that hint. It is on the list.

---

## Finding 4: Open redirect via `req.query` (`no-user-controlled-redirect`, CWE-601)

**The vulnerable code:**

```ts
app.get("/login", (req, res) => {
  // ...authenticate...
  res.redirect(req.query.returnUrl); // whatever the caller sent, we go there
});
```

**Why it survived review:** `returnUrl` is not a bug-shaped word. It is a convenience feature — "send the user back where they came from after login" — and it appears in the ticket, the design doc, and the acceptance criteria. What it actually is: a link on your domain, wearing your TLS certificate, that lands the user on the attacker's page. That is precisely what open redirects get used for in phishing — the link survives a domain check because the domain really is yours. It is also the kind of omission a coding assistant reproduces without hesitating: across [80 AI-written functions, 65–75% shipped carrying at least one vulnerability](https://ofriperetz.dev/articles/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities), and "reflect the parameter the caller sent" is a shape that satisfies every test you would think to write.

**The fix:**

```ts
// Resolve against an allowlist — never reflect raw input back into a Location header
const ALLOWED = new Set(["/dashboard", "/settings", "/profile"]);

app.get("/login", (req, res) => {
  const target = String(req.query.returnUrl ?? "");
  res.redirect(ALLOWED.has(target) ? target : "/dashboard");
});
```

**The neighbour this plugin does _not_ catch.** The sibling bug on that route is path traversal — `res.sendFile(path.join(__dirname, "uploads", req.params.name))`, which looks safe right up until `name` is `../../etc/passwd`. The fix is `path.basename()` before the join. But that is CWE-22, a filesystem weakness rather than an HTTP one, so it belongs to [`eslint-plugin-node-security`](https://ofriperetz.dev/articles/getting-started-eslint-plugin-node-security) (`detect-non-literal-fs-filename`, `no-arbitrary-file-access`), not here. A plugin that half-owns a weakness class is worse than one that clearly doesn't.

---

## Get it running (about a minute)

The six rules above — plus eight more — run before the code reaches review. One install, one config line, 14 CWE-mapped rules on every push.

**Step 1 — install:**

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

**Step 2 — flat config (`eslint.config.js`), pick one preset:**

```js
// `configs` is a NAMED export; the default export is the plugin object.
import { configs } from "eslint-plugin-express-security";

export default [
  configs.recommended, // all 14 — criticals at error, the noisier ones at warn
  // configs.strict,   // all 14, every rule at error
  // configs.api,      // 5-rule REST hardening set (helmet, CORS, CSRF, cookies, rate limit)
  // configs.graphql,  // introspection-in-production only
];
```

**Step 3 — run it.** Every finding carries the [CWE](https://ofriperetz.dev/articles/cwe-taxonomy-explained), the [OWASP Top 10](https://ofriperetz.dev/articles/owasp-top-10-explained) category, the [CVSS](https://ofriperetz.dev/articles/cvss-scores-explained) score, and the fix — on the line, not in a portal:

```text
src/routes/transfer.ts
  9:1  error  🔒 CWE-352 OWASP:A01-Broken CVSS:8.8 | Route handler for POST request lacks CSRF protection.
             Fix: Add CSRF middleware: app.use(csrf()) or use csurf package. Include csrfToken in forms.
```

That is the whole setup. No Express install, no running server, no build step: the plugin is **AST-based**, so it reads your `app.use(...)` chain and route definitions straight out of the source file. It recognises the standard middleware — `helmet`, `express-rate-limit`, `csurf`/`csrf-csrf`/`lusca`, `cors` — on `app` or on a router, and it fires the moment the pattern is absent.

---

## TL;DR

- **14 rules**, each carrying a declared CWE and CVSS, covering headers, CORS, CSRF, cookies, body limits, ReDoS routes, debug endpoints, GraphQL introspection, and open redirects.
- **4 presets**: `recommended` (all 14 — criticals at `error`; the rules with the widest [false-positive](https://ofriperetz.dev/articles/confusion-matrix-tp-fp-fn-tn) surface, rate-limiting and CSRF, default to `warn`) · `strict` (all 14 at `error`) · `api` (5-rule REST hardening set) · `graphql` (introspection-in-production only).
- **Flat config**, CommonJS, ESLint `8 || 9 || 10`, Node `>= 18`. AST-based — it lints source; no runtime peers, no Express install needed.

Rule set and preset severities below are **v1.3.2, verified against the source on 2026-07-28**.

| Rule                                  | Catches                                 | CWE      | `recommended` |
| ------------------------------------- | --------------------------------------- | -------- | ------------- |
| `require-helmet`                      | App missing `helmet()` security headers | CWE-693  | error         |
| `require-rate-limiting`               | No rate limiter → brute force / DoS     | CWE-770  | warn          |
| `require-csrf-protection`             | State-changing route, no CSRF           | CWE-352  | warn          |
| `require-express-body-parser-limits`  | Body parser with no size `limit`        | CWE-400  | warn          |
| `no-express-unsafe-regex-route`       | ReDoS in a route pattern                | CWE-1333 | error         |
| `no-permissive-cors`                  | `origin: '*'` / reflected origin        | CWE-942  | error         |
| `no-cors-credentials-wildcard`        | Wildcard origin + credentials           | CWE-942  | error         |
| `no-insecure-cookie-options`          | Missing `Secure`/`HttpOnly`/`SameSite`  | CWE-614  | error         |
| `no-exposed-debug-endpoints`          | Debug routes reachable in prod          | CWE-489  | error         |
| `no-graphql-introspection-production` | Introspection enabled in prod           | CWE-200  | warn          |
| `no-user-controlled-redirect`         | `res.redirect()` of raw user input      | CWE-601  | error         |
| `no-missing-cors-check`               | Origin trusted without validation       | CWE-346  | warn          |
| `no-missing-csrf-protection`          | State change with no CSRF guard         | CWE-352  | warn          |
| `no-missing-security-headers`         | Response missing security headers       | CWE-693  | warn          |

---

## Compatibility

| Surface              | Support                                                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Package managers** | npm, yarn, pnpm, bun — plain dev dependency                                                                         |
| **Node**             | `>= 18.0.0`                                                                                                         |
| **ESLint**           | `^8.0.0 \|\| ^9.0.0 \|\| ^10.0.0`, flat config                                                                      |
| **Express**          | Detects Express 4/5 `app.use(...)` chains, route definitions, and `cors`/`helmet`/`csrf`/`express-rate-limit` usage |
| **Module system**    | CommonJS — loads from both `eslint.config.js` and `eslint.config.mjs`                                               |
| **Runtime peers**    | None — it lints source AST                                                                                          |
| **Oxlint**           | Loads under Oxlint's JS-plugin runner via the `interlace-express-security` port                                     |

---

## What it sees — and doesn't

- **Presence, not correctness.** `require-helmet` proves you called `helmet()`; it can't prove your `contentSecurityPolicy` is tight, or that your rate-limit `max` is sane. It removes the "we forgot entirely" failure mode, not the "our config is weak" one. That is a deliberate trade: "forgot entirely" has by far the higher [base rate](https://ofriperetz.dev/articles/base-rate-problem-explained) in real Express codebases, and it is the one a checkable rule can decide without guessing.
- **Structural checks, not [taint tracking](https://ofriperetz.dev/articles/taint-vs-heuristic-detection).** These rules match AST shapes — a missing `app.use`, an `origin: true`, a `res.redirect()` whose argument _is_ a `req.query` / `req.body` access. They do not follow a value through an assignment at all: `const url = req.query.url; res.redirect(url)` is not detected — same function, one line apart. The upside is [precision](https://ofriperetz.dev/articles/precision-recall-f1-for-static-analysis): a structural check either matches or it doesn't, so it rarely invents a finding. The cost is recall — every indirection is invisible, from a local variable to a helper three files away.
- **It reads the obvious wiring.** A bespoke homegrown CSRF layer it doesn't recognise may need an inline disable with a comment explaining why. That is the honest failure mode, and it is a one-line comment rather than a wrong result.

---

## Your turn

Point `configs.recommended` at your oldest Express service — the one nobody has touched in a year — and look only at the first finding it reports. My guess is `require-helmet`, because that one gets decided at project setup and then never revisited. Drop the rule name and roughly how old the service is in the comments; I want to know which absence ages worst.

---

## Context: where this fits the bigger picture

The "framework hands you the guard, you ship without it" failure shows up at every layer of a Node stack, and each layer has its own rule set:

- **The floor underneath:** [Node.js Security Bugs That Pass Code Review Every Day](https://ofriperetz.dev/articles/getting-started-eslint-plugin-node-security) — crypto, `child_process`, `fs`, and the path traversal from Finding 4.
- **The framework above:** [NestJS Security Bugs Your Decorators Hide From Code Review](https://ofriperetz.dev/articles/nestjs-guards-pipes-throttlers-6-eslint-rules) — six-rule sibling set, same absence-of-middleware failure, one abstraction layer up.
- **The auth layer:** [Your AI Assistant Just Re-Added a 10-Year-Old JWT Bypass](https://ofriperetz.dev/articles/the-jwt-algorithm-none-attack-the-vulnerability-in-1-line-of-code-d9g) — one rule blocks the one-line catastrophe behind every Express login.
- **The protocol that runs all of them:** [The 30-Minute Security Audit](https://ofriperetz.dev/articles/the-30-minute-security-audit-onboarding-a-new-codebase), and [what it found on a real inherited codebase](https://ofriperetz.dev/articles/i-inherited-a-nestjs-codebase-the-first-lint-run-found-6-vulnerabilities).
- **Map it to the standard:** [I Mapped the OWASP Top 10 to ESLint Rules](https://ofriperetz.dev/articles/mapping-your-codebase-to-owasp-top-10-with-247-eslint-rules) — including the two categories no linter can honestly claim.

For how this slot compares to everything else competing for it, I benchmarked the field against a hand-labelled [ground-truth corpus](https://ofriperetz.dev/articles/ground-truth-in-security-testing) in [Benchmark: 17 ESLint Security Plugins Compared](https://ofriperetz.dev/articles/benchmark-17-eslint-security-plugins-compared).

> **The Hardened Stack** · [`eslint-plugin-node-security` ←](https://ofriperetz.dev/articles/getting-started-eslint-plugin-node-security) | **`eslint-plugin-express-security` (current)** | [`eslint-plugin-nestjs-security` →](https://ofriperetz.dev/articles/nestjs-guards-pipes-throttlers-6-eslint-rules) | [`eslint-plugin-jwt-security` →](https://ofriperetz.dev/articles/getting-started-eslint-plugin-jwt-security). If your Express app also touches the filesystem or `child_process`, read the node-security floor next — it owns the CWE-22 half of Finding 4.

---

## Links

- 📦 [npm: eslint-plugin-express-security](https://www.npmjs.com/package/eslint-plugin-express-security)
- 📖 [Full rule docs (per-rule CWE + examples)](https://eslint.interlace.tools/docs/security/plugin-express-security/rules)
- 💻 [Source on GitHub](https://github.com/ofri-peretz/eslint/tree/main/packages/eslint-plugin-express-security)

::dev-to-cta{url="https://www.npmjs.com/package/eslint-plugin-express-security"}
📦 `npm install --save-dev eslint-plugin-express-security` — 14 rules, one config line, running on your next push.
::

---

_[eslint-plugin-express-security](https://www.npmjs.com/package/eslint-plugin-express-security) is part of the [Interlace ESLint ecosystem](https://eslint.interlace.tools). Source on [GitHub](https://github.com/ofri-peretz/eslint) · Follow: [Dev.to/ofri-peretz](https://dev.to/ofri-peretz)_
