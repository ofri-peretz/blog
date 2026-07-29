---
title: "I Linted 12 AI-Shaped Agent Tools. All 12 Were Missing an Input Schema."
description: "I ran eslint-plugin-vercel-ai-security over 12 tool definitions written the way AI assistants wire them: 12/12 had no inputSchema and 6 destructive tools (deleteUser, transferFunds, executeCommand…) had no confirmation gate. Five CWE-tagged ESLint rules bound an AI agent's agency at write-time — and one ungated tool still slipped past."
slug: "securing-ai-agents-in-the-vercel-ai-sdk"
canonical_url: "https://ofriperetz.dev/articles/securing-ai-agents-in-the-vercel-ai-sdk"
tier: "TOPIC"
devto_url: "https://dev.to/ofri-peretz/securing-ai-agents-in-the-vercel-ai-sdk-485n"
devto_id: 3116469
published_at: "2025-12-20T00:03:08Z"
edited_at: "2026-02-05T05:33:12Z"
cover_image: "https://ofriperetz.dev/cdn/blog-cover-image/securing-ai-agents-in-the-vercel-ai-sdk.jpg"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/securing-ai-agents-in-the-vercel-ai-sdk-og.jpg"
reading_time_minutes: 8
tags:
  - "ai"
  - "security"
  - "javascript"
  - "devsecops"
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

**Twelve tool definitions. Twelve missing input schemas. Six of them could delete a user, move money, or run a shell command — with arguments a language model picked.**

