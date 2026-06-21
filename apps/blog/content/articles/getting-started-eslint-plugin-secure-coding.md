---
title: "A Hardcoded sk_live_ Key Passes Code Review. It Won't Pass These 27 ESLint Rules."
description: "Hardcoded secrets, unsafe deserialization, LDAP/XPath/GraphQL injection, prototype pollution — language-level bugs that pass review and tests, then become CVEs. The same CWE classes AI assistants write by default. 27 CWE-mapped ESLint rules that catch them in CI, framework-agnostic."
slug: "getting-started-eslint-plugin-secure-coding"
canonical_url: "https://ofriperetz.dev/articles/getting-started-eslint-plugin-secure-coding"
devto_url: "https://dev.to/ofri-peretz/getting-started-with-eslint-plugin-secure-coding-1eda"
devto_id: 3138988
published_at: "2025-12-31T21:31:41Z"
edited_at: "2026-01-11T10:21:50Z"
cover_image: "https://ofriperetz.dev/og/cover/getting-started-eslint-plugin-secure-coding"
social_image: "https://ofriperetz.dev/og/article/getting-started-eslint-plugin-secure-coding"
reading_time_minutes: 9
tags:
  - "eslint"
  - "security"
  - "javascript"
  - "ai"
author:
  name: "Ofri Peretz"
  username: "ofri-peretz"
  avatar: "https://media2.dev.to/dynamic/image/width=640,height=640,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Fuser%2Fprofile_image%2F3669992%2F50a1f256-472c-48a1-85e8-149459647ea7.png"
  twitter: "ofriperetzdev"
series: "The Hardened Stack"
---

A reviewer approves this diff in four seconds:

```ts
const stripe = new Stripe("sk_live_51H8xY2eZvKf...");
```

It passes the type-checker. It passes every unit test. It ships. Three weeks
later it's in a public commit, a security researcher greps your org's repos for
`sk_live_`, and you're rotating keys at 2am.

Hardcoded secrets are **CWE-798**. They're not a logic bug a test can catch —
the code _works_. They're a property of the source text, which is exactly what
a linter is good at. The problem is that the linters most teams run check
_style_: quotes, semicolons, unused vars. They have nothing to say about
`sk_live_`.

**Why does a senior wave this through?** Because review attention is a budget,
and that diff spends none of it. The line is syntactically clean, the variable
is named exactly what it is, and the reviewer's eye is downstream — on the
control flow, the error handling, the thing the PR description says it's about.
"Is this string a live credential?" is not a question a human pattern-matches at
review speed; it's a question you answer by _grepping the literal_, which is
machine work. The diff doesn't survive because the team is careless. It survives
because catching it is the wrong job for a person.

**`eslint-plugin-secure-coding` is the layer that does.** It's 27 rules for
_language-level_ security bugs — hardcoded credentials, unsafe deserialization,
LDAP/XPath/GraphQL/XXE injection, prototype pollution, insecure comparison,
ReDoS — every one pinned to a CWE and carrying a CVSS score and compliance
tags. It's deliberately framework-agnostic: no Express, no Nest, no AWS
specifics (those live in dedicated plugins). Just the mistakes you can make in
plain JavaScript or TypeScript that turn into CVEs.

This is the getting-started guide: how the flagship rule actually decides what
a credential is, the full 27-rule map, install/config across all package
managers, and the exact ESLint/Oxlint versions it runs under.

---

## TL;DR

- **27 rules**, every one carrying a `CWE` id, a CVSS score, and compliance
  tags (SOC2 / PCI-DSS / HIPAA / GDPR / …).
- **4 presets**: `flagship` (the 2 ecosystem-flagship rules), `recommended`
  (18 rules), `strict` (all 27), `owasp-top-10` (12 rules mapped to OWASP
  categories — the mapping is checkable below).
- **Framework-agnostic.** "Pure coding security": language-level vulns only.
  Framework-specific checks (Express, NestJS, Lambda, Postgres, …) live in
  their own plugins — this one is the base layer underneath them.
