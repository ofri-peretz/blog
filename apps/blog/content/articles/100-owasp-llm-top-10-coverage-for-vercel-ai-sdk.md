---
title: "Your Vercel AI SDK App vs the OWASP LLM Top 10: 8 Categories ESLint Catches in CI — and 2 It Honestly Can't."
description: "A real mapping of the OWASP LLM Top 10 (2025) to eslint-plugin-vercel-ai-security: which categories a CWE-tagged rule genuinely catches in source, and which two (supply chain, model poisoning) live outside static analysis."
slug: "100-owasp-llm-top-10-coverage-for-vercel-ai-sdk"
canonical_url: "https://ofriperetz.dev/articles/100-owasp-llm-top-10-coverage-for-vercel-ai-sdk"
devto_url: "https://dev.to/ofri-peretz/100-owasp-llm-top-10-coverage-for-vercel-ai-sdk-1bom"
devto_id: 3114794
published_at: "2025-12-19T06:00:22Z"
edited_at: "2026-02-05T05:33:09Z"
cover_image: "https://ofriperetz.dev/og/cover/100-owasp-llm-top-10-coverage-for-vercel-ai-sdk"
social_image: "https://ofriperetz.dev/og/article/100-owasp-llm-top-10-coverage-for-vercel-ai-sdk"
reading_time_minutes: 8
tags:
  - "eslint"
  - "ai"
  - "security"
  - "owasp"
author:
  name: "Ofri Peretz"
  username: "ofri-peretz"
  avatar: "https://media2.dev.to/dynamic/image/width=640,height=640,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Fuser%2Fprofile_image%2F3669992%2F50a1f256-472c-48a1-85e8-149459647ea7.png"
  twitter: "ofriperetzdev"
series: null
---

"How do you address the OWASP LLM Top 10?" is now a question on enterprise
security questionnaires. The honest answer for a Vercel AI SDK app is more
useful than a "100% covered" checkbox — because **static analysis genuinely
catches 8 of the 10 categories at the call site, and two of them it can't touch
at all.** Knowing which is which is the difference between a real control and a
compliance theater slide.

`eslint-plugin-vercel-ai-security` is SDK-aware (it understands `generateText`,
`streamText`, `tool()`), and maps a CWE-tagged rule to the categories that are
_source patterns_. Here's the real matrix.

---

## The 8 categories a rule genuinely catches

| OWASP LLM (2025)                           | What it is                           | Rule                                                                    | CWE                         |
| ------------------------------------------ | ------------------------------------ | ----------------------------------------------------------------------- | --------------------------- |
| **LLM01** Prompt Injection                 | untrusted input reaches the model    | `require-validated-prompt`, `no-dynamic-system-prompt`                  | CWE-74                      |
| **LLM02** Sensitive Information Disclosure | secrets/PII sent to the LLM          | `no-sensitive-in-prompt`                                                | CWE-200                     |
| **LLM05** Improper Output Handling         | model output → eval/SQL/innerHTML    | `no-unsafe-output-handling`                                             | CWE-94                      |
| **LLM06** Excessive Agency                 | tools act with no confirmation/limit | `require-tool-confirmation`, `require-max-steps`, `require-tool-schema` | CWE-862                     |
| **LLM07** System Prompt Leakage            | system prompt exposed in a response  | `no-system-prompt-leak`                                                 | CWE-200                     |
| **LLM08** Vector & Embedding Weaknesses    | unvalidated RAG / embeddings         | `require-rag-content-validation`, `require-embedding-validation`        | CWE-74 / CWE-20             |
| **LLM09** Misinformation                   | output shown to users unvalidated    | `require-output-validation`, `require-output-filtering`                 | CWE-707                     |
| **LLM10** Unbounded Consumption            | token/step/time exhaustion           | `require-max-tokens`, `require-max-steps`, `require-request-timeout`    | CWE-770 / CWE-834 / CWE-400 |

Each finding carries the CWE and the fix. (Note: the inline `OWASP:` tag in a
finding is the classic web-AppSec category the CWE rolls up to — e.g. CWE-74 →
`A03 Injection` — not the LLM code; the **rule set** is organized around the LLM
Top 10, the CWE is the precise anchor.)

---

## The 2 categories static analysis can't honestly claim

This is where "100% coverage" decks lie. Two categories are **not** code
patterns at a call site, so no source linter — this one included — genuinely
covers them:

