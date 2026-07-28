---
title: "65–75% of Claude's Code Shipped a Vuln. Hardcoded Secrets Are the One an Agent Can Actually Fix."
description: "AI assistants leave demo keys, placeholder passwords, and bare config literals in source — CWE-798 at scale. One ESLint rule catches the literal and prints a CWE/CVSS/compliance/fix line an agent can parse, so the model that wrote the bug can close it. Walked against eslint-plugin-secure-coding v3.3.2."
slug: "hardcoded-secrets-ai-agents-autofix"
canonical_url: "https://ofriperetz.dev/articles/hardcoded-secrets-ai-agents-autofix"
tier: "TOPIC"
devto_url: "https://dev.to/ofri-peretz/hardcoded-secrets-the-1-vulnerability-ai-agents-can-auto-fix-47cg"
devto_id: 3137474
published_at: "2025-12-31T05:39:36Z"
edited_at: "2026-07-28T00:00:00Z"
cover_image: "https://ofriperetz.dev/og/cover/hardcoded-secrets-ai-agents-autofix"
social_image: "https://ofriperetz.dev/og/article/hardcoded-secrets-ai-agents-autofix"
reading_time_minutes: 7
tags:
  - "ai"
  - "security"
  - "node"
  - "devsecops"
author:
  name: "Ofri Peretz"
  username: "ofri-peretz"
  avatar: "https://media2.dev.to/dynamic/image/width=640,height=640,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Fuser%2Fprofile_image%2F3669992%2F50a1f256-472c-48a1-85e8-149459647ea7.png"
  twitter: "ofriperetzdev"
series: "Hardening AI Agents"
---

`const JWT_SECRET = "your-secret-key";` — no human typed that line. A model did,
it passes every test you have, and it reads as scaffolding to whoever reviews
it, because in the training data that string genuinely was scaffolding.

