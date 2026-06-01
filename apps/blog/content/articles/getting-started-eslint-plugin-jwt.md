---
title: "jsonwebtoken Will Verify a Token Signed With algorithm: none. These 13 ESLint Rules Stop It."
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
  - "eslint"
  - "jwt"
  - "security"
  - "authentication"
author:
  name: "Ofri Peretz"
  username: "ofri-peretz"
  avatar: "https://media2.dev.to/dynamic/image/width=640,height=640,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Fuser%2Fprofile_image%2F3669992%2F50a1f256-472c-48a1-85e8-149459647ea7.png"
  twitter: "ofriperetzdev"
series: "The Hardened Stack"
---

This one line is a full authentication bypass:

```ts
jwt.verify(token, secret, { algorithms: ["HS256", "none"] });
```

`alg: "none"` is a JWT header value that means "this token has no signature."
Allow it in your verify call and an attacker forges any token they like —
`{ "sub": "admin" }`, no signature, accepted. It's **CWE-347** (Improper
Verification of Cryptographic Signature), it's the bug behind CVE-2022-23540,
and `eslint-plugin-jwt` fails your build on it:

```text
src/auth.ts
  15:3  error  🔒 CWE-347 | Using alg:"none" bypasses signature verification, allowing token forgery | CRITICAL
              Fix: Remove "none" and use RS256, ES256, or other secure algorithms
```

That's the flagship rule. There are **12 more** — for algorithm confusion,
weak/hardcoded secrets, and every missing claim check that turns a "verified"
token into a forgeable one — each pinned to a CWE.

---

## TL;DR

- **13 rules**, each carrying a `CWE` id, covering the JWT auth surface:
  signature bypass, algorithm confusion, secret strength, and claim validation.
- **5 presets**: `flagship` (the `alg:none` rule), `recommended` (the standard
  set), `strict` / `all` (everything), and `legacy` (relaxed for older
  `jsonwebtoken` setups).
- **Flat-config**, CommonJS, ESLint `8 || 9 || 10`, Node `>= 18`. AST-based —
  it reads your `jwt.sign`/`jwt.verify`/`jwt.decode` calls; no runtime peer.

---

## The flagship: `no-algorithm-none` (CWE-347)

```ts
// ❌ no-algorithm-none — "none" disables signature verification
jwt.verify(token, secret, { algorithms: ["HS256", "none"] });
```

```ts
// ✅ allow only real algorithms
jwt.verify(token, secret, { algorithms: ["HS256"] });
```

The rule flags `"none"` anywhere in the `algorithms` array. Its fix message is
explicit: _remove `"none"` and use `RS256`, `ES256`, or another secure
algorithm._ This is the canonical JWT attack and the reason "we use JWTs" is
not the same as "our auth is safe."

---

## Algorithm confusion: `no-algorithm-confusion` (CWE-347)

