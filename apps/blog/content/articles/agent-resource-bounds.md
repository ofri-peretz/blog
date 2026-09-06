---
title: "Your LLM Call Has No Ceiling. TypeScript Is Fine With It. Three CWEs Aren't."
description: "An AI SDK call with no token cap, no timeout and no abort signal is three distinct CWEs hiding in one missing config object."
slug: "agent-resource-bounds"
canonical_url: "https://ofriperetz.dev/articles/agent-resource-bounds"
tier: "T3"
published_at: null
cover_image: "https://ofriperetz.dev/cdn/blog-cover-image/agent-resource-bounds.jpg"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/agent-resource-bounds-og.jpg"
reading_time_minutes: 4
tags:
  - "ai"
  - "webdev"
  - "security"
  - "eslint"
author:
  name: "Ofri Peretz"
  username: "ofri-peretz"
  twitter: "ofriperetzdev"
series: null
---

`generateText` with a model and a prompt and nothing else is a valid call. TypeScript is satisfied. The type system has no opinion about how many tokens come back, how long it takes, or who pays for the answer nobody reads.

Three rules in `eslint-plugin-vercel-ai-security` fire on a call written that way, and they map to three *different* CWEs — 770, 400 and 404. (A CWE is a label, not a verdict — [what the taxonomy actually claims](https://ofriperetz.dev/articles/cwe-taxonomy-explained).) Same missing config object. Three separate ways to lose.

A note on the bound people expect to see here: step count. The SDK already defaults `stopWhen` to `stepCountIs(1)`, so a tool-calling loop does not run away on its own — that hole gets opened deliberately, by raising the ceiling, not by forgetting it. The three below are the ones that are genuinely unbounded when you say nothing.

---

## 1. The output with no cap — CWE-770 {#cwe-770-token-cap}

```ts
await generateText({ model, prompt }); // no maxOutputTokens
```

**Why it gets written:** the parameter is optional, and the happy path never needs it.

**Why it survives review:** output length reads as a *quality* knob, not a resource bound. But this is billed per token. An unbounded output is an unbounded invoice, and nothing in the diff looks like money.

Fix: `maxOutputTokens: 4096`. Note the rename — this was `maxTokens` in v4. Guidance written against v4 still *reads* correct in review and bounds nothing.

---

## 2. The request that never returns — CWE-400 {#cwe-400-request-timeout}

**Why it gets written:** `fetch`-shaped APIs feel like they time out. This one doesn't, by default.

**Why it survives review:** staging latency is fine, so nobody asks what happens when the provider hangs instead of failing.

```ts
const ac = new AbortController();
const timer = setTimeout(() => ac.abort(), 30_000);
try {
  await generateText({ model, prompt, abortSignal: ac.signal });
} finally {
  clearTimeout(timer);
}
```

---

## 3. The stream nobody can cancel — CWE-404 {#cwe-404-stream-abort}

```ts
const stream = streamText({ model, prompt }); // no abortSignal
```

You will want to file this one under polish. Here is why that is wrong: the client is gone, and the server keeps generating — and keeps billing — for a reader who will never see a token of it.

Why *shutdown* (CWE-404) rather than plain consumption (400)? Because the resource was acquired correctly and then never released. The handle outlives the request that justified it. That is a release bug, not an acquisition bug.

```ts
const ac = new AbortController();
req.signal.addEventListener('abort', () => ac.abort()); // client disconnected
const stream = streamText({ model, prompt, abortSignal: ac.signal });
```

---

## The pattern {#allocation-with-no-ceiling}

All three are one defect: **an allocation with no ceiling.** Tokens, wall-clock, lifetime.

I don't trust an allocation whose ceiling I can't see — the same instinct that keeps me out of a position whose downside I can't draw on one page.

Classic resource-exhaustion review asks whether an attacker can make something loop forever. For an LLM call, the answer is worse — you don't need an attacker. A verbose model and one retry will do it, and the meter runs the entire time.

This is OWASP LLM10, Unbounded Consumption — [the full top-10 mapping for this SDK](https://ofriperetz.dev/articles/100-owasp-llm-top-10-coverage-for-vercel-ai-sdk) covers the other nine. That is why these are security rules and not style rules. CWE-770, 400 and 404 are the same sentence in three grammars.

---

## The config

```bash
npm install -D eslint-plugin-vercel-ai-security
yarn add -D eslint-plugin-vercel-ai-security
pnpm add -D eslint-plugin-vercel-ai-security
bun add -d eslint-plugin-vercel-ai-security
```

Node 18+. The peer range is ESLint 8 ∥ 9 ∥ 10, so both config formats work.

```js
// eslint.config.mjs — ESLint 9 · 10
import vercelAi from 'eslint-plugin-vercel-ai-security';

export default [
  {
    files: ['**/*.ts'],
    plugins: { 'vercel-ai-security': vercelAi },
    rules: {
      'vercel-ai-security/require-max-tokens': 'error',
      'vercel-ai-security/require-request-timeout': 'warn',
      'vercel-ai-security/require-abort-signal': 'warn',
    },
  },
];
```

```json
// .eslintrc.json — ESLint 8
{
  "plugins": ["vercel-ai-security"],
  "rules": {
    "vercel-ai-security/require-max-tokens": "error",
    "vercel-ai-security/require-request-timeout": "warn",
    "vercel-ai-security/require-abort-signal": "warn"
  }
}
```

On oxlint, add `"jsPlugins": ["eslint-plugin-vercel-ai-security/oxlint"]`.

Rule docs: [require-max-tokens](https://github.com/ofri-peretz/eslint/blob/main/packages/eslint-plugin-vercel-ai-security/docs/rules/require-max-tokens.md) · [require-request-timeout](https://github.com/ofri-peretz/eslint/blob/main/packages/eslint-plugin-vercel-ai-security/docs/rules/require-request-timeout.md) · [require-abort-signal](https://github.com/ofri-peretz/eslint/blob/main/packages/eslint-plugin-vercel-ai-security/docs/rules/require-abort-signal.md)

---

_Has an LLM call ever run longer in production than you expected — and what told you first, the logs or the bill?_

---

**Related:**
- [Securing AI Agents in the Vercel AI SDK](https://ofriperetz.dev/articles/securing-ai-agents-in-the-vercel-ai-sdk)
- [Getting Started with eslint-plugin-vercel-ai-security](https://ofriperetz.dev/articles/getting-started-eslint-plugin-vercel-ai-security)
- [The CWE Taxonomy, Explained](https://ofriperetz.dev/articles/cwe-taxonomy-explained)

[npm](https://www.npmjs.com/package/eslint-plugin-vercel-ai-security) · [GitHub](https://github.com/ofri-peretz/eslint)