- **Flat-config**, CommonJS package, ESLint `8 || 9 || 10`, Node `>= 18`. No
  runtime peer deps — it lints source, not your dependency tree.

---

## The flagship rule: how `no-hardcoded-credentials` actually decides

A naive secret scanner greps for `password` and high-entropy strings, then
drowns you in false positives on UUIDs, test fixtures, and base64 blobs. The
reason this rule is usable in CI is that it makes **two different decisions**
depending on what it's looking at.

**1. Registered key formats fire anywhere — no context needed.** Some token
shapes are unambiguous: their prefix is owned by a vendor and means exactly one
thing. The rule matches these structurally, wherever they appear:

```ts
// ❌ no-hardcoded-credentials (CWE-798) — structural match, fires anywhere
const stripe = new Stripe("sk_live_51H8xY2eZvKf..."); // Stripe secret key
const aws = { accessKeyId: "AKIAIOSFODNN7EXAMPLE" }; // AWS access key
```

The pattern set covers Stripe (`sk_live_`/`sk_test_`/`pk_live_`/`pk_test_`/
`rk_live_`/`rk_test_`), AWS (`AKIA…`), and generic 32+ char API-key shapes.
Because `sk_test_` and `pk_test_` are _also_ registered prefixes, a test key in
a fixture **will** trip the rule — that's intentional (a leaked test key is
still a leak), and it's why the `allowInTests` option and per-line disables
exist (see below).

**2. Everything else needs a credential-named context.** For generic secrets
(a literal assigned to something), firing on every long string would bury you.
So the rule only flags a literal when the surrounding identifier _names_ a
credential and it clears `minLength`:

```ts
// ❌ flagged: identifier names a credential + length >= minLength (default 8)
const apiKey = "a8f5f167f44f4964e6c998dee827110c";
const dbPassword = "hunter2-prod-x9";

// ✅ NOT flagged: same-shaped string, no credential-named context
const requestId = "a8f5f167f44f4964e6c998dee827110c";
const greeting = "welcome to the dashboard";
```

