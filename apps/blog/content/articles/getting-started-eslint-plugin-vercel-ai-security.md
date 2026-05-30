---
title: "Hardening AI Agents: The Vercel AI Static Analysis Standard"
description: "The first static analysis standard for AI-native applications. Automate protection against prompt injection and unvalidated agent inputs."
slug: "getting-started-eslint-plugin-vercel-ai-security"
canonical_url: "https://ofriperetz.dev/articles/getting-started-eslint-plugin-vercel-ai-security"
devto_url: "https://dev.to/ofri-peretz/getting-started-with-eslint-plugin-vercel-ai-security-5e9g"
devto_id: 3139002
published_at: "2025-12-31T21:49:06Z"
edited_at: "2026-01-11T10:21:46Z"
cover_image: "https://dev-to-uploads.s3.amazonaws.com/uploads/articles/rxxfvuudvh7r4bny4jxn.png"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/getting-started-eslint-plugin-vercel-ai-security.png"
reading_time_minutes: 2
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

**AI-native applications require a new security paradigm. Here is the first automated static analysis standard for the Vercel AI SDK, protecting your agents from prompt injection in CI/CD.**

## Quick Install

```bash
npm install --save-dev eslint-plugin-vercel-ai-security
```

## Flat Config

```javascript
// eslint.config.js
import vercelAI from "eslint-plugin-vercel-ai-security";

export default [vercelAI.configs.recommended];
```

## Run ESLint

```bash
npx eslint .
```

You'll see output like:

```bash
src/chat.ts
  8:3  error  🔒 CWE-77 OWASP:LLM01 | Unvalidated prompt input
              Risk: Prompt injection vulnerability
              Fix: Use validated prompt: sanitizePrompt(userInput)

src/agent.ts
  24:5 error  🔒 OWASP:LLM08 | Tool missing confirmation gate
              Risk: AI agent can execute arbitrary actions
              Fix: Add await requireUserConfirmation() before execution
```

## Rule Overview

| Category          | Rules | Examples                                       |
| ----------------- | ----- | ---------------------------------------------- |
| Prompt Injection  | 4     | Unvalidated input, dynamic system prompts      |
| Data Exfiltration | 3     | System prompt leaks, sensitive data in prompts |
| Agent Safety      | 3     | Missing tool confirmation, unlimited steps     |
| Resource Limits   | 4     | Token limits, timeouts, abort signals          |
| RAG Security      | 2     | Content validation, embedding verification     |
| Output Safety     | 3     | Output filtering, validation                   |

## Quick Wins

### Before

```javascript
// ❌ Prompt Injection Risk
const { text } = await generateText({
  model: openai("gpt-4"),
  prompt: userInput, // Unvalidated!
});
```

### After

```javascript
// ✅ Validated Input
const { text } = await generateText({
  model: openai("gpt-4"),
  prompt: sanitizePrompt(userInput),
  maxTokens: 1000,
  abortSignal: AbortSignal.timeout(30000),
});
```

### Before (unlimited agent)

```javascript
// ❌ Unlimited Agent
const { result } = await generateText({
  model: openai("gpt-4"),
  tools: dangerousTools,
});
```

### After (bounded agent)

```javascript
// ✅ Limited Agent
const { result } = await generateText({
  model: openai("gpt-4"),
  tools: safeTools,
  maxSteps: 5,
});
```

## Available Presets

```javascript
// Security-focused configuration
vercelAI.configs.recommended;

// Full OWASP LLM Top 10 coverage
vercelAI.configs["owasp-llm-top-10"];
```

## OWASP LLM Top 10 Mapping

| OWASP LLM               | Rules                                                                                                                                                                                                                                                                      |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LLM01: Prompt Injection | [`require-validated-prompt`](https://eslint.interlace.tools/docs/security/plugin-vercel-ai-security/rules/require-validated-prompt), [`no-dynamic-system-prompt`](https://eslint.interlace.tools/docs/security/plugin-vercel-ai-security/rules/no-dynamic-system-prompt)   |
| LLM02: Insecure Output  | [`require-output-filtering`](https://eslint.interlace.tools/docs/security/plugin-vercel-ai-security/rules/require-output-filtering), [`no-unsafe-output-handling`](https://eslint.interlace.tools/docs/security/plugin-vercel-ai-security/rules/no-unsafe-output-handling) |
| LLM04: Model DoS        | [`require-max-tokens`](https://eslint.interlace.tools/docs/security/plugin-vercel-ai-security/rules/require-max-tokens), [`require-abort-signal`](https://eslint.interlace.tools/docs/security/plugin-vercel-ai-security/rules/require-abort-signal)                       |
| LLM06: Sensitive Data   | [`no-sensitive-in-prompt`](https://eslint.interlace.tools/docs/security/plugin-vercel-ai-security/rules/no-sensitive-in-prompt), [`no-system-prompt-leak`](https://eslint.interlace.tools/docs/security/plugin-vercel-ai-security/rules/no-system-prompt-leak)             |
| LLM07: Plugin Design    | [`require-tool-schema`](https://eslint.interlace.tools/docs/security/plugin-vercel-ai-security/rules/require-tool-schema), [`require-tool-confirmation`](https://eslint.interlace.tools/docs/security/plugin-vercel-ai-security/rules/require-tool-confirmation)           |
| LLM08: Excessive Agency | [`require-max-steps`](https://eslint.interlace.tools/docs/security/plugin-vercel-ai-security/rules/require-max-steps), [`require-tool-confirmation`](https://eslint.interlace.tools/docs/security/plugin-vercel-ai-security/rules/require-tool-confirmation)               |

## Customizing Rules

```javascript
// eslint.config.js
import vercelAI from "eslint-plugin-vercel-ai-security";

export default [
  vercelAI.configs.recommended,
  {
    rules: {
      // Configure max steps
      "vercel-ai/require-max-steps": ["error", { maxSteps: 10 }],

      // Make RAG validation a warning
      "vercel-ai/require-rag-content-validation": "warn",
    },
  },
];
```

## Quick Reference

```bash
# Install
npm install --save-dev eslint-plugin-vercel-ai-security

# Config (eslint.config.js)
import vercelAI from 'eslint-plugin-vercel-ai-security';
export default [vercelAI.configs.recommended];

# Run
npx eslint .
```

---

## Links

📦 [npm: eslint-plugin-vercel-ai-security](https://www.npmjs.com/package/eslint-plugin-vercel-ai-security)
📖 [Full Rule List](https://eslint.interlace.tools/docs/security/plugin-vercel-ai-security/rules)
📖 [OWASP LLM Mapping](https://github.com/ofri-peretz/eslint/tree/main/packages/eslint-plugin-vercel-ai-security#owasp-llm-top-10)

::dev-to-cta{url="https://github.com/ofri-peretz/eslint"}
⭐ Star on GitHub
::

---

**The Interlace ESLint Ecosystem**
Interlace is a high-fidelity suite of static code analyzers designed to automate security, performance, and reliability for the modern Node.js stack. With over 330 rules across 18 specialized plugins, it provides 100% coverage for OWASP Top 10, LLM Security, and Database Hardening.

## [Explore the full Documentation](https://eslint.interlace.tools)

© 2026 Ofri Peretz. All rights reserved.

---

**Build Securely.**
I'm Ofri Peretz, a Security Engineering Leader and the architect of the Interlace Ecosystem. I build static analysis standards that automate security and performance for Node.js fleets at scale.

[ofriperetz.dev](https://ofriperetz.dev) | [LinkedIn](https://linkedin.com/in/ofri-peretz) | [GitHub](https://github.com/ofri-peretz)
