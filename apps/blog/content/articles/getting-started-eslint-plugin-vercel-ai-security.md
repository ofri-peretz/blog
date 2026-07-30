---
title: "Vercel AI SDK Security Holes That TypeScript Won't Catch — 19 Rules That Will"
description: "Prompt injection via unvalidated user input, system prompt exfiltration, missing output validation, tool call injection — TypeScript types look correct in every case. Here are the 19 ESLint rules that catch them in CI."
slug: "getting-started-eslint-plugin-vercel-ai-security"
canonical_url: "https://ofriperetz.dev/articles/getting-started-eslint-plugin-vercel-ai-security"
tier: "TUTORIAL"
devto_url: "https://dev.to/ofri-peretz/getting-started-with-eslint-plugin-vercel-ai-security-5e9g"
devto_id: 3139002
published_at: "2025-12-31T21:49:06Z"
edited_at: "2026-01-11T10:21:46Z"
cover_image: "https://ofriperetz.dev/cdn/blog-cover-image/getting-started-eslint-plugin-vercel-ai-security.jpg"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/getting-started-eslint-plugin-vercel-ai-security-og.jpg"
reading_time_minutes: 11
tags:
  - "ai"
  - "security"
  - "devsecops"
  - "eslint"
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

```text
✖ 13 problems (10 errors, 3 warnings)
```

That is `eslint-plugin-vercel-ai-security` over three idiomatic Vercel AI SDK files — the shapes the SDK docs teach and your AI assistant reproduces. All three failed. Every failing line type-checks without complaint, because the holes live in data flow, not in types: `tsc` has no opinion about where a string came from.

Getting the same scan into your repo is two commands:

```bash
npm install --save-dev eslint-plugin-vercel-ai-security
npx eslint .
```

What follows is what those 13 findings were: four vulnerability classes, the code that carries each one, why review waves it through, and the rule that stops it. Then the full setup, and an honest list of what the rules still miss.

