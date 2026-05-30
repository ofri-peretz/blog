---
title: "Your Vercel AI SDK Agent Has 19 Attack Surfaces. Here's an ESLint Rule for Each."
description: "Prompt injection, tool over-permissioning, AI output that reaches eval/SQL/innerHTML, secrets in prompts — the Vercel AI SDK puts every one a single property away. 19 ESLint rules that catch them in CI, before deploy."
slug: "getting-started-eslint-plugin-vercel-ai-security"
canonical_url: "https://ofriperetz.dev/articles/getting-started-eslint-plugin-vercel-ai-security"
devto_url: "https://dev.to/ofri-peretz/getting-started-with-eslint-plugin-vercel-ai-security-5e9g"
devto_id: 3139002
published_at: "2025-12-31T21:49:06Z"
edited_at: "2026-01-11T10:21:46Z"
cover_image: "https://dev-to-uploads.s3.amazonaws.com/uploads/articles/rxxfvuudvh7r4bny4jxn.png"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/getting-started-eslint-plugin-vercel-ai-security.png"
reading_time_minutes: 9
tags:
  - "eslint"
  - "ai"
  - "security"
  - "vercel"
reactions: 0
comments: 0
views: 0
author:
  name: "Ofri Peretz"
  username: "ofri-peretz"
  avatar: "https://media2.dev.to/dynamic/image/width=640,height=640,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Fuser%2Fprofile_image%2F3669992%2F50a1f256-472c-48a1-85e8-149459647ea7.png"
  twitter: "ofriperetzdev"
series: "Hardening AI Agents"
---

The Vercel AI SDK gives you a tool-calling agent in about six lines:

```ts
import { generateText, tool } from "ai";
import { openai } from "@ai-sdk/openai";

const { text } = await generateText({
  model: openai("gpt-4o"),
  prompt: userMessage,
  tools: { deleteAccount, transferFunds },
});
```

That snippet ships. It also hands an attacker a prompt-injection vector
(`userMessage` flows straight into the model), two destructive tools with no
confirmation gate, no token ceiling, no step ceiling, and no plan for what
happens when the model's output lands in your database or your DOM.

None of that is a bug in the SDK. It's the same gap every powerful API has:
the easy path and the safe path look almost identical, and the compiler can't
tell them apart. **`eslint-plugin-vercel-ai-security` makes that gap a CI
failure.** It's a focused plugin — 19 rules, each pinned to a CWE and mapped to
the OWASP Top 10 for LLM Applications — that reads your AI SDK call sites and
flags the dangerous shape before it merges.

This is the getting-started guide: what each rule catches, the real fix it
wants, how to install and configure it across npm/yarn/pnpm, and exactly which
ESLint and Oxlint versions it runs under.

---

## TL;DR

- **19 rules**, every one carrying a `CWE` id and a CVSS score, mapped to the
  OWASP LLM Top 10.
- **4 presets**: `minimal` (2 rules), `recommended` (7 errors + 7 warnings +
  5 off), `strict` (17 errors + 2 warnings), and `flagship` (the single
  highest-severity rule, `no-unsafe-output-handling`).
- **Flat-config native**, ESLint `8 || 9 || 10`, Node `>= 18`. Shipped as a
  CommonJS package, so it loads from both `eslint.config.js` and
  `eslint.config.mjs`. The `ai` package is an _optional_ peer — the rules are
  AST-based, so the plugin lints a repo that hasn't installed the SDK yet.
