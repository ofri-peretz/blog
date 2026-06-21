---
title: "I Linted 12 AI-Shaped Agent Tools. All 12 Were Missing an Input Schema."
description: "I ran eslint-plugin-vercel-ai-security over 12 tool definitions written the way AI assistants wire them: 12/12 had no inputSchema and 6 destructive tools (deleteUser, transferFunds, executeCommand…) had no confirmation gate. Five CWE-tagged ESLint rules bound an AI agent's agency at write-time — and one ungated tool still slipped past."
slug: "securing-ai-agents-in-the-vercel-ai-sdk"
canonical_url: "https://ofriperetz.dev/articles/securing-ai-agents-in-the-vercel-ai-sdk"
devto_url: "https://dev.to/ofri-peretz/securing-ai-agents-in-the-vercel-ai-sdk-485n"
devto_id: 3116469
published_at: "2025-12-20T00:03:08Z"
edited_at: "2026-02-05T05:33:12Z"
cover_image: "https://ofriperetz.dev/og/cover/securing-ai-agents-in-the-vercel-ai-sdk"
social_image: "https://ofriperetz.dev/og/article/securing-ai-agents-in-the-vercel-ai-sdk"
reading_time_minutes: 8
tags:
  - "eslint"
  - "ai"
  - "security"
  - "javascript"
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

An LLM that hallucinates is annoying. **An _agent_ that hallucinates calls the
wrong tool** — and if that tool is `deleteUser`, the hallucination is a deleted
production row.

