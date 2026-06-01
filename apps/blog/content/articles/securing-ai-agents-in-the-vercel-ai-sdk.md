---
title: "Your Vercel AI SDK Agent Can Delete Your Database. 5 ESLint Rules That Gate Every Tool Call."
description: "An agent that hallucinates doesn't just say the wrong thing — it calls the wrong tool. Five CWE-tagged ESLint rules bound an AI agent's agency: tool confirmation, input schemas, step limits, error handling, and abort signals — caught at write-time."
slug: "securing-ai-agents-in-the-vercel-ai-sdk"
canonical_url: "https://ofriperetz.dev/articles/securing-ai-agents-in-the-vercel-ai-sdk"
devto_url: "https://dev.to/ofri-peretz/securing-ai-agents-in-the-vercel-ai-sdk-485n"
devto_id: 3116469
published_at: "2025-12-20T00:03:08Z"
edited_at: "2026-02-05T05:33:12Z"
cover_image: "https://ofriperetz.dev/og/cover/securing-ai-agents-in-the-vercel-ai-sdk"
social_image: "https://ofriperetz.dev/og/article/securing-ai-agents-in-the-vercel-ai-sdk"
reading_time_minutes: 6
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

An LLM that hallucinates is annoying. **An _agent_ that hallucinates calls the
wrong tool** — and if that tool is `deleteUser`, the hallucination is a deleted
production row.

The moment you hand a model `tools`, you've granted it agency: it decides _which
function to run and with what arguments_. The OWASP LLM Top 10 calls the failure
mode **LLM06: Excessive Agency**. `eslint-plugin-vercel-ai-security` is SDK-aware
(it understands `generateText`/`streamText` and tool definitions), so it can
check, at write-time, that every tool call is gated. Five rules do it.

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
to streaming calls). The linter names three of them inline; the fourth it flags
separately:

```text
src/agent.ts
  3:5  warning  ⚠️ CWE-862 OWASP:A01-Broken CVSS:7 | Tool "deleteUser" performs destructive operation "delete" without requiring confirmation. | HIGH [SOC2]
              Fix: Add requiresConfirmation: true or implement confirmation logic in the tool
  3:5  error    🔒 CWE-20 OWASP:A03-Injection CVSS:7.5 | Tool "deleteUser" is missing inputSchema. Unvalidated tool parameters can lead to injection attacks. | HIGH [SOC2]
              Fix: Add inputSchema using Zod: tool({ inputSchema: z.object({ ... }), execute: ... })
  2:18 warning  ⚠️ CWE-834 OWASP:A05-Security CVSS:6.5 | generateText with tools is missing maxSteps. Without a limit, tool calls can loop indefinitely. | MEDIUM [SOC2]
              Fix: Add maxSteps option: generateText({ ..., maxSteps: 5 })
```

(A fourth rule, `require-error-handling` (CWE-755), flags the un-`try/catch`'d
call separately — an agent step that throws shouldn't cascade.)

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

## The hardened agent

```ts
import { z } from "zod";

try {
  const result = await generateText({
    model: openai("gpt-4o"),
    maxSteps: 5, // require-max-steps — bound the loop
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
  // require-error-handling — a failed step is contained, not cascaded
  logger.error("agent step failed", { err });
}
```

`requiresConfirmation: true` is the flag the rule looks for; the actual
human-in-the-loop gate (a UI prompt, an approval queue) is yours to wire — the
linter enforces that the _decision point exists_, not that your implementation
is correct.

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

::dev-to-cta{url="https://github.com/ofri-peretz/eslint"}
⭐ Star on GitHub if a `deleteUser` tool is one hallucination away from running in your app.
::

---

I'm **Ofri Peretz**, a security engineering leader and the author of the
Interlace ESLint ecosystem — domain-specific static analysis for security,
reliability, and performance on the Node.js stack.

[ofriperetz.dev](https://ofriperetz.dev) · [LinkedIn](https://linkedin.com/in/ofri-peretz) · [GitHub](https://github.com/ofri-peretz)
