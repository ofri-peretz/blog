---
title: "Secure Coding Violations Your Team Ships Every Sprint — and the 28-Rule ESLint Config That Catches Them"
description: "Hardcoded secrets, guessable reset tokens, GraphQL interpolation, a password in a log line — four violations that pass code review every sprint. Install one plugin, add six lines of config, and see the exact CWE/CVSS output each one produces. Every command and every terminal block below was re-run against v3.3.3 on 2026-07-28."
slug: "getting-started-eslint-plugin-secure-coding"
canonical_url: "https://ofriperetz.dev/articles/getting-started-eslint-plugin-secure-coding"
tier: "TUTORIAL"
devto_url: "https://dev.to/ofri-peretz/getting-started-with-eslint-plugin-secure-coding-1eda"
devto_id: 3138988
published_at: "2025-12-31T21:31:41Z"
edited_at: "2026-07-28T00:00:00Z"
cover_image: "https://ofriperetz.dev/og/cover/getting-started-eslint-plugin-secure-coding"
social_image: "https://ofriperetz.dev/og/article/getting-started-eslint-plugin-secure-coding"
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

> **"Every security violation your team ships this sprint was reviewable. None of them will be caught by a linter that only checks style."**

Here is the outcome this guide gets you, and it takes about three minutes:

```text
src/payments.ts
  4:34  error  🔒 CWE-798 OWASP:A04-Cryptographic CVSS:9.8 | Hard-coded API key detected | CRITICAL [SOC2,PCI-DSS,HIPAA,GDPR]
```

