---
title: "Secure Coding Violations Your Team Ships Every Sprint — 28 ESLint Rules Make Them Impossible"
description: "Hardcoded secrets, insecure randomness, missing input sanitization, unhandled rejections leaking stack traces — violations that pass review and ship every sprint. Here are 4 specific examples and the 28 ESLint rules that make each one impossible to merge."
slug: "getting-started-eslint-plugin-secure-coding"
canonical_url: "https://ofriperetz.dev/articles/getting-started-eslint-plugin-secure-coding"
tier: "TUTORIAL"
devto_url: "https://dev.to/ofri-peretz/getting-started-with-eslint-plugin-secure-coding-1eda"
devto_id: 3138988
published_at: "2025-12-31T21:31:41Z"
edited_at: "2026-07-05T00:00:00Z"
cover_image: "https://ofriperetz.dev/og/cover/getting-started-eslint-plugin-secure-coding"
social_image: "https://ofriperetz.dev/og/article/getting-started-eslint-plugin-secure-coding"
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

> **"Every security violation your team ships this sprint was reviewable. None of them will be caught by a linter that only checks style."**

Four violations. Four production incidents waiting to happen. Four reasons they survive every sprint.

---

## Violation 1: The hardcoded secret that passes in four seconds

A reviewer approves this diff without a second look:

```ts
// ❌ no-hardcoded-credentials (CWE-798, CVSS 9.8)
const stripe = new Stripe("sk_live_51H8xY2eZvKf...");
```

**Why it survived review:** The variable is named exactly what it is. The type-checker is happy. Every unit test passes. The reviewer's eye is on the control flow downstream — "is this string a live credential?" is not a question a human pattern-matches at review speed. It's machine work.

Three weeks later it's in a public commit. A security researcher greps your org's repos for `sk_live_`. You're rotating keys at 2am.

**The ESLint rule that catches it:**

```text
src/payments.ts
  4:24  error  🔒 CWE-798 OWASP:A04-Cryptographic CVSS:9.8 | Hard-coded API key detected | CRITICAL [SOC2,PCI-DSS,HIPAA,GDPR]
               Fix: Use environment variable: process.env.STRIPE_SECRET_KEY
```

**The fix:**

```ts
// ✅
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
```

