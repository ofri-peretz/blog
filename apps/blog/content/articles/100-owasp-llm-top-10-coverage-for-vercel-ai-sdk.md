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
  - "security"
  - "ai"
  - "owasp"
  - "geminichallenge"
author:
  name: "Ofri Peretz"
  username: "ofri-peretz"
  avatar: "https://media2.dev.to/dynamic/image/width=640,height=640,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Fuser%2Fprofile_image%2F3669992%2F50a1f256-472c-48a1-85e8-149459647ea7.png"
  twitter: "ofriperetzdev"
series: "Hardening AI Agents"
---

> **Series: Hardening AI Agents** ·
> [Prompt injection](https://ofriperetz.dev/articles/vercel-ai-sdk-prompt-injection-vulnerability)
> · [Excessive agency](https://ofriperetz.dev/articles/securing-ai-agents-in-the-vercel-ai-sdk)
> · [All 19 rules](https://ofriperetz.dev/articles/getting-started-eslint-plugin-vercel-ai-security)
> · **OWASP LLM Top 10 (you are here)**

Every "100% OWASP LLM coverage" claim I have audited maps a timeout rule to
"model poisoning" and hopes the buyer doesn't open the category list. The honest
number is **8 of the 10 — static analysis genuinely catches them at the call
site — and 2 it cannot touch at all** (supply chain and model poisoning). That
gap is now a line item on enterprise security questionnaires, and knowing which 8
and which 2 is the difference between a real control and a compliance-theater
slide.

`eslint-plugin-vercel-ai-security` is SDK-aware (it understands `generateText`,
`streamText`, `tool()`), and maps a CWE-tagged rule to the categories that are
_source patterns_. Here's the real matrix.

> **The other half of the questionnaire:** this is the **LLM** Top 10. The
> **web** OWASP Top 10 (2021) for the same Node.js stack — also 8 of 10, also
> honestly — is mapped in
> [I Mapped the OWASP Top 10 to ESLint Rules. 8 Hold Up. 2 Are Vendor Theater.](https://ofriperetz.dev/articles/mapping-your-codebase-to-owasp-top-10-with-247-eslint-rules)
> If the questionnaire asks for both, these two pieces are the paired answer.

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

Two of these rows have their own war-story deep-dive, because they're the two
that ship most often: **LLM01** is dissected in
[3 Lines of Vercel AI SDK Code Are a Prompt-Injection Hole](https://ofriperetz.dev/articles/3-lines-of-code-to-hack-your-vercel-ai-app-and-1-line-to-fix-it-jo)
(and why "just sanitize it" doesn't close it), and **LLM06** Excessive Agency —
the one that lets an agent delete your database — is the subject of
[5 ESLint Rules That Gate Every Tool Call](https://ofriperetz.dev/articles/securing-ai-agents-in-the-vercel-ai-sdk).

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

**Why this survives the security review.** That first line —
`prompt: userMessage` — passes review because reviewers read the handler logic,
check the error handling, confirm the response shape, and move on. The prompt
field is a string; the string is typed; TypeScript is green. Nobody scans a
`generateText` call and asks _"is this argument trusted?"_ — they ask "does the
chat feature work?" The missing validation boundary is negative space, and
negative space doesn't show up in a diff. I would have approved it too.

The same blindness has a second, sneakier shape — the **missing `maxSteps`** on a
tool loop (LLM10 / LLM06). Picture the same handler with a `tools: { ... }` block
and no step cap. In the demo, the model calls the tool once, gets its result, and
returns — the loop _terminates_, the response is correct, the test passes. So it
reads as done: a reviewer watches one happy-path run end cleanly and has no reason
to ask "what bounds this if a later prompt makes it call itself?" The cap isn't
wrong in the diff; it's _absent_, and absence only becomes a bug under an input
nobody typed in review. That's exactly what `require-max-steps` (CWE-834) fires
on, structurally, before the input that loops ever arrives. Every row in the
matrix is some version of this — an absent timeout, an ungated tool — each reading
as "the happy path is correct," because it is. What's missing is the part a human
reviewer is not trained to see, and a per-file rule is.

---

## The category the coding assistant keeps reopening

Here's the part the questionnaire doesn't ask about. Most Vercel AI SDK code
isn't hand-written line by line anymore — it's generated by a coding assistant
(Claude, Gemini, Copilot) from a prompt like "add a chat endpoint with the AI
SDK." Ask any of them for that endpoint and you reliably get the working,
insecure shape: `generateText({ prompt: userMessage })`, no `maxSteps`, no
timeout, a `tool()` that executes with no confirmation. Not because the model is
careless — because the prompt asked for a chat feature, not for an injection
boundary or a step cap, and the model answers the question it was asked. The
happy path _is_ the spec it was given.

**So I ran the test.** I took the canonical generated route — a `POST` handler
doing `generateText({ model, prompt: userMessage, tools: { deleteRecord: tool(...) } })`,
the exact shape an assistant hands you — saved it as `src/app/chat/route.ts`, and
ran the **`recommended`** config from `eslint-plugin-vercel-ai-security@1.3.5`
(ESLint 10.4.1) against it. Four findings, on a file that compiles clean and whose
happy path works:

```text
error  vercel-ai-security/require-validated-prompt   L12  (LLM01, CWE-74)
error  vercel-ai-security/require-max-steps          L10  (LLM06/LLM10, CWE-834)
error  vercel-ai-security/require-max-tokens         L10  (LLM10, CWE-770)
warn   vercel-ai-security/require-request-timeout    L10  (LLM10, CWE-400)
```

Two of the eight covered categories light up from one unremarkable handler — LLM01
(the prompt-injection boundary) and LLM10 (the unbounded loop, the token ceiling,
and the request-timeout warning), with `require-max-steps` also rolling into LLM06. (Note: `require-tool-confirmation` stayed silent
here _by design_ — the rule reports on a destructive tool written as a plain
object, and steps back when the tool uses the `tool()` helper, where confirmation
may be wired inside. Write `deleteRecord` as a bare object literal and it fires
too. Honest tools tell you where they stop.) Reproduce it in two minutes: paste
your assistant's route into a repo, add the config below, run
`npx eslint . --format stylish`, count the findings.

That's why this matrix is a CI control and not a one-time audit. The same
assistant that helped you ship the fix will, in the next session with no memory
of this one, regenerate the unguarded version — a pattern I measured across
domains in
[I Let Claude Write 80 Functions. 65-75% Had Security Vulnerabilities](https://ofriperetz.dev/articles/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities),
and the reason fixing AI omissions by hand in review doesn't converge:
[The AI Hydra Problem](https://ofriperetz.dev/articles/the-ai-hydra-problem-fix-one-ai-bug-get-two-more).
A linter that fires on every file, every run, is the only reviewer that asks the
negative-space question — _"is this input trusted? is this loop bounded? is this
tool gated?"_ — on every commit, regardless of which model wrote it.

And it _is_ regardless of model — this isn't a Claude tic. When I ran the same
prompt on Claude and Gemini for a different stack, both shipped insecure code;
they just omitted different guards (Claude tripped 6 rules, Gemini 2, and **both**
missed rate limiting on the auth endpoint):
[Same NestJS Prompt. Claude Got 6 Security Errors. Gemini Got 2.](https://ofriperetz.dev/articles/claude-vs-gemini-nestjs-security-same-prompt-different-errors)
The per-model count moves; the negative space is constant. The clean adaptation
of _this_ matrix is the same experiment scaled across the LLM Top 10: generate the
chat route with **Gemini 2.5**, run the recommended config, and record which of
the eight categories it leaves as negative space versus Claude. Same rules, same
methodology, one model swap — that's the Build-with-Gemini benchmark this piece is
one run away from.

---

## Install — run it on the next generated route

The fastest way to feel the matrix is to lint the code your assistant just
emitted:

```bash
# npm
npm install --save-dev eslint-plugin-vercel-ai-security
# yarn / pnpm / bun: same, with that manager's --dev flag
```

```js
// eslint.config.js — `configs` is a NAMED export (default export is the plugin)
import { configs } from "eslint-plugin-vercel-ai-security";

export default [
  configs.recommended, // v1.3.5: 11 errors + 4 warnings + 4 off
  // configs.strict,   // 18 errors + 1 warning — production hardening
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

The uncomfortable corollary: if you can't name the rule and the CWE behind each
covered row, you don't have 8 of 10 — you have a slide. So I'll ask the question
the questionnaire should: **when your last AI SDK endpoint shipped, which of
these eight categories had a guard in CI — and which one made it to production as
negative space nobody saw in review?** I've watched the prompt-injection row and
the unbounded-consumption row slip through the most. What slipped through yours?

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
