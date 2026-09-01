---
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/claude-vs-gemini-4-security-domains-dead-heat-og.jpg?v=b2"
cover_image: "https://ofriperetz.dev/cdn/blog-cover-image/claude-vs-gemini-4-security-domains-dead-heat.jpg?v=b2"
title: "Claude vs Gemini Across 4 Security Domains: A Dead Heat — and the Hardening 63% of AI Code Skips"
description: "Same prompts, both CLIs, scored by the ESLint security plugins I wrote. Gemini tied Claude on JWT and MongoDB, won the NestJS round, and never shipped a high-severity injection bug. The real finding: both frontier models miss the exact same hardening — the negative space static analysis was built for."
slug: "claude-vs-gemini-4-security-domains-dead-heat"
published: true
date: "2026-05-31"
published_at: "2026-05-31T03:39:06.766Z"
tags:
  - "ai"
  - "security"
  - "googleai"
  - "eslint"
devto_id: 3785746
tier: "T3"
series: "AI Security Benchmark Series"
canonical_url: "https://ofriperetz.dev/articles/claude-vs-gemini-4-security-domains-dead-heat"
author:
---

The interesting result isn't who won. It's that across four security domains, Claude and Gemini missed **the same hardening steps** — and if you've shipped AI-generated auth middleware this year, your code almost certainly has the same gaps, and your review didn't catch them either.