I assembled 12 tools in the exact shape assistants hand you — three small agents
(admin, billing, CMS), each wired like the unprotected literal below — and pointed
`eslint-plugin-vercel-ai-security`'s `recommended` preset at them. **All 12 were
missing an `inputSchema`. Six destructive tools — `deleteUser`, `transferFunds`,
`executeCommand`, `updateUserRole`, `createInvoice`, `removePost` — had no
confirmation gate.** 31 findings across three files. I planted none of them; the
gaps are structural to the shape.
([Reproduce it below.](#i-ran-the-linter-on-a-real-batch-of-tools))

And it is the shape models reach for. A separate benchmark of
[700 AI-generated functions across 5 models found 49–73% shipped with a security
hole](https://ofriperetz.dev/articles/we-ranked-5-ai-models-by-security-the-leaderboard-is-wrong)
— and the code wiring up your agent's tools comes from those same models.

A Vercel AI SDK agent without tool-call constraints is a remote code execution
surface controlled by user input. The moment you pass `tools`, the model decides
_which function runs and with what arguments_ — not your code. That is the whole
attack surface, and the OWASP LLM Top 10 has a name for it: **LLM06: Excessive
Agency**. `eslint-plugin-vercel-ai-security` is SDK-aware — it understands
`generateText`/`streamText` and tool definitions — so it can check at write-time
that every tool call is gated. Five rules do it.

> **Series — Hardening AI Agents.** The
> [input surface (prompt injection)](https://ofriperetz.dev/articles/vercel-ai-sdk-prompt-injection-vulnerability)
> · **the output surface (tool calls — you're here)** ·
> [the full OWASP LLM map](https://ofriperetz.dev/articles/100-owasp-llm-top-10-coverage-for-vercel-ai-sdk).

---

## Why agent security is different from API security

Traditional API security assumes your code chooses what runs. You validate the input, check authorization, and call the function. The control flow is deterministic — the same request takes the same path every time.

**An agent's tool calls are model-chosen, not code-chosen.** The same user input that would fail a traditional injection check can succeed as an agent instruction. When a user sends `"delete the test accounts"` to a chat interface, your code doesn't parse that string — the model does, and it maps it to a `deleteUser` tool call with arguments it inferred. You never had a chance to validate, because you never saw the intermediate decision.

This creates a class of vulnerability that code path analysis can't find: the path from user message to tool call to side effect is non-deterministic. There is no line of code to audit, no branch to trace, no [taint path from source to sink](https://ofriperetz.dev/articles/taint-vs-heuristic-detection) to follow, no [SAST](https://ofriperetz.dev/articles/static-analysis-vs-sast-vs-linting) rule to write — because the path is assembled at runtime by the model, differently each conversation.

Without `inputSchema`, every tool call the model makes can carry arbitrary arguments. Without `maxSteps`, the loop is unbounded. Without a confirmation gate on the destructive ones, nothing sits between a well-crafted user message and a deleted production row.

The linter runs before that runtime path exists. It asserts structural invariants — _this tool must have a schema, this destructive tool must have a gate_ — that hold regardless of what the model decides later.

---

## The unprotected agent

```ts
// ships to production more often than you'd think
const result = await generateText({
  model: openai("gpt-4o"),
  tools: {
    deleteUser: {
      execute: async ({ userId }) => {
        await db.users.delete(userId); // no confirmation, no schema, no step bound
      },
    },
  },
});
```

Four things are missing here (a fifth, the abort signal, applies only to streaming
calls). Three of them fire inline under `configs.recommended`, all at `error`
severity — not advisory warnings you can scroll past:

```text
src/agent.ts
  5:5  error  vercel-ai-security/require-tool-confirmation
             ⚠️ CWE-862 OWASP:A01-Broken CVSS:7 | Tool "deleteUser" performs destructive operation "delete" without requiring confirmation. | HIGH [SOC2]
             Fix: Add requiresConfirmation: true or implement confirmation logic in the tool
  5:5  error  vercel-ai-security/require-tool-schema
             🔒 CWE-20 OWASP:A03-Injection CVSS:7.5 | Tool "deleteUser" is missing inputSchema. Unvalidated tool parameters can lead to injection attacks. | HIGH [SOC2]
             Fix: Add inputSchema using Zod: tool({ inputSchema: z.object({ ... }), execute: ... })
  2:24 error  vercel-ai-security/require-max-steps
             ⚠️ CWE-834 OWASP:A05-Security CVSS:6.5 | generateText with tools is missing maxSteps. Without a limit, tool calls can loop indefinitely. | MEDIUM [SOC2]
             Fix: Add maxSteps option: generateText({ ..., maxSteps: 5 })
```

Each message carries the linter's own metadata:
[CWE](https://ofriperetz.dev/articles/cwe-taxonomy-explained) names the weakness
class, [CVSS](https://ofriperetz.dev/articles/cvss-scores-explained) scores its
severity, and the `OWASP:` tag maps it back to the web
[Top 10](https://ofriperetz.dev/articles/owasp-top-10-explained).

(A fourth rule, `require-error-handling` (CWE-755), flags the un-`try/catch`'d
call — an agent step that throws shouldn't cascade. It's `off` in `recommended`
and `error` in `configs.strict`, so it stays silent above until you opt in.)

Want to see this on your own agent before reading further?
`npm i -D eslint-plugin-vercel-ai-security && npx eslint .` — the
[full config block is below](#install). The rest of this piece is _why_ each
finding is the one that bites in production.

---

## The 5 rules that bound agency

| Rule                                                                                                                                  | CWE     | What it forces                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------- | ------- | -------------------------------------------------------------------------------- |
| [`require-tool-confirmation`](https://eslint.interlace.tools/docs/security/plugin-vercel-ai-security/rules/require-tool-confirmation) | CWE-862 | a destructive tool (delete/transfer/execute…) must carry a confirmation gate     |
| [`require-tool-schema`](https://eslint.interlace.tools/docs/security/plugin-vercel-ai-security/rules/require-tool-schema)             | CWE-20  | every tool declares an `inputSchema` (Zod) — the model can't pass arbitrary args |
| [`require-max-steps`](https://eslint.interlace.tools/docs/security/plugin-vercel-ai-security/rules/require-max-steps)                 | CWE-834 | a tool-calling loop is bounded by `maxSteps` — no infinite agent loop            |
| [`require-error-handling`](https://eslint.interlace.tools/docs/security/plugin-vercel-ai-security/rules/require-error-handling)       | CWE-755 | the SDK call is wrapped in `try/catch` — a failed step doesn't cascade           |
| [`require-abort-signal`](https://eslint.interlace.tools/docs/security/plugin-vercel-ai-security/rules/require-abort-signal)           | CWE-404 | streaming calls take an `abortSignal` — a user can cancel a runaway stream       |

These five are the operational half of agent safety — the half that fires after
the model has decided to act. (The input half, prompt injection, is linked at the
end.)

> **One honest limitation.** `require-tool-confirmation` inspects tool **object
> literals** declared inline in `tools: { … }`. Wrap a tool in the `tool()`
> helper and the rule skips it — the source says so out loud:
> `// For CallExpressions (tool() helper), we'll assume it might be handled`.
> Extract the tool to a variable and it's skipped even earlier, before the
> destructive-name check runs. Either way you get a documented
> [false-negative](https://ofriperetz.dev/articles/confusion-matrix-tp-fp-fn-tn) —
> gate those manually. (`require-tool-schema` _does_ read inside `tool({ … })`.)
> The hardened pattern below uses the inline form so every rule fires.

---

## Why this survives code review

The unprotected snippet isn't sloppy. It's what a careful engineer ships,
because every line that's missing is invisible at review time. Reviewers think
about code paths. Agents introduce non-deterministic behavior that no code path
analysis covers.

- **`maxSteps`** is absent, so the loop is unbounded — but in the demo the model
  called the tool once and stopped. Unbounded only bites when a _later_ prompt
  makes the model retry in a loop, and that prompt doesn't exist yet at review.
  A reviewer can read every line and never see the attack — it isn't in the code.
  It's in a future user message.
- **`inputSchema`** is absent, but `userId` is destructured as if it were a
  trusted string. The reviewer reads `{ userId }` and pattern-matches "typed
  argument" — the type is inferred from usage, never enforced against the model's
  output. TypeScript is green either way. Nothing in the code is wrong; the hole
  is in the handoff from model output to function argument, which leaves no
  static trace.
- **confirmation** is absent, but `deleteUser` sits in a PR titled "add admin
  tools," reviewed by someone who assumes an admin already confirmed in the UI.
  The gate lives in a different file, in a different person's head.
- **`try/catch`** is absent, but the happy path returns cleanly. A throwing tool
  step only surfaces under load, in an error path no test exercises.

None of these are knowledge gaps. They're _context_ gaps — the reviewer can't
see the prompt that hasn't been written, the load that hasn't happened, the
admin check that lives elsewhere. That's exactly the gap a write-time linter
fills: it doesn't need the runtime context, because it asserts the structural
invariant must hold _regardless_ of context. "This destructive tool has no
confirmation gate" is true at line 3 whether or not the rest of the system is
careful.

### And then the AI writes the next tool

Here's what turns a one-time review miss into a recurring one. The agent code
_itself_ is increasingly AI-scaffolded — ask an assistant for "a tool that deletes
a user" and you get the unprotected literal from the top of this article, because
that's the shape dominating its training data. In a [run of 80 AI-generated Node.js
functions](https://ofriperetz.dev/articles/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities),
65–75% shipped with a security hole, and tool definitions sit squarely in that
distribution. The model that hallucinates the _wrong tool call_ at runtime is the
same model that omits the `inputSchema` at write-time.

Switching assistants doesn't dodge it. Across the same 5 models, **every one came
back 49–73% vulnerable**, and Gemini 2.5 Pro was the _worst_ generator at 73% —
ahead of every Claude model. The Vercel AI SDK is model-agnostic by design
(`openai("gpt-4o")` is one line away from a Gemini or Anthropic provider), and so
is the failure: you get the ungated `tools: { … }` literal back whichever provider
string you swap in. [The toolchain changes _which_ gaps you inherit, not whether
you inherit them](https://ofriperetz.dev/articles/claude-vs-gemini-nestjs-security-same-prompt-different-errors).
The linter is the one layer that stays constant — the thing standing between your
`tools: { … }` block and the next paste from an assistant that has never heard of
LLM06.

> **Related:** [3 lines of code to hack your Vercel AI app](https://ofriperetz.dev/articles/3-lines-of-code-to-hack-your-vercel-ai-app-and-1-line-to-fix-it-jo) — the shortest exploit path against this SDK, and the one-line fix.

---

## I ran the linter on a real batch of tools

The cross-linked benchmarks above measure _functions_. I wanted a number for
_tools_ specifically, so I assembled a batch and ran the linter — no planted bugs,
no rules disabled. The 12 tool definitions use the canonical ungated shape: the
inline `tools: { name: { execute } }` literal from the top of this article, the
exact form the
[700-function benchmark](https://ofriperetz.dev/articles/we-ranked-5-ai-models-by-security-the-leaderboard-is-wrong)
shows models default to. The
[ground truth](https://ofriperetz.dev/articles/ground-truth-in-security-testing)
here is the shape itself, not a hand-labelled corpus — every finding is either
present in that literal or it isn't. Three small agents:

- `admin-agent.ts` — a user-management agent + a streaming shell-command endpoint
  (5 tools)
- `billing-agent.ts` — refunds, transfers, invoices, balance reads (4 tools)
- `content-agent.ts` — publish, remove, search posts (3 tools)

Twelve tool definitions. At 3–5 tool calls per user message, a single session
reaches ~60 calls — and without `inputSchema`, every one of them accepts whatever
arguments the model produced, with nothing between the user's sentence and your
function signature. Against **`eslint-plugin-vercel-ai-security` v1.3.5**, nothing
but `configs.recommended`, **measured 2026-06-21** — version-stamped so you can
[reproduce it](https://ofriperetz.dev/articles/reproducibility-vs-replicability)
instead of taking my word:

```bash
npx eslint src/*.ts
# ✖ 31 problems (27 errors, 4 warnings)
```

Counting only the five agency rules from this article:

| Rule                        | Hits  | What that means                                                                                                             |
| --------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------- |
| `require-tool-schema`       | 12/12 | **every** tool was declared without an `inputSchema`                                                                        |
| `require-tool-confirmation` | 6     | `deleteUser`, `updateUserRole`, `executeCommand`, `transferFunds`, `createInvoice`, `removePost` — ungated                  |
| `require-max-steps`         | 4     | all 4 tool-calling call-sites (admin has 2 — a `generateText` and a `streamText` — billing and CMS one each) were unbounded |
| `require-abort-signal`      | 1     | the one streaming call had no `abortSignal`                                                                                 |
| `require-error-handling`    | 0     | _off in `recommended`_ — flip to `configs.strict` and it fires too                                                          |

(The other 8 errors/warnings come from `require-max-tokens` and
`require-request-timeout`, also in `recommended`: 27 errors = 6 + 12 + 4 + 1 + 4
max-tokens; 4 warnings = the 4 request-timeout hits.)

The headline isn't even the destructive tools — it's the **12/12 on
`inputSchema`**. The ungated shape never carries a Zod schema; it destructures
`{ userId }` and trusts it, exactly the pattern that's invisible at code review.

A fair objection: I assembled these, so "12/12 failed" measures the shape I chose.
True — and the honest reading is that 12/12 is a
[base rate](https://ofriperetz.dev/articles/base-rate-problem-explained) for that
one literal, not for every agent codebase in production. But I didn't pick the
literal arbitrarily. It's what the
[700-function benchmark](https://ofriperetz.dev/articles/we-ranked-5-ai-models-by-security-the-leaderboard-is-wrong)
shows models emit by default (49–73% vulnerable across 5 of them), so the batch is
a _representative sample of what you'll actually paste in_, not a strawman built to
fail. The point of the scan isn't "look, bad code is bad" — it's that **every one
of these gaps is structural and silent**: nothing about the shape trips a type
error, a test, or a reviewer's eye, yet the linter flags all 31 at write-time. A
write-time rule asserts the invariant regardless of runtime context — which is
exactly the context a human reviewer doesn't have.

**And one tool got away.** `sendNewsletter` — a tool that broadcasts to every
subscriber — was _not_ flagged by `require-tool-confirmation`. The rule's
`defaultOptions` list includes `send`, but its runtime fallback when you pass no
options — exactly what `recommended` does — is the narrow six:
`delete/remove/transfer/execute/update/create`. So the linter inherits a blind
spot of its own: it gates the verbs it knows. That is a
[recall](https://ofriperetz.dev/articles/precision-recall-f1-for-static-analysis)
gap, it is mine to close, and until I do, it's yours to work around. If your
destructive vocabulary is `broadcast`, `publish`, `notify`, or `charge`, pass your
own `destructivePatterns` — the scan is a floor, not a ceiling.

> **Want to run the exact same diff on Gemini?** Every code block here uses
> `openai("gpt-4o")` because that's what the SDK docs default to — but the Vercel
> AI SDK is model-agnostic, and so is this rule set (it's AST-based; it never
> calls the model). Swap the provider to `google("gemini-2.5-pro")`, re-prompt the
> same three agents, re-run the diff. Gemini 2.5 Pro was the _worst_ generator in
> [the 700-function benchmark](https://ofriperetz.dev/articles/we-ranked-5-ai-models-by-security-the-leaderboard-is-wrong)
> at 73% vulnerable, so I expect the 12/12 on `inputSchema` to hold — but expecting
> is not measuring, and this is the run I haven't done. If you beat me to it, send
> me the output.

---

## The hardened agent

```ts
// Vercel AI SDK — pinned to the ai@4.x names; read the version note below first
import { z } from "zod";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

try {
  const result = await generateText({
    model: openai("gpt-4o"),
    maxSteps: 5, // bound the loop — CWE-834
    tools: {
      // inline object literal, NOT tool() — see the limitation above
      deleteUser: {
        description: "Delete a user account",
        parameters: z.object({ userId: z.string().uuid() }), // require-tool-schema
        requiresConfirmation: true, // require-tool-confirmation — CWE-862
        execute: async ({ userId }: { userId: string }) => {
          await db.users.delete(userId);
        },
      },
    },
  });
} catch (err) {
  // require-error-handling (configs.strict) — a failed step is contained, not cascaded
  logger.error("agent step failed", { err });
}
```

That's the inline form on purpose. Wrapping `deleteUser` in `tool()` buys you
argument-type inference — which is why you have to annotate `{ userId: string }`
by hand here — but it also makes `require-tool-confirmation` skip the tool
entirely. Pick your trade knowingly: inference from the helper, or enforcement
from the rule.

> **API version note — check this before you copy.** The `ai` package moves fast:
> `latest` is on the **7.x** line as of **2026-07-28**, and the snippet above uses
> the **v4** spelling (`parameters`, `maxSteps`) because that's what all five rules
> validate cleanly today. **v5 renamed them** to `inputSchema` and
> `stopWhen: stepCountIs(5)`. `require-tool-schema` accepts **either**
> `inputSchema` or `parameters`, so the rename costs you nothing there — but
> `require-max-steps` still keys on the literal `maxSteps` key, so it flags a
> correct `stopWhen` form as a false positive until the matcher catches up. Read
> your installed major, not this article.

One line in there is not what it looks like. `requiresConfirmation: true` is _not_
a native Vercel SDK option — the SDK ignores it. It's the marker
`require-tool-confirmation` keys on to confirm a decision point exists, and the
rule checks the flag's **presence**, not its correctness: a
`requiresConfirmation: true` wired to a no-op handler still passes the lint. That
is
[Goodhart's law](https://ofriperetz.dev/articles/goodharts-law-explained) pointed
at my own rule — the moment a flag becomes the measure, the flag is what gets
added. The real human-in-the-loop gate (a UI prompt, an approval queue) is yours
to build, and no linter will tell you whether you built it.

One objection worth pre-empting, because a senior reader will raise it:
**`parameters`/`inputSchema` validates the _shape_ of the arguments, not the
_authority_ to run.** A perfectly valid `z.string().uuid()` still authorizes
deleting a user the caller had no business touching. Least-privilege tool exposure
and per-call authz are a separate layer the linter can't assert — schema validation
closes the injection door (CWE-20), not the broken-access-control door.

---

## Install

```bash
# npm
npm install --save-dev eslint-plugin-vercel-ai-security
# yarn
yarn add -D eslint-plugin-vercel-ai-security
# pnpm
pnpm add -D eslint-plugin-vercel-ai-security
# bun
bun add -d eslint-plugin-vercel-ai-security
```

```js
// eslint.config.js — `configs` is a NAMED export (the default export is the plugin)
import { configs } from "eslint-plugin-vercel-ai-security";

export default [
  configs.recommended, // balanced
  // configs.strict,   // maximum agency hardening for agent code
];
```

> Name the file `eslint.config.mjs` if your `package.json` isn't
> `"type": "module"`. The plugin is CommonJS and loads either way.

```yaml
# CI — block the PR on a new ungated tool
- run: npx eslint . --max-warnings 0
```

---

## Compatibility

| Surface              | Support                                                                                   |
| -------------------- | ----------------------------------------------------------------------------------------- |
| **Plugin**           | `v1.3.7` — npm `latest`, checked 2026-07-28 (the scan above ran on `v1.3.5`)              |
| **Package managers** | npm, yarn, pnpm, bun                                                                      |
| **Node**             | `>= 18.0.0`                                                                               |
| **ESLint**           | `^8.0.0 \|\| ^9.0.0 \|\| ^10.0.0`, flat config                                            |
| **Vercel AI SDK**    | optional peer — AST-based; lints whether or not `ai` is installed                         |
| **Module system**    | CommonJS — `eslint.config.js` or `.mjs`                                                   |
| **Oxlint**           | flagship rule (`no-unsafe-output-handling`) wired + parity-checked; full set ESLint-first |

---

## Read next

This was the **agency** half — the tool-call surface, where a model stops talking
and starts acting. The **input** half comes first in the request: before a model
picks a bad tool, something has to talk it into picking one.

**→ [Prompt injection, in 1 of 3 places](https://ofriperetz.dev/articles/vercel-ai-sdk-prompt-injection-vulnerability)** — the three
places untrusted text reaches your prompt, and the rules that gate each one.

For the whole map: [the OWASP LLM Top 10, mapped
honestly](https://ofriperetz.dev/articles/100-owasp-llm-top-10-coverage-for-vercel-ai-sdk)
(8 of 10, and the 2 it can't cover), or [all 19 rules end to
end](https://ofriperetz.dev/articles/getting-started-eslint-plugin-vercel-ai-security).

---

## Links

- 📦 [npm: eslint-plugin-vercel-ai-security](https://www.npmjs.com/package/eslint-plugin-vercel-ai-security)
- 📖 [Full rule docs (per-rule CWE + examples)](https://eslint.interlace.tools/docs/security/plugin-vercel-ai-security/rules)
- 🔐 [OWASP LLM06: Excessive Agency](https://genai.owasp.org/llmrisk/llm062025-excessive-agency/)
- 💻 [Source on GitHub](https://github.com/ofri-peretz/eslint/tree/main/packages/eslint-plugin-vercel-ai-security)

The five rules won't make your agent safe — they make the gaps visible while the
gaps are still cheap, which is the only window a linter gets. **Run
`npx eslint .` on your agent file and tell me the number.** I'd bet more of you
have an ungated `delete` than will say so out loud, and I'd rather read that in
the comments than in an incident report.

::dev-to-cta{url="https://www.npmjs.com/package/eslint-plugin-vercel-ai-security"}
📦 `npm i -D eslint-plugin-vercel-ai-security` — five rules between your `tools` block and a hallucinated `deleteUser`.
::

---

_[eslint-plugin-vercel-ai-security](https://www.npmjs.com/package/eslint-plugin-vercel-ai-security) is part of the [Interlace ESLint ecosystem](https://eslint.interlace.tools). Source on [GitHub](https://github.com/ofri-peretz/eslint) · Follow: [Dev.to/ofri-peretz](https://dev.to/ofri-peretz)_
