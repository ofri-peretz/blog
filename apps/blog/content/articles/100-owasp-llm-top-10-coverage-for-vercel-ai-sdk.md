---
title: "I Linted Every OWASP LLM Category Against a Real Vercel AI SDK App. 8 Fire. 2 Are Vendor Theater."
description: "A real mapping of the OWASP LLM Top 10 (2025) to eslint-plugin-vercel-ai-security: which categories a CWE-tagged rule genuinely catches in source — and why each one survives normal code review."
slug: "100-owasp-llm-top-10-coverage-for-vercel-ai-sdk"
canonical_url: "https://ofriperetz.dev/articles/100-owasp-llm-top-10-coverage-for-vercel-ai-sdk"
tier: "T3"
devto_url: "https://dev.to/ofri-peretz/100-owasp-llm-top-10-coverage-for-vercel-ai-sdk-1bom"
devto_id: 3114794
published_at: "2025-12-19T06:00:22Z"
edited_at: "2026-07-05T06:00:00Z"
cover_image: "https://ofriperetz.dev/og/cover/100-owasp-llm-top-10-coverage-for-vercel-ai-sdk"
social_image: "https://ofriperetz.dev/og/article/100-owasp-llm-top-10-coverage-for-vercel-ai-sdk"
reading_time_minutes: 9
tags:
  - "ai"
  - "security"
  - "javascript"
  - "devsecops"
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

I took a standard Vercel AI SDK chat endpoint — the exact shape a coding assistant hands you when you prompt it for "a chat route with tool use" — and ran it against all 10 OWASP LLM categories. The file compiled clean. TypeScript was green. The happy path worked. ESLint found **4 violations across 3 OWASP LLM categories before a single request was made.**

> **If you're using Vercel AI SDK without these rules, you're shipping OWASP LLM Top 10 gaps that TypeScript's type system will never catch.**

That sentence is load-bearing. Type safety tells you the prompt field accepts a string. It does not tell you whether that string is trusted input. The OWASP LLM gaps live in the negative space — the guards that aren't there — and negative space doesn't show up in a diff.

Every "100% OWASP LLM coverage" claim I've audited maps a timeout rule to "model poisoning" and hopes the buyer doesn't open the category list. The real number, for any source linter, is **8 of 10**. Here's the honest matrix — each category with the specific rule, the [CWE](https://ofriperetz.dev/articles/cwe-taxonomy-explained), and, critically, _why the vulnerability survives a normal code review without it_.

