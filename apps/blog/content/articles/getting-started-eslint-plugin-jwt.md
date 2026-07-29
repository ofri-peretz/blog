---
title: "JWT Vulnerabilities Your Code Review Approves Every Day — 13 ESLint Rules Stop Them in CI"
description: "alg:none token forgery, RS256↔HS256 confusion, weak/hardcoded secrets, missing exp/iss/aud — the JWT auth mistakes that hand attackers a valid session. The 13 CWE-mapped rules in eslint-plugin-jwt v2.2.7 that turn them into CI errors, which preset you actually need, and the four rules `recommended` leaves off."
slug: "getting-started-eslint-plugin-jwt"
canonical_url: "https://ofriperetz.dev/articles/getting-started-eslint-plugin-jwt"
tier: "TUTORIAL"
devto_url: "https://dev.to/ofri-peretz/getting-started-with-eslint-plugin-jwt-4l4p"
devto_id: 3143580
published_at: "2026-01-02T15:17:19Z"
edited_at: "2026-07-28T00:00:00Z"
cover_image: "https://ofriperetz.dev/cdn/blog-cover-image/getting-started-eslint-plugin-jwt.jpg"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/getting-started-eslint-plugin-jwt-og.jpg"
reading_time_minutes: 12
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

Five JWT vulnerabilities. Every one merged. Every one approved by a human reviewer.

I put all five in a repro project and ran `eslint-plugin-jwt` over it — v2.2.7, ESLint 9.39.2, Node v24.18.0, measured 2026-07-28. `configs.recommended` failed the build on four of them. The fifth, the missing `audience` check, needs `configs.strict`.

That gap is the most useful thing in this guide, and it is the one thing a preset table won't tell you. Install first, then each vulnerability, why review waved it through, and the rule that stops it.

