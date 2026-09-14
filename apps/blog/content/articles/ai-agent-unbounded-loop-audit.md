---
title: "I Linted 14 Public AI SDK Repos. 12 Ship a Call With No Token Ceiling."
description: "A field study of 116 generation call sites across 14 public repositories, including five of the SDK vendor's own. The output cap is the one almost nobody sets."
slug: "ai-agent-unbounded-loop-audit"
canonical_url: "https://ofriperetz.dev/articles/ai-agent-unbounded-loop-audit"
tier: "T3"
published_at: null
cover_image: "https://ofriperetz.dev/cdn/blog-cover-image/ai-agent-unbounded-loop-audit.jpg"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/ai-agent-unbounded-loop-audit-og.jpg"
reading_time_minutes: 4
quality:
  panel_version: "1.0.0"
  reviewed: "2026-09-14"
  spec: sdlc/spec/ai-agent-unbounded-loop-audit.md
  lenses:
    growth_hook: 9.5
    security_correctness: 9.6
    structure_framing_voice: 9.5
    compatibility: 9.5
    reproducibility: 9.7
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

I argued last week that [an AI SDK call with no bounds is three CWEs in one missing config object](https://ofriperetz.dev/articles/agent-resource-bounds). Fair question back: does anyone actually ship that?

So I linted for it. 20,004 source files across 14 public repositories, 474 of which import the Vercel AI SDK, **116 of which contain a real generation call**. That 116 is the denominator; everything below is a fraction of it.

| Bound | Files missing it | Repositories |
|---|---|---|
| output cap (`maxOutputTokens`) | 103 / 116 | **12 of 14** |
| request timeout | 50 / 116 | 9 of 14 |
| abort signal on a stream | 44 / 116 | 7 of 14 |

## Read the repo column, not the percentage {#concentration}

88.8% is the number that would travel, and it is the one I trust least. One repository, `cloudflare_agents`, contributes 52 of those 103 files — just over half. Percentages of files measure how a codebase is split into modules as much as how it was written.

The repo count is the robust statistic. Twelve of fourteen survives deleting any single project from the corpus. The percentage does not.

## Five of the fourteen are Vercel's own {#vendor}

`ai-elements`, `vercel_chat`, `vercel_examples`, `vercel_streamdown` and `vercel-labs_agent-eval` are the SDK vendor's repositories, and they are in the findings.

That is not a gotcha — it is the mechanism. Example code is deliberately minimal; a ceiling is noise in a snippet teaching you `streamText`. But the minimal shape is the shape that gets copied, and it is missing the same parameter in the reader's production handler, where it is no longer noise. The omission is correct upstream and wrong downstream, which is exactly why nothing catches it.

## What an unbounded call looks like in the wild {#wild}

Not exotic. This is the common form:

```ts
const result = streamText({ model, messages });
```

The one worth showing is subtler — `302ai_302-AI-Studio` builds its options indirectly:

```ts
const streamTextOptions = { ...baseConfig, ...(prompt && { system: prompt }) };
const result = await generateText(streamTextOptions);
```

I assumed this was a false positive: a rule cannot see into an object built elsewhere. It isn't. `baseConfig` sets `model`, `messages`, `providerOptions` and `tools` — and the whole 1,500-line file contains exactly one occurrence of `timeout`, `abortSignal` or `maxOutputTokens` between them.

## The bound I threw out {#max-steps}

The audit measured a fourth — step count — and I am not reporting it. Two reasons, either sufficient. The SDK already defaults `stopWhen` to `stepCountIs(1)`, so the loop is bounded unless you raised it yourself; a rule firing there reports a non-defect. And spot-checking four of its flagged files found one that sets both `stopWhen` and `stepCountIs` and was flagged anyway.

A rule that fires on a safe default doesn't make the number bigger. It makes the other three unbelievable.

## Run it on yours {#method}

```js
// eslint.config.mjs — after `npm i -D eslint-plugin-vercel-ai-security`
import ai from "eslint-plugin-vercel-ai-security";

export default [
  {
    files: ["**/*.ts"],
    plugins: { "vercel-ai-security": ai },
    rules: { "vercel-ai-security/require-max-tokens": "error" },
  },
];
```

Honest limits, because n = 14 is small. This is an adoption-scan convenience sample, not a random draw from npm, and two directories in it turned out to be the same project cloned twice — caught by content fingerprint, since every checkout reported the same `git remote`. The claim is that this is what the SDK's own ecosystem looks like. It is not a population rate.

The prior sweep I tried to reuse recorded findings but no denominator and no repo list, so it could not answer this at all. A count without its denominator isn't a small result. It's not a result.

---

More of these — [follow on dev.to](https://dev.to/ofri-peretz).

_Check the handler you shipped this week: is there a ceiling on it, or did the example not have one either?_

---

**Related:**

- [Your LLM Call Has No Ceiling](https://ofriperetz.dev/articles/agent-resource-bounds)
- [The CWE Taxonomy, Explained](https://ofriperetz.dev/articles/cwe-taxonomy-explained)
- [Getting Started with eslint-plugin-vercel-ai-security](https://ofriperetz.dev/articles/getting-started-eslint-plugin-vercel-ai-security)

[npm](https://www.npmjs.com/package/eslint-plugin-vercel-ai-security) · [GitHub](https://github.com/ofri-peretz/eslint)