When I had Claude generate 80 common Node.js functions with no security context,
[65–75% shipped with a vulnerability](https://ofriperetz.dev/articles/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities).
Hardcoded credentials weren't the most _frequent_ finding — 2 hits in the
60-function, 3-model slice of that corpus (`results/ai-security/2026-02-06.json`)
against 31 query-injection ones. They were the most _closable_: maximum
[CVSS](https://ofriperetz.dev/articles/cvss-scores-explained) of 9.8, exactly
one correct fix each. Ask an assistant to "wire up Stripe" and watch:

```ts
const stripe = new Stripe("sk_live_51H8xY2eZvKf..."); // demo key it left in
const db = new Pool({ password: "changeme" }); // placeholder it forgot to remove
const JWT_SECRET = "your-secret-key"; // the classic
```

**Why does this happen specifically with AI-generated code?** When a model
writes `password: "changeme"`, it isn't making a mistake — it's statistically
reproducing the most common string for that context out of millions of
tutorials, repos, and Stack Overflow answers, a meaningful share of which ship
real secrets and demo literals. On top of that, coding assistants optimize for
"runs on the first try," and the fastest path to runnable code is a literal in
place. So they emit **demo keys**, **placeholder credentials**, and **bare
config literals** at the speed they generate everything else. That's
**[CWE-798](https://ofriperetz.dev/articles/cwe-taxonomy-explained)** (Use of
Hard-coded Credentials), and it now enters codebases faster than any human ever
added it.

Here's what makes this fixable rather than just alarming: the same property that
makes AI a prolific _source_ of these bugs — it reads and writes structured text
— makes it a capable _fixer_. `eslint-plugin-secure-coding`'s
`no-hardcoded-credentials` rule emits a finding that carries the CWE, CVSS,
compliance tags, and the exact fix. Feed that back to the assistant and it
remediates its own output. This is the agentic-CI loop: **AI writes → linter
flags in machine-readable form → AI fixes.**

The shape of the finding is the whole ballgame. I ran one model (Opus 4.6,
2026-02-08) over the same 20 prompts twice: once
[handed specific lint findings, once told only to "be more
secure"](https://ofriperetz.dev/articles/the-ai-hydra-problem-fix-one-ai-bug-get-two-more).
With findings it fixed 15 vulnerability instances and introduced 2; with
prompting alone it fixed 15 and introduced 13. Same weights, same prompts — the
machine-readable channel was the entire difference.

Hardcoded credentials are the rare case where that loop closes completely. For
most vulnerability classes "fix it again" is a gamble, because the fix has
branches the model can get creative in. CWE-798 has none: hoist the literal to
`process.env`, done. That's why it's the **one** AI-introduced vulnerability
worth wiring into an autonomous loop first.

> **Series — Hardening AI Agents:** [I Let Claude Write 80 Functions (65–75% had a vuln)](https://ofriperetz.dev/articles/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities) → **Hardcoded secrets: the one AI can auto-fix** (you are here) → [Claude wrote a NestJS service — ESLint found 6 holes](https://ofriperetz.dev/articles/claude-wrote-nestjs-service-eslint-found-6-security-holes). The thread: AI writes the bug, a machine-readable lint finding closes the loop.

---

## TL;DR

- AI assistants introduce hardcoded secrets (**CWE-798**) at scale — demo keys,
  placeholder passwords, config literals left in source. Not the most common
  AI-written flaw; the one with a single deterministic fix, which is what makes
  it automatable.
- `no-hardcoded-credentials` (in `eslint-plugin-secure-coding` v3.3.2) emits a
  **structured, CWE-tagged** finding an agent can parse and act on. Fed specific
  findings instead of "be more secure," the same model introduced **2 new
  vulnerabilities instead of 13** (Opus 4.6, 2026-02-08 run).
- The detector is two-mode (registered key prefixes fire anywhere; generic
  secrets need a credential-named identifier), which is what keeps it quiet
  enough to run as a CI **error**. Full mechanism in the [secure-coding deep-dive](https://ofriperetz.dev/articles/getting-started-eslint-plugin-secure-coding).

> **Slack-quotable:** An AI assistant will write the secret and — handed the right error message — delete it. The whole question is whether your linter speaks a language the model can act on.

---

## Why the lint error is written for the machine

A human reads `error: hardcoded credential` and sighs. An AI agent reads the
_structure_ and acts. Point the rule at the literal Stripe key an assistant
left behind:

```ts
// src/payments.ts
import Stripe from "stripe";

const STRIPE_SECRET_KEY = "sk_live_51H8xY2eZvKfABCD1234";
export const stripe = new Stripe(STRIPE_SECRET_KEY);
```

Run `npx eslint .` and that's the exact, unedited finding v3.3.2 prints — line,
column, and all (paste the file above into a fresh repo with the rule enabled
and you'll get it character-for-character):

```text
src/payments.ts
  4:27  error  🔒 CWE-798 OWASP:A04-Cryptographic CVSS:9.8 | Hard-coded API key detected | CRITICAL [SOC2,PCI-DSS,HIPAA,GDPR]
   Fix: Use environment variable: process.env.STRIPE_SECRET_KEY or secret management service | https://cwe.mitre.org/data/definitions/798.html
```

Every token there is derived, not hand-typed: the CWE drives an auto-enrichment
table (`@interlace/eslint-devkit`) that fills in the OWASP category, CVSS score
and compliance set, so the finding can't drift out of sync with the
vulnerability class. Read left to right:

- **`CWE-798`** — a stable, machine-readable vulnerability class the model has
  seen thousands of times in training; it knows the remediation pattern.
- **`OWASP:A04-Cryptographic`** — the [OWASP Top 10](https://ofriperetz.dev/articles/owasp-top-10-explained) bucket CWE-798 maps to.
  Mind the year: _Cryptographic Failures_ is **A04 in 2025 and was A02 in
  2021** — same category, renumbered. Secrets in source are a key-management
  failure, so the finding slots into an OWASP report as-is.
- **`CVSS:9.8` + `CRITICAL`** — the severity the agent uses to prioritize this
  over a style nit.
- **`[SOC2,PCI-DSS,HIPAA,GDPR]`** — compliance frameworks, for an audit trail
  the agent can cite. First four of six; the formatter truncates to keep the
  line one terminal-width long.
- **`Fix:`** — the exact transformation (`→ process.env.STRIPE_SECRET_KEY`,
  derived from the variable name), so the edit is deterministic, not a guess.

Drop that into Cursor, Copilot, Claude Code or a CI agent and the fix is
mechanical: hoist the literal to an environment variable or a secret manager. A
vague "be secure" instruction becomes a closed, verifiable loop. One caveat
worth knowing up front — the rule ships that transformation as an editor
_suggestion_, not an unattended `eslint --fix`. Deliberately; see
[Honest scope](#honest-scope).

Want to see it fire on your own repo right now? An install, three lines of flat
config, one lint run:

```bash
npm install --save-dev eslint-plugin-secure-coding
```

```js
// eslint.config.mjs
import { configs } from "eslint-plugin-secure-coding";
export default [configs.flagship]; // credentials + ReDoS, both at `error`
```

```bash
npx eslint .   # any hardcoded sk_live_… / password: "…" is now a blocking error
```

(Per-repo tuning — the fuller `recommended` preset, allowing test fixtures — is
in [Install](#install) below.)

---

## The fix the rule wants

```ts
// ✅ no literal in source; the secret comes from the environment
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const db = new Pool({ password: process.env.DATABASE_PASSWORD });
// for higher assurance: fetch from AWS Secrets Manager / Vault at runtime
```

The rule flags the **bare literal** — `new Stripe("sk_live_…")`,
`password: "changeme"`, `const JWT_SECRET = "…"` — and its suggested fix hoists
it to a `process.env` reference, the exact shape the agent should have produced.
One deliberate nuance: an env read with a literal fallback
(`process.env.X || "dev-default"`) counts as **already remediated** and doesn't
fire, so an agent that applies the suggestion never re-triggers it. That's also
how a fallback quietly outlives the fix — see [Honest scope](#honest-scope).

## Why this survives code review — and why AI makes it worse

If hardcoded secrets are so obvious, why do they keep reaching `main`? The
failure isn't ignorance — it's the review process. Three things wave a
`sk_live_…` straight through:

- **It reads as a placeholder.** `password: "changeme"` looks like scaffolding
  the author will swap before merge. The reviewer pattern-matches "obvious dummy
  value" and moves on — and "before merge" never arrives. The form is authentic;
  only the context is wrong.
- **It's buried in a green diff.** The line lands in a 400-line PR that adds a
  feature, passes CI, and does what the ticket asked. Nobody scanning for logic
  bugs is entropy-scoring every string literal; the secret rides in on the back
  of working code. When the PR was AI-generated, nobody wrote the individual
  lines, so nobody can vouch for them either.
- **Nobody owns "is this a real key?"** Telling a revoked test key from a live
  one isn't a judgment a human makes at review speed, so the question quietly
  doesn't get asked. AI raises the stakes on all three: more code, faster, and
  none of it authored by someone who can answer.

A warning gets the same "I'll fix it later" treatment the placeholder did, which
is the case for making this an _error_. Put bluntly: **the credential didn't
survive review because nobody looked — it survived because looking at every
string literal isn't a job a human can do, and it is the only job a linter
does.**

## How it stays quiet enough to be an error

A naive secret scanner drowns you in [false positives](https://ofriperetz.dev/articles/confusion-matrix-tp-fp-fn-tn), which trains everyone
(human and agent) to ignore it. `no-hardcoded-credentials` makes **two
different decisions**: registered vendor key prefixes (`sk_live_`, `AKIA…`)
fire anywhere because they're unambiguous, while a generic high-entropy string
is only flagged when the surrounding identifier _names_ a credential
(`apiKey`, `password`, `token`) and clears a length floor. It's a
[heuristic detector, not a taint tracker](https://ofriperetz.dev/articles/taint-vs-heuristic-detection)
— it never proves the string reaches an auth call, it decides what the string
is _for_ — which is exactly why the context tier has to carry the weight.

I have the receipt. An early, context-blind version of this rule fired **842
times on `vercel/ai` — and the real count of hardcoded credentials was zero**
(measured 2026-05-09 on `vercel/ai @4d58048`, Node v24.13.0, ESLint 9.39.4).
807 of those "findings" were TypeScript union-type literals, error class names,
and the bare string `"test"`. Full autopsy in
[842 secrets, real count zero](https://ofriperetz.dev/articles/no-hardcoded-credentials-entropy-isnt-enough);
the statistical reason a rare target wrecks a decent detector is the
[base rate problem](https://ofriperetz.dev/articles/base-rate-problem-explained).
And the reason I believed 842 for as long as I did: nobody had established
[ground truth](https://ofriperetz.dev/articles/ground-truth-in-security-testing)
for that repo, so I was reading a number, not a result. Building the rule and
then being its worst-scoring customer is a useful place to sit exactly once.

The context gate dropped 842 to 0, and that low false-positive rate is the whole
licence to run this as a blocking error — it's what makes an agent trust the
signal instead of suppressing it. The
[secure-coding getting-started](https://ofriperetz.dev/articles/getting-started-eslint-plugin-secure-coding)
walks the full two-mode mechanism.

Here's why that matters if you point this at AI output: `vercel/ai` is a
**hand-written human library**, and it still buried a context-blind rule under
807 false positives — because it names things `experimental_onToolExecutionStart`.
That long, underscore-laced texture is _exactly_ what an LLM emits in
TypeScript. Run a naive credential regex — as a
[lint rule or a standalone scanner](https://ofriperetz.dev/articles/static-analysis-vs-sast-vs-linting)
— over Claude- or Gemini-written code and you don't get a security report; you
get noise proportional to how verbosely the model named its symbols. The
two-mode design isn't a nicety; it's the only reason this rule survives the code
AI is writing fastest.

I keep running it on AI output, too. Same NestJS prompt,
[Claude shipped 6 findings and Gemini 2](https://ofriperetz.dev/articles/claude-vs-gemini-nestjs-security-same-prompt-different-errors);
[ranked across five models](https://ofriperetz.dev/articles/we-ranked-5-ai-models-by-security-the-leaderboard-is-wrong),
the best coder wasn't the safest. Which model you pick changes _how many_ of
these literals land, never _whether_ they land — so the rule is the constant,
not the model.

Don't take the [precision](https://ofriperetz.dev/articles/precision-recall-f1-for-static-analysis)
claim from me. Generate the corpus with Gemini instead of Claude, run the
structural-only pass against the context-tiered one, report the delta. Same
rule, different corpus — that's
[replication, not a rerun](https://ofriperetz.dev/articles/reproducibility-vs-replicability),
and it's the version I'd believe.

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

```js
// eslint.config.mjs — `configs` is a NAMED export
// (plain `eslint.config.js` works too if your package.json says "type": "module")
import { configs } from "eslint-plugin-secure-coding";

export default [configs.recommended];
```

`recommended` already sets `no-hardcoded-credentials` to `error`. On a repo that
has never run a security linter, prefer `configs.flagship` — this rule plus
ReDoS, both at `error`, nothing else to triage on day one.

Tune it for your repo (e.g. allow fixtures in tests):

```js
import { configs } from "eslint-plugin-secure-coding";

export default [
  configs.recommended,
  {
    rules: {
      "secure-coding/no-hardcoded-credentials": [
        "error",
        { allowInTests: true },
      ],
    },
  },
];
```

`allowInTests` matches on path (`.test.`, `.spec.`, `__tests__/`, `fixtures/`
and friends), so it exempts fixture credentials without punching a hole in `src/`.
Verified against v3.3.2.

---

## Compatibility

| Surface              | Support                                                                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Package managers** | npm, yarn, pnpm, bun                                                                                                                              |
| **Node**             | `>= 18.0.0`                                                                                                                                       |
| **ESLint**           | `^8.0.0 \|\| ^9.0.0 \|\| ^10.0.0`, flat config                                                                                                    |
| **Module system**    | CommonJS — `eslint.config.js` or `.mjs`                                                                                                           |
| **AI assistants**    | the CWE/CVSS/compliance/fix line is plain text in the lint output — readable by Cursor, Copilot, Claude Code or a CI agent, no integration needed |

---

## Honest scope

- **It catches the literal in source, not key validity.** It flags
  `sk_live_…`; it can't tell a revoked test key from a live one. Rotate anything
  that was ever committed.
- **The fix is a suggestion, not an unattended `--fix`.** It rewrites the
  literal to `process.env.STRIPE_SECRET_KEY || 'sk_live_…'` — a non-breaking
  edit an agent can apply blind, but the fallback keeps the secret in the file.
  That's a staging step, not the finish line: something still has to delete the
  fallback and rotate the key. Let the agent apply, let a human approve the
  deletion.
- **Where the secret lives is an architectural call.** Env var, Secrets Manager,
  Vault — the rule points at the problem, you pick the destination.
- **One rule, not a secret-scanning platform.** Pair it with a
  history/secret scanner (commits already pushed) and rotation; this is the
  pre-merge gate that stops new ones — including the ones your AI just wrote.

---

## Where this sits

This is one rule in `eslint-plugin-secure-coding`, part of the
[Interlace ESLint ecosystem](https://eslint.interlace.tools) — static analysis
whose findings are deliberately structured for both humans and the agents now
writing most of the code.

The optimistic read: of every class of bug AI writes, this is the one where
tooling has already caught up. The literal is machine-detectable, the fix is one
deterministic rewrite, and the finding is legible to the same model that
produced the bug. That's a closed loop you can turn on this afternoon — most
vulnerability classes are nowhere near it.

**Read next:** [Claude wrote a NestJS service — ESLint found 6 security holes](https://ofriperetz.dev/articles/claude-wrote-nestjs-service-eslint-found-6-security-holes)
— the same loop applied to a whole AI-written service, where hardcoded
credentials are one finding among several. (Framework-aware version:
[securing AI agents in the Vercel AI SDK](https://ofriperetz.dev/articles/securing-ai-agents-in-the-vercel-ai-sdk).)

- 📦 [npm: eslint-plugin-secure-coding](https://www.npmjs.com/package/eslint-plugin-secure-coding)
- 📖 [Rule docs: no-hardcoded-credentials](https://eslint.interlace.tools/docs/security/plugin-secure-coding/rules/no-hardcoded-credentials)
- 💻 [Source on GitHub](https://github.com/ofri-peretz/eslint/tree/main/packages/eslint-plugin-secure-coding)

Run it on your AI-written code and tell me what it found — especially if it
found nothing. A clean zero on a real repo is a result too, and I'd like to know
which repos produce it.

::dev-to-cta{url="https://www.npmjs.com/package/eslint-plugin-secure-coding"}
📦 `npm install --save-dev eslint-plugin-secure-coding` — one rule, one CI error, and the next `"your-secret-key"` never reaches `main`.
::

---

_Part of the [Interlace ESLint ecosystem](https://eslint.interlace.tools). Source on [GitHub](https://github.com/ofri-peretz/eslint) · Follow: [Dev.to/ofri-peretz](https://dev.to/ofri-peretz)_