- It's **static analysis**: it enforces that a safety boundary _exists_ at each
  call site. It does not (and can't) prove your validator is semantically
  correct. Pair it with runtime guardrails — the
  [what static analysis can't do](#what-static-analysis-cannot-do) section is
  explicit about where the line is.

---

## The attack surface, one rule at a time

The 19 rules cluster into six things that go wrong with LLM call sites. Each
example below is the shape the rule flags (`❌`) and the shape it accepts
(`✅`) — the "after" is the rule's own suggested fix, not a hand-wave.

### 1. Prompt injection — untrusted input reaches the model

```ts
// ❌ require-validated-prompt (CWE-74, CVSS 9.0)
//    no-dynamic-system-prompt (CWE-74)
const { text } = await generateText({
  model: openai("gpt-4o"),
  system: `You are an assistant for ${user.companyName}`, // dynamic system prompt
  prompt: userMessage, // untrusted input, straight in
});
```

```ts
// ✅ input passes through a validation boundary; system prompt is static
const { text } = await generateText({
  model: openai("gpt-4o"),
  system: STATIC_SYSTEM_PROMPT,
  prompt: validateInput(userMessage),
});
```

`require-validated-prompt` traces user-controlled identifiers
(`userMessage`, `req.body.*`, `input`, …) into the `prompt` field and fails
unless they pass through a recognized validation call first.
`no-dynamic-system-prompt` does the same for the `system` field, where
interpolated content is an _agent-confusion_ vector — instructions and data
sharing one channel.

> **Honest framing.** The linter enforces that a boundary _exists_ — it can't
> verify your validator actually defeats injection. String "sanitization"
> alone does not stop prompt injection; nothing reliably does at the text
> layer. Treat `validateInput` as the place you enforce a schema, length and
> allow-list, keep instructions and data in separate channels, and assume the
> model output is attacker-influenced downstream. The rule guarantees you have
> a place to do that work and that you didn't skip it.

### 2. Insecure output handling — the model's text reaches a sink

This is the highest-severity category, and the plugin's **flagship** rule.

```ts
// ❌ no-unsafe-output-handling — declared CWE-94, with per-sink ids:
//    eval → CWE-94 (RCE) · SQL → CWE-89 · innerHTML → CWE-79 (XSS)
eval(aiOutput); // RCE
db.query(`SELECT * FROM users WHERE name = '${aiOutput}'`); // SQL injection
el.innerHTML = aiOutput; // XSS
```

```ts
// ✅ the rule's own fixes
db.query("SELECT * FROM users WHERE name = ?", [aiOutput]); // parameterized
el.textContent = aiOutput; // inert
// (and: never pass model output to eval/Function/exec/spawn)
```

Model output is untrusted input that _looks_ trustworthy because you generated
it. `no-unsafe-output-handling` flags it flowing into `eval`, `Function`,
`exec`/`execSync`/`spawn`/`execFile`, raw SQL template strings, and
`innerHTML`. `require-output-validation` and `require-output-filtering` cover
the softer cases — output rendered to users unvalidated, or tool results
returning raw rows from a data source.

### 3. Excessive agency — tools that act without a leash

```ts
// ❌ require-tool-confirmation (CWE-862): destructive tool, no gate
const { text } = await generateText({
  model: openai("gpt-4o"),
  prompt,
  tools: {
    deleteUser: {
      description: "Delete a user account",
      inputSchema: z.object({ id: z.string() }),
      execute: async ({ id }) => db.users.delete(id),
    },
  },
});
```

```ts
// ✅ destructive tools declare a confirmation requirement
tools: {
  deleteUser: {
    description: "Delete a user account",
    requiresConfirmation: true, // human-in-the-loop before execute
    inputSchema: z.object({ id: z.string() }),
    execute: async ({ id }) => db.users.delete(id),
  },
}
```

`require-tool-confirmation` recognizes destructive verbs (`delete`,
`transfer`, `execute`, `drop`, …) in the tool's key name and requires a
confirmation flag (`requiresConfirmation` / `requiresApproval` / …) on the
tool object. `require-tool-schema` fails any tool whose parameters aren't
schema-constrained — an unconstrained tool is an open API the model can call
with anything.

> **Scope note.** `require-tool-confirmation` inspects tool object literals
> declared inline inside a `tools: { … }` object. It does not yet see tools
> authored with the SDK's `tool()` helper or extracted into a variable
> (`const deleteUser = tool({ … })`) — a documented known false-negative. If
> you use that (idiomatic) form, gate destructive tools manually, or inline the
> definition so the rule can check it.

### 4. Resource exhaustion & runaway loops

```ts
// ❌ require-max-steps (CWE-834), require-max-tokens (CWE-770),
//    require-request-timeout (CWE-400)
const { text } = await generateText({
  model: openai("gpt-4o"),
  tools,
  prompt, // no maxSteps → unbounded tool loop; no maxTokens → unbounded cost
});
```

```ts
// ✅ bounded
const { text } = await generateText({
  model: openai("gpt-4o"),
  tools,
  prompt,
  maxSteps: 5,
  maxTokens: 1000,
  abortSignal: AbortSignal.timeout(30_000),
});
```

An agent with tools but no `maxSteps` can loop until it burns your budget or
your rate limit; no `maxTokens` is an open-ended bill and a denial-of-service
lever. `require-abort-signal` ensures streaming calls (`streamText`,
`streamObject`) can actually be cancelled.

> **SDK-version note.** `require-max-tokens` keys on the `maxTokens` /
> `max_tokens` property (and `require-max-steps` on `maxSteps`). AI SDK v5+
> renamed the token option to `maxOutputTokens`; if you're on v5+, set
> `maxTokens` to satisfy the current rule, or pin the property name your
> codebase uses. Use whichever the version you've installed expects.

### 5. Data leakage — secrets and PII crossing the boundary

```ts
// ❌ no-hardcoded-api-keys (CWE-798), no-sensitive-in-prompt (CWE-200),
//    no-system-prompt-leak (CWE-200)
const model = openai("gpt-4o", { apiKey: "sk-proj-REDACTED" }); // hardcoded
const { text } = await generateText({ model, prompt: `User SSN: ${ssn}` }); // PII in prompt
return Response.json({ reply: text, system: SYSTEM_PROMPT }); // leaks instructions
```

```ts
// ✅
const model = openai("gpt-4o"); // key from env (OPENAI_API_KEY)
const { text } = await generateText({ model, prompt: redactPII(userText) });
return Response.json({ reply: text }); // system prompt stays server-side
```

`no-training-data-exposure` (CWE-359) rounds out the category, flagging user
data routed to fine-tuning / training endpoints.

### 6. RAG & embeddings — the retrieved context is also untrusted

```ts
// ❌ require-rag-content-validation (CWE-74), require-embedding-validation (CWE-20)
const docs = await vectorStore.similaritySearch(query);
const { text } = await generateText({
  model: openai("gpt-4o"),
  prompt: `Context:\n${docs.map((d) => d.content).join("\n")}\n\nQ: ${query}`,
});
```

```ts
// ✅ retrieved content is validated before it becomes prompt context
const docs = await vectorStore.similaritySearch(query);
const context = validateRagContent(docs); // size/source/format checks
const { text } = await generateText({
  model: openai("gpt-4o"),
  prompt: buildPrompt(context, query),
});
```

Indirect prompt injection lives here: poison a document in the vector store and
it's injected into every prompt that retrieves it. The retrieved chunk deserves
the same suspicion as direct user input.

The remaining rules — `require-error-handling` (CWE-755) and
`require-audit-logging` (CWE-778) — keep failures observable rather than silent.

---

## The full rule set

All 19, with the severity each gets in the `recommended` preset:

| Rule                             | Catches                             | CWE     | `recommended` |
| -------------------------------- | ----------------------------------- | ------- | ------------- |
| `require-validated-prompt`       | Untrusted input → prompt            | CWE-74  | error         |
| `no-dynamic-system-prompt`       | Interpolated system prompt          | CWE-74  | error         |
| `no-unsafe-output-handling`      | AI output → eval/SQL/innerHTML      | CWE-94  | error         |
| `no-hardcoded-api-keys`          | Keys in model config                | CWE-798 | error         |
| `no-sensitive-in-prompt`         | Secrets/PII in prompt               | CWE-200 | error         |
| `no-system-prompt-leak`          | System prompt in response           | CWE-200 | error         |
| `require-tool-confirmation`      | Destructive tool, no gate           | CWE-862 | error         |
| `require-tool-schema`            | Unconstrained tool params           | CWE-20  | warn          |
| `require-max-tokens`             | No output ceiling                   | CWE-770 | warn          |
| `require-max-steps`              | Unbounded agent loop                | CWE-834 | warn          |
| `require-output-filtering`       | Raw data-source rows in tool result | CWE-200 | warn          |
| `require-rag-content-validation` | Unvalidated retrieved context       | CWE-74  | warn          |
| `no-training-data-exposure`      | User data → training endpoint       | CWE-359 | warn          |
| `require-request-timeout`        | No timeout/abort                    | CWE-400 | warn          |
| `require-error-handling`         | AI call not wrapped                 | CWE-755 | off           |
| `require-abort-signal`           | Streaming call can't cancel         | CWE-404 | off           |
| `require-audit-logging`          | AI op not logged                    | CWE-778 | off           |
| `require-embedding-validation`   | Unvalidated embedding stored        | CWE-20  | off           |
| `require-output-validation`      | Output shown unvalidated            | CWE-707 | off           |

`recommended` ships the seven highest-severity rules as errors and seven more
as warnings; the last five are `off` by default (enable them in `strict`, which
turns 17 on as errors). Start with `recommended`, ratchet to `strict` per
directory as you adopt.

---

## Install

```bash
# npm
npm install --save-dev eslint-plugin-vercel-ai-security

# yarn
yarn add --dev eslint-plugin-vercel-ai-security

# pnpm
pnpm add --save-dev eslint-plugin-vercel-ai-security

# bun
bun add --dev eslint-plugin-vercel-ai-security
```

Flat config (`eslint.config.js` / `.ts`):

```js
// `configs` is a named export; the default export is the plugin object.
import { configs } from "eslint-plugin-vercel-ai-security";

export default [
  // pick one preset (each registers the plugin under `vercel-ai-security`):
  configs.recommended, // balanced — 7 errors + 7 warnings + 5 off
  // configs.minimal,  // 2 critical rules, for gradual adoption
  // configs.strict,   // 17 errors + 2 warnings — production hardening
  // configs.flagship, // just no-unsafe-output-handling
];
```

Tune any rule inline — the preset already registered the
`vercel-ai-security` namespace, so a later config object can reference it
directly:

```js
import { configs } from "eslint-plugin-vercel-ai-security";

export default [
  configs.recommended,
  {
    rules: {
      // require-max-steps' option is `suggestedMaxSteps` (default 5):
      "vercel-ai-security/require-max-steps": [
        "error",
        { suggestedMaxSteps: 10 },
      ],
      "vercel-ai-security/require-rag-content-validation": "warn",
    },
  },
];
```

Run it:

```bash
npx eslint .
```

The output carries the CWE, OWASP mapping, CVSS, severity and the fix on the
finding itself:

```text
src/app/chat/route.ts
  9:11  error  🔒 CWE-74 OWASP:A03-Injection CVSS:9 | User input "userMessage" passed directly to generateText prompt without validation | CRITICAL [SOC2,GDPR]
               Fix: Validate input before use: generateText({ prompt: validateInput(userInput) }) | https://owasp.org/www-project-top-10-for-large-language-model-applications/

src/agent/tools.ts
  24:3  error  ⚠️ CWE-862 OWASP:A01-Broken CVSS:7 | Tool "deleteUser" performs destructive operation "delete" without requiring confirmation. | HIGH [SOC2]
               Fix: Add requiresConfirmation: true or implement confirmation logic in the tool | https://sdk.vercel.ai/docs/ai-sdk-core/tools-and-tool-calling
```

(The inline `OWASP:` tag is the classic web-AppSec category the finding's CWE
rolls up to — e.g. CWE-74 → A03 Injection. The plugin's _rule set_ is organized
around the OWASP Top 10 for LLM Applications threat model; the CWE on each
finding is the precise, unambiguous anchor.)

---

## Compatibility

| Surface              | Support                                                                                                                                                                                                                                                                                                                                            |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Package managers** | npm, yarn, pnpm (and Bun) — it's a plain dev dependency                                                                                                                                                                                                                                                                                            |
| **Node**             | `>= 18.0.0`                                                                                                                                                                                                                                                                                                                                        |
| **ESLint**           | `^8.0.0 \|\| ^9.0.0 \|\| ^10.0.0`, flat config                                                                                                                                                                                                                                                                                                     |
| **Module system**    | CommonJS — loads from both `eslint.config.js` (CJS) and `eslint.config.mjs` (ESM, via Node interop); `import vercelAI from "..."` works either way                                                                                                                                                                                                 |
| **Vercel AI SDK**    | _Optional_ peer — rules are AST-based and lint whether or not `ai` is installed. They key on AI SDK option names: `prompt`, `system`, `tools`, `maxTokens`/`max_tokens`, `maxSteps`, `abortSignal`. AI SDK v5+ renamed the token option to `maxOutputTokens`; `require-max-tokens` currently keys on `maxTokens` (see the SDK-version note above). |
| **Oxlint**           | The plugin loads under Oxlint's JS-plugin runner; the flagship rule (`no-unsafe-output-handling`) is wired into our Oxlint config and parity-checked in CI. The full 19-rule set runs on ESLint today.                                                                                                                                             |

> On the ESLint↔Oxlint story: rules are the portable asset, engines are the
> commodity. We keep the flagship rule running identically on both and gate
> parity in CI; the rest of the set is ESLint-first while Oxlint's plugin API
> matures. No "works everywhere" claim beyond what's actually wired.

---

## What static analysis _cannot_ do {#what-static-analysis-cannot-do}

Being precise about the boundary is the difference between a tool you trust and
one you cargo-cult:

- **It enforces structure, not semantics.** `require-validated-prompt` proves
  `validateInput()` is _called_; it cannot prove your `validateInput` is
  correct, or that any text-level defense fully stops prompt injection (none
  does). The rule removes the "we forgot entirely" failure mode — the largest
  one — not the "our validator is weak" one.
- **It sees call sites, not runtime.** A confirmation flag satisfies the rule;
  whether your UI actually blocks on it is a runtime concern. Pair these rules
  with runtime guardrails, output moderation, and human review for destructive
  actions.
- **Naming-based heuristics have edges.** Destructive-verb and
  user-input detection use configurable pattern lists. Tune them
  (`{ destructivePatterns: [...] }`, `{ userInputPatterns: [...] }`) to your
  codebase rather than assuming the defaults are exhaustive.

Static analysis is the cheapest, earliest, most consistent layer — it runs on
every commit and never gets tired. It is a floor, not the whole building.

---

## Where this sits in the ecosystem

The general-purpose security linters (`eslint-plugin-security` and friends)
predate the agent era — they don't know what a `generateText` call or a
`tool({ execute })` is. This plugin is the specialized layer for that surface:
it speaks AI SDK shapes and maps every finding to the OWASP LLM Top 10 and a
CWE. It complements the generic set rather than replacing it — reach for it
once your app actually calls a model. It's one plugin in the
[Interlace](https://eslint.interlace.tools) family of domain-specific security
linters (Node, JWT, Express, Lambda, Postgres, …); the AI SDK is simply its
domain.

---

## Links

- 📦 [npm: eslint-plugin-vercel-ai-security](https://www.npmjs.com/package/eslint-plugin-vercel-ai-security)
- 📖 [Full rule docs](https://eslint.interlace.tools/docs/security/plugin-vercel-ai-security/rules)
- 🔐 [OWASP Top 10 for LLM Applications](https://owasp.org/www-project-top-10-for-large-language-model-applications/)
- 💻 [Source on GitHub](https://github.com/ofri-peretz/eslint/tree/main/packages/eslint-plugin-vercel-ai-security)

::dev-to-cta{url="https://github.com/ofri-peretz/eslint"}
⭐ Star on GitHub if this saved you an incident review.
::

---

I'm **Ofri Peretz**, a security engineering leader and the author of the
Interlace ESLint ecosystem — domain-specific static analysis for security,
reliability, and performance on the Node.js stack. The AI SDK plugin is the
agent-era member of that family.

[ofriperetz.dev](https://ofriperetz.dev) · [LinkedIn](https://linkedin.com/in/ofri-peretz) · [GitHub](https://github.com/ofri-peretz)