So I ran the linter against a real batch. I assembled 12 tool definitions in the
exact shape models hand you — three small agents (admin, billing, CMS) wired the
way the unprotected literal at the top of this article is wired — and pointed
`eslint-plugin-vercel-ai-security`'s `recommended` preset at them. **All 12 were
missing an `inputSchema`. Six destructive tools — `deleteUser`, `transferFunds`,
`executeCommand`, `updateUserRole`, `createInvoice`, `removePost` — had no
confirmation gate.** 31 findings across three files, none of which I had to plant
— the gaps are structural to the shape itself.
([Reproduce it below.](#i-ran-the-linter-on-a-real-batch-of-tools)) And this is the shape
models reach for: in a separate benchmark of
[700 AI-generated functions across 5 models, 49–73% shipped with a security
hole](https://ofriperetz.dev/articles/we-ranked-5-ai-models-by-security-the-leaderboard-is-wrong)
— and the code wiring up your agent's tools comes from the same models.

The moment you hand a model `tools`, you've granted it agency: it decides _which
function to run and with what arguments_. The OWASP LLM Top 10 calls the failure
mode **LLM06: Excessive Agency**. `eslint-plugin-vercel-ai-security` is SDK-aware
(it understands `generateText`/`streamText` and tool definitions), so it can
check, at write-time, that every tool call is gated. Five rules do it.

> **Series — Hardening AI Agents.** The
> [input surface (prompt injection)](https://ofriperetz.dev/articles/vercel-ai-sdk-prompt-injection-vulnerability)
> · **the output surface (tool calls — you're here)** ·
> [the full OWASP LLM map](https://ofriperetz.dev/articles/100-owasp-llm-top-10-coverage-for-vercel-ai-sdk).

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

Four things are missing in this snippet (a fifth, the abort signal, applies only
to streaming calls). With `configs.recommended`, three of them fire inline — all
at `error` severity, because in the recommended preset these rules are `error`,
not advisory:

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

These are the operational half of agent safety. The _input_ half — prompt
injection, system-prompt leakage — is the
[prompt-injection deep-dive](https://ofriperetz.dev/articles/vercel-ai-sdk-prompt-injection-vulnerability);
the full OWASP LLM map (8 of 10, honestly) is
[here](https://ofriperetz.dev/articles/100-owasp-llm-top-10-coverage-for-vercel-ai-sdk).

> **One honest limitation.** `require-tool-confirmation` inspects tool **object
> literals** declared inline in `tools: { … }`. If you wrap a tool in the
> `tool()` helper or extract it to a variable, the rule currently treats it as
> "may be handled elsewhere" and skips it — a documented false-negative. Gate
> those manually. (`require-tool-schema` _does_ read inside `tool({ … })`.) The
> hardened pattern below uses the inline form so every rule fires.

---

## Why this survives code review

The unprotected snippet isn't sloppy. It's what a careful engineer ships,
because every line that's missing is invisible at review time:

- **`maxSteps`** is absent, so the loop is unbounded — but in the demo the model
  called the tool once and stopped. Unbounded only bites when a _later_ prompt
  makes the model retry in a loop, and that prompt doesn't exist yet at review.
- **`inputSchema`** is absent, but `userId` is destructured as if it were a
  trusted string. The reviewer reads `{ userId }` and pattern-matches "typed
  argument" — the type is inferred from usage, not enforced against the model's
  output. TypeScript is green either way.
- **confirmation** is absent, but `deleteUser` is in a PR titled "add admin
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

Here's the part that turns this from a one-time review miss into a recurring
one. The agent code _itself_ is increasingly AI-scaffolded — you ask the
assistant for "a tool that deletes a user," and it gives you the unprotected
literal at the top of this article, because that's the shape that dominates its
training data. In a [run of 80 AI-generated Node.js
functions](https://ofriperetz.dev/articles/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities),
65–75% shipped with a security hole — and tool definitions are squarely in that
distribution. The model that hallucinates the _wrong tool call_ at runtime is
the same model that omits the `inputSchema` at write-time. (The
[NestJS version of this](https://ofriperetz.dev/articles/claude-wrote-nestjs-service-eslint-found-6-security-holes)
— green TypeScript, six holes ESLint caught — is the same failure in a different
framework.)

And this is not a one-vendor problem you dodge by switching assistants. When I
[benchmarked 700 AI-generated functions across 5 models from Claude and
Gemini](https://ofriperetz.dev/articles/we-ranked-5-ai-models-by-security-the-leaderboard-is-wrong),
**every model came back 49–73% vulnerable** — Gemini 2.5 Pro was the _worst_
generator at 73%, ahead of every Claude model. The Vercel AI SDK is
model-agnostic by design (`openai("gpt-4o")` is one line away from a Gemini or
Anthropic provider), and so is the failure: the ungated `tools: { … }` literal
is the shape you get back regardless of which provider string you swap in.
Picking a "safer" model doesn't gate the tool call — [the toolchain only
changes _which_ gaps you inherit, not whether you inherit
them](https://ofriperetz.dev/articles/claude-vs-gemini-nestjs-security-same-prompt-different-errors).
The linter is the layer that's the same across all of them.

So the linter isn't only catching the human reviewer's blind spot. It's the
thing standing between your `tools: { … }` block and the next paste from an
assistant — Claude, Gemini, or otherwise — that has never heard of LLM06.

---

## I ran the linter on a real batch of tools

The cross-linked benchmarks above measure _functions_. I wanted a number for
_tools_ specifically, so I assembled a batch and ran the linter — no planted bugs,
no rules disabled. The 12 tool definitions are written in the canonical ungated
shape: the inline `tools: { name: { execute } }` literal from the top of this
article — the exact form the
[700-function benchmark](https://ofriperetz.dev/articles/we-ranked-5-ai-models-by-security-the-leaderboard-is-wrong)
shows models default to. Three small agents:

- `admin-agent.ts` — a user-management agent + a streaming shell-command endpoint
  (5 tools)
- `billing-agent.ts` — refunds, transfers, invoices, balance reads (4 tools)
- `content-agent.ts` — publish, remove, search posts (3 tools)

Twelve tool definitions. Then, against `eslint-plugin-vercel-ai-security@latest`
with nothing but `configs.recommended` (run on 2026-06-21):

```bash
npx eslint src/*.ts
# ✖ 31 problems (27 errors, 4 warnings)
```

Counting only the five agency rules from this article:

| Rule                       | Hits  | What that means                                                        |
| -------------------------- | ----- | --------------------------------------------------------------------- |
| `require-tool-schema`      | 12/12 | **every** tool was declared without an `inputSchema`                   |
| `require-tool-confirmation` | 6     | `deleteUser`, `updateUserRole`, `executeCommand`, `transferFunds`, `createInvoice`, `removePost` — ungated |
| `require-max-steps`        | 4     | all 4 tool-calling call-sites (admin has 2 — a `generateText` and a `streamText` — billing and CMS one each) were unbounded |
| `require-abort-signal`     | 1     | the one streaming call had no `abortSignal`                            |
| `require-error-handling`   | 0     | _off in `recommended`_ — flip to `configs.strict` and it fires too    |

(The other 8 errors/warnings come from `require-max-tokens` and
`require-request-timeout`, also in `recommended`: 27 errors = 6 + 12 + 4 + 1 + 4
max-tokens; 4 warnings = the 4 request-timeout hits.)

The headline isn't even the destructive tools — it's the **12/12 on
`inputSchema`**. The ungated shape never carries a Zod schema; it destructures
`{ userId }` and trusts it, exactly the pattern that's invisible at code review.

A fair objection: I assembled these, so "12/12 failed" partly measures the shape I
chose. True — but I didn't choose it arbitrarily. It's the literal the
[700-function benchmark](https://ofriperetz.dev/articles/we-ranked-5-ai-models-by-security-the-leaderboard-is-wrong)
shows models emit by default (49–73% vulnerable across 5 of them), so the batch is
a _representative sample of what you'll actually paste in_, not a strawman built to
fail. The point of the scan isn't "look, bad code is bad" — it's that **every one
of these gaps is structural and silent**: nothing about the shape trips a type
error, a test, or a reviewer's eye, yet the linter flags all 31 at write-time. The
one-sentence takeaway: _a write-time linter asserts the structural invariant must
hold regardless of runtime context — which is exactly the context a human reviewer
doesn't have._

**And one tool got away.** `sendNewsletter` — a tool that broadcasts to every
subscriber — was _not_ flagged by `require-tool-confirmation`. The shipped default
only treats `delete/remove/transfer/execute/update/create` as destructive, and
"send" isn't on that list (the rule's broader `defaultOptions` includes it, but
the recommended preset uses the narrow set). So even the linter inherits a blind
spot: it gates the verbs it knows. If your destructive vocabulary is `broadcast`,
`publish`, `notify`, or `charge`, pass your own `destructivePatterns` — the scan
is a floor, not a ceiling.

> **Want to run the exact same diff on Gemini?** Every code block here uses
> `openai("gpt-4o")` because that's what the SDK docs default to — but the Vercel
> AI SDK is model-agnostic, and so is this rule set (it's AST-based; it never
> calls the model). To turn this into a **[Build-with-Gemini
> challenge](https://dev.to/challenges)** submission, swap the provider to
> `google("gemini-2.5-pro")`, re-prompt the same three agents, and re-run the
> ungated-vs-hardened lint diff. Given Gemini 2.5 Pro was the _worst_ generator in
> [the 700-function benchmark](https://ofriperetz.dev/articles/we-ranked-5-ai-models-by-security-the-leaderboard-is-wrong)
> (73% vulnerable), I'd expect the 12/12 on `inputSchema` to hold — but that's a
> measurement, not a guess, and it's the one I haven't run yet.

---

## The hardened agent

```ts
// AI SDK v5 — inputSchema + stopWhen are the v5 names (see the version note below)
import { z } from "zod";
import { generateText, stepCountIs } from "ai";

try {
  const result = await generateText({
    model: openai("gpt-4o"),
    stopWhen: stepCountIs(5), // bound the loop (v5; was maxSteps in v4)
    // ⚠️ require-max-steps still flags this on v5 — its matcher keys on
    // `maxSteps` and is one SDK rename behind. The bound is correct; see note below.
    tools: {
      deleteUser: {
        description: "Delete a user account",
        inputSchema: z.object({ userId: z.string().uuid() }), // require-tool-schema
        requiresConfirmation: true, // require-tool-confirmation
        execute: async ({ userId }) => {
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

`requiresConfirmation: true` is the marker the rule keys on — it is _not_ a
native Vercel SDK option; it's the flag this rule looks for to confirm a decision
point exists. The rule checks the flag's **presence**, not its correctness: a
`requiresConfirmation: true` wired to a no-op handler still passes the lint. The
real human-in-the-loop gate (a UI prompt, an approval queue) is yours to build —
same class of "green but not safe" as the `sendNewsletter` miss above.

And one objection worth pre-empting, because a senior reader will raise it:
**`inputSchema` validates the _shape_ of the arguments, not the _authority_ to
run.** A perfectly valid `z.string().uuid()` still authorizes deleting a user the
caller had no business touching. Least-privilege tool exposure and per-call authz
are a separate layer the linter can't assert — schema validation closes the
injection door (CWE-20), not the broken-access-control door.

> **One API note — and an honest rule limitation — for AI SDK v5.** The hardened
> block above is written for **v5**: `inputSchema` (v4 called it `parameters`) and
> `stopWhen: stepCountIs(5)` (v4 called it `maxSteps`). Here's the catch:
> `require-max-steps` still keys on the literal `maxSteps`/`max_steps` key — its
> own fix message even links to the v5 `stopWhen` docs, but it doesn't yet _credit_
> `stopWhen` as satisfying the bound. So on v5 you write the correct `stopWhen`
> form, and this one rule will still flag the call as "unbounded" (a known
> false-positive against current SDK code). The invariant it asserts — _a
> tool-calling loop must have a ceiling_ — holds either way; the rule's matcher is
> one SDK rename behind, and that's tracked. If you're still on v4, swap
> `stopWhen: stepCountIs(5)` back to `maxSteps: 5` and `inputSchema` to
> `parameters` and the rule goes quiet.

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
| **Package managers** | npm, yarn, pnpm, bun                                                                      |
| **Node**             | `>= 18.0.0`                                                                               |
| **ESLint**           | `^8.0.0 \|\| ^9.0.0 \|\| ^10.0.0`, flat config                                            |
| **Vercel AI SDK**    | optional peer — AST-based; lints whether or not `ai` is installed                         |
| **Module system**    | CommonJS — `eslint.config.js` or `.mjs`                                                   |
| **Oxlint**           | flagship rule (`no-unsafe-output-handling`) wired + parity-checked; full set ESLint-first |

---

## Where this fits

This is the **agency** view of `eslint-plugin-vercel-ai-security` — the tool-call
surface where a model stops talking and starts acting. The companion pieces:

- [Prompt injection, in 1 of 3 places](https://ofriperetz.dev/articles/vercel-ai-sdk-prompt-injection-vulnerability) — the input surface
- [The OWASP LLM Top 10, mapped honestly](https://ofriperetz.dev/articles/100-owasp-llm-top-10-coverage-for-vercel-ai-sdk) — 8 of 10, and the 2 it can't
- [All 19 rules, end to end](https://ofriperetz.dev/articles/getting-started-eslint-plugin-vercel-ai-security) — the full plugin

---

## Links

- 📦 [npm: eslint-plugin-vercel-ai-security](https://www.npmjs.com/package/eslint-plugin-vercel-ai-security)
- 📖 [Full rule docs (per-rule CWE + examples)](https://eslint.interlace.tools/docs/security/plugin-vercel-ai-security/rules)
- 🔐 [OWASP LLM06: Excessive Agency](https://genai.owasp.org/llmrisk/llm062025-excessive-agency/)
- 💻 [Source on GitHub](https://github.com/ofri-peretz/eslint/tree/main/packages/eslint-plugin-vercel-ai-security)
- 🐦 [Follow the "Hardening AI Agents" series on DEV](https://dev.to/ofri-peretz) — the Gemini re-run is the next entry

Run `npx eslint .` on your agent file and drop the warning count in the comments —
I'll bet more of you have an ungated `delete` than will admit it.

**But the question I actually want answered: what's the most destructive tool
you've handed an agent — and what's gating it today?** A confirmation flag, a
human in the loop, or nothing but the hope it doesn't hallucinate? I'd genuinely
like to read the war stories.

::dev-to-cta{url="https://github.com/ofri-peretz/eslint"}
⭐ Star on GitHub if a `deleteUser` tool is one hallucination away from running in your app.
::

---

I'm **Ofri Peretz**, a security engineering leader and the author of the
Interlace ESLint ecosystem — domain-specific static analysis for security,
reliability, and performance on the Node.js stack.

[ofriperetz.dev](https://ofriperetz.dev) · [LinkedIn](https://linkedin.com/in/ofri-peretz) · [GitHub](https://github.com/ofri-peretz) · [X/Twitter](https://twitter.com/ofriperetzdev)