**Skip to:** [Setup](#setting-it-up-in-two-minutes) · [All 19 rules](#the-full-rule-set-all-19) · [The reproducible scan](#what-recommended-actually-fires-a-scan-you-can-re-run) · [Compatibility](#compatibility) · [What it can't do](#what-static-analysis-cannot-do)

---

## Finding 1: Prompt injection via unvalidated user input

```ts
// ❌ VULNERABLE — type: string, danger: unvalidated
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

const { text } = await generateText({
  model: openai("gpt-4o"),
  prompt: userMessage, // req.body.message — attacker-controlled
});
```

**Why it survived review.** `prompt: userMessage` is the canonical line in every AI SDK tutorial, every Stack Overflow answer, every README — the reviewer's pattern-matcher reads it as correct, and TypeScript agrees that `userMessage` is a `string`. No `+` concatenation to flag, no `eval`, no obvious sink. The vulnerability is what's _absent_: a validation boundary. Absence is the hardest thing to spot in a diff, and a tired reviewer at 5pm notices it approximately never.

**The rule:** `require-validated-prompt` ([CWE-74](https://ofriperetz.dev/articles/cwe-taxonomy-explained), [CVSS 9.0](https://ofriperetz.dev/articles/cvss-scores-explained))

ESLint output:

```text
  9:11  error  🔒 CWE-74 OWASP:A03-Injection CVSS:9 | User input "userMessage" passed
               directly to generateText prompt without validation | CRITICAL [SOC2,GDPR]
               Fix: Validate input before use: generateText({ prompt: validateInput(userInput) })
```

```ts
// ✅ FIXED — input passes through a validation boundary
const { text } = await generateText({
  model: openai("gpt-4o"),
  prompt: validateInput(userMessage), // schema + length + allow-list
});
```

---

## Finding 2: System prompt exfiltration

```ts
// ❌ VULNERABLE — two holes in one call
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

const SYSTEM_PROMPT = "You are an internal assistant. Company data: ...";

const { text } = await generateText({
  model: openai("gpt-4o"),
  system: `You are an assistant for ${user.companyName}`, // dynamic: attacker shapes instructions
  prompt: userMessage,
});

// Then later in the API route handler:
return Response.json({ reply: text, system: SYSTEM_PROMPT }); // leaks instructions to client
```

**Why it survived review.** The `system` field looks harmless — it's personalizing the assistant greeting with a company name. TypeScript types `system` as `string`, and a template literal satisfies that perfectly. The `Response.json` line looks like a debugging convenience that never got cleaned up. Neither reviewer flagged either. The first is an agent-confusion vector (instructions and data share one channel); the second hands an attacker your entire system prompt.

**The rules:** `no-dynamic-system-prompt` (CWE-74, CVSS 8.0) + `no-system-prompt-leak` (CWE-200, CVSS 7.5)

```ts
// ✅ FIXED — static system prompt, never returned to client
const { text } = await generateText({
  model: openai("gpt-4o"),
  system: STATIC_SYSTEM_PROMPT, // no interpolation
  prompt: validateInput(userMessage),
});

return Response.json({ reply: text }); // system prompt stays server-side
```

---

## Finding 3: Missing output validation — model text reaches a sink

This is the highest-severity finding, and the plugin's flagship rule.

```ts
// ❌ VULNERABLE — model output treated as trusted data
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

const { text } = await generateText({
  model: openai("gpt-4o"),
  prompt: validateInput(userMessage), // input is validated — looks secure
});

// Three sinks, three CWEs:
eval(text); // RCE (CWE-94)
db.query(`SELECT * FROM logs WHERE id = '${text}'`); // SQL injection (CWE-89)
el.innerHTML = text; // XSS (CWE-79)
```

**Why it survived review.** The PR that ships this looks like a _rendering_ change — `el.innerHTML = text` lands in a diff titled "render assistant markdown," next to thirty lines of CSS. And `text` was assigned three lines up from a call with `validateInput` on its `prompt`, so it reads as "we're already being careful." The blind spot is that an attacker shaped the _prompt_ that shaped the output: model output is untrusted input that looks trustworthy because you generated it. The rule fires at the sink no matter how far away the model call is — exactly the trace a human skips.

**The rule:** `no-unsafe-output-handling` (CWE-94/89/79, CVSS 9.8 for eval sink)

```ts
// ✅ FIXED — output treated as untrusted at every sink
db.query("SELECT * FROM logs WHERE id = ?", [text]); // parameterized
el.textContent = text; // inert assignment
// never pass model output to eval / Function / exec / spawn
```

On the exact shape above, the rule fires on `eval` and `innerHTML` — it tracks the binding back to the `generateText` call. The SQL sink needs the output to be legible _inside_ the template: `${result.text}` fires, a bare destructured `${text}` does not. That is a real [false negative](https://ofriperetz.dev/articles/confusion-matrix-tp-fp-fn-tn), and it is in the caveats below.

---

## Finding 4: Tool call injection — destructive tools without a confirmation gate

```ts
// ❌ VULNERABLE — model can invoke a destructive operation unilaterally
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

const { text } = await generateText({
  model: openai("gpt-4o"),
  prompt: validateInput(userMessage),
  tools: {
    deleteUser: {
      description: "Delete a user account",
      parameters: z.object({ id: z.string() }),
      execute: async ({ id }) => db.users.delete(id),
    },
  },
  // no step limit → model can loop tool calls until the budget is gone
});
```

**Why it survived review.** The destructive tool arrives in the PR that makes the agent _useful_ — "let the assistant cancel a subscription." The `execute` body is a one-liner calling an internal API the team already trusts (`db.users.delete`). The reviewer reads it, confirms it calls the right API, approves. What's missing isn't in the body; it's the gate _around_ it, and the diff gives no visual cue that this tool is more dangerous than the read-only one above it. The missing step ceiling is worse: it's a line that was never written.

**The rules:** `require-tool-confirmation` (CWE-862, CVSS 7.0) + `require-max-steps` (CWE-834)

ESLint output:

```text
  24:3  error  ⚠️ CWE-862 OWASP:A01-Broken CVSS:7 | Tool "deleteUser" performs destructive
               operation "delete" without requiring confirmation. | HIGH [SOC2]
               Fix: Add requiresConfirmation: true or implement confirmation logic in the tool
```

```ts
// ✅ FIXED — gate on destructive tool, bounded loop
const { text } = await generateText({
  model: openai("gpt-4o"),
  prompt: validateInput(userMessage),
  maxSteps: 5, // bounded agent loop — AI SDK v4 name, see the note below
  tools: {
    deleteUser: {
      description: "Delete a user account",
      requiresConfirmation: true, // human-in-the-loop before execute
      parameters: z.object({ id: z.string() }),
      execute: async ({ id }) => db.users.delete(id),
    },
  },
});
```

**If you are on AI SDK v5 or later, type this instead:** `stopWhen: stepCountIs(5)` replaced `maxSteps`, and `maxOutputTokens` replaced `maxTokens`. Both `require-max-steps` and `require-max-tokens` still key on the v4 names as of v1.3.7, so on a v5+ codebase they flag calls that are already correctly bounded. Write the real option, silence those two rules for that file, and keep the other 17 — a rule that is behind a rename is a [false positive](https://ofriperetz.dev/articles/confusion-matrix-tp-fp-fn-tn) you can see coming, which is the cheap kind.

---

## Setting it up in two minutes

You installed it at the top of this article. What is left is the config file that decides which rules fire.

Flat config (`eslint.config.js` or `eslint.config.mjs` — both load):

```js
import { configs } from "eslint-plugin-vercel-ai-security";

export default [
  configs.recommended, // 11 errors + 4 warnings — all four findings above fire here
  // configs.minimal,  // 2 rules — the gradual-adoption on-ramp for a large codebase
  // configs.strict,   // 18 errors + 1 warning — production hardening
];
```

The plugin ships CommonJS, so a CommonJS project can `require` it without any interop dance:

```js
const { configs } = require("eslint-plugin-vercel-ai-security");

module.exports = [configs.recommended];
```

`recommended` catches all four vulnerabilities above, and every finding it prints carries the CWE, the [OWASP mapping](https://ofriperetz.dev/articles/owasp-top-10-explained), the CVSS score, and the fix on the same line — the format you saw under Finding 1. No documentation lookup, no second tab.

Tune any rule inline:

```js
import { configs } from "eslint-plugin-vercel-ai-security";

export default [
  configs.recommended,
  {
    rules: {
      "vercel-ai-security/require-max-steps": [
        "error",
        { suggestedMaxSteps: 10 },
      ],
      "vercel-ai-security/require-rag-content-validation": "warn",
    },
  },
];
```

yarn, pnpm, and bun install it the same way npm does — nothing in the plugin depends on the package manager.

---

## The full rule set: all 19

| Rule                             | Catches                             | CWE          | `recommended` |
| -------------------------------- | ----------------------------------- | ------------ | ------------- |
| `require-validated-prompt`       | Untrusted input → prompt            | CWE-74       | error         |
| `no-dynamic-system-prompt`       | Interpolated system prompt          | CWE-74       | error         |
| `no-unsafe-output-handling`      | AI output → eval/SQL/innerHTML      | CWE-94/89/79 | error         |
| `no-hardcoded-api-keys`          | Keys in model config                | CWE-798      | error         |
| `no-sensitive-in-prompt`         | Secrets/PII in prompt               | CWE-200      | error         |
| `no-system-prompt-leak`          | System prompt in response           | CWE-200      | error         |
| `require-tool-confirmation`      | Destructive tool, no gate           | CWE-862      | error         |
| `require-tool-schema`            | Unconstrained tool params           | CWE-20       | error         |
| `require-max-tokens`             | No output ceiling                   | CWE-770      | error         |
| `require-max-steps`              | Unbounded agent loop                | CWE-834      | error         |
| `require-abort-signal`           | Streaming call can't cancel         | CWE-404      | error         |
| `require-output-filtering`       | Raw data-source rows in tool result | CWE-200      | warn          |
| `require-rag-content-validation` | Unvalidated retrieved context       | CWE-74       | warn          |
| `no-training-data-exposure`      | User data → training endpoint       | CWE-359      | warn          |
| `require-request-timeout`        | No timeout/abort                    | CWE-400      | warn          |
| `require-error-handling`         | AI call not wrapped                 | CWE-755      | off           |
| `require-audit-logging`          | AI op not logged                    | CWE-778      | off           |
| `require-embedding-validation`   | Unvalidated embedding stored        | CWE-20       | off           |
| `require-output-validation`      | Output shown unvalidated            | CWE-707      | off           |

`recommended` ships **11 rules as errors and 4 as warnings**; the remaining 4 are off. `strict` turns **18 on as errors** and leaves `require-audit-logging` at warn. Start with `recommended`, ratchet to `strict` per directory as you harden. (Counts read off v1.3.7 on 2026-07-28 — what the package exports, not what its README remembers.)

---

## What `recommended` actually fires: a scan you can re-run

I put the four vulnerable shapes into three files — `chat-route.js` (Findings 1 and 2), `agent-tools.js` (Finding 4), `render.js` (Finding 3) — and ran the `recommended` preset over them.

**Result: 3 files, 13 findings — 10 errors, 3 warnings.**

| Rule                        | Findings | Severity |
| --------------------------- | -------- | -------- |
| `require-max-tokens`        | 3        | error    |
| `require-request-timeout`   | 3        | warn     |
| `no-unsafe-output-handling` | 2        | error    |
| `require-validated-prompt`  | 1        | error    |
| `no-dynamic-system-prompt`  | 1        | error    |
| `no-system-prompt-leak`     | 1        | error    |
| `require-tool-confirmation` | 1        | error    |
| `require-max-steps`         | 1        | error    |

Every one of the three files failed. The insecure shape is the default shape — exactly as the SDK's own examples teach it.

**Reproduce it** — plugin `1.3.7`, ESLint `10.8.0`, Node `22.22.0`, measured 2026-07-28:

```bash
npm install --save-dev eslint-plugin-vercel-ai-security@1.3.7 eslint@10
# eslint.config.mjs → import { configs } from "eslint-plugin-vercel-ai-security";
#                     export default [configs.recommended];
npx eslint chat-route.js agent-tools.js render.js
```

One friction point worth ten minutes of your life: ESLint 10 needs Node `^20.19 || ^22.13 || >=24`. On Node 18 the run dies inside the formatter with `TypeError: util.styleText is not a function` — which reads like a plugin bug and isn't one. The plugin runs fine on Node 18; pair it with ESLint 8 or 9 there.

**Two honest caveats**, both re-checked against the run above:

1. `require-tool-confirmation` only inspects inline tool object literals. Tools authored with the SDK's `tool()` helper, or lifted into a variable, are skipped. Inline the definition so the rule can see it, or gate those tools by hand.
2. `no-unsafe-output-handling` follows the model-output binding into `eval` and `innerHTML`, but its SQL check matches on the interpolated text: ``db.query(`... ${result.text}`)`` fires, ``db.query(`... ${text}`)`` from a destructured call does not. Keep the output reachable as `result.text`, or parameterize the query and stop thinking about it.

Both are misses, not noise — these rules stay quiet rather than guess, which is the [precision-over-recall](https://ofriperetz.dev/articles/precision-recall-f1-for-static-analysis) side of a trade every detector makes, and the right side for a rule that blocks merges. I wrote both rules and still found the second gap by re-running my own scan for this update, which is the argument for [shipping the reproduce command](https://ofriperetz.dev/articles/reproducibility-vs-replicability) rather than a screenshot of a green terminal.

---

## Compatibility

| Surface              | Support                                                                                                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Package managers** | npm, yarn, pnpm, bun                                                                                                                                                            |
| **Node**             | Plugin: `>= 18.0.0`. But ESLint 10 itself needs `^20.19 \|\| ^22.13 \|\| >=24` — on Node 18, stay on ESLint 8 or 9.                                                             |
| **ESLint**           | `^8.0.0 \|\| ^9.0.0 \|\| ^10.0.0`, flat config                                                                                                                                  |
| **Module system**    | CommonJS — loads from `eslint.config.js` (via `import` or `require`) and `eslint.config.mjs`                                                                                    |
| **Vercel AI SDK**    | Optional peer — rules are AST-based. v5+ renamed `maxTokens` → `maxOutputTokens` and `maxSteps` → `stopWhen: stepCountIs(n)`; both rules still key on the v4 names as of 1.3.7. |
| **Oxlint**           | `no-unsafe-output-handling` is wired into our Oxlint config and parity-checked in CI. Full 19-rule set runs on ESLint.                                                          |

---

## What static analysis cannot do

- **It enforces structure, not semantics.** `require-validated-prompt` proves `validateInput()` is called; it cannot prove your validator defeats injection, and string sanitization alone does not. Treat `validateInput` as the place you enforce a schema, a length, and an allow-list — the rule only guarantees you have such a place.
- **It sees call sites, not runtime.** A confirmation flag satisfies the rule; whether your UI actually blocks on it is a runtime concern.
- **Naming-based heuristics have edges.** Destructive-verb detection uses configurable pattern lists — a [heuristic matcher, not taint tracking](https://ofriperetz.dev/articles/taint-vs-heuristic-detection). That trade buys a rule that runs in milliseconds with zero configuration, and costs you the edges in the caveats above. Tune with `{ destructivePatterns: [...] }` rather than assuming the defaults are exhaustive.

[Static analysis](https://ofriperetz.dev/articles/static-analysis-vs-sast-vs-linting) is the cheapest, earliest, most consistent layer — it runs on every commit and never gets tired. It is a floor, not the whole building.

---

## Why this matters more every quarter: your AI writes this code now

Every shape these 19 rules flag is a shape an AI assistant will happily generate. Ask Claude, Copilot, or Gemini for a tool-calling agent and you get back `prompt: userMessage`, ungated destructive tools, and no step ceiling at all. The model isn't careless — it's reproducing the canonical example, which is the insecure one.

I've measured this: [65–75% of functions Claude generated carried a security vulnerability](https://ofriperetz.dev/articles/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities). [The same harness across 700 functions from five models](https://ofriperetz.dev/articles/we-ranked-5-ai-models-by-security-the-leaderboard-is-wrong) found every model shipping the insecure default — Gemini 2.5 Pro at 73%, Flash at 64%. And [clean compilation buys you nothing: Claude wrote 200 lines of NestJS that TypeScript accepted, ESLint found 6 holes in 3 seconds](https://ofriperetz.dev/articles/claude-wrote-nestjs-service-eslint-found-6-security-holes).

That's the argument for a deterministic gate: the thing writing your AI call sites has no memory of your threat model, and the thing reviewing the PR is increasingly also a model. A rule keyed to the AST is the one layer in that loop that fails closed every time, however the code was authored.

---

**Read next:** [3 lines of code to hack your Vercel AI app — and 1 line to fix it](https://ofriperetz.dev/articles/3-lines-of-code-to-hack-your-vercel-ai-app-and-1-line-to-fix-it-jo). You have the scan running; that one shows the attack it stops end to end, and why the boundary has to be structural rather than a string filter.

Then, from the _Hardening AI Agents_ series:

- [Vercel AI SDK prompt injection vulnerability](https://ofriperetz.dev/articles/vercel-ai-sdk-prompt-injection-vulnerability) — the LLM01 rules in depth
- [Your AI SDK app vs the OWASP LLM Top 10](https://ofriperetz.dev/articles/100-owasp-llm-top-10-coverage-for-vercel-ai-sdk) — the 8 categories these rules cover, and the 2 they honestly can't

## Links

- 📦 [npm: eslint-plugin-vercel-ai-security](https://www.npmjs.com/package/eslint-plugin-vercel-ai-security)
- 📖 [Full rule docs](https://eslint.interlace.tools/docs/security/plugin-vercel-ai-security/rules)
- 🔐 [OWASP Top 10 for LLM Applications](https://owasp.org/www-project-top-10-for-large-language-model-applications/)
- 💻 [Source on GitHub](https://github.com/ofri-peretz/eslint/tree/main/packages/eslint-plugin-vercel-ai-security)

::dev-to-cta{url="https://www.npmjs.com/package/eslint-plugin-vercel-ai-security"}
📦 `npm i -D eslint-plugin-vercel-ai-security` — two commands and one config file, and your CI reads AI call sites the way an attacker does.
::

**Which of the 19 rules did your first scan fire — and was it code you wrote, or code your AI assistant handed you?** Drop it in the comments — I'm tracking the split between human-authored and AI-authored findings.

---

_[eslint-plugin-vercel-ai-security](https://www.npmjs.com/package/eslint-plugin-vercel-ai-security) is part of the [Interlace ESLint ecosystem](https://eslint.interlace.tools). Source on [GitHub](https://github.com/ofri-peretz/eslint) · Follow: [Dev.to/ofri-peretz](https://dev.to/ofri-peretz)_