For the record, the scoreboard: **one Gemini win, two ties, one split — a [statistical dead heat](https://ofriperetz.dev/articles/statistical-significance-p-value).** That's the last time the _winner_ matters in this article.

Here's the number that should bother you more than any leaderboard: across 700 AI-generated functions scored by the rules I'm about to use, **63% shipped a vulnerability**. So "which model writes more secure code?" is mostly the wrong question — I've [run that leaderboard myself](https://dev.to/ofri-peretz/we-ranked-5-ai-models-by-security-the-leaderboard-is-wrong-5a4o) and argued it's the wrong frame. But people keep asking it, so I ran it properly — on the ESLint security plugins I wrote specifically to catch these bugs, each mapped to a [CWE](https://ofriperetz.dev/articles/cwe-taxonomy-explained) — to show you what actually matters.

**Skip to:** [The scorecard](#the-scorecard) · [JWT round](#round-2--jwt-a-55-tie-missing-the-identical-rfc-8725-steps) · [MongoDB round](#round-3--mongodb-both-leaked-passwords-neither-got-injected) · [Injection round](#round-4--general-injection-the-count-lies) · [When the tie inverts](#the-honest-caveat-task-type-changes-everything) · [What it means](#what-this-actually-means)

## The setup

Four domains, four of my plugins. For each, the _same_ feature-only prompt (no "make it secure" hint — that's how people actually use these tools), generated once by **Gemini 2.5 Flash via the Gemini CLI** and once by **Claude Sonnet 4.6 via the Claude CLI**, then linted with the domain's plugin on `recommended` (both CLI runs, May 2026).

_Method honesty: this is Gemini **Flash** vs Claude **Sonnet** — the comparable price/latency tier each vendor's CLI defaults to (Pro and Opus are a separate bracket; more on that below). It compares CLI tooling, system prompt included, not raw models under controlled decoding. [n=1 per domain](https://ofriperetz.dev/articles/sample-size-and-statistical-power) — but I re-ran the JWT round, and both models landed on 5 findings again with the same core misses, so treat these as directional with stable failure modes, not ±0 gospel._

## The scorecard

| Domain                      | Prompt                    | Plugin             | Gemini | Claude |
| --------------------------- | ------------------------- | ------------------ | ------ | ------ |
| **NestJS** service          | users + auth + admin      | `nestjs-security`  | **2**  | 6      |
| **JWT** auth                | login + verify middleware | `jwt`              | 5      | 5      |
| **MongoDB** data layer      | Mongoose model + search   | `mongodb-security` | 8      | 8      |
| **General API** (injection) | import + search + reset   | `secure-coding`    | 9      | 13\*   |

One Gemini win, two dead heats, one split. The frontier security gap is **smaller than the discourse suggests** — and the count is the least interesting number here.

_Table legend below: `✗` = one violation of that rule, `✗✗` = two, `✗✗✗` = three, `—` = rule didn't fire (clean)._

## Round 1 — NestJS: Gemini's idiomatic scaffolding wins

The one clean win, [written up in full separately](https://dev.to/ofri-peretz/i-ran-the-same-nestjs-prompt-on-claude-and-gemini-one-got-6-security-errors-heres-what-both-1fnf). Short version: asked for a users service, Gemini's CLI reached for idiomatic NestJS — class-level `@UseGuards`, `@Exclude()` on the password field, `class-validator` on every DTO. `nestjs-security` found **2** issues. Claude wrote functionally identical code with none of that scaffolding and drew **6**.

In an opinionated framework, Gemini defaults to the secure idiom. Hold that thought.

## Round 2 — JWT: a 5–5 tie, missing the identical RFC 8725 steps

Both wrote clean `jsonwebtoken` code: a signed login token, middleware that _verifies_ (no `jwt.decode` shortcut, no `alg: none`, no hardcoded secret — every catastrophic JWT footgun avoided by both). Then both stopped at exactly the same place:

| `jwt` rule                                                                                                                 | CWE     | Gemini | Claude |
| -------------------------------------------------------------------------------------------------------------------------- | ------- | ------ | ------ |
| [`require-algorithm-whitelist`](https://eslint.interlace.tools/docs/security/plugin-jwt/rules/require-algorithm-whitelist) | CWE-757 | ✗      | ✗      |
| [`require-audience-validation`](https://eslint.interlace.tools/docs/security/plugin-jwt/rules/require-audience-validation) | CWE-287 | ✗      | ✗      |
| `require-issuer-validation`                                                                                                | CWE-287 | ✗      | ✗      |
| `require-max-age`                                                                                                          | CWE-294 | ✗      | ✗✗     |
| `no-sensitive-payload`                                                                                                     | CWE-359 | ✗      | —      |

Here's _why it survives review_: a reviewer reading `jwt.verify(token, secret)` sees a verify call and ships it. Nobody asks the next question — verifies _for whom?_ Without an `audience` option, a token your service minted for a _different_ API sails straight through. That blind spot is exactly what `require-audience-validation` encodes, and it's why both models — and most human review — walk past it. Call the round 5–5.

## Round 3 — MongoDB: both leaked passwords, neither got injected

The finding that should make you check your own repo first: both models wrote the search to return **whole documents — password hashes included — with no projection**.

```typescript
// Both models, essentially:
const results = await User.find(filter); // ships passwordHash to the caller
// the fix neither wrote:
const results = await User.find(filter).select("-passwordHash").lean();
```

That's `require-projection` (CWE-200) and `no-select-sensitive-fields` firing on both sides. The pleasant surprise: the prompt hands a user-supplied search object straight into a Mongoose query — a textbook `$where`/operator-injection trap — and **both models sidestepped it.** Zero `no-operator-injection`, zero `no-unsafe-where`, zero `no-unsafe-query` on either side. The frontier has internalized "don't interpolate untrusted input into a query." It just hasn't internalized "don't hand back the password column."

| `mongodb-security` rule                                                                                               | CWE     | Gemini | Claude |
| --------------------------------------------------------------------------------------------------------------------- | ------- | ------ | ------ |
| `require-schema-validation`                                                                                           | CWE-20  | ✗✗✗    | ✗      |
| [`require-projection`](https://eslint.interlace.tools/docs/security/plugin-mongodb-security/rules/require-projection) | CWE-200 | ✗      | ✗✗     |
| `require-lean-queries`                                                                                                | CWE-400 | ✗      | ✗✗     |
| `no-select-sensitive-fields`                                                                                          | CWE-200 | ✗      | ✗✗     |
| `no-unbounded-find`                                                                                                   | CWE-400 | ✗      | —      |
| `no-bypass-middleware`                                                                                                | CWE-284 | ✗      | ✗      |

Different distribution, same total (8–8) — but one cell deserves an honest call-out, because it cuts _against_ my own headline: `require-schema-validation` fired **three times on Gemini and once on Claude**. Here, Claude was the more disciplined one — it wired up more of Mongoose's schema-level validation, where Gemini leaned on looser typing. "Gemini is frontier-grade" doesn't mean "Gemini wins every cell"; this is a cell it lost. (And yes, `require-lean-queries` is CWE-400, not classic injection — `.lean()` returns plain objects instead of hydrated Mongoose documents, and on an unbounded search that's a real memory-exhaustion lever, which is why it's scored as a resource control, not a nice-to-have.)

## Round 4 — General injection: the count lies

\*The asterisk. On a raw injection-prone API (JSON/XML import, dynamic search, password reset), `secure-coding` flagged Gemini **9** and Claude **13** — but that count is backwards. Claude's extra findings came from Claude _doing more_: it explicitly rejected XML `DOCTYPE`/`ENTITY` (XXE-hardened), allowlisted the search field, and actually implemented token verification. And here's the honest part — it implemented some of that _insecurely_:

```typescript
// Claude's reset flow — CWE-208, timing-unsafe:
if (providedToken === storedToken) {
  /* ...reset... */
}

// The fix — hash both to a fixed length first, then compare:
import { createHash, timingSafeEqual } from "crypto";
const hash = (s: string) => createHash("sha256").update(s).digest();
if (timingSafeEqual(hash(providedToken), hash(storedToken))) {
  /* ...reset... */
}
// Direct timingSafeEqual(Buffer.from(a), Buffer.from(b)) throws if lengths differ,
// leaking token length to an attacker — always normalise lengths first.
```

Claude wrote that `===` comparison **five times** (`no-insecure-comparison`, CWE-208). It's the one _real_ vulnerability either model introduced across this entire benchmark — and it exists precisely _because_ Claude built the verification surface at all. Gemini's leaner 97 lines issued a token and never compared one, so it had no surface to get wrong. Count favored Gemini; substance is genuinely mixed: Claude hardened more **and** shipped the only real bug.

## The honest caveat: task type changes everything

Before anyone screenshots "Gemini ties Claude on security" — that holds for _realistic, structured_ tasks. On **isolated, security-sensitive functions** it inverts. In a [separate 700-function run](https://dev.to/ofri-peretz/aggregate-benchmarks-lie-heres-what-700-ai-functions-look-like-by-security-domain-1hgj) scored by these same plugins, the average vulnerability rate was **63%** — and **Gemini 2.5 Pro was the _most_ vulnerable model at 72.9%** (Flash sat mid-pack at 63.6%). Build a _service_ and Gemini's scaffolding shines; [ask for a stack of risky functions in isolation](https://dev.to/ofri-peretz/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities-414o) and every model — Gemini included — leaks. Context is the variable, not the logo.

(The whole method rests on "scored by the plugins I wrote," so a fair question is whether the _scorer_ is trustworthy — [here's what ground truth caught that my own unit tests missed](https://dev.to/ofri-peretz/what-ground-truth-caught-that-unit-tests-missed-3-real-bugs-in-9-flagship-lint-rules-o0b).)

## What this actually means

Strip out the leaderboard and two things are left:

1. **Gemini is a frontier-grade secure default.** It tied or beat Claude in three of four domains, won the framework round outright, and never shipped a [high-severity](https://ofriperetz.dev/articles/cvss-scores-explained) injection or auth-bypass bug — no NoSQL operator injection, no `alg: none`, no `jwt.decode`-without-verify, no `eval`, no hardcoded credentials, in any domain. (The lone _introduced_ vulnerability was Claude's timing-unsafe token comparison — CWE-208. In fairness it's probably the _lower_-risk finding here: a high-entropy token compared after a DB lookup is hard to attack through network jitter, and the _latent_ gap both models share — an unpinned JWT algorithm with no `aud`/`iss` validation — is the one most appsec engineers would patch first. "Hardening" undersells it; I'm flagging it as the missing control, not as harmless.) If you're building with Gemini, you're starting from a credible security baseline.
2. **No frontier model is security-_complete_.** The misses weren't random — they were the _same_ negative-space hardening (algorithm allowlists, audience validation, query projections, schema validation, auth) that no model infers from a feature prompt, because the prompt never named it. That gap doesn't close with a better model. It closes with a tool that checks the constraints you didn't write down.

Which is the whole point of static analysis: it asks the questions your prompt didn't.

## The config (runs on output from either model)

```javascript
// eslint.config.mjs
import jwt from "eslint-plugin-jwt";
import mongodbSecurity from "eslint-plugin-mongodb-security";
import nestjsSecurity from "eslint-plugin-nestjs-security";
import secureCoding from "eslint-plugin-secure-coding";
import tsParser from "@typescript-eslint/parser";

export default [
  // TypeScript parser so decorators and types resolve
  { files: ["**/*.ts"], languageOptions: { parser: tsParser } },
  // Each plugin ships a flat `recommended` preset (plugin + rules)
  jwt.configs.recommended,
  mongodbSecurity.configs.recommended,
  nestjsSecurity.configs.recommended,
  secureCoding.configs.recommended,
];
```

```bash
npm install --save-dev eslint-plugin-jwt eslint-plugin-mongodb-security \
  eslint-plugin-nestjs-security eslint-plugin-secure-coding
npx eslint src/
```

Every rule maps to a CWE so an AI agent and a human read the same signal. Full docs at [eslint.interlace.tools](https://eslint.interlace.tools).

---

Which hardening step does _your_ AI-generated code skip most — the algorithm allowlist, the audience check, or the query projection? Open the file and look. I'll bet it's at least two of the three. Tell me which ones — I'm collecting scorecards.

---

_Part of the [AI Security Benchmark Series](https://dev.to/ofri-peretz/series/35564):_
_← [Same NestJS Prompt. Claude Got 6 Security Errors. Gemini Got 2.](https://dev.to/ofri-peretz/i-ran-the-same-nestjs-prompt-on-claude-and-gemini-one-got-6-security-errors-heres-what-both-1fnf) · **Frontier Dead Heat (you are here)** · next → (coming soon)_

---

📦 [`eslint-plugin-jwt`](https://www.npmjs.com/package/eslint-plugin-jwt) · [`eslint-plugin-mongodb-security`](https://www.npmjs.com/package/eslint-plugin-mongodb-security) · [`eslint-plugin-nestjs-security`](https://www.npmjs.com/package/eslint-plugin-nestjs-security) · [`eslint-plugin-secure-coding`](https://www.npmjs.com/package/eslint-plugin-secure-coding) · [Rule docs](https://eslint.interlace.tools)

{% cta <https://github.com/ofri-peretz/eslint> %}
⭐ Star on GitHub
{% endcta %}

---

[GitHub](https://github.com/ofri-peretz) | [X](https://x.com/ofriperetzdev) | [LinkedIn](https://linkedin.com/in/ofri-peretz) | [Dev.to](https://dev.to/ofri-peretz) | [ofriperetz.dev](https://ofriperetz.dev)

---

👇 **Drop your scorecard below** — algorithm allowlist, audience check, or query projection: which one does your AI-generated code skip? I'm collecting them.