The subtler cousin. If your server verifies with the algorithm list left open,
an attacker takes your **public** RS256 key (it's public!), signs a token with
it using **HS256**, and your server — treating the public key as an HMAC secret
— accepts it:

```ts
// ❌ no-algorithm-confusion — no pinned algorithm lets RS256 be verified as HS256
jwt.verify(token, publicKey);
```

```ts
// ✅ pin the algorithm so the key type can't be repurposed
jwt.verify(token, publicKey, { algorithms: ["RS256"] });
```

`require-algorithm-whitelist` (CWE-757) enforces that you always pass an
explicit `algorithms` list — the precondition that closes both attacks above.

---

## The claim checks that make "verified" mean something

A signature-valid token can still be expired, replayed, or minted for a
different service. These rules require the checks:

- `require-expiration` (CWE-613) — sign with `expiresIn`; a token with no `exp`
  is valid forever.
- `require-issuer-validation` / `require-audience-validation` (CWE-287) — verify
  `iss`/`aud` so a token minted for another service isn't accepted by yours.
- `require-max-age`, `require-issued-at`, `no-timestamp-manipulation` (CWE-294) —
  bound token age and guard the `iat`/clock-skew handling against replay.
- `no-decode-without-verify` (CWE-345) — `jwt.decode()` does **not** verify the
  signature; using its output for auth decisions trusts an unverified token.

## Secrets

- `no-weak-secret` (CWE-326) — an HS256 secret short enough to brute-force.
- `no-hardcoded-secret` (CWE-798) — the signing secret as a string literal.
- `no-sensitive-payload` (CWE-359) — PII in the payload (a JWT is base64, **not**
  encrypted — anyone can read it).

---

## The full rule set

All 13, with each rule's declared CWE:

| Rule                          | Catches                       | CWE     |
| ----------------------------- | ----------------------------- | ------- |
| `no-algorithm-none`           | `alg:none` signature bypass   | CWE-347 |
| `no-algorithm-confusion`      | RS256↔HS256 key confusion     | CWE-347 |
| `no-decode-without-verify`    | `jwt.decode()` used for auth  | CWE-345 |
| `require-algorithm-whitelist` | no explicit `algorithms` list | CWE-757 |
| `no-weak-secret`              | brute-forceable HS256 secret  | CWE-326 |
| `no-hardcoded-secret`         | signing secret in source      | CWE-798 |
| `no-sensitive-payload`        | PII in the (readable) payload | CWE-359 |
| `require-expiration`          | missing `exp` / `expiresIn`   | CWE-613 |
| `require-issuer-validation`   | missing `iss` check           | CWE-287 |
| `require-audience-validation` | missing `aud` check           | CWE-287 |
| `require-issued-at`           | missing `iat`                 | CWE-294 |
| `require-max-age`             | no `maxAge` on verify         | CWE-294 |
| `no-timestamp-manipulation`   | clock-skew / replay exposure  | CWE-294 |

---

## The complete secure pattern

What passes all 13:

```ts
// Signing — pinned algorithm, bounded lifetime, scoped to iss/aud
const token = jwt.sign({ userId: 123 }, process.env.JWT_SECRET, {
  algorithm: "HS256",
  expiresIn: "1h",
  issuer: "your-app",
  audience: "your-api",
});

// Verifying — explicit algorithms, validated claims, bounded age
const payload = jwt.verify(token, process.env.JWT_SECRET, {
  algorithms: ["HS256"],
  issuer: "your-app",
  audience: "your-api",
  maxAge: "1h",
});
```

---

## Install

```bash
# npm
npm install --save-dev eslint-plugin-jwt
# yarn
yarn add --dev eslint-plugin-jwt
# pnpm
pnpm add --save-dev eslint-plugin-jwt
# bun
bun add --dev eslint-plugin-jwt
```

Flat config (`eslint.config.js`):

```js
// `configs` is a NAMED export; the default export is the plugin object.
import { configs } from "eslint-plugin-jwt";

export default [
  configs.recommended, // the standard set
  // configs.strict,    // everything
  // configs.flagship,  // just no-algorithm-none
  // configs.legacy,    // relaxed for older jsonwebtoken setups
];
```

---

## Compatibility

| Surface              | Support                                                                                                                                               |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Package managers** | npm, yarn, pnpm, bun — plain dev dependency                                                                                                           |
| **Node**             | `>= 18.0.0`                                                                                                                                           |
| **ESLint**           | `^8.0.0 \|\| ^9.0.0 \|\| ^10.0.0`, flat config                                                                                                        |
| **JWT libraries**    | detects `jsonwebtoken` and `jose` call shapes (`sign`/`verify`/`decode`) — reads source, no library pin                                               |
| **Module system**    | CommonJS — loads from both `eslint.config.js` and `eslint.config.mjs`                                                                                 |
| **Oxlint**           | Loads under Oxlint's JS-plugin runner via the `interlace-jwt` port, with ESLint↔Oxlint parity gated in CI. The full 13-rule set runs on ESLint today. |

---

## What it does — and doesn't — see

- **Source patterns, not runtime tokens.** It flags `algorithms: ["none"]`, a
  missing `expiresIn`, a `jwt.decode()` feeding an auth check. It can't validate
  a token at runtime or prove your secret's entropy — it enforces that the
  _call_ is configured safely.
- **Pin the algorithm, then validate claims.** The rules push you toward the
  one correct shape (explicit `algorithms` + `iss`/`aud`/`exp`/`maxAge`); the
  values are yours to set correctly.

For a worked exploit of the headline bug, see the companion piece
[The JWT `algorithm: none` Attack — the vulnerability in one line of code](https://dev.to/ofri-peretz/the-jwt-algorithm-none-attack-the-vulnerability-in-1-line-of-code-d9g).

---

## Where this sits in the ecosystem

Generic linters don't know what `jwt.verify` or an `algorithms` array _is_.
`eslint-plugin-jwt` is the dedicated JWT layer — signature bypass, algorithm
confusion, secret strength, claim validation — each finding tagged with a CWE.
It's the auth member of the [Interlace](https://eslint.interlace.tools) family,
complementary to the generic set and the other server-side plugins
(`eslint-plugin-express-security`, `eslint-plugin-nestjs-security`, …).

---

## Links

- 📦 [npm: eslint-plugin-jwt](https://www.npmjs.com/package/eslint-plugin-jwt)
- 📖 [Full rule docs (per-rule CWE + examples)](https://eslint.interlace.tools/docs/security/plugin-jwt/rules)
- 💻 [Source on GitHub](https://github.com/ofri-peretz/eslint/tree/main/packages/eslint-plugin-jwt)

::dev-to-cta{url="https://github.com/ofri-peretz/eslint"}
⭐ Star on GitHub if your `verify` call has ever trusted `algorithms: ["none"]`.
::

---

I'm **Ofri Peretz**, a security engineering leader and the author of the
Interlace ESLint ecosystem — domain-specific static analysis for security,
reliability, and performance on the Node.js stack. `eslint-plugin-jwt` is its
JWT/auth layer.

[ofriperetz.dev](https://ofriperetz.dev) · [LinkedIn](https://linkedin.com/in/ofri-peretz) · [GitHub](https://github.com/ofri-peretz)
