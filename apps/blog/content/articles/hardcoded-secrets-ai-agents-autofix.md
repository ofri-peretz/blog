---
title: "AI Coding Assistants Hardcode Secrets. This ESLint Rule Catches Them — in a Format the AI Can Auto-Fix."
description: "AI assistants leave demo keys, placeholder passwords, and bare config literals in source — CWE-798 at scale. One ESLint rule catches the hardcoded literal, and its CWE/CVSS/fix message is structured so the same AI can read the error and hoist it to process.env."
slug: "hardcoded-secrets-ai-agents-autofix"
canonical_url: "https://ofriperetz.dev/articles/hardcoded-secrets-ai-agents-autofix"
devto_url: "https://dev.to/ofri-peretz/hardcoded-secrets-the-1-vulnerability-ai-agents-can-auto-fix-47cg"
devto_id: 3137474
published_at: "2025-12-31T05:39:36Z"
edited_at: "2026-01-11T10:22:03Z"
cover_image: "https://ofriperetz.dev/og/cover/hardcoded-secrets-ai-agents-autofix"
social_image: "https://ofriperetz.dev/og/article/hardcoded-secrets-ai-agents-autofix"
reading_time_minutes: 7
tags:
  - "eslint"
  - "javascript"
  - "security"
  - "devops"
author:
  name: "Ofri Peretz"
  username: "ofri-peretz"
  avatar: "https://media2.dev.to/dynamic/image/width=640,height=640,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Fuser%2Fprofile_image%2F3669992%2F50a1f256-472c-48a1-85e8-149459647ea7.png"
  twitter: "ofriperetzdev"
series: "Hardening AI Agents"
---

Ask an AI assistant to "wire up Stripe" or "connect to the database" and watch
what it produces:

```ts
const stripe = new Stripe("sk_live_51H8xY2eZvKf..."); // demo key it left in
const db = new Pool({ password: "changeme" }); // placeholder it forgot to remove
const JWT_SECRET = "your-secret-key"; // the classic
```

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

---

## TL;DR

- AI assistants introduce hardcoded secrets (**CWE-798**) at scale — bare demo
  keys, placeholder passwords, and config literals left in source.
- `no-hardcoded-credentials` (in `eslint-plugin-secure-coding`) catches them and
  emits a **structured, CWE-tagged** finding an AI agent can parse and auto-fix.
- The detector is two-mode (registered key prefixes fire anywhere; generic
  secrets need a credential-named identifier) so it's quiet enough to run as a
  CI **error**. Full mechanism in the [secure-coding deep-dive](https://ofriperetz.dev/articles/getting-started-eslint-plugin-secure-coding).

---

## Why the lint error is written for the machine

A human reads `error: hardcoded credential` and sighs. An AI agent reads the
_structure_ and acts. Run `npx eslint .` and a finding looks like this:

```text
src/payments.ts
  4:36  error  🔒 CWE-798 OWASP:A04-Cryptographic CVSS:9.8 | Hard-coded API key detected | CRITICAL [SOC2,PCI-DSS,HIPAA,GDPR]
              Fix: Use environment variable: process.env.STRIPE_SECRET_KEY or secret management service
```

Every token is a machine signal:

- **`CWE-798`** — a stable, machine-readable vulnerability class the model has
  seen thousands of times in training; it knows the remediation pattern.
- **`CVSS:9.8` + `CRITICAL`** — lets an agent prioritize this over a style nit.
- **`[SOC2,PCI-DSS,HIPAA,GDPR]`** — the compliance frameworks the finding maps
  to, for an audit trail the agent can cite.
- **`Fix:`** — the exact transformation (`→ process.env.…`), so the edit is
  deterministic, not a guess.

Drop that into Cursor/Copilot/Claude (or an autonomous CI agent) and the fix is
mechanical: hoist the literal to an environment variable or a secret manager.
The rule turns a vague "be secure" instruction into a closed, verifiable loop.

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

## How it stays quiet enough to be an error

A naive secret scanner drowns you in false positives, which trains everyone
(human and agent) to ignore it. `no-hardcoded-credentials` makes **two
different decisions**: registered vendor key prefixes (`sk_live_`, `AKIA…`)
fire anywhere because they're unambiguous, while a generic high-entropy string
is only flagged when the surrounding identifier _names_ a credential
(`apiKey`, `password`, `token`) and clears a length floor. That low
false-positive rate is what lets you run it as a blocking CI error — and what
makes an agent trust the signal instead of suppressing it. The
[secure-coding getting-started](https://ofriperetz.dev/articles/getting-started-eslint-plugin-secure-coding)
walks the full two-mode mechanism and the other 26 rules in the plugin.

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

This is one rule in `eslint-plugin-secure-coding` (27 framework-agnostic
"pure coding security" rules; see the
[full getting-started](https://ofriperetz.dev/articles/getting-started-eslint-plugin-secure-coding)).
It's part of the [Interlace](https://eslint.interlace.tools) ecosystem —
domain-specific static analysis whose findings are deliberately structured for
both humans and the agents now writing most of the code.

- 📦 [npm: eslint-plugin-secure-coding](https://www.npmjs.com/package/eslint-plugin-secure-coding)
- 📖 [Rule docs: no-hardcoded-credentials](https://eslint.interlace.tools/docs/security/plugin-secure-coding/rules)
- 💻 [Source on GitHub](https://github.com/ofri-peretz/eslint/tree/main/packages/eslint-plugin-secure-coding)

::dev-to-cta{url="https://github.com/ofri-peretz/eslint"}
⭐ Star on GitHub if your AI assistant has ever left a `"your-secret-key"` literal in your source.
::

---

I'm **Ofri Peretz**, a security engineering leader and the author of the
Interlace ESLint ecosystem — domain-specific static analysis for security,
reliability, and performance on the Node.js stack, with findings structured for
the AI agents now writing the code.

[ofriperetz.dev](https://ofriperetz.dev) · [LinkedIn](https://linkedin.com/in/ofri-peretz) · [GitHub](https://github.com/ofri-peretz)