> **The web [OWASP Top 10](https://ofriperetz.dev/articles/owasp-top-10-explained) for the same stack:** [I Mapped the OWASP Top 10 to ESLint Rules. 8 Hold Up. 2 Are Vendor Theater.](https://ofriperetz.dev/articles/mapping-your-codebase-to-owasp-top-10-with-247-eslint-rules)
> If the questionnaire asks for both, these two pieces are the paired answer.

---

## The 8 categories a rule genuinely catches

| OWASP LLM (2025)                           | Rule                                                                    | CWE                         |
| ------------------------------------------ | ----------------------------------------------------------------------- | --------------------------- |
| **LLM01** Prompt Injection                 | `require-validated-prompt`, `no-dynamic-system-prompt`                  | CWE-74                      |
| **LLM02** Sensitive Information Disclosure | `no-sensitive-in-prompt`                                                | CWE-200                     |
| **LLM05** Improper Output Handling         | `no-unsafe-output-handling`                                             | CWE-94 / CWE-89 / CWE-79   |
| **LLM06** Excessive Agency                 | `require-tool-confirmation`, `require-max-steps`, `require-tool-schema` | CWE-862                     |
| **LLM07** System Prompt Leakage            | `no-system-prompt-leak`                                                 | CWE-200                     |
| **LLM08** Vector & Embedding Weaknesses    | `require-rag-content-validation`, `require-embedding-validation`        | CWE-74 / CWE-20             |
| **LLM09** Misinformation                   | `require-output-validation`, `require-output-filtering`                 | CWE-707                     |
| **LLM10** Unbounded Consumption            | `require-max-tokens`, `require-max-steps`, `require-request-timeout`    | CWE-770 / CWE-834 / CWE-400 |

Each finding carries the CWE and the fix in the lint output. The inline `OWASP:` tag references the classic web AppSec category the CWE rolls up to (e.g. CWE-74 → `A03 Injection`) — not the LLM code. The rule set is organized around the LLM Top 10; the CWE is the precise anchor.

**Note on LLM05 / CWE mapping:** `no-unsafe-output-handling` covers model output flowing into `eval()` (CWE-94 / code injection), SQL query strings (CWE-89), and `innerHTML` (CWE-79). All three downstream sinks are distinct CWE classes — the finding includes the specific one that fired.

**Note on LLM09 / CWE-707:** CWE-707 (Improper Neutralization) covers the class of weaknesses where output is presented to a downstream consumer without adequate processing. The rule enforces that a validation call _exists_ in the output path before user-visible rendering — it cannot detect hallucination (no static rule can), but it can catch the structural absence of any output boundary. That boundary is where hallucination-detection middleware lives. A missing boundary is a detectable source pattern; a wrong answer is not.

---

## Why each one survives the security review

This is what the matrix doesn't tell you, and what makes the difference between a table and a control.

**LLM01 — Prompt Injection** survives because `prompt: userMessage` is a string assigned to a typed field. TypeScript is satisfied. Reviewers check error handling, response shape, and status codes — they don't ask "is this string trusted?" because the field signature doesn't require trust, only a string. The validation boundary is negative space: its absence is invisible in the diff.

The rule (`require-validated-prompt`) checks whether the value passed to the `prompt` property on a `generateText` / `streamText` call is wrapped in a validation call. It doesn't do [taint analysis](https://ofriperetz.dev/articles/taint-vs-heuristic-detection) across the entire call graph — it enforces that a boundary function exists at the call site. If your validator is `(x) => x`, the rule stays silent; if your input goes straight from `req.body` to the model, it fires. That's the trade-off stated explicitly in the [rule docs](https://eslint.interlace.tools/docs/security/plugin-vercel-ai-security/rules/require-validated-prompt).

See the [full Vercel AI SDK prompt injection breakdown](https://ofriperetz.dev/articles/3-lines-of-code-to-hack-your-vercel-ai-app-and-1-line-to-fix-it-jo) for why "just sanitize it" doesn't close the vector.

**LLM02 — Sensitive Information Disclosure** survives because secrets and PII passed to an LLM aren't written to a log file or returned in a response — they go into a prompt string. Reviewers scan for `console.log(apiKey)` and `res.json({ token })`. Nobody scans for `prompt: \`${systemConfig.dbPassword}\`` because the output is the model's text response, not the secret itself. The secret leaves the perimeter silently through the model API call.

**LLM05 — Improper Output Handling** survives because model output arrives as a string. Reviewers check that the string renders. They don't ask "what happens if this string contains `'; DROP TABLE users; --`?" because it came from a model, not a user form field. The output is trusted implicitly — it was _generated_, not _entered_. That implicit trust is exactly what `no-unsafe-output-handling` breaks.

**LLM06 — Excessive Agency** survives because in the demo, the model calls the tool once, gets its result, and returns. The loop terminates. The response is correct. The test passes. A reviewer watches one happy-path run end cleanly and has no reason to ask "what bounds this if a later prompt makes it loop?" The cap isn't wrong in the diff — it's absent, and absence only becomes a bug under an adversarial input nobody typed in review.

**LLM07 — System Prompt Leakage** survives because the system prompt is developer-authored content, not user input. It doesn't look like an injection vector. A jailbreak prompt in the user message that extracts the system prompt is an attack the reviewer would have to simulate — it doesn't surface from reading the handler code.

**LLM08 — Vector & Embedding Weaknesses** survives because RAG content comes from what feels like a trusted internal store. Reviewers don't ask "is this document chunk validated before it's appended to the prompt?" — it was retrieved by the application, not submitted by a user. The trust boundary is invisible at the call site.

**LLM09 — Misinformation** survives because the output is a string and it renders. The review confirms the feature works. There's no structural signal that a validation boundary is absent — the model response just flows through to the user. The `require-output-validation` rule fires when no validation call wraps the output before it hits a user-visible surface.

**LLM10 — Unbounded Consumption** survives because unbounded consumption only materializes under adversarial or unexpected input. The test prompt terminates the tool loop in one step. The reviewer sees a correct response and no loop. `require-max-steps` fires on the _structure_ — the absence of the `maxSteps` cap — before any input arrives that would exploit it.

---

## What 4 findings look like on one standard handler

I took the canonical generated route — a `POST` handler doing:

```ts
// src/app/chat/route.ts — exactly what a coding assistant emits
import { generateText, tool } from "ai";
import { openai } from "@ai-sdk/openai";

export async function POST(req: Request) {
  const { userMessage } = await req.json();

  const { text } = await generateText({
    model: openai("gpt-4o-mini"),
    prompt: userMessage,                // ← no validation boundary
    tools: {
      deleteRecord: tool({
        description: "Delete a record by ID",
        parameters: z.object({ id: z.string() }),
        execute: async ({ id }) => db.delete(id),
      }),
    },
    // ← no maxSteps, no maxTokens, no timeout
  });

  return Response.json({ text });
}
```

Saved it, ran `eslint-plugin-vercel-ai-security@1.3.5` recommended config (ESLint 9, flat config). Four findings, zero TypeScript errors, happy path works:

```text
src/app/chat/route.ts
  12:5  error   🔒 CWE-74  OWASP:A03 CVSS:9 | User input "userMessage" passed directly to generateText prompt without validation | CRITICAL [SOC2,GDPR]
              Fix: generateText({ prompt: validateInput(userMessage) })

  10:5  error   🔒 CWE-834 OWASP:A05 CVSS:7 | generateText call missing maxSteps — unbounded tool loop | HIGH
              Fix: generateText({ maxSteps: 5, ... })

  10:5  error   🔒 CWE-770 OWASP:A05 CVSS:6 | generateText call missing maxTokens — unbounded consumption | HIGH
              Fix: generateText({ maxTokens: 2048, ... })

  10:5  warn    🔒 CWE-400 OWASP:A05 CVSS:5 | generateText call missing AbortSignal / timeout | MEDIUM
              Fix: generateText({ abortSignal: AbortSignal.timeout(30_000), ... })
```

LLM01 and LLM10 from a single unremarkable handler. That's the gap.

```ts
// ✅ the same handler after fixes
const { text } = await generateText({
  model: openai("gpt-4o-mini"),
  prompt: validateInput(userMessage),
  maxSteps: 5,
  maxTokens: 2048,
  abortSignal: AbortSignal.timeout(30_000),
  tools: { deleteRecord: tool({ ... }) },
});
```

Two of the eight covered categories resolved in four lines.

---

## The 2 categories static analysis can't honestly claim

This is where "100% coverage" decks lie. Two categories are not code patterns at a call site:

- **LLM03 Supply Chain** — a compromised model, a poisoned dependency, a malicious LoRA adapter. That's a dependency/model-provenance problem. Use SBOM/lockfile integrity, model signing, and a dependency auditor. No source linter touches model supply chain.
- **LLM04 Data & Model Poisoning** — malicious data entering training/fine-tuning or a RAG store. That's a data-pipeline control (provenance, validation at ingest), not a `generateText` call shape. `no-training-data-exposure` flags user data flowing to a training endpoint (a privacy/egress concern), but it does not detect poisoning into the model.

Anyone selling you "automated 100% OWASP LLM coverage" is mapping a timeout rule to "model poisoning" and hoping you don't read the categories. You should. "8 of 10, automated and CWE-tagged, plus the right control named for the other two" is a stronger answer than a claim that collapses the moment someone opens the OWASP page.

---

## Why CI beats code review for this class of vulnerability

[I measured AI-generated security gaps across 80 functions](https://ofriperetz.dev/articles/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities) — 65–75% had security vulnerabilities. The pattern wasn't random: coding assistants answer the question asked. "Add a chat endpoint" doesn't ask for injection boundaries or step caps. The happy path is the spec given. The missing guard is negative space.

The same assistant that helped you ship the fix will, in the next session with no memory of this one, regenerate the unguarded version. Code review catches it the first time if someone thinks to ask. CI catches it every time, regardless of which model wrote the code or which engineer reviewed it.

That's why this matrix is a CI control and not a one-time audit.

---

## Install — run it on the next generated route

```bash
npm install --save-dev eslint-plugin-vercel-ai-security
# yarn / pnpm / bun: same, with that manager's --dev flag
```

```js
// eslint.config.js (ESM flat config — requires "type": "module" in package.json)
import { configs } from "eslint-plugin-vercel-ai-security";

export default [
  configs.recommended, // v1.3.5: 11 errors + 4 warnings + 4 off
  // configs.strict,   // 18 errors + 1 warning — production hardening
];
```

```js
// eslint.config.cjs (CommonJS — for projects without "type": "module")
const { configs } = require("eslint-plugin-vercel-ai-security");

module.exports = [
  configs.recommended,
];
```

```yaml
# CI — fail the PR on a new LLM-category finding
- run: npx eslint . --max-warnings 0
```

The plugin ships CommonJS and is consumed via ESM or CJS config depending on your project's module system. The flat config format is required (ESLint 8.21+ / 9.x / 10.x).

---

## Compatibility

| Surface              | Support                                                                                   |
| -------------------- | ----------------------------------------------------------------------------------------- |
| **Package managers** | npm, yarn, pnpm, bun                                                                      |
| **Node**             | `>= 18.0.0`                                                                               |
| **ESLint**           | `^8.21.0 \|\| ^9.0.0 \|\| ^10.0.0`, flat config only                                     |
| **Vercel AI SDK**    | optional peer — AST-based, lints whether or not `ai` is installed                         |
| **Module system**    | Plugin ships CJS; config file can be ESM (`eslint.config.js` with `"type":"module"`) or CJS (`.cjs`) |
| **Oxlint**           | flagship rule (`no-unsafe-output-handling`) wired + parity-checked; full set ESLint-first |

---

## Links

- 📦 [npm: eslint-plugin-vercel-ai-security](https://www.npmjs.com/package/eslint-plugin-vercel-ai-security)
- 📖 [Full rule docs](https://eslint.interlace.tools/docs/security/plugin-vercel-ai-security)
- 🔐 [OWASP Top 10 for LLM Applications](https://genai.owasp.org/llm-top-10/)
- 💻 [Source on GitHub](https://github.com/ofri-peretz/eslint/tree/main/packages/eslint-plugin-vercel-ai-security)

::dev-to-cta{url="https://github.com/ofri-peretz/eslint"}
⭐ Star on GitHub if "we're 100% OWASP-covered" has ever made you suspicious.
::

---

Which OWASP LLM category are you most worried about in your Vercel AI SDK integration, and have you checked whether your CI catches it? The prompt-injection row (LLM01) and the unbounded-consumption row (LLM10) slip through the most in my experience — curious whether that matches yours.

---

*[eslint-plugin-vercel-ai-security](https://www.npmjs.com/package/eslint-plugin-vercel-ai-security) is part of the [Interlace ESLint ecosystem](https://eslint.interlace.tools). Source on [GitHub](https://github.com/ofri-peretz/eslint) · Follow: [Dev.to/ofri-peretz](https://dev.to/ofri-peretz)*
