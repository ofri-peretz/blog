---
title: "JWT Vulnerabilities Your Code Review Approves Every Day — 13 ESLint Rules Stop Them in CI"
description: "alg:none token forgery, RS256↔HS256 confusion, weak/hardcoded secrets, missing exp/iss/aud — the JWT auth mistakes that hand attackers a valid session. 13 CWE-mapped ESLint rules that catch them in CI."
slug: "getting-started-eslint-plugin-jwt"
canonical_url: "https://ofriperetz.dev/articles/getting-started-eslint-plugin-jwt"
devto_url: "https://dev.to/ofri-peretz/getting-started-with-eslint-plugin-jwt-4l4p"
devto_id: 3143580
published_at: "2026-01-02T15:17:19Z"
edited_at: "2026-01-11T10:21:39Z"
cover_image: "https://ofriperetz.dev/og/cover/getting-started-eslint-plugin-jwt"
social_image: "https://ofriperetz.dev/og/article/getting-started-eslint-plugin-jwt"
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
series: "The Hardened Stack"
---

Five JWT vulnerabilities. Every one merged. Every one passed a human code review. All five fail CI in under a second with `eslint-plugin-jwt`.

Here's what actually happened — and the guard that catches all of it.

---

## Vulnerability 1: The `alg:none` attack (CWE-347)

**The vulnerable code that shipped:**

```ts
jwt.verify(token, secret, { algorithms: ["HS256", "none"] });
```

**Why it survived review.** Nobody writes `algorithms: ["none"]` on purpose. This line arrived honestly: a dev was debugging tokens from a service that didn't sign its dev tokens, added `"none"` to unblock themselves locally, and the diff went up with `HS256` sitting right next to it. The reviewer sees a real algorithm in the list, sees `jwt.verify` being called, and approves. The array reads as "we accept HS256, and also this other thing" — not as "we accept forged tokens." A human skims the shape; a CWE-tagged lint rule reads every element.

**`alg: "none"` means "no signature."** On `jsonwebtoken` specifically, this line forges the moment `secret` is *also* falsy — an unset env var, a per-tenant lookup that silently returns `undefined` for an unrecognized tenant. With a real, truthy secret, modern `jsonwebtoken` still throws `jwt signature is required` — I verified this directly. So on a codebase already running `jsonwebtoken` 9.x with real secrets everywhere, `no-algorithm-none` is defense-in-depth against a downgrade or a library swap, not a live bug today — that's still worth CI blocking, because "everywhere" is doing a lot of work in that sentence. Libraries that don't guard the falsy-secret case, or that trust the token's own header by default, don't even need that: `"none"` in the accepted algorithms is enough on its own. It's the bug behind CVE-2022-23540 — technically the narrower case of an implicit, unlisted `"none"` plus a falsy secret, not the explicit list shown above, but the same root failure either way.

**The rule that catches it — `no-algorithm-none` (CWE-347):**

```text
src/auth.ts
  15:3  error  🔒 CWE-347 | jwt/no-algorithm-none — Using alg:"none" bypasses
               signature verification, allowing token forgery | CRITICAL
               Fix: Remove "none" and use RS256, ES256, or other secure algorithms
```

The match is case-insensitive — `"None"`, `"NONE"`, `"nOnE"` all trip it, so string-casing tricks don't get you past this one.

**The fix:**

```ts
// ✅ allow only real algorithms
jwt.verify(token, secret, { algorithms: ["HS256"] });
```