One `npm install`, six lines of config, and every commit gets checked for a
[CWE](https://ofriperetz.dev/articles/cwe-taxonomy-explained)-classified dangerous shape — with
the [CVSS](https://ofriperetz.dev/articles/cvss-scores-explained) score, the
[OWASP](https://ofriperetz.dev/articles/owasp-top-10-explained) category, the compliance tags and
the fix, printed on the line that caused it. Want only the commands?
[Jump to Get it running](#get-it-running).

Every terminal block below is a paste from a real run — **v3.3.3, ESLint 9.39.5, Node v18.16.1,
2026-07-28** — not typed from memory. That distinction matters more here than usual, and I'll
show you why at the end.

First, the four violations, because the reason they need a machine is that all four pass a human.

---

## Violation 1: The hardcoded secret that passes in four seconds

A reviewer approves this diff without a second look:

```ts
// src/payments.ts
import Stripe from "stripe";

export const stripe = new Stripe("sk_live_51H8xY2eZvKf...REDACTED_EXAMPLE"); // ❌
```

**Why it survived review:** The variable is named exactly what it is. The type-checker is happy. Every unit test passes. The reviewer's eye is on the control flow downstream — "is this string a live credential?" is not a question a human pattern-matches at review speed. It's machine work.

Three weeks later it's in a public commit. A security researcher greps your org's repos for `sk_live_`. You're rotating keys at 2am.

**The rule that catches it:** `no-hardcoded-credentials` — `error` in the `recommended` preset.

```text
src/payments.ts
  4:34  error  🔒 CWE-798 OWASP:A04-Cryptographic CVSS:9.8 | Hard-coded API key detected | CRITICAL [SOC2,PCI-DSS,HIPAA,GDPR]
                Fix: Use environment variable: process.env.API_KEY or secret management service
                https://cwe.mitre.org/data/definitions/798.html   secure-coding/no-hardcoded-credentials
```

**The fix:**

```ts
// ✅
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
```

The rule detects this in two modes: a structural match on vendor-owned prefixes (`sk_live_`,
`AKIA…`) that fires anywhere, no surrounding context needed — and a credential-name gate for
generic secrets that keeps
[false positives](https://ofriperetz.dev/articles/confusion-matrix-tp-fp-fn-tn) low enough to
run as a CI error rather than a warning. The full two-mode design is in
[When entropy isn't enough](https://ofriperetz.dev/articles/no-hardcoded-credentials-entropy-isnt-enough).

---

## Violation 2: A password-reset token anyone can predict

This token generation looks reasonable at review time:

```ts
// src/auth.ts
import { db } from "./db";

export async function startReset(email: string) {
  const passwordResetToken = Math.random().toString(36).slice(2); // ❌
  await db.update({ where: { email }, data: { passwordResetToken } });
  return passwordResetToken;
}
```

**Why it survived review:** `Math.random()` produces something that looks random, and it works
correctly in tests. Nobody checks whether a PRNG is cryptographically secure unless they already
know to look — and most reviewers don't have
[CWE-640](https://ofriperetz.dev/articles/cwe-taxonomy-explained) loaded at review speed. It
isn't secure: an attacker who observes enough outputs predicts the next reset token and takes
over an account without ever touching the password.

**The rule that catches it:** `no-weak-password-recovery` — `warn` in `recommended`.

```text
src/auth.ts
  5:30  warning  🔒 CWE-640 | Recovery token can be predicted or guessed | CRITICAL
                 Fix: Use cryptographically secure random tokens
                 https://cwe.mitre.org/data/definitions/640.html   secure-coding/no-weak-password-recovery
```

**The fix:**

```ts
// ✅
import { randomBytes } from "node:crypto";
const passwordResetToken = randomBytes(32).toString("hex");
```

One caveat, because it changes how you name things: the rule keys on the **variable name** plus
the generator shape, and wants a password word and a recovery word together —
`passwordResetToken` fires, a bare `resetToken` does **not**. That's the cost of a name-gated
heuristic instead of
[taint analysis](https://ofriperetz.dev/articles/taint-vs-heuristic-detection): it buys
[precision](https://ofriperetz.dev/articles/precision-recall-f1-for-static-analysis) high enough
to ship, and pays in recall. For blanket `Math.random()`-in-crypto coverage regardless of naming,
`eslint-plugin-node-security` carries `no-math-random-crypto` (CWE-338).

---

## Violation 3: Missing input sanitization before a structured query

This ships in a GraphQL resolver on a Tuesday:

```ts
// src/resolvers/user.ts
import { graphqlClient } from "../client";

export async function user(req: Request) {
  const query = `{ user(id: "${req.body.userId}") { email } }`; // ❌
  return graphqlClient.query(query);
}
```

**Why it survived review:** The template literal looks clean. `userId` sounds like an ID — how dangerous could it be? The reviewer is checking the business logic around it, not whether the interpolation is safe.

A crafted `userId` of `") { __typename } user(id: "admin` rewrites the query entirely.

**The rules that catch it:** `no-graphql-injection` and — see below — `no-ldap-injection`.

```text
src/resolvers/user.ts
  5:17  error    🔒 CWE-90 OWASP:A05-Injection CVSS:9.8 | LDAP filter constructed with unsafe string operations | HIGH
                 Fix: Use ldap.escape.filterValue() to escape user input   secure-coding/no-ldap-injection
  5:17  warning  🔒 CWE-89 OWASP:A05-Injection CVSS:9.8 | Unsafe interpolation in GraphQL query | HIGH [SOC2,PCI-DSS,HIPAA,ISO27001]
                 Fix: Use GraphQL variables instead of string interpolation   secure-coding/no-graphql-injection
  6:30  warning  🔒 CWE-20 OWASP:A06-Insecure CVSS:7.5 | GraphQL input not validated | MEDIUM [SOC2,PCI-DSS,HIPAA,GDPR]
                 Fix: Validate all user inputs before GraphQL execution   secure-coding/no-graphql-injection
```

Yes — three findings for one bug, and one is the LDAP rule firing on a GraphQL string: an LDAP
`(key=value)` filter and a `user(id: "…")` selector are close enough that a name-free structural
heuristic can't separate them. I'd rather paste the real output than a tidied one. In a repo with
no directory server, `"secure-coding/no-ldap-injection": "off"` is a perfectly reasonable line.

**The fix:**

```ts
// ✅
return graphqlClient.query(USER_QUERY, { id: req.body.userId });
```

That clears the injection findings. The `CWE-20 | GraphQL input not validated` warning stays —
parameterizing stops the query being rewritten, but doesn't validate what `userId` actually is.
Add a schema check and it goes quiet.

The same family covers concatenation and interpolation into GraphQL, LDAP, XPath and XML — the
injection column of the
[OWASP Top 10](https://ofriperetz.dev/articles/owasp-top-10-explained), in one preset. One label
to decode before this reaches a compliance ticket: the output reads `OWASP:A05-Injection`, not
the `A03` you may have memorised, because these messages carry **2025** category ids. Same
category, renumbered edition.

---

## Violation 4: The debug log that ships with a password in it

This gets added during an incident and never gets taken out:

```ts
// src/session.ts
import { db, logger } from "./deps";

export async function login(email: string, password: string) {
  const user = await db.findUser(email);
  if (!user) logger.error("login failed", password); // ❌
  return user;
}
```

**Why it survived review:** Somebody was debugging a login failure at 1am and wanted to see what
was actually being submitted. It's one line, inside an error branch, and by the time the PR is
read the reviewer's attention is on `findUser`. Log lines are the part of a diff everyone's eyes
slide over.

Now the plaintext password is in your log aggregator, replicated across retention tiers, inside
whatever compliance scope your logging vendor sits in. And there's no rotation story for a user's
password — you force-reset everyone who logged in during the window.

**The rule that catches it:** `no-sensitive-data-exposure` — `warn` in `recommended`.

```text
src/session.ts
  6:43  warning  🔒 CWE-532 OWASP:A09-Logging CVSS:5.3 | Sensitive data detected in logs: password | HIGH [GDPR,HIPAA,PCI-DSS,SOC2]
                 Fix: Redact or mask sensitive data before logging/exposing
                 https://cwe.mitre.org/data/definitions/532.html   secure-coding/no-sensitive-data-exposure
```

It matches on the identifier and literal names passed into `console.*` / `logger.*` calls and
into `new Error(...)`. The default list is 14 patterns — `password`, `secret`, `token`, `ssn`,
`api_key`, `credit_card` and variants — compared after camelCase is split into words, so
`apiKey` and `creditCard` are caught but a bare `key` or `card` is not. The `sensitivePatterns`
option replaces that list with your own.

**The fix:**

```ts
// ✅
if (!user)
  logger.error("login failed", { email, hasPassword: Boolean(password) });
```

---

## Get it running

Four violations, four CWE classes, all four caught by the `recommended` preset. Three steps.

**1. Install** — pick your package manager:

```bash
npm  install --save-dev eslint-plugin-secure-coding   # npm
yarn add     --dev      eslint-plugin-secure-coding   # yarn
pnpm add     --save-dev eslint-plugin-secure-coding   # pnpm
bun  add     --dev      eslint-plugin-secure-coding   # bun
```

**2. Configure.** If your repo is plain JavaScript, two lines are the whole config:

```js
// eslint.config.mjs — `configs` is a NAMED export; the default export is the plugin object
import { configs } from "eslint-plugin-secure-coding";

export default [configs.recommended]; // 18 rules
```

If your repo is **TypeScript**, you need one more line — and this is the step that quietly eats
people's afternoons. The presets ship rules only, no `files` pattern and no parser, so ESLint 9
falls back to its default and never opens a `.ts` file. You get no warning, just
`All of the files matching the glob pattern "src/" are ignored.` Add the parser stanza:

```js
// eslint.config.mjs
import tseslint from "typescript-eslint";
import { configs } from "eslint-plugin-secure-coding";

export default [
  { files: ["**/*.ts"], languageOptions: { parser: tseslint.parser } },
  configs.recommended,
];
```

`npm i -D typescript-eslint` if you don't have it. No type-aware setup, no `project` option, no
`tsconfig` wiring — these rules read the AST, so the plain parser is enough and the run stays
fast.

**3. Run it:**

```bash
npx eslint .
```

On the four files above, that prints:

```text
✖ 6 problems (2 errors, 4 warnings)
```

Apply the four fixes above and the same command returns **1 warning** — the leftover "validate
your input" nudge on the resolver. That's the whole loop: a number that goes down on every
commit, without anyone remembering to look. And each finding is audit-ready — CWE id, OWASP
category, CVSS score, compliance tags, and the fix. Not a bare "bad," but a line a compliance
reviewer can map directly.

**About that `(2 errors, 4 warnings)`.** `recommended` is 18 rules: **8 at `error`, 10 at
`warn`.** The split isn't indecision — a rule only earns `error` if its
[precision](https://ofriperetz.dev/articles/precision-recall-f1-for-static-analysis) clears the
bar to block a build. `no-graphql-injection` was demoted after an audit found most of its
real-world hits were on adversarial edge-case code. When you're ready to gate CI on all 18,
promote them in one line:

```js
export default [configs["recommended-strict"]]; // same 18 rules, all as errors
```

Tune it for your repo — the preset registers the `secure-coding` namespace, so overrides are one
config object away:

```js
import { configs } from "eslint-plugin-secure-coding";

export default [
  configs.recommended,
  {
    rules: {
      // relax: skip test files, and ignore anything shorter than 12 chars
      "secure-coding/no-hardcoded-credentials": [
        "error",
        { allowInTests: true, minLength: 12 },
      ],
      // add: no-pii-in-logs is one of the 10 rules NOT in `recommended` — this turns it on
      "secure-coding/no-pii-in-logs": "warn",
      // remove: no directory server in this repo, so the LDAP cross-fire is pure noise
      "secure-coding/no-ldap-injection": "off",
    },
  },
];
```

For a known-safe fixture, a scoped disable is honest and self-documenting — and it leaves the
reason in the file for whoever reads it next:

```ts
// eslint-disable-next-line secure-coding/no-hardcoded-credentials -- documented test fixture
export const EXAMPLE_KEY = "sk_live_51H8xY2eZvKf...REDACTED_EXAMPLE";
```

That's the whole setup. The rest of this article is context you can read later.

---

## Why this matters more now that AI writes the diff

Now for the part that changed how I think about this. These aren't bugs a careful senior writes
once and learns from — they're the _default_ output of a language model optimizing for "code
that runs," not "code that's safe."

When I had Claude generate 80 ordinary Node.js functions with no security context,
[**65–75% shipped a security hole**](https://ofriperetz.dev/articles/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities)
— hardcoded fallbacks, `eval`-as-parser, loose comparisons on tokens — the exact CWE classes
these 28 rules cover. Expanded to
[700 functions across five Gemini and Claude models](https://ofriperetz.dev/articles/we-ranked-5-ai-models-by-security-the-leaderboard-is-wrong)
(20 prompts × 7 iterations × 5 models, run 2026-02-09), the per-model rate ranged **49–73%**.
Gemini 2.5 Pro was the _highest_ at 73%; Claude Haiku 4.5 the lowest at 49% — mostly because it
writes less code, which is a fact about output volume, not about security judgement. On the JWT
prompt, one model was flagged **7 out of 7 runs**.

The reviewer approving the four-second diff is increasingly approving a diff a model wrote. And
when you ask the model to _fix_ the finding without deterministic feedback,
[**1 in 3 "fixes" introduces a brand-new vulnerability**](https://ofriperetz.dev/articles/the-ai-hydra-problem-fix-one-ai-bug-get-two-more)
in a different category — the original finding disappears, the diff looks like progress, and the
reviewer approves it.

A rule that fires deterministically on the _shape_ in the source — every commit, human- or
machine-authored — is the only part of this loop that doesn't get tired and doesn't care which
model wrote the line.

Related: [No Hardcoded Credentials — Entropy Isn't Enough](https://ofriperetz.dev/articles/no-hardcoded-credentials-entropy-isnt-enough) · [The 30-Minute Security Audit: A Static Analysis Protocol for Onboarding](https://ofriperetz.dev/articles/the-30-minute-security-audit-onboarding-a-new-codebase)

---

## The full 28-rule map

All 28 rules with each rule's declared CWE, and — the column people actually want — what it does
in `recommended`. A dash means the rule exists but is off by default; you get it from `strict`,
or by naming it in your own config.

| Rule                               | Catches                                | CWE      | In `recommended` |
| ---------------------------------- | -------------------------------------- | -------- | ---------------- |
| `no-hardcoded-credentials`         | Secrets/keys in source                 | CWE-798  | `error`          |
| `no-hardcoded-session-tokens`      | Session/JWT tokens in source           | CWE-798  | —                |
| `no-sensitive-data-exposure`       | Secrets/PII in logs and error messages | CWE-532  | `warn`           |
| `no-pii-in-logs`                   | Email/SSN/card in console logs         | CWE-359  | —                |
| `no-unsafe-deserialization`        | Deserializing untrusted data           | CWE-502  | `warn`           |
| `no-graphql-injection`             | GraphQL injection / DoS                | CWE-89   | `warn`           |
| `no-ldap-injection`                | LDAP injection                         | CWE-90   | `error`          |
| `no-xpath-injection`               | XPath injection                        | CWE-643  | `error`          |
| `no-xxe-injection`                 | XML external entity                    | CWE-611  | `error`          |
| `no-format-string-injection`       | Format-string injection                | CWE-134  | —                |
| `no-directive-injection`           | Template directive injection           | CWE-96   | —                |
| `no-template-injection`            | Server-side template injection (SSTI)  | CWE-94   | `error`          |
| `detect-object-injection`          | `obj[userKey]` / prototype pollution   | CWE-915  | `warn`           |
| `detect-non-literal-regexp`        | `RegExp(variable)`                     | CWE-400  | `warn`           |
| `no-unsafe-regex-construction`     | Regex built from user input            | CWE-400  | `error`          |
| `no-redos-vulnerable-regex`        | Catastrophic-backtracking regex        | ReDoS¹   | `error`          |
| `no-missing-authentication`        | Route handler with no auth check       | CWE-287  | —²               |
| `require-backend-authorization`    | Missing server-side authz              | CWE-602  | —²               |
| `no-privilege-escalation`          | Privilege-escalation patterns          | CWE-269  | `warn`           |
| `detect-weak-password-validation`  | Weak password requirements             | CWE-521  | —                |
| `no-weak-password-recovery`        | Weak password-reset flows              | CWE-640  | `warn`           |
| `no-improper-sanitization`         | Incomplete input sanitization          | CWE-116  | `error`          |
| `no-improper-type-validation`      | Missing/loose type validation          | CWE-1287 | —                |
| `no-insecure-comparison`           | `==`/`!=` on security values           | CWE-697  | `warn`           |
| `no-unchecked-loop-condition`      | Unbounded loop → DoS                   | CWE-400  | `warn`           |
| `no-unlimited-resource-allocation` | Unbounded allocation → DoS             | CWE-770  | `warn`           |
| `no-electron-security-issues`      | Insecure Electron config               | CWE-16   | —                |
| `require-secure-defaults`          | Insecure-by-default config             | CWE-1188 | —                |

¹ `no-redos-vulnerable-regex` targets the MITRE ReDoS class (CWE-1333); the others above carry the CWE declared in their rule metadata.
² Deprecated in this plugin — both assume an Express route-handler shape, so they moved to `eslint-plugin-express-security`. Still exported here for backwards compatibility; don't build on them.

**5 presets** (v3.3.3):

| Preset               | Rules | Severity        | Use it when                                             |
| -------------------- | ----- | --------------- | ------------------------------------------------------- |
| `flagship`           | 2     | all `error`     | You want the highest-signal subset gating CI on day one |
| `recommended`        | 18    | 8 error/10 warn | Default. Start here                                     |
| `recommended-strict` | 18    | all `error`     | Same rules, zero tolerance — the graduation step        |
| `strict`             | 28    | all `error`     | Everything on, including the opinionated ones           |
| `owasp-top-10`       | 11    | mapped          | You're reporting against OWASP categories specifically  |

```js
export default [
  configs.recommended, // 18 rules — start here
  // configs.flagship,             // the 2 ecosystem-flagship rules only
  // configs["recommended-strict"], // same 18, all as errors
  // configs.strict,               // all 28 as errors
  // configs["owasp-top-10"],      // the 11 OWASP-mapped rules
];
```

---

## Compatibility

Verified on v3.3.3, 2026-07-28.

| Surface              | Support                                                                                                                                                                            |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Package managers** | npm, yarn, pnpm, bun — plain dev dependency                                                                                                                                        |
| **Node**             | `>= 18.0.0` (the run above was Node v18.16.1)                                                                                                                                      |
| **ESLint**           | `^8.0.0 \|\| ^9.0.0 \|\| ^10.0.0`, flat config                                                                                                                                     |
| **Module system**    | CommonJS — loads from `eslint.config.js`, `.mjs`, and `.cjs` alike                                                                                                                 |
| **TypeScript**       | Works, but bring your own parser — the presets set no `files` pattern (see step 2)                                                                                                 |
| **Peer deps**        | `eslint` only. Four small runtime deps ship with the package; nothing for you to configure                                                                                         |
| **Type-aware lint**  | Not required. Rules read the AST — no `project` / `tsconfig` wiring, no type-check cost                                                                                            |
| **Oxlint**           | All 28 rules load under Oxlint's JS-plugin runner: `{ "jsPlugins": ["eslint-plugin-secure-coding/oxlint"] }`. The flagship pair is parity-checked in CI; ESLint is the tested path |

---

## Honest scope — what "28 rules" means and what it doesn't

- **It's 28 rules, not "89."** The published `recommended` enables 18, `strict` turns on all 28.
  The breadth is in CWE _coverage_, not rule count.
- **"OWASP coverage" is the `owasp-top-10` preset, and it's checkable.** 11 rules wired to named
  categories — open the config and count them yourself. It is not a claim that the whole Top 10
  is handled: categories like vulnerable dependencies and security misconfiguration aren't
  source-shape problems, and no linter settles them.
- **Several of these are name-gated heuristics, not
  [taint analysis](https://ofriperetz.dev/articles/taint-vs-heuristic-detection).** You saw it in
  Violation 2: rename the variable and the rule goes quiet. Knowing which of your rules are
  structural and which are name-gated is the difference between using this tool and trusting it.
- **[Linting is not SAST](https://ofriperetz.dev/articles/static-analysis-vs-sast-vs-linting),
  and a floor is not a ceiling.** These rules prove a dangerous _shape_ isn't in your source.
  They can't prove your auth logic is correct or your validator complete — pair them with reviews
  and runtime controls. What they do is run on every commit and never get tired.

And the thing I promised at the top. The first version of this guide was written from memory.
Revising it in July, I finally ran its own examples through my own plugin — and two of the four
didn't fire. The reset-token snippet used a variable name my rule doesn't match; the
unhandled-rejection snippet described a bug this plugin has no rule for at all. A
getting-started guide for a tool I maintain, half the detections wrong, and nobody caught it,
because prose doesn't have a test suite.

Which is also the argument for the tool. I know this plugin better than anyone alive and I still
couldn't predict its output from memory. Neither can your reviewer, at 4pm, on the eleventh file
of a long PR. Don't trust the prose. Run the linter — including on mine.

---

## Where this sits in the ecosystem

`eslint-plugin-secure-coding` is the framework-agnostic base layer of the
[Interlace](https://eslint.interlace.tools) family. The per-framework plugins (`-pg`, `-jwt`,
`-nestjs-security`, `-node-security`, `-express-security`, `-lambda-security`) sit _on top_ of it
— that's where `no-math-random-crypto`, the Express route-auth rules and the JWT algorithm checks
live. Each of those guides assumes `secure-coding` is already in your config. If you're going to
run more than one, this is the one to install first.

---

## Your next move

```bash
npm install --save-dev eslint-plugin-secure-coding
```

Paste the config from step 2, run `npx eslint .` once against the repo you already have open, and
read what comes back. Even if you fix none of it today, you'll have a number for how much of this
is in your codebase — and that number is the only honest place to start.

Then, to watch these same rules run on code neither of us wrote:
[Claude Wrote a NestJS Service. ESLint Found 6 Security Holes.](https://ofriperetz.dev/articles/claude-wrote-nestjs-service-eslint-found-6-security-holes)
— 200 lines of model output that TypeScript compiled clean.

- 📦 [npm: eslint-plugin-secure-coding](https://www.npmjs.com/package/eslint-plugin-secure-coding)
- 📖 [Full rule docs (per-rule CWE + OWASP mapping)](https://eslint.interlace.tools/docs/security/plugin-secure-coding/rules)
- 💻 [Source on GitHub](https://github.com/ofri-peretz/eslint/tree/main/packages/eslint-plugin-secure-coding)

**Run it and tell me what the first line said** — which rule fired, and what everyone was looking
at instead when that line got approved. I'm most interested in the findings you disagree with: a
rule firing where it shouldn't is a bug report I can act on, and this revision exists because I
found two of those in my own examples.

::dev-to-cta{url="https://www.npmjs.com/package/eslint-plugin-secure-coding"}
📦 `npm install --save-dev eslint-plugin-secure-coding` — 28 rules, one dev dependency.
::

---

_[eslint-plugin-secure-coding](https://www.npmjs.com/package/eslint-plugin-secure-coding) is part of the [Interlace ESLint ecosystem](https://eslint.interlace.tools). Source on [GitHub](https://github.com/ofri-peretz/eslint) · Follow: [Dev.to/ofri-peretz](https://dev.to/ofri-peretz)_