This identifier-name gate is what keeps the false-positive rate low enough to
run as a CI error instead of a warning everyone ignores. It's not a theoretical
concern: a context-blind credential regex on `vercel/ai` reported 842 "findings"
— and sampling showed 807 of them were TypeScript union-type literals,
error-class names, and the string `"test"`, not secrets. That noise is exactly
what drove the two-mode design above; the full teardown is in
[When entropy isn't enough](https://ofriperetz.dev/articles/no-hardcoded-credentials-entropy-isnt-enough).
That's the difference between a rule you leave on and a rule you mute by Friday.

**The fix it wants** — pull the value out of source entirely:

```ts
// ✅
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
```

**Where the CWE/CVSS/compliance tags come from.** The rule declares
`CWE-798`; the shared CWE map in the engine enriches that into the OWASP
category (`A04:2025`), a CVSS score (`9.8`), and the compliance frameworks the
weakness touches (`SOC2, PCI-DSS, HIPAA, GDPR, …`). So the finding isn't a bare
"bad" — it's an audit-ready line your compliance reviewer can map directly.
Tune it for your repo:

```js
"secure-coding/no-hardcoded-credentials": ["error", {
  allowInTests: true,   // don't flag in *.test.* / __tests__ (default: false)
  minLength: 12,          // raise the generic-secret length floor (default: 8)
  detectDatabaseStrings: true,
  ignorePatterns: ["^EXAMPLE_"], // regexes to skip
}]
```

For a known-safe fixture, a scoped disable is honest and self-documenting:

```ts
// eslint-disable-next-line secure-coding/no-hardcoded-credentials -- documented test fixture
const EXAMPLE_KEY = "pk_test_example";
```

---

## A second bug a test won't catch: `no-unsafe-deserialization`

Deserialization of untrusted data (**CWE-502**) is the quiet RCE. The code
round-trips fine in every test because your tests feed it trusted input:

```ts
// ❌ no-unsafe-deserialization (CWE-502) — eval as a deserializer = RCE
const obj = eval("(" + untrustedJson + ")");
```

```ts
// ✅ the rule's own fix
const obj = JSON.parse(untrustedJson); // and validate shape/size before use
```

The rule flags `eval`-as-parser and unsafe deserialization sinks, and (notably)
treats **AI model/tool output** as untrusted too — the fix message reminds you
to validate it via schema and size limits before deserializing.

---

## Why an AI assistant will write both of these for you

Here's the part that changed how I think about this plugin. These aren't bugs a
careful senior writes once and learns from — they're the _default_ output of a
language model that's optimizing for "code that runs," not "code that's safe."

I asked Claude (four model tiers) to generate 80 ordinary Node.js functions
with no security context and counted the vulnerabilities:
**65–75% of them shipped a security hole** — hardcoded fallbacks, `eval`-as-parser,
loose comparisons on tokens — the exact CWE classes the 27 rules above cover.
The full methodology and per-model numbers are in
[I Let Claude Write 80 Functions. 65–75% Had Security Vulnerabilities](https://ofriperetz.dev/articles/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities).
Same pattern holds across providers: point a model at "write me a Stripe client"
and `sk_live_...` as a default argument is a perfectly likely completion.

This is why a source-text linter matters _more_ now, not less. The reviewer
approving the four-second diff at the top of this article is increasingly
approving a diff a model wrote. And when you ask the model to _fix_ the finding,
it often trades one CWE for another — I measured that
[fix-one-get-two-more loop here](https://ofriperetz.dev/articles/the-ai-hydra-problem-fix-one-ai-bug-get-two-more).
A rule that fires deterministically on the _shape_ in the source — every commit,
human- or machine-authored — is the only part of this loop that doesn't get
tired or talked out of its answer. Want to run these same rules against your
own AI-generated code? The install block is two sections down.

---

## The full rule set

All 27, grouped, with each rule's declared CWE:

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

¹ `no-redos-vulnerable-regex` targets the MITRE ReDoS class (CWE-1333); the
others above carry the CWE declared in their rule metadata.

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

Flat config (`eslint.config.js`):

```js
// `configs` is a NAMED export; the default export is the plugin object.
import { configs } from "eslint-plugin-secure-coding";

export default [
  configs.recommended, // 18 rules — the sane default
  // configs.flagship,    // the 2 ecosystem-flagship rules only
  // configs.strict,      // all 27 as errors
  // configs["owasp-top-10"], // the 12 OWASP-mapped rules
];
```

Tune any rule inline — the preset already registers the `secure-coding`
namespace, so a later config object can reference it directly:

```js
import { configs } from "eslint-plugin-secure-coding";

export default [
  configs.recommended,
  {
    rules: {
      "secure-coding/no-pii-in-logs": "warn",
      "secure-coding/no-hardcoded-credentials": [
        "error",
        { allowInTests: true },
      ],
    },
  },
];
```

Run it:

```bash
npx eslint .
```

Each finding carries the CWE, OWASP category, CVSS, severity, compliance tags,
and the fix:

```text
src/payments.ts
  4:24  error  🔒 CWE-798 OWASP:A04-Cryptographic CVSS:9.8 | Hard-coded API key detected | CRITICAL [SOC2,PCI-DSS,HIPAA,GDPR]
               Fix: Use environment variable: process.env.STRIPE_SECRET_KEY or secret management service | https://cwe.mitre.org/data/definitions/798.html
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
| **Oxlint**           | Loads under Oxlint's JS-plugin runner via the `interlace-secure-coding` port; the flagship rules are wired into the Oxlint config and parity-checked in CI. The full 27-rule set runs on ESLint today. |

---

## Honest scope — what "27 rules" means and what it doesn't

- **It's 27 rules, not "89."** Earlier copy floated bigger numbers; the
  published `recommended` enables 18, `strict` turns on all 27, and that's the
  whole plugin. The breadth is in CWE _coverage_, not rule count.
- **"OWASP coverage" is the `owasp-top-10` preset, and it's checkable.** That
  preset wires 12 rules — `no-missing-authentication`, `no-privilege-escalation`,
  `no-hardcoded-credentials`, `no-sensitive-data-exposure`, `no-graphql-injection`,
  `no-xxe-injection`, `no-xpath-injection`, `no-ldap-injection`,
  `no-weak-password-recovery`, `no-improper-type-validation`,
  `no-insecure-comparison`, `no-unsafe-deserialization` — each mapped to an
  OWASP category (the 12 are listed right here; the per-rule CWE/OWASP detail
  lives in the [rule docs](https://eslint.interlace.tools/docs/security/plugin-secure-coding/rules)).
  No "100% of everything" claim — and for the honest version of how far source
  analysis gets you across the whole list, see
  [8 of the OWASP Top 10 Are ESLint Rules. 2 Aren't](https://ofriperetz.dev/articles/mapping-your-codebase-to-owasp-top-10-with-247-eslint-rules),
  which walks the two categories (Insecure Design, Vulnerable Components) no
  linter can prove.
- **Static analysis is a floor.** These rules prove a dangerous _shape_ isn't
  in your source. They can't prove your auth logic is correct or your validator
  is complete — pair them with reviews and runtime controls. They run on every
  commit and never get tired; that's the value.

---

## Where this sits in the ecosystem

The widely-used generic linters (`eslint-plugin-security` and friends) overlap
some of this surface but emit a bare rule id. `secure-coding` adds the depth a
security or compliance reviewer actually needs: a CWE, a CVSS, compliance tags,
and a heuristic (like the two-mode credential detector above) tuned to stay
quiet on fixtures. For where it lands against the field, I put it through a
head-to-head in
[17 ESLint Security Plugins, Compared](https://ofriperetz.dev/articles/benchmark-17-eslint-security-plugins-compared).

It's the framework-agnostic base layer of the
[Interlace](https://eslint.interlace.tools) family — the per-framework plugins
([`eslint-plugin-pg`](https://ofriperetz.dev/articles/getting-started-eslint-plugin-pg),
[`-jwt`](https://ofriperetz.dev/articles/getting-started-eslint-plugin-jwt),
[`-nestjs-security`](https://ofriperetz.dev/articles/getting-started-eslint-plugin-nestjs-security),
[`-node-security`](https://ofriperetz.dev/articles/getting-started-eslint-plugin-node-security),
`-express-security`, `-lambda-security`, …) sit _on top_ of it for stack-specific
coverage. If you run more than one, this is the one you install first.

> **Series — The Hardened Stack.** This is the base-layer entry. Each
> per-framework guide above assumes `secure-coding` is already in your config and
> layers the stack-specific rules on top.

---

## Links

- 📦 [npm: eslint-plugin-secure-coding](https://www.npmjs.com/package/eslint-plugin-secure-coding)
- 📖 [Full rule docs (per-rule CWE + OWASP mapping)](https://eslint.interlace.tools/docs/security/plugin-secure-coding/rules)
- 💻 [Source on GitHub](https://github.com/ofri-peretz/eslint/tree/main/packages/eslint-plugin-secure-coding)

What's the secret you rotated at 2am — and was it a human or an AI completion
that put it in the source? Drop the CWE in the comments; I collect these.

::dev-to-cta{url="https://github.com/ofri-peretz/eslint"}
⭐ Star on GitHub if this caught something your code review wouldn't.
::

---

I'm **Ofri Peretz**, a security engineering leader and the author of the
Interlace ESLint ecosystem — domain-specific static analysis for security,
reliability, and performance on the Node.js stack. `secure-coding` is its
framework-agnostic base layer.

[ofriperetz.dev](https://ofriperetz.dev) · [LinkedIn](https://linkedin.com/in/ofri-peretz) · [GitHub](https://github.com/ofri-peretz)