See the full exploit walkthrough in [The JWT `algorithm: none` Attack — the vulnerability in one line of code](https://ofriperetz.dev/articles/the-jwt-algorithm-none-attack-the-vulnerability-in-1-line-of-code-d9g).

---

## Vulnerability 2: Algorithm confusion — RS256 public key used as HMAC secret (CWE-347)

**The vulnerable code that shipped:**

```ts
jwt.verify(token, publicKey);
```

**Why it survived review.** `jwt.verify` is being called. The public key is passed. Nothing looks wrong unless you know the algorithm handshake: if no `algorithms` option is set, an attacker takes your RS256 public key (it's public — they already have it), signs a token with it using HS256, and — on a library that treats the key as an HMAC secret without checking its type — the forged token is accepted. The attack is invisible at the call site.

Modern `jsonwebtoken` closes this one on its own — but it took two separate fixes, years apart, on two different mechanisms, and the first one is narrower than it looks. I diffed the published source between [4.2.1](https://unpkg.com/jsonwebtoken@4.2.1/index.js) and [4.2.2](https://unpkg.com/jsonwebtoken@4.2.2/index.js) directly: 4.2.1 already defaults to `['RS256','RS384','RS512','ES256','ES384','ES512']` when the key string contains `BEGIN CERTIFICATE` or `BEGIN PUBLIC KEY` (PKCS#8) — that part predates the fix. What 4.2.2 actually adds, for CVE-2015-9235 ([GHSA-c7hr-j4mj-j2w6](https://github.com/advisories/GHSA-c7hr-j4mj-j2w6)), is a narrower middle branch: a key matching `BEGIN RSA PUBLIC KEY` (the older PKCS#1 format) now defaults to `['RS256','RS384','RS512']` instead of falling through to HMAC. Before 4.2.2, that one specific PEM format — PKCS#1 RSA public keys, not PKCS#8 or certificates — was the gap: hand `jwt.verify` a PKCS#1 public key with no `algorithms` option, and pre-4.2.2 it defaulted to HMAC, letting an attacker sign a forged HS256 token with that public key as the "secret." Still a literal string match either way, not real key inspection — the robust fix, actual crypto-level key-type inspection via `createPublicKey(...).asymmetricKeyType` that doesn't care what string the key contains, landed later, in [9.0.0](https://github.com/auth0/node-jsonwebtoken/blob/master/CHANGELOG.md#900---2022-12-21) (CVE-2022-23541). Anything older than 9.0.0, and other JWT libraries that never added an equivalent check, are exactly where this attack still lands — and a reviewer reading the call site has no way to know which fix, if any, the running version actually has. Pin the algorithm anyway; don't let a decade of layered library patches be the only thing standing between this call and a forged token.

Worth being precise about which rule actually fires here: the call site above is caught by `require-algorithm-whitelist` (CWE-757, "no explicit algorithms list"), not by `no-algorithm-confusion` in the table below. `no-algorithm-confusion` is the narrower rule — it fires when it can tell from naming or shape that you're holding a public key at all; `require-algorithm-whitelist` fires on any unpinned `verify()` call regardless of what the key looks like, which is why it's the one in the output here.

**The rule that catches it — `require-algorithm-whitelist` (CWE-757):**

```text
src/auth.ts
  2:10  error  🔒 CWE-757 | jwt/require-algorithm-whitelist — JWT verification
               without explicit algorithms trusts the token header | HIGH
               Fix: pass an explicit algorithms list, e.g. { algorithms: ["RS256"] }
```

**The fix:**

```ts
// ✅ pin the algorithm so the key type can't be repurposed
jwt.verify(token, publicKey, { algorithms: ["RS256"] });
```

This is also the exact pattern AI assistants produce by default. I ran 20 generations across Gemini 3 Pro and Flash — 10 each — with the prompt "Write a Node.js function called `verifyToken` that takes a token string and verifies it." **All 20 came back with a bare `jwt.verify(token, secret)` with no `algorithms` option.** `require-algorithm-whitelist` fired on every single one. The model reproduces the median of its training data, and the median predates the `jsonwebtoken 9.0.0` fix.

Same failure mode I've measured at scale elsewhere: [Gemini 2.5 Pro wrote unsafe SQL 96% of the time](https://ofriperetz.dev/articles/three-sql-injection-patterns-node-postgres-eslint) on injection-prone patterns, and [65-75% of 80 Claude-written functions shipped with a security vulnerability](https://ofriperetz.dev/articles/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities). Auth config is squarely in that pattern, not an exception to it.

---

## Vulnerability 3: Hardcoded weak secret (CWE-798 + CWE-326)

**The vulnerable code that shipped:**

```ts
const token = jwt.sign({ userId: 123 }, "supersecret123", {
  algorithm: "HS256",
});
```

**Why it survived review.** `"supersecret123"` is clearly a placeholder — or so the reviewer assumes. It reads as "this will be replaced with an env var before prod." Sometimes it was replaced. Sometimes it shipped exactly as written, went into git history, and stayed there after the env var was added. The string in history is still a credential.

**The rules that catch it — `no-hardcoded-secret` (CWE-798) and `no-weak-secret` (CWE-326):**

```text
src/auth.ts
  1:38  error  🔒 CWE-798 | jwt/no-hardcoded-secret — Hardcoded JWT secret
               detected — use env var | CRITICAL
  1:38  error  🔒 CWE-326 | jwt/no-weak-secret — Weak JWT secret — minimum
               256 bits required | HIGH
```

**The fix:**

```ts
// ✅ secret from environment — length is now your responsibility, not the rule's
const token = jwt.sign({ userId: 123 }, process.env.JWT_SECRET!, {
  algorithm: "HS256",
  expiresIn: "1h",
});
```

The entropy argument ("it's a high-entropy string, it's fine") doesn't survive contact with a public git history. I made that case in [No Hardcoded Credentials: Entropy Isn't Enough](https://ofriperetz.dev/articles/no-hardcoded-credentials-entropy-isnt-enough). The rule is deliberately blunt: a JWT secret as a string literal is a finding, full stop.

---

## Vulnerability 4: `jwt.decode()` feeding an auth decision (CWE-345)

**The vulnerable code that shipped:**

```ts
// "quick helper" in a middleware
const payload = jwt.decode(token) as { role: string };
if (payload.role === "admin") { /* ... */ }
```

**Why it survived review.** `jwt.decode()` and `jwt.verify()` have nearly identical call sites. Someone needed the `userId` for a logging helper, reached for `decode()` because it doesn't need the secret, and returned the payload. In every test — with a token the test itself just minted — it works. The reviewer sees a function that reads a JWT and returns a user, backed by green tests, and approves. What no test exercises: `decode()` happily parses `{ "role": "admin" }` with a garbage signature and hands it back. The gap between "parsed the token" and "verified the token" is exactly one method name and zero failing tests.

**The rule that catches it — `no-decode-without-verify` (CWE-345):**

```text
src/middleware.ts
  3:18  error  🔒 CWE-345 | jwt/no-decode-without-verify — jwt.decode() does
               not verify signature — result must not reach auth decisions | HIGH
```

One case this rule flags on purpose that isn't actually a bug: reading a token's `kid` header to pick which key to verify with, before calling `verify()` separately. That's a legitimate JWKS key-selection pattern, and it still trips the rule, because the rule can't see the `verify()` call two lines down is coming — annotate it `@decoded-header-only` rather than treating the warning as noise to silence globally.

**The fix:**

```ts
// ✅ verify, don't decode, when the result is used for auth
const payload = jwt.verify(token, process.env.JWT_SECRET!, {
  algorithms: ["HS256"],
});
```

---

## Vulnerability 5: no audience check — one token, two services (CWE-287)

**The vulnerable code that shipped:**

```ts
// service-b/src/auth.ts
const payload = jwt.verify(token, process.env.JWT_SECRET!, {
  algorithms: ["HS256"],
});
```

**Why it survived review.** Service A mints a token for its own users. Service B shares the same signing secret — same team, same infra, same env var — and verifies with it. The call looks complete: algorithm pinned, signature checked, no red flags. Nobody asks the question that matters: *was this token minted for me?* I verified this directly — a token Service A issued with no `audience` claim passes Service B's verify call cleanly, because nothing in the call site checks which service the token was scoped to. Same secret, same algorithm, wrong service — and it's accepted.

**The rule that catches it — `require-audience-validation` (CWE-287):**

```text
service-b/src/auth.ts
  3:3  error  🔒 CWE-287 | jwt/require-audience-validation — JWT verification
              without an audience check accepts tokens scoped to other
              services | HIGH
```

**The fix:**

```ts
// ✅ scope the token to the service verifying it
const payload = jwt.verify(token, process.env.JWT_SECRET!, {
  algorithms: ["HS256"],
  audience: "service-b",
});
```

`require-issuer-validation` is the mirror case — same failure, opposite direction: nothing checks *who minted* the token, so a token from a lower-trust issuer (a staging environment, a partner API) verifies cleanly against a production secret it was never supposed to reach.

---

## Here's the guard that catches all of this in CI

```bash
npm install --save-dev eslint-plugin-jwt
```

[`eslint-plugin-jwt` on npm](https://www.npmjs.com/package/eslint-plugin-jwt) · [full rule docs](https://eslint.interlace.tools/docs/security/plugin-jwt)

```js
// eslint.config.js — `configs` is a NAMED export
import { configs } from "eslint-plugin-jwt";

export default [
  configs.recommended, // the standard set — covers all five vulnerabilities above
  // configs.strict,   // everything
  // configs.flagship, // the single highest-signal rule (no-algorithm-none) — same "flagship" tier used across every Interlace plugin, for CI gates that need one rule, not a typo
  // configs.legacy,   // relaxed for older jsonwebtoken setups
];
```

Run `eslint .`. The five patterns above fail the build immediately. The `alg:none` attack, the missing algorithm whitelist, the hardcoded secret, the bare `jwt.decode()`, and the missing audience check each produce a CWE-tagged error — before any of it reaches review.

`eslint-plugin-jwt` makes 13 categories of JWT auth failure — including the exact call shapes AI assistants default to — into build errors that never reach code review.

---

## The full rule set

All 13, each CWE-pinned:

| Rule                                                                                                | Catches                        | CWE     |
| --------------------------------------------------------------------------------------------------- | ------------------------------ | ------- |
| [`no-algorithm-none`](https://eslint.interlace.tools/docs/security/plugin-jwt/rules/no-algorithm-none) | `alg:none` signature bypass   | CWE-347 |
| [`no-algorithm-confusion`](https://eslint.interlace.tools/docs/security/plugin-jwt/rules/no-algorithm-confusion) | RS256↔HS256 key confusion | CWE-347 |
| [`no-decode-without-verify`](https://eslint.interlace.tools/docs/security/plugin-jwt/rules/no-decode-without-verify) | `jwt.decode()` used for auth | CWE-345 |
| [`require-algorithm-whitelist`](https://eslint.interlace.tools/docs/security/plugin-jwt/rules/require-algorithm-whitelist) | no explicit `algorithms` list | CWE-757 |
| [`no-weak-secret`](https://eslint.interlace.tools/docs/security/plugin-jwt/rules/no-weak-secret)   | brute-forceable HS256 secret   | CWE-326 |
| [`no-hardcoded-secret`](https://eslint.interlace.tools/docs/security/plugin-jwt/rules/no-hardcoded-secret) | signing secret in source     | CWE-798 |
| [`no-sensitive-payload`](https://eslint.interlace.tools/docs/security/plugin-jwt/rules/no-sensitive-payload) | PII in the (readable) payload | CWE-359 |
| [`require-expiration`](https://eslint.interlace.tools/docs/security/plugin-jwt/rules/require-expiration) | missing `exp` / `expiresIn`  | CWE-613 |
| [`require-issuer-validation`](https://eslint.interlace.tools/docs/security/plugin-jwt/rules/require-issuer-validation) | missing `iss` check      | CWE-287 |
| [`require-audience-validation`](https://eslint.interlace.tools/docs/security/plugin-jwt/rules/require-audience-validation) | missing `aud` check  | CWE-287 |
| [`require-issued-at`](https://eslint.interlace.tools/docs/security/plugin-jwt/rules/require-issued-at) | missing `iat`                | CWE-294 |
| [`require-max-age`](https://eslint.interlace.tools/docs/security/plugin-jwt/rules/require-max-age) | no `maxAge` on verify            | CWE-294 |
| [`no-timestamp-manipulation`](https://eslint.interlace.tools/docs/security/plugin-jwt/rules/no-timestamp-manipulation) | clock-skew / replay exposure | CWE-294 |

---

## The complete secure pattern

What passes all 13:

```ts
// Signing — pinned algorithm, bounded lifetime, scoped to iss/aud
const token = jwt.sign({ userId: 123 }, process.env.JWT_SECRET!, {
  algorithm: "HS256",
  expiresIn: "1h",
  issuer: "your-app",
  audience: "your-api",
});

// Verifying — explicit algorithms, validated claims, bounded age
const payload = jwt.verify(token, process.env.JWT_SECRET!, {
  algorithms: ["HS256"],
  issuer: "your-app",
  audience: "your-api",
  maxAge: "1h",
});
```

Passing all 13 rules is a lint-time property, not an architecture review — it's a different check than "should this shared secret exist at all." One HMAC secret shared across services means any service holding it can mint tokens the others will accept; `audience` narrows who a token is *for*, it doesn't stop whoever holds the secret from *minting* one. If Service A and Service B are separate trust boundaries, not just separate deployments of the same trust, the actual fix is asymmetric — RS256/ES256 with Service A holding the private key and every verifier holding only the public one.

---

## Compatibility

| Surface              | Support                                                                                                                                               |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Package managers** | npm, yarn, pnpm, bun                                                                                                                                  |
| **Node**             | `>= 18.0.0`                                                                                                                                           |
| **ESLint**           | `^8.0.0 \|\| ^9.0.0 \|\| ^10.0.0`, flat config                                                                                                        |
| **JWT libraries**    | detects `jsonwebtoken`'s `sign`/`verify`/`decode` and `jose`'s `SignJWT`/`jwtVerify` — reads source, no library pin. `jose`'s `decodeJwt` isn't in the decode-detection set yet, so `no-decode-without-verify` currently only fires on `jsonwebtoken`-shaped decode calls |
| **Module system**    | CommonJS — loads from both `eslint.config.js` and `eslint.config.mjs`                                                                                 |
| **Oxlint**           | Loads under Oxlint's JS-plugin runner via the `interlace-jwt` port, with ESLint↔Oxlint parity gated in CI. The full 13-rule set runs on ESLint today. |

---

## What it sees — and doesn't

- **Source patterns, not runtime tokens.** It flags `algorithms: ["none"]`, a missing `expiresIn`, a `jwt.decode()` feeding an auth check. It can't validate a token at runtime or prove your secret's entropy — it enforces that the _call_ is configured safely.
- **Pin the algorithm, then validate claims.** The rules push you toward the correct shape (explicit `algorithms` + `iss`/`aud`/`exp`/`maxAge`); the values are yours to set correctly.
- **Two rules worth knowing the actual limits of.** `no-algorithm-confusion` doesn't have runtime key-type knowledge — it recognizes "this looks like a public key" from naming and shape (`publicKey`, `.pem`, a PEM header string, `jwks`). Rename the argument and the rule can miss it. `no-decode-without-verify` flags every `decode()` call unconditionally, whether or not the payload actually reaches an auth check — it doesn't trace dataflow, because that's not a question an AST-level rule answers reliably. Annotate a header-only peek with `@decoded-header-only` and it steps aside; everything else it wants justified.
- **What's out of scope.** Key-*selection* attacks — a `kid` header used unsanitized in a file path or DB lookup, or a `jku`/`x5u` header pointed at an attacker-controlled JWKS endpoint — aren't rules in this set. They're a real, current class of JWT incident, and static analysis on the `verify()` call site doesn't see them; that's a key-retrieval-function problem, not a call-shape problem. Scoped out here, not solved.

This fits into the broader static-analysis onboarding protocol I use when auditing codebases: [The 30-Minute Security Audit: I Ran It on 140 Gemini-Written Functions. 102 Shipped Vulnerable.](https://ofriperetz.dev/articles/the-30-minute-security-audit-onboarding-a-new-codebase).

---

## Where this sits in the ecosystem

`eslint-plugin-jwt` is the dedicated JWT layer — signature bypass, algorithm confusion, secret strength, claim validation — each finding tagged with a CWE. Generic security plugins don't cover this layer; it's [one of the gaps I found benchmarking 17 of them](https://ofriperetz.dev/articles/benchmark-17-eslint-security-plugins-compared), and it maps onto [A02 and A07 of the OWASP Top 10](https://ofriperetz.dev/articles/mapping-your-codebase-to-owasp-top-10-with-247-eslint-rules). It pairs with [`eslint-plugin-express-security`](https://ofriperetz.dev/articles/getting-started-with-eslint-plugin-express-security) and [`eslint-plugin-nestjs-security`](https://ofriperetz.dev/articles/nestjs-guards-pipes-throttlers-6-eslint-rules) as the auth member of the **Hardened Stack** series.

> **The Hardened Stack** · [← `eslint-plugin-express-security`](https://ofriperetz.dev/articles/getting-started-with-eslint-plugin-express-security) | **`eslint-plugin-jwt` (current)** | [`eslint-plugin-nestjs-security` →](https://ofriperetz.dev/articles/nestjs-guards-pipes-throttlers-6-eslint-rules)

---

Run `configs.recommended` on your own auth code. Senior engineers who've been burned by a JWT bug: which incident sticks with you as the one that changed how you review auth code?

::dev-to-cta{url="https://github.com/ofri-peretz/eslint"}
⭐ Star on GitHub if one of these 13 rules just lit up a `verify` call you thought was safe.
::

---

*[eslint-plugin-jwt](https://www.npmjs.com/package/eslint-plugin-jwt) is part of the [Interlace ESLint ecosystem](https://eslint.interlace.tools). Source on [GitHub](https://github.com/ofri-peretz/eslint) · Follow: [Dev.to/ofri-peretz](https://dev.to/ofri-peretz) · [X @ofriperetzdev](https://x.com/ofriperetzdev)*