- **LLM03 Supply Chain** — a compromised model, a poisoned dependency, a
  malicious LoRA adapter. That's a _dependency/model-provenance_ problem. Use
  SBOM/lockfile integrity, model signing, and a dependency auditor —
  `eslint-plugin-node-security`'s `require-dependency-integrity` / `lock-file`
  touch the npm slice, but the model supply chain is out of scope for source
  analysis.
- **LLM04 Data & Model Poisoning** — malicious data entering training/fine-tuning
  or a RAG store. That's a _data-pipeline_ control (provenance, validation at
  ingest), not a `generateText` call shape. `no-training-data-exposure` flags
  user data flowing _to_ a training endpoint (a privacy/egress concern), but it
  does not detect poisoning _into_ the model.

Anyone selling you "automated 100% OWASP LLM coverage" is mapping a timeout rule
to "model poisoning" and hoping you don't read the categories. You should.

---

## What a finding looks like

```text
src/app/chat/route.ts
  6:11  error  🔒 CWE-74 OWASP:A03-Injection CVSS:9 | User input "userMessage" passed directly to generateText prompt without validation | CRITICAL [SOC2,GDPR]
              Fix: Validate input before use: generateText({ prompt: validateInput(userInput) })
```

```ts
// ❌ LLM01 — untrusted input straight into the model
const { text } = await generateText({ model, prompt: userMessage });

// ✅ input passes a validation boundary
const { text } = await generateText({
  model,
  prompt: validateInput(userMessage),
});
```

(Honest caveat, same as the getting-started: the linter enforces that a
validation _boundary exists_ — it can't prove your validator defeats injection.
Nothing reliably does at the text layer. See the
[vercel-ai-security deep-dive](https://ofriperetz.dev/articles/getting-started-eslint-plugin-vercel-ai-security)
for the full mechanism of all 19 rules.)

---

## Install

```bash
# npm
npm install --save-dev eslint-plugin-vercel-ai-security
# yarn / pnpm / bun: same, with that manager's --dev flag
```

```js
// eslint.config.js — `configs` is a NAMED export (default export is the plugin)
import { configs } from "eslint-plugin-vercel-ai-security";

export default [
  configs.recommended, // 7 errors + 7 warnings + 5 off
  // configs.strict,   // 17 errors — production hardening
];
```

```yaml
# CI — fail the PR on a new LLM-category finding
- run: npx eslint . --max-warnings 0
```

---

## Compatibility

| Surface              | Support                                                                                   |
| -------------------- | ----------------------------------------------------------------------------------------- |
| **Package managers** | npm, yarn, pnpm, bun                                                                      |
| **Node**             | `>= 18.0.0`                                                                               |
| **ESLint**           | `^8.0.0 \|\| ^9.0.0 \|\| ^10.0.0`, flat config                                            |
| **Vercel AI SDK**    | optional peer — AST-based, lints whether or not `ai` is installed                         |
| **Module system**    | CommonJS — `eslint.config.js` or `.mjs`                                                   |
| **Oxlint**           | flagship rule (`no-unsafe-output-handling`) wired + parity-checked; full set ESLint-first |

---

## Why the honest matrix wins the security review

A CTO's security reviewer has seen the "100%" slide. What closes the deal is a
mapping they can _audit_: each covered category points to a named rule and a CWE
they can verify, and the two uncovered categories come with the right control
named (SBOM/model signing for LLM03, ingest validation for LLM04) instead of a
hand-wave. "8 of 10, automated and CWE-tagged, plus a clear plan for the other
two" is a stronger answer than a claim that collapses the moment someone opens
the OWASP page.

---

## Links

- 📦 [npm: eslint-plugin-vercel-ai-security](https://www.npmjs.com/package/eslint-plugin-vercel-ai-security)
- 📖 [Full rule docs](https://eslint.interlace.tools/docs/security/plugin-vercel-ai-security/rules)
- 🔐 [OWASP Top 10 for LLM Applications](https://genai.owasp.org/llm-top-10/)
- 💻 [Source on GitHub](https://github.com/ofri-peretz/eslint/tree/main/packages/eslint-plugin-vercel-ai-security)

::dev-to-cta{url="https://github.com/ofri-peretz/eslint"}
⭐ Star on GitHub if "we're 100% OWASP-covered" has ever made you suspicious.
::

---

I'm **Ofri Peretz**, a security engineering leader and the author of the
Interlace ESLint ecosystem — domain-specific static analysis for security,
reliability, and performance on the Node.js stack.

[ofriperetz.dev](https://ofriperetz.dev) · [LinkedIn](https://linkedin.com/in/ofri-peretz) · [GitHub](https://github.com/ofri-peretz)