The rule detects this in two modes: structural match on vendor-owned prefixes (`sk_live_`, `AKIA…`) that fire anywhere — no context needed — and a credential-name gate for generic secrets that keeps [false positives](https://ofriperetz.dev/articles/confusion-matrix-tp-fp-fn-tn) low enough to run as a CI error. The full two-mode design is in [When entropy isn't enough](https://ofriperetz.dev/articles/no-hardcoded-credentials-entropy-isnt-enough).

---

## Violation 2: Insecure randomness on a security value

This token generation looks reasonable at review time:

```ts
// ❌ detect-non-literal-regexp / no-insecure-comparison (CWE-338)
const resetToken = Math.random().toString(36).slice(2);
await db.update({ where: { token: resetToken } });
```

**Why it survived review:** `Math.random()` generates something that looks random. It works correctly in tests. Nobody checks whether the PRNG is cryptographically secure unless they already know to look for it — and most reviewers don't have [CWE-338](https://ofriperetz.dev/articles/cwe-taxonomy-explained) loaded at review time.

The problem: `Math.random()` is not cryptographically secure. An attacker who can influence the seed (or observe enough outputs) can predict your password-reset tokens.

**The ESLint rule that catches it:**

```ts
// ❌ no-hardcoded-credentials + require-secure-defaults (CWE-338 / CWE-1188)
// Rule fires: Math.random() used for security-sensitive token generation
```

**The fix:**

```ts
// ✅
import { randomBytes } from "crypto";
const resetToken = randomBytes(32).toString("hex");
```

---

## Violation 3: Missing input sanitization before a structured query

This ships in a GraphQL resolver on a Tuesday:

```ts
// ❌ no-graphql-injection (CWE-89)
const query = `{ user(id: "${req.body.userId}") { email } }`;
const result = await graphqlClient.query(query);
```

**Why it survived review:** The template literal looks clean. `userId` sounds like an ID — how dangerous could it be? The reviewer is checking the business logic around it, not whether the interpolation is safe.

A crafted `userId` of `") { __typename } user(id: "admin` rewrites the query entirely.

**The ESLint rule that catches it:**

```text
src/resolvers/user.ts
  8:20  error  🔒 CWE-89 OWASP:A03-Injection CVSS:9.8 | GraphQL injection: user input interpolated directly into query string
               Fix: Use parameterized queries or a query builder
```

**The fix:**

```ts
// ✅
const result = await graphqlClient.query(USER_QUERY, { id: req.body.userId });
```

The rule catches string concatenation and template-literal interpolation into GraphQL, LDAP, XPath, and SQL query strings — all of [OWASP A03](https://ofriperetz.dev/articles/owasp-top-10-explained) in one preset.

---

## Violation 4: Unhandled rejection leaking a stack trace to the client

This ships in an Express route when someone's in a hurry:

```ts
// ❌ no-sensitive-data-exposure (CWE-532)
app.get("/api/user/:id", async (req, res) => {
  const user = await db.getUser(req.params.id);
  res.json(user);
});
```

**Why it survived review:** It looks like a normal route handler. The happy path works. The reviewer doesn't simulate what happens when `db.getUser` rejects — the unhandled promise rejection bubbles up and Express (depending on version and config) may respond with the raw error, stack trace included.

Stack traces contain file paths, library versions, and internal module structure — reconnaissance gold for an attacker.

**The ESLint rule that catches it:**

```ts
// ❌ no-sensitive-data-exposure (CWE-532) — unhandled rejection can expose stack trace
// Rule fires: async route handler without try/catch or error middleware
```

**The fix:**

```ts
// ✅
app.get("/api/user/:id", async (req, res, next) => {
  try {
    const user = await db.getUser(req.params.id);
    res.json(user);
  } catch (err) {
    next(err); // error middleware handles response — no raw stack to client
  }
});
```

---

## Here's the guard that catches all of this in CI

Four violations, four different CWE classes, all in the `recommended` preset. Two commands:

```bash
npm install --save-dev eslint-plugin-secure-coding
```

```js
// eslint.config.js
import { configs } from "eslint-plugin-secure-coding";
export default [configs.recommended]; // 18 rules, catches every violation above
```

Run it:

```bash
npx eslint .
```

Every finding comes out audit-ready — CWE id, OWASP category, [CVSS score](https://ofriperetz.dev/articles/cvss-scores-explained), compliance tags (SOC2/PCI-DSS/HIPAA/GDPR), and the fix. Not a bare "bad" — a line your compliance reviewer can map directly.

Tune it for your repo — the preset registers the `secure-coding` namespace so overrides are one config object away:

```js
import { configs } from "eslint-plugin-secure-coding";

export default [
  configs.recommended,
  {
    rules: {
      "secure-coding/no-hardcoded-credentials": [
        "error",
        { allowInTests: true, minLength: 12 },
      ],
      "secure-coding/no-pii-in-logs": "warn",
    },
  },
];
```

For a known-safe fixture, a scoped disable is honest and self-documenting:

```ts
// eslint-disable-next-line secure-coding/no-hardcoded-credentials -- documented test fixture
const EXAMPLE_KEY = "pk_test_example";
```

---

## Why this matters more now that AI writes the diff

Now for the part that changed how I think about this. These aren't bugs a careful senior writes once and learns from — they're the _default_ output of a language model optimizing for "code that runs," not "code that's safe."

When I had Claude generate 80 ordinary Node.js functions with no security context, **65–75% shipped a security hole** — hardcoded fallbacks, `eval`-as-parser, loose comparisons on tokens — the exact CWE classes the 28 rules cover. Expanded to 700 functions across five Gemini and Claude models, the per-model vuln rate ranged 49–73%. Gemini 2.5 Pro was the _highest_ at 73%. One model emitted vulnerable JWT code **7 out of 7 runs**.

The reviewer approving the four-second diff is increasingly approving a diff a model wrote. And when you ask the model to _fix_ the finding, **1 in 3 "fixes" introduced a brand-new vulnerability** in a different category.

A rule that fires deterministically on the _shape_ in the source — every commit, human- or machine-authored — is the only part of this loop that doesn't get tired and doesn't care which model wrote the line.

Related: [No Hardcoded Credentials — Entropy Isn't Enough](https://ofriperetz.dev/articles/no-hardcoded-credentials-entropy-isnt-enough) · [The 30-Minute Security Audit: A Static Analysis Protocol for Onboarding](https://ofriperetz.dev/articles/the-30-minute-security-audit-onboarding-a-new-codebase)

---

## The full 28-rule map

All 28 rules, grouped, with each rule's declared CWE:

| Rule                               | Catches                                | CWE      |
| ---------------------------------- | -------------------------------------- | -------- |
| `no-hardcoded-credentials`         | Secrets/keys in source                 | CWE-798  |
| `no-hardcoded-session-tokens`      | Session/JWT tokens in source           | CWE-798  |
| `no-sensitive-data-exposure`       | Secrets/PII in logs, responses, errors | CWE-532  |
| `no-pii-in-logs`                   | Email/SSN/card in console logs         | CWE-359  |
| `no-unsafe-deserialization`        | Deserializing untrusted data           | CWE-502  |
| `no-graphql-injection`             | GraphQL injection / DoS                | CWE-89   |
| `no-ldap-injection`                | LDAP injection                         | CWE-90   |
| `no-xpath-injection`               | XPath injection                        | CWE-643  |
| `no-xxe-injection`                 | XML external entity                    | CWE-611  |
| `no-format-string-injection`       | Format-string injection                | CWE-134  |
| `no-directive-injection`           | Template directive injection           | CWE-96   |
| `no-template-injection`            | Server-side template injection (SSTI)  | CWE-94   |
| `detect-object-injection`          | `obj[userKey]` / prototype pollution   | CWE-915  |
| `detect-non-literal-regexp`        | `RegExp(variable)`                     | CWE-400  |
| `no-unsafe-regex-construction`     | Regex built from user input            | CWE-400  |
| `no-redos-vulnerable-regex`        | Catastrophic-backtracking regex        | ReDoS¹   |
| `no-missing-authentication`        | Route handler with no auth check       | CWE-287  |
| `require-backend-authorization`    | Missing server-side authz              | CWE-602  |
| `no-privilege-escalation`          | Privilege-escalation patterns          | CWE-269  |
| `detect-weak-password-validation`  | Weak password requirements             | CWE-521  |
| `no-weak-password-recovery`        | Weak password-reset flows              | CWE-640  |
| `no-improper-sanitization`         | Incomplete input sanitization          | CWE-116  |
| `no-improper-type-validation`      | Missing/loose type validation          | CWE-1287 |
| `no-insecure-comparison`           | `==`/`!=` on security values           | CWE-697  |
| `no-unchecked-loop-condition`      | Unbounded loop → DoS                   | CWE-400  |
| `no-unlimited-resource-allocation` | Unbounded allocation → DoS             | CWE-770  |
| `no-electron-security-issues`      | Insecure Electron config               | CWE-16   |
| `require-secure-defaults`          | Insecure-by-default config             | CWE-1188 |

¹ `no-redos-vulnerable-regex` targets the MITRE ReDoS class (CWE-1333); the others above carry the CWE declared in their rule metadata.

**4 presets:**

- `flagship` — the 2 ecosystem-flagship rules
- `recommended` — 18 rules (the sane default, catches all 4 violations above)
- `strict` — all 28 as errors
- `owasp-top-10` — 11 rules mapped to OWASP A01–A10 categories

---

## Install

```bash
# npm
npm install --save-dev eslint-plugin-secure-coding
# yarn
yarn add --dev eslint-plugin-secure-coding
# pnpm
pnpm add --save-dev eslint-plugin-secure-coding
# bun
bun add --dev eslint-plugin-secure-coding
```

**Flat config** (`eslint.config.js`):

```js
// `configs` is a NAMED export; the default export is the plugin object.
import { configs } from "eslint-plugin-secure-coding";

export default [
  configs.recommended, // 18 rules — the sane default
  // configs.flagship,    // the 2 ecosystem-flagship rules only
  // configs.strict,      // all 28 as errors
  // configs["owasp-top-10"], // the 11 OWASP-mapped rules
];
```

---

## Compatibility

| Surface              | Support                                                                                                                                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Package managers** | npm, yarn, pnpm, bun — plain dev dependency                                                                                                                                                            |
| **Node**             | `>= 18.0.0`                                                                                                                                                                                            |
| **ESLint**           | `^8.0.0 \|\| ^9.0.0 \|\| ^10.0.0`, flat config                                                                                                                                                         |
| **Module system**    | CommonJS — loads from both `eslint.config.js` and `eslint.config.mjs`                                                                                                                                  |
| **Runtime peers**    | None — the rules read source AST; nothing to install at runtime                                                                                                                                        |
| **Oxlint**           | Loads under Oxlint's JS-plugin runner via the `interlace-secure-coding` port; the flagship rules are wired into the Oxlint config and parity-checked in CI. The full 28-rule set runs on ESLint today. |

---

## Honest scope — what "28 rules" means and what it doesn't

- **It's 28 rules, not "89."** The published `recommended` enables 18, `strict` turns on all 28. The breadth is in CWE _coverage_, not rule count.
- **"OWASP coverage" is the `owasp-top-10` preset, and it's checkable.** 11 rules wired to specific OWASP categories. `no-missing-authentication` is _not_ in this preset — it assumes an Express route-handler shape and lives in `eslint-plugin-express-security`.
- **Static analysis is a floor.** These rules prove a dangerous _shape_ isn't in your source. They can't prove your auth logic is correct or your validator is complete — pair them with reviews and runtime controls. They run on every commit and never get tired.

---

## Where this sits in the ecosystem

`eslint-plugin-secure-coding` is the framework-agnostic base layer of the [Interlace](https://eslint.interlace.tools) family. The per-framework plugins (`-pg`, `-jwt`, `-nestjs-security`, `-node-security`, `-express-security`, `-lambda-security`) sit _on top_ of it for stack-specific coverage. If you run more than one, this is the one you install first.

> **Series — The Hardened Stack.** Each per-framework guide assumes `secure-coding` is already in your config and layers the stack-specific rules on top. Want to see these rules earn their keep on real model output? They're the ones that flagged the bugs in [Claude Wrote a NestJS Service. ESLint Found 6 Security Holes.](https://ofriperetz.dev/articles/claude-wrote-nestjs-service-eslint-found-6-security-holes)

---

## Links

- 📦 [npm: eslint-plugin-secure-coding](https://www.npmjs.com/package/eslint-plugin-secure-coding)
- 📖 [Full rule docs (per-rule CWE + OWASP mapping)](https://eslint.interlace.tools/docs/security/plugin-secure-coding/rules)
- 💻 [Source on GitHub](https://github.com/ofri-peretz/eslint/tree/main/packages/eslint-plugin-secure-coding)

**What security violation surprised your team most?** The credential that lived in source for months, the token generated with `Math.random()`, the stack trace that logged to the client in production? Was it a teammate or an AI completion that wrote it, and what was everyone looking at instead when it slipped through? Drop the CWE and the story in the comments — I collect these.

::dev-to-cta{url="https://github.com/ofri-peretz/eslint"}
⭐ Star on GitHub if this caught something your code review wouldn't.
::

---

_[eslint-plugin-secure-coding](https://www.npmjs.com/package/eslint-plugin-secure-coding) is part of the [Interlace ESLint ecosystem](https://eslint.interlace.tools). Source on [GitHub](https://github.com/ofri-peretz/eslint) · Follow: [Dev.to/ofri-peretz](https://dev.to/ofri-peretz)_
