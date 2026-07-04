---
title: "I Linted 3 Idiomatic Vercel AI SDK Snippets. All 3 Failed: 13 Findings, 10 Errors."
description: "Prompt injection, tool over-permissioning, AI output that reaches eval/SQL/innerHTML, secrets in prompts — the Vercel AI SDK puts every one a single property away. 19 ESLint rules that catch them in CI, before deploy."
slug: "getting-started-eslint-plugin-vercel-ai-security"
canonical_url: "https://ofriperetz.dev/articles/getting-started-eslint-plugin-vercel-ai-security"
devto_url: "https://dev.to/ofri-peretz/getting-started-with-eslint-plugin-vercel-ai-security-5e9g"
devto_id: 3139002
published_at: "2025-12-31T21:49:06Z"
edited_at: "2026-01-11T10:21:46Z"
cover_image: "https://ofriperetz.dev/og/cover/getting-started-eslint-plugin-vercel-ai-security"
social_image: "https://ofriperetz.dev/og/article/getting-started-eslint-plugin-vercel-ai-security"
reading_time_minutes: 9
tags:
  - "security"
  - "ai"
  - "eslint"
  - "googleai"
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

That snippet ships. It passes review. It also hands an attacker a
prompt-injection vector (`userMessage` flows straight into the model), two
destructive tools with no confirmation gate, no token ceiling, no step ceiling,
and no plan for what happens when the model's output lands in your database or
your DOM. **Six lines of code, six attack surfaces.** None of them looks wrong
in a diff — that's exactly why it merged. When I saved that snippet plus two
more idiomatic AI SDK shapes to disk and ran the linter, all three files failed:
[13 findings, 10 of them errors](#what-recommended-actually-fires--a-reproducible-scan).
The insecure shape isn't an edge case. It's the default the SDK's own examples teach.

None of it is a bug in the SDK. It's the same gap every powerful API has: the
easy path and the safe path look almost identical, and the compiler can't tell
them apart. The reviewer can't either — `prompt: userMessage` reads like every
other example in the docs. **`eslint-plugin-vercel-ai-security` makes that gap a
CI failure.** It's a focused plugin — 19 rules, each pinned to a CWE and mapped
to the OWASP Top 10 for LLM Applications — that reads your AI SDK call sites and
flags the dangerous shape before it merges.

If you want it running before you read the rest, that's two commands:

```bash
npm install --save-dev eslint-plugin-vercel-ai-security
npx eslint .
```

This is the getting-started guide: what each rule catches, the real fix it
wants, how to install and configure it across npm/yarn/pnpm, and exactly which
ESLint and Oxlint versions it runs under. It's part of the **Hardening AI
Agents** series — companion reads as we go:

- [Prompt injection lives in 3 places in a Vercel AI app](https://ofriperetz.dev/articles/vercel-ai-sdk-prompt-injection-vulnerability) — the LLM01 rules in depth.
- ["Just sanitize it" won't close a prompt-injection hole](https://ofriperetz.dev/articles/3-lines-of-code-to-hack-your-vercel-ai-app-and-1-line-to-fix-it-jo) — why the boundary is structural, not a string filter.
- [Your AI SDK app vs the OWASP LLM Top 10](https://ofriperetz.dev/articles/100-owasp-llm-top-10-coverage-for-vercel-ai-sdk) — the 8 categories these rules cover, and the 2 they honestly can't.

---

## TL;DR

- **19 rules**, every one carrying a `CWE` id and a CVSS score, mapped to the
  OWASP LLM Top 10.
- **4 presets**: `minimal` (2 rules), `recommended` (11 errors + 4 warnings +
  4 off), `strict` (18 errors + 1 warning), and `flagship` (the single
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

**Why this survives review.** `prompt: userMessage` is the single most common
line in every AI SDK tutorial, every Stack Overflow answer, every README. A
reviewer's pattern-matcher reads it as "correct" — it looks exactly like the
canonical example. There's no `+` string concatenation to flag, no obvious
`exec`, no SQL. The injection is in what's _absent_ (a validation boundary), and
absence is the hardest thing for a human to see in a diff. That's the whole
case for moving this check to CI: a linter notices the missing boundary on every
PR; a tired reviewer at 5pm notices it approximately never.

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

**Why this survives review.** The PR that ships this almost always looks like a
_rendering_ change, not a security one: `el.innerHTML = response` lands in a diff
titled "render assistant markdown," sitting next to thirty lines of CSS. The
reviewer's attention is on the layout, and the data source is one hop away — the
`response` variable was assigned three lines up, or in a different file, so the
"this came from a model" fact isn't visible at the sink. We trust our own output
because we generated it; the blind spot is forgetting that an attacker shaped the
_prompt_ that shaped that output. The rule fires at the sink regardless of how
far away the model call is, which is exactly the trace a human skips.

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

**Why this survives review.** The destructive tool gets added in the PR that
makes the agent _useful_ — "let the assistant cancel a subscription for the
user" — and the `execute` body is a one-line call to a function the team already
trusts (`db.users.delete`, `billing.refund`). The reviewer reads the `execute`
body, confirms it calls the right internal API, and approves. What's missing
isn't in the body — it's the absence of a gate _around_ the body, and the diff
gives no visual cue that this tool is more dangerous than the read-only one
above it. The same blind spot bites the `maxSteps` case in section 4: an agent
with tools but no step ceiling is one ambiguous user message away from looping —
call tool, reconsider, call again — until it exhausts your rate limit or your
budget, and "no `maxSteps`" is invisible precisely because it's a line that was
never written.

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
| `require-tool-schema`            | Unconstrained tool params           | CWE-20  | error         |
| `require-max-tokens`             | No output ceiling                   | CWE-770 | error         |
| `require-max-steps`              | Unbounded agent loop                | CWE-834 | error         |
| `require-output-filtering`       | Raw data-source rows in tool result | CWE-200 | warn          |
| `require-rag-content-validation` | Unvalidated retrieved context       | CWE-74  | warn          |
| `no-training-data-exposure`      | User data → training endpoint       | CWE-359 | warn          |
| `require-request-timeout`        | No timeout/abort                    | CWE-400 | warn          |
| `require-error-handling`         | AI call not wrapped                 | CWE-755 | off           |
| `require-abort-signal`           | Streaming call can't cancel         | CWE-404 | error         |
| `require-audit-logging`          | AI op not logged                    | CWE-778 | off           |
| `require-embedding-validation`   | Unvalidated embedding stored        | CWE-20  | off           |
| `require-output-validation`      | Output shown unvalidated            | CWE-707 | off           |

`recommended` ships **11 rules as errors and 4 as warnings**; the remaining 4
(`require-error-handling`, `require-audit-logging`, `require-embedding-validation`,
`require-output-validation`) are `off` by default. `strict` turns **18 on as
errors** and leaves only `require-audit-logging` at `warn`. Start with
`recommended`, ratchet to `strict` per directory as you adopt.

---

## What `recommended` actually fires — a reproducible scan

Claims about a linter are cheap; the output is the proof. So here is a scan you
can run yourself and get the same numbers. I took the three insecure shapes from
the sections above — the six-line agent at the top of this article, the
ungated `deleteUser` tool, and the model-output-to-sink block — saved them as
three files, and ran the **`recommended`** preset over them.

**Reproduce it** (plugin `eslint-plugin-vercel-ai-security@1.3.5`, ESLint
`10.4.1`, Node 18, run 2026-06-21):

```bash
npm install --save-dev eslint-plugin-vercel-ai-security@1.3.5
# eslint.config.js → export default [ configs.recommended ]
npx eslint chat-route.js agent-tools.js render.js
```

**Result: 3 files scanned, 13 findings — 10 errors, 3 warnings.** Distribution
by rule:

| Rule                        | Findings | Severity |
| --------------------------- | -------- | -------- |
| `require-max-tokens`        | 3        | error    |
| `no-unsafe-output-handling` | 3        | error    |
| `require-request-timeout`   | 3        | warn     |
| `require-max-steps`         | 2        | error    |
| `require-validated-prompt`  | 1        | error    |
| `require-tool-confirmation` | 1        | error    |

Two things in that table are worth sitting with. First, **every one of the three
files failed** — there is no "mostly fine" sample here; the insecure shape is the
default shape, exactly as the SDK's own examples teach it. Second, the heaviest
hitters are the _boring_ rules — `require-max-tokens`, `require-request-timeout`,
`require-max-steps` fire on essentially every call site, because nobody
remembers to set a token ceiling or a timeout on the happy path. The
catastrophic ones (`no-unsafe-output-handling` at CVSS 9.8 for the `eval` sink,
`require-validated-prompt` at CVSS 9.0) are rarer per file but are the ones that
turn into an incident.

This is also the answer to "is that sample lint output real or illustrative?" —
it is captured, not mocked. The `require-validated-prompt` finding on
`chat-route.js` is the exact line reproduced verbatim in the **Run it** block
below: `CWE-74 OWASP:A03-Injection CVSS:9 | User input "userMessage" passed
directly to generateText prompt without validation | CRITICAL [SOC2,GDPR]`.

One honest caveat that the scan surfaces: the top six-line snippet declares its
two destructive tools in shorthand (`tools: { deleteAccount, transferFunds }`),
and `require-tool-confirmation` only inspects inline tool _object literals_ — so
it fires once (on the spelled-out `deleteUser` literal in the second file), not
on the shorthand pair. That is the documented known false-negative from the
[Excessive agency](#3-excessive-agency--tools-that-act-without-a-leash) scope
note, showing up in a real run rather than as a footnote. The prompt-injection,
unbounded-loop, and output-sink surfaces in that snippet all still fire; the
confirmation gap on shorthand tools is the one you still close by hand.

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
  configs.recommended, // balanced — 11 errors + 4 warnings + 4 off
  // configs.minimal,  // 2 critical rules, for gradual adoption
  // configs.strict,   // 18 errors + 1 warning — production hardening
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

Both findings above are real output from the
[reproducible scan](#what-recommended-actually-fires--a-reproducible-scan) —
the `chat-route.js` prompt-injection line and the `agent-tools.js`
`deleteUser` confirmation line, copied from the run, not hand-written for the
article.

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

## The reason this matters more every quarter: your AI writes this code now

Every shape these 19 rules flag is a shape an AI assistant will happily generate
for you. Ask Claude, Copilot, or Gemini to "add a tool-calling agent with the
Vercel AI SDK" and you get back the six-line snippet at the top of this article
— `prompt: userMessage`, ungated destructive tools, no `maxSteps`, the lot. The
model isn't being careless; it's reproducing the canonical example, which is the
insecure one. The training data is full of the easy path because the easy path
is what gets written.

I've measured how often this happens, and the numbers aren't close. Given no
security context,
[65–75% of the functions I had Claude generate carried a security
vulnerability](https://ofriperetz.dev/articles/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities).
That isn't a Claude problem — I ran the same harness across
[700 AI-generated functions from five different
models](https://ofriperetz.dev/articles/we-ranked-5-ai-models-by-security-the-leaderboard-is-wrong),
and every one of them shipped the insecure default; the leaderboard only argues
about _which_ model is worst. And clean compilation buys you nothing here —
[Claude wrote 200 lines of NestJS that TypeScript accepted without complaint, and
the security rules found 6 holes in
3 seconds](https://ofriperetz.dev/articles/claude-wrote-nestjs-service-eslint-found-6-security-holes).
The Vercel AI SDK surface is no different: ask any of those models for an agent
and you get `prompt: userMessage` with no `maxSteps`.

It also compounds. Ask the model to fix one finding and it often
[introduces two more in the patch](https://ofriperetz.dev/articles/the-ai-hydra-problem-fix-one-ai-bug-get-two-more) —
the AI-Hydra problem. That's the actual argument for a deterministic gate: the
thing writing your AI call sites has no memory of your threat model, and the
thing reviewing the PR is increasingly also a model. A lint rule keyed to the AST
is the one layer in that loop that fails closed, every time, regardless of how
the code was authored.

This is also why I run the same rules over AI-generated code as over
hand-written code — there's no separate "AI lint." The call site is dangerous or
it isn't; who typed it is irrelevant to the rule. And this isn't a Claude-only
tic: when I ran the same harness over Google's models,
[Gemini 2.5 Pro carried a 73% vulnerability rate and Flash 64% across 700
functions](https://ofriperetz.dev/articles/we-ranked-5-ai-models-by-security-the-leaderboard-is-wrong) —
the insecure default is model-agnostic, so under the **Build with Gemini**
challenge it's the same rules, same AST: point `npx eslint .` at the code Gemini
hands you and `prompt: userMessage` with no `maxSteps` shows up exactly the same.

---

## Where this sits in the ecosystem

The general-purpose security linters (`eslint-plugin-security` and friends)
predate the agent era — they don't know what a `generateText` call or a
`tool({ execute })` is. This plugin is the specialized layer for that surface:
it speaks AI SDK shapes and maps every finding to the OWASP LLM Top 10 and a
CWE. It complements the generic set rather than replacing it — reach for it
once your app actually calls a model. If the destructive-tool problem is the one
that keeps you up — the `deleteUser` execute with no gate — that one has its own
deep dive:
[5 ESLint rules that gate every tool call](https://ofriperetz.dev/articles/securing-ai-agents-in-the-vercel-ai-sdk).
It's one plugin in the
[Interlace](https://eslint.interlace.tools) family of domain-specific security
linters (Node, JWT, Express, Lambda, Postgres, …); the AI SDK is simply its
domain.

---

Run `npx eslint .` against your AI SDK code once. If you've shipped a
`generateText` call, I'd bet money one of these 19 fires on the first run —
they almost always do, because the insecure shape is the default shape. So
here's the question I actually want answered in the comments: **which of the 19
did your first scan light up — and was it code _you_ wrote, or code your AI
assistant handed you?** I'm collecting the distribution; the split between
human-authored and AI-authored findings is the interesting part.

## Links

- 📦 [npm: eslint-plugin-vercel-ai-security](https://www.npmjs.com/package/eslint-plugin-vercel-ai-security)
- 📖 [Full rule docs](https://eslint.interlace.tools/docs/security/plugin-vercel-ai-security/rules)
- 🔐 [OWASP Top 10 for LLM Applications](https://owasp.org/www-project-top-10-for-large-language-model-applications/)
- 💻 [Source on GitHub](https://github.com/ofri-peretz/eslint/tree/main/packages/eslint-plugin-vercel-ai-security)

**The _Hardening AI Agents_ series** — you're reading the map; here's the rest, in reading order:

1. **This guide** — all 19 rules, the reproducible scan, install & config _(you are here)_
2. [Prompt injection lives in 3 places →](https://ofriperetz.dev/articles/vercel-ai-sdk-prompt-injection-vulnerability) — the LLM01 rules in depth
3. [Why "just sanitize it" won't close it →](https://ofriperetz.dev/articles/3-lines-of-code-to-hack-your-vercel-ai-app-and-1-line-to-fix-it-jo) — the boundary is structural, not a string filter
4. [Gating every tool call →](https://ofriperetz.dev/articles/securing-ai-agents-in-the-vercel-ai-sdk) — the 5 rules that bound an agent's agency
5. [Your app vs the full OWASP LLM Top 10 →](https://ofriperetz.dev/articles/100-owasp-llm-top-10-coverage-for-vercel-ai-sdk) — the 8 it covers, the 2 it honestly can't

**See it on AI-written code:** [I ranked 5 models on 700 functions →](https://ofriperetz.dev/articles/we-ranked-5-ai-models-by-security-the-leaderboard-is-wrong) · [Claude's clean-compiling NestJS, 6 holes →](https://ofriperetz.dev/articles/claude-wrote-nestjs-service-eslint-found-6-security-holes) · [Fix one AI bug, get two more →](https://ofriperetz.dev/articles/the-ai-hydra-problem-fix-one-ai-bug-get-two-more)

::dev-to-cta{url="https://github.com/ofri-peretz/eslint"}
⭐ Star on GitHub if this saved you an incident review.
::

---

I'm **Ofri Peretz**, a security engineering leader and the author of the
Interlace ESLint ecosystem — domain-specific static analysis for security,
reliability, and performance on the Node.js stack. The AI SDK plugin is the
agent-era member of that family.

[ofriperetz.dev](https://ofriperetz.dev) · [LinkedIn](https://linkedin.com/in/ofri-peretz) · [GitHub](https://github.com/ofri-peretz)
