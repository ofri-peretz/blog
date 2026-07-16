---
title: "65-75% of Claude's Code Shipped a Vuln. Hardcoded Secrets Are the One AI Agents Can Auto-Fix."
description: "AI assistants leave demo keys, placeholder passwords, and bare config literals in source — CWE-798 at scale. One ESLint rule catches the hardcoded literal, and its CWE/CVSS/fix message is structured so the same AI can read the error and hoist it to process.env."
slug: "hardcoded-secrets-ai-agents-autofix"
canonical_url: "https://ofriperetz.dev/articles/hardcoded-secrets-ai-agents-autofix"
devto_url: "https://dev.to/ofri-peretz/hardcoded-secrets-the-1-vulnerability-ai-agents-can-auto-fix-47cg"
devto_id: 3137474
published_at: "2025-12-31T05:39:36Z"
edited_at: "2026-07-05T00:00:00Z"
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

AI agents autofixed 3 hardcoded secrets in our codebase — and introduced 2 new ones in the same PR. Here's why that happens and how to stop it.

When I had Claude generate 80 common Node.js functions with no security context,
[65–75% shipped with a vulnerability](https://dev.to/ofri-peretz/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities)
— and a hardcoded credential was the single most repeated pattern. Ask an AI
assistant to "wire up Stripe" or "connect to the database" and watch what it
produces:

```ts
const stripe = new Stripe("sk_live_51H8xY2eZvKf..."); // demo key it left in
const db = new Pool({ password: "changeme" }); // placeholder it forgot to remove
const JWT_SECRET = "your-secret-key"; // the classic
```

**Why does this happen specifically with AI-generated code?** The model has
absorbed millions of tutorials, GitHub repos, and Stack Overflow answers — a
meaningful portion of which include actual secrets, placeholder credentials, and
"just for demo" literals. When the model generates `password: "changeme"`, it
isn't making a mistake: it's statistically reproducing the most common pattern
for that context from its training data. The fix (`process.env.DB_PASSWORD`)
looks almost identical to the vulnerability at a glance, which is precisely why
it escapes review. A human scanning a 400-line AI-generated diff pattern-matches
"this looks like a placeholder" and moves on — because in the training data, it
usually was.

Coding assistants optimize for "runs on the first try," and the fastest path to
runnable code is a literal in place. So they hardcode **demo keys**,
**placeholder credentials**, and **bare config literals** — at the speed they
generate everything else. That's **CWE-798** (Use of Hard-coded Credentials),
and it now enters codebases faster than any human ever added it.

Here's the twist that makes this fixable rather than just alarming: the same
property that makes AI a prolific _source_ of these bugs — it reads and writes
structured text — makes it a capable _fixer_. `eslint-plugin-secure-coding`'s
`no-hardcoded-credentials` rule emits a finding that carries the CWE, CVSS,
compliance tags, and the exact fix. Feed that back to the assistant and it
remediates its own output. This is the agentic-CI loop: **AI writes → linter
flags in machine-readable form → AI fixes.**

Hardcoded credentials are the rare case where that loop is genuinely closed.
For most vulnerability classes, "ask the model to fix it again" is a gamble — I
measured [a fix-one-bug-get-two-more failure mode across three remediation
rounds](https://ofriperetz.dev/articles/the-ai-hydra-problem-fix-one-ai-bug-get-two-more)
where prompt-only feedback regressed. CWE-798 is different: the remediation is a
single deterministic rewrite — hoist the literal to `process.env` — with no
behavioral branches for the model to get creative in. That's why this is the
**one** AI-introduced vulnerability worth wiring into an autonomous loop first.

> **Series — Hardening AI Agents:** [I Let Claude Write 80 Functions (65–75% had a vuln)](https://dev.to/ofri-peretz/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities) → **Hardcoded secrets: the one AI can auto-fix** (you are here) → [Claude wrote a NestJS service — ESLint found 6 holes](https://ofriperetz.dev/articles/claude-wrote-nestjs-service-eslint-found-6-security-holes). The thread: AI writes the bug, a machine-readable lint finding closes the loop.

---

## TL;DR

- AI assistants introduce hardcoded secrets (**CWE-798**) at scale — bare demo
  keys, placeholder passwords, and config literals left in source. Autofix
  accuracy in our corpus: **3 found, 2 reintroduced** — a 60% net success rate
  without a blocking lint gate.
- `no-hardcoded-credentials` (in `eslint-plugin-secure-coding`) catches them and
  emits a **structured, CWE-tagged** finding an AI agent can parse and auto-fix.
- The detector is two-mode (registered key prefixes fire anywhere; generic
  secrets need a credential-named identifier) so it's quiet enough to run as a
  CI **error**. Full mechanism in the [secure-coding deep-dive](https://ofriperetz.dev/articles/getting-started-eslint-plugin-secure-coding).

> **Slack-quotable:** Your AI coding assistant is more likely to introduce a hardcoded secret than any developer on your team — and it will make the literal look exactly like a placeholder so code review waves it through.

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

Run `npx eslint .` and that's the exact, unedited finding it prints — line,
column, and all (paste the file above into a fresh repo with the rule enabled
and you'll get it character-for-character):

```text
src/payments.ts
  4:27  error  🔒 CWE-798 OWASP:A04-Cryptographic CVSS:9.8 | Hard-coded API key detected | CRITICAL [SOC2,PCI-DSS,HIPAA,GDPR]
   Fix: Use environment variable: process.env.STRIPE_SECRET_KEY or secret management service | https://cwe.mitre.org/data/definitions/798.html
```

Every token in that line is a machine signal — and the rule derives them, it
doesn't hand-type them: the CWE drives an auto-enrichment table
(`@interlace/eslint-devkit`) that fills in the OWASP category, the CVSS score,
and the compliance set, so the finding can't drift out of sync with the
vulnerability class. Read left to right:

- **`CWE-798`** — a stable, machine-readable vulnerability class the model has
  seen thousands of times in training; it knows the remediation pattern.
- **`OWASP:A04-Cryptographic`** — the OWASP Top 10 (2025) bucket CWE-798 maps
  to (A04 is _Cryptographic Failures_ in the 2025 list — secrets in source are
  a key-management failure), so the finding slots straight into an OWASP report.
- **`CVSS:9.8` + `CRITICAL`** — the severity the agent uses to prioritize this
  over a style nit.
- **`[SOC2,PCI-DSS,HIPAA,GDPR]`** — the compliance frameworks the finding maps
  to, for an audit trail the agent can cite.
- **`Fix:`** — the exact transformation (`→ process.env.STRIPE_SECRET_KEY`,
  derived from the variable name), so the edit is deterministic, not a guess.

Drop that into Cursor/Copilot/Claude (or an autonomous CI agent) and the fix is
mechanical: hoist the literal to an environment variable or a secret manager.
The rule turns a vague "be secure" instruction into a closed, verifiable loop.

Want to see it fire on your own repo right now? Two lines:

```bash
npm install --save-dev eslint-plugin-secure-coding
npx eslint .   # any hardcoded sk_live_… / password: "…" lights up as an error
```

(Full config and per-repo tuning — allowing test fixtures, etc. — is in
[Install](#install) below.)

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
(One deliberate nuance: a value that's _already_ an env read with a literal
fallback — `process.env.X || "dev-default"` — is treated as **already
remediated**, since the real secret lives in the environment; that form is the
rule's accepted output, not a finding. So the thing it catches is the bare,
env-less literal.)

## Why this survives code review — and why AI makes it worse

If hardcoded secrets are so obvious, why do they keep reaching `main`? Because
the failure isn't ignorance — it's the review process itself. I've watched all
three of these wave a `sk_live_…` straight through:

- **It reads as a placeholder.** `password: "changeme"` and
  `JWT_SECRET = "your-secret-key"` look like scaffolding the author will swap
  before merge. The reviewer pattern-matches "obvious dummy value" and moves on
  — and "before merge" never arrives. AI-generated code makes this worse: the
  model pulls these exact strings from training data where they genuinely _were_
  placeholders. The form is authentic; only the context is wrong.
- **It's buried in a green diff.** The line lands inside a 400-line PR that adds
  a feature, passes CI, and does what the ticket asked. A reviewer scanning for
  logic bugs is not entropy-scoring every string literal; the secret rides in on
  the back of working code. When the PR was AI-generated, there's an extra
  layer: nobody wrote the individual lines, so nobody can vouch for them. The
  reviewer is checking _does this do what the ticket asked_, not _did the model
  reproduce a secret from its training corpus_.
- **Nobody owns "is this a real key?"** Telling a revoked test key from a live
  one isn't a judgment a human makes at review speed, so the question quietly
  doesn't get asked. AI worsens this too: the volume of code is higher, the
  velocity is higher, and the literal _looks exactly_ like the thousands of
  legitimate placeholders the model emits — because it learned that pattern from
  places where the key was intentionally dummy. See also: [why entropy checks
  alone aren't enough to catch these](https://dev.to/ofri-peretz/no-hardcoded-credentials-entropy-isnt-enough).

A blocking lint rule fixes the one thing humans are structurally bad at here:
applying the same boring check to **every** literal, on every PR, without
fatigue. That's the case for making it an _error_, not a warning — a warning
gets the same "I'll fix it later" treatment as the placeholder did. Put bluntly:
**the credential didn't survive review because nobody looked — it survived
because looking at every string literal isn't a job a human can do, and it is
the only job a linter does.**

## How it stays quiet enough to be an error

A naive secret scanner drowns you in false positives, which trains everyone
(human and agent) to ignore it. `no-hardcoded-credentials` makes **two
different decisions**: registered vendor key prefixes (`sk_live_`, `AKIA…`)
fire anywhere because they're unambiguous, while a generic high-entropy string
is only flagged when the surrounding identifier _names_ a credential
(`apiKey`, `password`, `token`) and clears a length floor. That context check is
load-bearing, and I have the receipt: an early, context-blind version of this
rule fired **842 times on the `vercel/ai` codebase — and the real count of
hardcoded credentials was zero.** 807 of those "findings" were TypeScript
union-type literals, error class names, and the bare string `"test"`. I walk
that whole false-positive autopsy in
[what ground truth caught that unit tests missed](https://ofriperetz.dev/articles/what-ground-truth-caught-that-unit-tests-missed).
The context gate is what dropped that to zero — and that low false-positive rate
is what lets you run it as a blocking CI error, and what makes an agent trust
the signal instead of suppressing it. The
[secure-coding getting-started](https://ofriperetz.dev/articles/getting-started-eslint-plugin-secure-coding)
walks the full two-mode mechanism and the rest of the security rules in the
plugin.

Here's the part that matters if you point this at AI output: `vercel/ai` is a
**hand-written human library**, and it still buried a context-blind rule under
807 false positives — because it names things `experimental_onToolExecutionStart`
and `AI_ToolCallNotFoundForApprovalError`. That long, underscore-laced,
type-literal-heavy texture is _exactly_ what an LLM emits when it generates
TypeScript. Run a naive credential regex over a folder of Claude- or
Gemini-written code and you don't get a security report — you get noise
proportional to how verbosely the model named its symbols. So the two-mode
design isn't a nicety; it's the only reason this rule survives contact with the
code AI is now writing fastest.

And the "run it on AI output" part isn't hypothetical — I keep doing it. When I
gave Claude and Gemini the
[same NestJS prompt, Claude shipped 6 security findings and Gemini 2](https://ofriperetz.dev/articles/claude-vs-gemini-nestjs-security-same-prompt-different-errors),
and when I
[ranked five models by the security of what they generate](https://ofriperetz.dev/articles/we-ranked-5-ai-models-by-security-the-leaderboard-is-wrong)
the "best coder" wasn't the safest one. The throughline: which model you pick
changes _how many_ of these literals land, but not _whether_ they land — every
model leaves some. The two-mode rule is the constant that catches them
regardless of which assistant wrote the diff. (Want to reproduce the precision
claim on your own model? Generate the corpus with Gemini, run the
structural-only pass against the context-tiered pass, and report the delta —
same rule, swap the corpus.)

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
// eslint.config.js — `configs` is a NAMED export
import { configs } from "eslint-plugin-secure-coding";

export default [configs.recommended];
```

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

---

## Compatibility

| Surface              | Support                                                                                                                                                                |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Package managers** | npm, yarn, pnpm, bun                                                                                                                                                   |
| **Node**             | `>= 18.0.0`                                                                                                                                                            |
| **ESLint**           | `^8.0.0 \|\| ^9.0.0 \|\| ^10.0.0`, flat config                                                                                                                         |
| **Module system**    | CommonJS — `eslint.config.js` or `.mjs`                                                                                                                                |
| **AI assistants**    | the CWE/CVSS/compliance/fix message is plain text in the lint output — consumable by Cursor, Copilot, Claude Code, or an autonomous CI agent with no extra integration |

---

## Honest scope

- **It catches the literal in source, not key validity.** It flags
  `sk_live_…`; it can't tell a revoked test key from a live one. Rotate anything
  that was ever committed.
- **Auto-fix needs a human gate for the secret value.** The agent can hoist the
  literal to `process.env.X` deterministically, but _where the real secret
  lives_ (env, Secrets Manager, Vault) is an architectural decision — the rule
  points at it, you choose it.
- **One rule, not a secret-scanning platform.** Pair it with a
  history/secret scanner (commits already pushed) and rotation; this is the
  pre-merge gate that stops new ones — including the ones your AI just wrote.

---

## Where this sits

This is one rule in `eslint-plugin-secure-coding` — a set of framework-agnostic
"pure coding security" rules (see the
[full getting-started](https://ofriperetz.dev/articles/getting-started-eslint-plugin-secure-coding)).
It's part of the [Interlace ESLint ecosystem](https://eslint.interlace.tools) —
domain-specific static analysis whose findings are deliberately structured for
both humans and the agents now writing most of the code.

This piece is part of my **Hardening AI Agents** series. The
[65–75% experiment](https://dev.to/ofri-peretz/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities)
is where the headline number comes from; if you want the same
machine-readable-finding loop applied to a whole AI-written service, see
[Claude wrote a NestJS service — ESLint found 6 security holes](https://ofriperetz.dev/articles/claude-wrote-nestjs-service-eslint-found-6-security-holes),
where hardcoded credentials were one finding among several in real generated
code. And for the framework-aware version of the same loop on agent code, see
[securing AI agents in the Vercel AI SDK](https://ofriperetz.dev/articles/securing-ai-agents-in-the-vercel-ai-sdk).

- 📦 [npm: eslint-plugin-secure-coding](https://www.npmjs.com/package/eslint-plugin-secure-coding)
- 📖 [Rule docs: no-hardcoded-credentials](https://eslint.interlace.tools/docs/security/plugin-secure-coding/rules/no-hardcoded-credentials)
- 💻 [Source on GitHub](https://github.com/ofri-peretz/eslint/tree/main/packages/eslint-plugin-secure-coding)

Has your team's AI-assisted coding introduced a secret that code review missed — and would your CI have caught it? Drop the story in the comments.

::dev-to-cta{url="https://github.com/ofri-peretz/eslint"}
⭐ Star on GitHub if your AI assistant has ever left a `"your-secret-key"` literal in your source.
::

---

*Part of the [Interlace ESLint ecosystem](https://eslint.interlace.tools). Source on [GitHub](https://github.com/ofri-peretz/eslint) · Follow: [Dev.to/ofri-peretz](https://dev.to/ofri-peretz)*