**Skip to:** [Install](#install-it-first-60-seconds) · [`alg:none`](#vulnerability-1-the-algnone-attack-cwe-347) · [algorithm confusion](#vulnerability-2-algorithm-confusion--rs256-public-key-used-as-hmac-secret-cwe-347) · [hardcoded secret](#vulnerability-3-hardcoded-weak-secret-cwe-798--cwe-326) · [`jwt.decode()`](#vulnerability-4-jwtdecode-feeding-an-auth-decision-cwe-345) · [missing `aud`](#vulnerability-5-no-audience-check--one-token-two-services-cwe-287) · [which preset](#which-preset-you-actually-need) · [all 13 rules](#the-full-rule-set)

---

## Install it first (60 seconds)

```bash
npm install --save-dev eslint-plugin-jwt
```

```js
// eslint.config.js — `configs` is a NAMED export
import { configs } from "eslint-plugin-jwt";

export default [
  configs.strict, // all 13 rules — what the five examples below are measured against
];
```

Run `eslint .`. If your auth code is older than your conventions, something fires on the first run.

Every rule message below is verbatim v2.2.7 output from that run — file names and line numbers are from my repro project, yours will differ. The only edit is shape: long lines are hard-wrapped to fit the page, and ESLint's trailing rule ID gets its own last line. The message text itself is untouched, including the full `OWASP:` token and the documentation link that shares the `Fix:` line. Pinning the version, the linter and the date is the difference between a claim you can [reproduce and a claim you can only repeat](https://ofriperetz.dev/articles/reproducibility-vs-replicability). The preset trade-off (`recommended` vs `strict` vs `flagship`) is in [Which preset you actually need](#which-preset-you-actually-need), after the five.

---

## Vulnerability 1: The `alg:none` attack (CWE-347)

**The vulnerable code that shipped:**

```ts
jwt.verify(token, secret, { algorithms: ["HS256", "none"] });
```

**Why it survived review.** Nobody writes `algorithms: ["none"]` on purpose. This line arrived honestly: a dev was debugging tokens from a service that didn't sign its dev tokens, added `"none"` to unblock themselves locally, and the diff went up with `HS256` sitting right next to it. The reviewer sees a real algorithm in the list, sees `jwt.verify` being called, and approves. The array reads as "we accept HS256, and also this other thing" — not as "we accept forged tokens." A human skims the shape; a [CWE-tagged](https://ofriperetz.dev/articles/cwe-taxonomy-explained) lint rule reads every element.

**`alg: "none"` means "no signature."** On `jsonwebtoken` specifically, this line forges the moment `secret` is _also_ falsy — an unset env var, a per-tenant lookup that returns `undefined` for an unrecognized tenant. With a truthy secret, modern `jsonwebtoken` still throws `jwt signature is required`; I verified that directly. So on a codebase running `jsonwebtoken` 9.x with real secrets everywhere, `no-algorithm-none` is defense-in-depth against a downgrade or a library swap rather than a live bug — still worth CI blocking, because "everywhere" is doing a lot of work in that sentence. Libraries that don't guard the falsy-secret case, or that trust the token's own header by default, don't need the falsy secret at all. It's the root failure behind CVE-2022-23540.

**The rule that catches it — `no-algorithm-none` (CWE-347):**

```text
src/vuln1.ts
  4:60  error  🔒 CWE-347 | Including "none" in algorithms array allows
               unsigned tokens | CRITICAL
               Fix: Remove "none" from the algorithms array |
               https://nvd.nist.gov/vuln/detail/CVE-2022-23540
               jwt/no-algorithm-none
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

Modern `jsonwebtoken` closes this on its own, but it took two fixes years apart and the first is narrower than it looks. I diffed the published source between [4.2.1](https://unpkg.com/jsonwebtoken@4.2.1/index.js) and [4.2.2](https://unpkg.com/jsonwebtoken@4.2.2/index.js): 4.2.1 already defaulted to the RS/ES family for `BEGIN CERTIFICATE` and `BEGIN PUBLIC KEY` (PKCS#8) keys. All 4.2.2 added, for CVE-2015-9235 ([GHSA-c7hr-j4mj-j2w6](https://github.com/advisories/GHSA-c7hr-j4mj-j2w6)), was one more branch: `BEGIN RSA PUBLIC KEY` — the older PKCS#1 format — stops falling through to HMAC. That single PEM format was the whole gap. Both fixes are string matching, not key inspection; the robust version, `createPublicKey(...).asymmetricKeyType`, only landed in [9.0.0](https://github.com/auth0/node-jsonwebtoken/blob/master/CHANGELOG.md#900---2022-12-21) (CVE-2022-23541). Anything older, plus any library that never added an equivalent check, is where this still lands — and a reviewer reading the call site has no way to know which fix the running version has. Pin the algorithm anyway. Don't let a decade of layered library patches be the only thing between this call and a forged token.

Which rule fires here is worth being exact about, because I guessed wrong the first time. This call site trips `require-algorithm-whitelist` (CWE-757, "no explicit algorithms list") — **not** `no-algorithm-confusion`. The confusion rule needs two things at once: an argument that looks like a public key (`publicKey`, `.pem`, `jwks`, a PEM header) _and_ an explicit `HS256`/`HS384`/`HS512` in the options. With no options at all it has nothing to compare and stays quiet. The broader rule is the one that saves you.

**The rule that catches it — `require-algorithm-whitelist` (CWE-757):**

```text
src/vuln2.ts
  4:10  error  🔒 CWE-757 | JWT verification without explicit algorithms
               trusts the token header | HIGH
               Fix: Add algorithms: ["RS256"] or algorithms: ["ES256"] to
               options | https://tools.ietf.org/html/rfc8725
               jwt/require-algorithm-whitelist
```

**The fix:**

```ts
// ✅ pin the algorithm so the key type can't be repurposed
jwt.verify(token, publicKey, { algorithms: ["RS256"] });
```

This is also the exact pattern AI assistants produce by default. I ran a quick check — 20 generations across Gemini 3 Pro and Flash, 10 each, prompt: "Write a Node.js function called `verifyToken` that takes a token string and verifies it." **All 20 came back with a bare `jwt.verify(token, secret)` and no `algorithms` option.** `require-algorithm-whitelist` fired on every one. Treat that as a spot check, not a benchmark: 20 generations, one prompt, no held-out corpus. The model reproduces the median of its training data, and the median predates the `jsonwebtoken 9.0.0` fix.

The two numbers behind it are measured properly: [Gemini 2.5 Pro generated unsafe database code 96% of the time](https://ofriperetz.dev/articles/three-sql-injection-patterns-node-postgres-eslint) in the database domain of a [700-function benchmark](https://ofriperetz.dev/articles/aggregate-benchmarks-lie-heres-what-700-ai-functions-look-like-by-security-domain), and [65-75% of 80 Claude-written functions shipped with a security vulnerability](https://ofriperetz.dev/articles/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities). Auth config sits squarely inside that pattern, not outside it.

---

## Vulnerability 3: Hardcoded weak secret (CWE-798 + CWE-326)

**The vulnerable code that shipped:**

```ts
const token = jwt.sign({ userId: 123 }, "supersecret123", {
  algorithm: "HS256",
});
```

**Why it survived review.** `"supersecret123"` is clearly a placeholder — or so the reviewer assumes. It reads as "this will be replaced with an env var before prod." Sometimes it was replaced. Sometimes it shipped exactly as written, went into git history, and stayed there after the env var was added. The string in history is still a credential.

**The rules that catch it — three fire on this one call:**

```text
src/vuln3.ts
  4:10  error  🔒 CWE-613 OWASP:A07-Authentication CVSS:5.4 | JWT without
               expiration is valid forever, increasing exposure window |
               MEDIUM
               Fix: Add expiresIn: "1h" or exp claim to payload |
               https://tools.ietf.org/html/rfc8725
               jwt/require-expiration
  4:36  error  🔒 CWE-326 OWASP:A04-Cryptographic CVSS:5.9 | JWT secret must
               be at least 32 characters (256 bits) for HS256 | HIGH
               Fix: Generate a secret with:
               crypto.randomBytes(32).toString("hex") |
               https://tools.ietf.org/html/rfc8725
               jwt/no-weak-secret
  4:36  error  🔒 CWE-798 OWASP:A04-Cryptographic CVSS:9.8 | Secret key
               hardcoded in source code can be extracted from repositories |
               HIGH [SOC2,PCI-DSS,HIPAA,GDPR]
               Fix: Use process.env.JWT_SECRET or secure secret management |
               https://cwe.mitre.org/data/definitions/798.html
               jwt/no-hardcoded-secret
```

Read that last message again: **`CVSS:9.8`** and the word **`HIGH`**, printed by the same rule on the same line. On the [CVSS 3.1 bands](https://ofriperetz.dev/articles/cvss-scores-explained), 9.0–10.0 is _Critical_. Our own severity word is one band low. That is not drift I found in someone else's tool — I wrote the rule, and [auditing 203 of our security rules turned up 33 with the same mismatch](https://ofriperetz.dev/articles/i-audited-203-of-our-own-eslint-security-rules-16-mislabel-their-own-cvss-score): 16%, this plugin included. The score comes from CWE metadata; the word next to it doesn't, and nothing was checking the two agreed. Gate CI on `cvss >= 7.0`, never on the severity string — advice I can give with confidence, having been the one to break it.

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
if (payload.role === "admin") {
  /* ... */
}
```

**Why it survived review.** `jwt.decode()` and `jwt.verify()` have nearly identical call sites. Someone needed the `userId` for a logging helper, reached for `decode()` because it doesn't need the secret, and returned the payload. In every test — with a token the test itself just minted — it works. The reviewer sees a function that reads a JWT and returns a user, backed by green tests, and approves. What no test exercises: `decode()` happily parses `{ "role": "admin" }` with a garbage signature and hands it back. The gap between "parsed the token" and "verified the token" is exactly one method name and zero failing tests.

**The rule that catches it — `no-decode-without-verify` (CWE-345):**

```text
src/middleware.ts
  4:19  error  🔒 CWE-345 OWASP:A08-Software CVSS:7.5 | jwt.decode() returns
               payload without verifying signature - data can be forged | HIGH
               Fix: Use jwt.verify(token, secret) instead of
               jwt.decode(token) |
               https://owasp.org/API-Security/0xa7-security-misconfiguration/
               jwt/no-decode-without-verify
```

`no-algorithm-none` reports on this line too, which surprised me until I read what it says: treating a decoded payload as authenticated _is_ `algorithm: "none"`, spelled differently. Two rules, one bug — and the one I didn't expect names the failure better than the one I did.

**The one deliberate false positive, and how to actually silence it.** Reading a token's `kid` header to choose which key to verify with — the standard JWKS key-selection pattern — trips this rule even though a real `verify()` call is two lines below. The rule can't see it coming, so it reports: a [false positive it accepts on purpose](https://ofriperetz.dev/articles/confusion-matrix-tp-fp-fn-tn) rather than guess at intent. The escape hatch is an annotation, and it has to be opted into — no preset turns it on:

```js
// eslint.config.js
rules: {
  "jwt/no-decode-without-verify": [
    "error",
    { trustedAnnotations: ["@decoded-header-only"] },
  ],
}
```

```ts
// @decoded-header-only
const { kid } = jwt.decode(token, { complete: true })!.header;
```

The comment has to sit _before_ the code, and that word is doing the work. I tested four placements against v2.2.7. Three suppress: a `//` comment on the line above, a `/* */` block above, and JSDoc on the enclosing function — the check walks up from the `decode()` call through every ancestor, reading the comments before each one, and stops only after it has inspected the containing function. The one placement that silently keeps reporting is a trailing comment on the same line, because a comment _after_ the code is never a comment _before_ any node on that chain. Put it on the line above; the docblock works too.

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

**Why it survived review.** Service A mints a token for its own users. Service B shares the same signing secret — same team, same infra, same env var — and verifies with it. The call looks complete: algorithm pinned, signature checked, no red flags. Nobody asks the question that matters: _was this token minted for me?_ I verified this directly — a token Service A issued with no `audience` claim passes Service B's verify call cleanly, because nothing in the call site checks which service the token was scoped to. Same secret, same algorithm, wrong service — and it's accepted.

**The rule that catches it — `require-audience-validation` (CWE-287), and it is not in `recommended`:**

```text
service-b/src/auth.ts
  4:53  error  🔒 CWE-287 OWASP:A07-Authentication CVSS:9.8 | JWT verification
               without audience validation accepts tokens intended for other
               services | MEDIUM
               Fix: Add audience option:
               { audience: "https://api.example.com" } |
               https://tools.ietf.org/html/rfc8725
               jwt/require-audience-validation
```

Two things in that block. First, the severity word is one whole band below the score again — CVSS 9.8 printed `MEDIUM`, the same [score-versus-label drift](https://ofriperetz.dev/articles/cvss-scores-explained) as Vulnerability 3, and the loudest single example in the 203-rule audit. Second, and more practical: this rule ships in `configs.strict`, not `configs.recommended`. Install the plugin, take the default preset, and this is the one vulnerability of the five that still merges.

**The fix:**

```ts
// ✅ scope the token to the service verifying it
const payload = jwt.verify(token, process.env.JWT_SECRET!, {
  algorithms: ["HS256"],
  audience: "service-b",
});
```

`require-issuer-validation` is the mirror case — same failure, opposite direction: nothing checks _who minted_ the token, so a token from a lower-trust issuer (a staging environment, a partner API) verifies cleanly against a production secret it was never supposed to reach.

---

## Which preset you actually need

Four presets ship. The difference between them isn't strictness in the abstract — it's which of the five above still merges. All four run against the same repro project, v2.2.7 / ESLint 9.39.2 / Node v24.18.0, 2026-07-28:

| Preset        | Rules on            | Blocks, of the five above         | Reach for it when                                                     |
| ------------- | ------------------- | --------------------------------- | --------------------------------------------------------------------- |
| `flagship`    | 1                   | **2** — vulnerabilities 1 and 4   | One shared org-wide gate: a single rule, no argument about its budget |
| `legacy`      | 3 (2 error, 1 warn) | **2** errors, plus 3 as a warning | Migrating an old codebase — keep forgery blocking, turn the rest down |
| `recommended` | 9 (8 error, 1 warn) | **4** — everything except 5       | A new service whose tokens don't cross a trust boundary yet           |
| `strict`      | 13                  | **5**                             | Anything minting or verifying tokens across services                  |

The four rules `recommended` leaves off are all claim validation: `require-issuer-validation`, `require-audience-validation`, `require-issued-at`, `require-max-age`. They're off by default for a defensible reason — they fire on _every_ `verify()` call in a codebase that hasn't adopted `iss`/`aud` yet, and a plugin whose first run lights up every auth file in the repo gets uninstalled before lunch. They're also, precisely, Vulnerability 5. If your tokens cross a service boundary, pay the first-run noise and take `strict`:

```js
export default [
  configs.strict, // all 13 — the only preset that blocks all five above
  // configs.recommended, // 9 rules — quieter first run, no iss/aud/iat/maxAge enforcement
  // configs.flagship,    // 1 rule (no-algorithm-none) — the ecosystem-wide flagship tier
  // configs.legacy,      // 3 rules — migration mode
];
```

One useful accident in that table: `flagship` catches Vulnerability 4 as well as Vulnerability 1, because `no-algorithm-none` also reports on `jwt.decode()`. One rule, two of the five — which is why it's the rule that goes in the gate when you only get one.

---

## The full rule set

All 13, each pinned to a [CWE identifier](https://ofriperetz.dev/articles/cwe-taxonomy-explained). The last column is the one to read before you pick a preset — it's read straight off the v2.2.7 config objects:

| Rule                                                                                                                       | Catches                       | CWE     | In `recommended`? |
| -------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | ------- | ----------------- |
| [`no-algorithm-none`](https://eslint.interlace.tools/docs/security/plugin-jwt/rules/no-algorithm-none)                     | `alg:none` signature bypass   | CWE-347 | error             |
| [`no-algorithm-confusion`](https://eslint.interlace.tools/docs/security/plugin-jwt/rules/no-algorithm-confusion)           | RS256↔HS256 key confusion     | CWE-347 | error             |
| [`no-decode-without-verify`](https://eslint.interlace.tools/docs/security/plugin-jwt/rules/no-decode-without-verify)       | `jwt.decode()` used for auth  | CWE-345 | error             |
| [`require-algorithm-whitelist`](https://eslint.interlace.tools/docs/security/plugin-jwt/rules/require-algorithm-whitelist) | no explicit `algorithms` list | CWE-757 | error             |
| [`no-weak-secret`](https://eslint.interlace.tools/docs/security/plugin-jwt/rules/no-weak-secret)                           | brute-forceable HS256 secret  | CWE-326 | error             |
| [`no-hardcoded-secret`](https://eslint.interlace.tools/docs/security/plugin-jwt/rules/no-hardcoded-secret)                 | signing secret in source      | CWE-798 | error             |
| [`require-expiration`](https://eslint.interlace.tools/docs/security/plugin-jwt/rules/require-expiration)                   | missing `exp` / `expiresIn`   | CWE-613 | error             |
| [`no-timestamp-manipulation`](https://eslint.interlace.tools/docs/security/plugin-jwt/rules/no-timestamp-manipulation)     | clock-skew / replay exposure  | CWE-294 | error             |
| [`no-sensitive-payload`](https://eslint.interlace.tools/docs/security/plugin-jwt/rules/no-sensitive-payload)               | PII in the (readable) payload | CWE-359 | **warn**          |
| [`require-issuer-validation`](https://eslint.interlace.tools/docs/security/plugin-jwt/rules/require-issuer-validation)     | missing `iss` check           | CWE-287 | **strict only**   |
| [`require-audience-validation`](https://eslint.interlace.tools/docs/security/plugin-jwt/rules/require-audience-validation) | missing `aud` check           | CWE-287 | **strict only**   |
| [`require-issued-at`](https://eslint.interlace.tools/docs/security/plugin-jwt/rules/require-issued-at)                     | missing `iat`                 | CWE-294 | **strict only**   |
| [`require-max-age`](https://eslint.interlace.tools/docs/security/plugin-jwt/rules/require-max-age)                         | no `maxAge` on verify         | CWE-294 | **strict only**   |

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

Passing all 13 rules is a lint-time property, not an architecture review — it's a different check than "should this shared secret exist at all." One HMAC secret shared across services means any service holding it can mint tokens the others will accept; `audience` narrows who a token is _for_, it doesn't stop whoever holds the secret from _minting_ one. If Service A and Service B are separate trust boundaries, not just separate deployments of the same trust, the actual fix is asymmetric — RS256/ES256 with Service A holding the private key and every verifier holding only the public one.

---

## Compatibility

Verified against `eslint-plugin-jwt` v2.2.7 (latest on npm, 2026-07-28):

| Surface              | Support                                                                                                                                                                                                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Package managers** | npm, yarn, pnpm, bun                                                                                                                                                                                                                                                      |
| **Node**             | `>= 18.0.0`                                                                                                                                                                                                                                                               |
| **ESLint**           | `^8.0.0 \|\| ^9.0.0 \|\| ^10.0.0`, flat config                                                                                                                                                                                                                            |
| **JWT libraries**    | detects `jsonwebtoken`'s `sign`/`verify`/`decode` and `jose`'s `SignJWT`/`jwtVerify` — reads source, no library pin. `jose`'s `decodeJwt` isn't in the decode-detection set yet, so `no-decode-without-verify` currently only fires on `jsonwebtoken`-shaped decode calls |
| **Module system**    | CommonJS — loads from both `eslint.config.js` and `eslint.config.mjs`                                                                                                                                                                                                     |
| **Oxlint**           | Loads under Oxlint's JS-plugin runner via the `interlace-jwt` port, with ESLint↔Oxlint parity gated in CI. The full 13-rule set runs on ESLint today.                                                                                                                     |

---

## What it sees — and doesn't

- **Source patterns, not runtime tokens.** It flags `algorithms: ["none"]`, a missing `expiresIn`, a `jwt.decode()` feeding an auth check. It can't validate a token at runtime or prove your secret's entropy — it enforces that the _call_ is configured safely.
- **Pin the algorithm, then validate claims.** The rules push you toward the correct shape (explicit `algorithms` + `iss`/`aud`/`exp`/`maxAge`); the values are yours to set correctly.
- **Two rules worth knowing the limits of.** `no-algorithm-confusion` has no runtime key knowledge — it matches "this looks like a public key" by name and shape (`publicKey`, `.pem`, a PEM header, `jwks`) and only reports when an explicit `HS*` sits next to it. Rename the argument, or drop the algorithms list, and it misses: [a false negative by design](https://ofriperetz.dev/articles/confusion-matrix-tp-fp-fn-tn), which is why the broader `require-algorithm-whitelist` is what fired on Vulnerability 2. `no-decode-without-verify` errs the other way and flags every `decode()` call, whether or not the payload reaches an auth check, because it does no [taint tracking](https://ofriperetz.dev/articles/taint-vs-heuristic-detection) — following a value from source to sink isn't something an AST-level rule answers reliably. Two rules, opposite error directions, one plugin: that trade is the [precision-versus-recall conversation](https://ofriperetz.dev/articles/precision-recall-f1-for-static-analysis) in miniature, and the reason presets exist at all.
- **What's out of scope.** Key-_selection_ attacks — a `kid` header used unsanitized in a file path or DB lookup, or a `jku`/`x5u` header pointed at an attacker-controlled JWKS endpoint — aren't rules in this set. They're a real, current class of JWT incident, and [static analysis](https://ofriperetz.dev/articles/static-analysis-vs-sast-vs-linting) on the `verify()` call site doesn't see them; that's a key-retrieval-function problem, not a call-shape problem. Scoped out here, not solved.

This fits into the broader static-analysis onboarding protocol I use when auditing codebases: [The 30-Minute Security Audit: I Ran It on 140 Gemini-Written Functions. 102 Shipped Vulnerable.](https://ofriperetz.dev/articles/the-30-minute-security-audit-onboarding-a-new-codebase).

---

## Where this sits in the ecosystem

`eslint-plugin-jwt` is the dedicated JWT layer — signature bypass, algorithm confusion, secret strength, claim validation — each finding tagged with a CWE. Generic security plugins don't cover this layer; it's [one of the gaps I found benchmarking 17 of them](https://ofriperetz.dev/articles/benchmark-17-eslint-security-plugins-compared). In [OWASP Top 10](https://ofriperetz.dev/articles/owasp-top-10-explained) terms it lands in A02 (Cryptographic Failures) and A07 (Identification and Authentication Failures) — categories, not severities, which is exactly why the CWE and the CVSS score do the ranking work here; [the full rule-to-category mapping is here](https://ofriperetz.dev/articles/mapping-your-codebase-to-owasp-top-10-with-247-eslint-rules). It pairs with [`eslint-plugin-express-security`](https://ofriperetz.dev/articles/getting-started-with-eslint-plugin-express-security) and [`eslint-plugin-nestjs-security`](https://ofriperetz.dev/articles/nestjs-guards-pipes-throttlers-6-eslint-rules) as the auth member of the **Hardened Stack** series.

> **The Hardened Stack** · [← `eslint-plugin-express-security`](https://ofriperetz.dev/articles/getting-started-with-eslint-plugin-express-security) | **`eslint-plugin-jwt` (current)** | [`eslint-plugin-nestjs-security` →](https://ofriperetz.dev/articles/nestjs-guards-pipes-throttlers-6-eslint-rules)

---

## Links

- 📦 [npm: eslint-plugin-jwt](https://www.npmjs.com/package/eslint-plugin-jwt) — v2.2.7
- 📖 [Full rule docs (per-rule CWE + examples)](https://eslint.interlace.tools/docs/security/plugin-jwt)
- 💻 [Source on GitHub](https://github.com/ofri-peretz/eslint/tree/main/packages/eslint-plugin-jwt)

Run `configs.strict` against the oldest service you have that verifies a token — the one written before anyone on the team had opinions about `aud`. Something will fire. That is the good outcome, not the bad one: the pattern was already in production, and now it has a CWE, a score, and a line number. Fix the errors, read the warnings, ship.

Then read [The JWT `algorithm: none` Attack](https://ofriperetz.dev/articles/the-jwt-algorithm-none-attack-the-vulnerability-in-1-line-of-code-d9g) next — Vulnerability 1 end to end, from a forged token to an accepted session. Same bug, one level deeper.

**Which JWT incident changed how you review auth code — and being honest about it, would a linter have caught that one?** I'd like to know how many of these are configuration and how many are architecture. My guess is it splits about even.

::dev-to-cta{url="https://www.npmjs.com/package/eslint-plugin-jwt"}
📦 `npm install --save-dev eslint-plugin-jwt` — 13 rules, one dev dependency.
::

---

_[eslint-plugin-jwt](https://www.npmjs.com/package/eslint-plugin-jwt) is part of the [Interlace ESLint ecosystem](https://eslint.interlace.tools). Source on [GitHub](https://github.com/ofri-peretz/eslint) · Follow: [Dev.to/ofri-peretz](https://dev.to/ofri-peretz) · [X @ofriperetzdev](https://x.com/ofriperetzdev)_
