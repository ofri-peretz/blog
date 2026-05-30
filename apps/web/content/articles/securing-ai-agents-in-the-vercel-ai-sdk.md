---
title: "The AI Security Protocol: Hardening Vercel AI SDK Agents"
description: "The definitive engineering standard for AI-native security. Use automated static analysis to protect agents from LLM-specific vulnerabilities."
slug: "securing-ai-agents-in-the-vercel-ai-sdk"
canonical_url: "https://ofriperetz.dev/articles/securing-ai-agents-in-the-vercel-ai-sdk"
devto_url: "https://dev.to/ofri-peretz/securing-ai-agents-in-the-vercel-ai-sdk-485n"
devto_id: 3116469
published_at: "2025-12-20T00:03:08Z"
edited_at: "2026-02-05T05:33:12Z"
cover_image: "https://media2.dev.to/dynamic/image/width=1000,height=420,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fofriperetz.dev%2Fcdn%2Fblog-cover-image%2Fsecuring-ai-agents-in-the-vercel-ai-sdk.jpg"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/securing-ai-agents-in-the-vercel-ai-sdk.jpg"
reading_time_minutes: 3
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
series: null
---

2025 was the year of LLMs. 2026 is the year of **Agents**.

Agents don't just answer questions—they take actions. They browse the web, execute code, query databases, and call APIs. This changes the security model completely.

An LLM that hallucinates is annoying. **An Agent that hallucinates can delete your production database.**

> **This guide is for developers using the Vercel AI SDK.** The linting rules understand `generateText`, `streamText`, `tool()`, and other SDK functions natively.

## The OWASP Agentic Top 10 2026

OWASP saw this coming. They're drafting a new category specifically for agentic systems:

| #     | Category                      | The Risk                              |
| ----- | ----------------------------- | ------------------------------------- |
| ASI01 | Agent Confusion               | System prompt dynamically overwritten |
| ASI02 | Insufficient Input Validation | Tool parameters not validated         |
| ASI03 | Insecure Credentials          | API keys hardcoded in config          |
| ASI04 | Sensitive Data in Output      | Tools leak secrets in responses       |
| ASI05 | Unexpected Code Execution     | AI output executed as code            |
| ASI07 | RAG Injection                 | Malicious docs inject instructions    |
| ASI08 | Cascading Failures            | Errors propagate across agent steps   |
| ASI09 | Trust Boundary Violations     | AI bypasses authorization             |
| ASI10 | Insufficient Logging          | No audit trail for AI actions         |

## Visual Example: The Problem

The Vercel AI SDK makes building agents easy. Maybe too easy.

### ❌ Before: Unprotected Agent

```typescript
// This code ships to production every day
const result = await generateText({
  model: openai("gpt-4"),
  tools: {
    deleteUser: tool({
      execute: async ({ userId }) => {
        await db.users.delete(userId); // No confirmation, no validation
      },
    }),
  },
});
```

**What's wrong?**

- No human confirmation before destructive action
- No parameter validation on `userId`
- No `maxSteps` limit—agent can loop forever
- No error boundaries for cascading failures

### ✅ After: With ESLint Protection

Install and run the linter:

```bash
npm install eslint-plugin-vercel-ai-security --save-dev
npx eslint src/
```

**Immediate feedback on every issue:**

```bash
🔒 CWE-862 OWASP:ASI09 CVSS:7.0 | Destructive tool without confirmation | HIGH
   at src/agent.ts:5:5
   Fix: Add human-in-the-loop confirmation before execution

🔒 CWE-20 OWASP:ASI02 CVSS:6.5 | Tool parameters not validated | MEDIUM
   at src/agent.ts:6:7
   Fix: Add Zod schema validation for tool parameters

🔒 CWE-400 OWASP:ASI08 CVSS:5.0 | No maxSteps limit on agent | MEDIUM
   at src/agent.ts:3:16
   Fix: Add maxSteps option to prevent infinite loops
```

### ✅ Fixed Code

```typescript
import { z } from "zod";

const result = await generateText({
  model: openai("gpt-4"),
  maxSteps: 10, // ✅ Prevent infinite loops
  tools: {
    deleteUser: tool({
      parameters: z.object({
        userId: z.string().uuid(), // ✅ Validated input
      }),
      execute: async ({ userId }, { confirmDangerous }) => {
        await confirmDangerous(); // ✅ Human-in-the-loop
        await db.users.delete(userId);
      },
    }),
  },
});
```

**Result:** All warnings resolved. Agent is production-ready.

## Setup (60 Seconds)

```javascript
// eslint.config.js
import vercelAISecurity from "eslint-plugin-vercel-ai-security";

export default [
  vercelAISecurity.configs.strict, // Maximum security for agents
];
```

**Strict mode enforces:**

- ✅ Tool schema validation (Zod)
- ✅ Human confirmation for destructive actions
- ✅ `maxSteps` limits for multi-step workflows
- ✅ Error handling for cascading failures

## Coverage: 9/10 OWASP Agentic Categories

[eslint-plugin-vercel-ai-security](https://www.npmjs.com/package/eslint-plugin-vercel-ai-security) covers **9/10 OWASP Agentic categories**. ASI06 (Memory Corruption) is N/A for TypeScript.

The plugin knows:

- Which functions are Vercel AI SDK calls
- Which tools perform destructive operations
- Whether proper safeguards are in place

## The Bottom Line

AI agents are the most powerful—and most dangerous—software we've ever built.

The difference between a helpful assistant and a liability is the guardrails you put in place.

**Don't ship agents without them.**

---

**The Interlace ESLint Ecosystem**
Interlace is a high-fidelity suite of static code analyzers designed to automate security, performance, and reliability for the modern Node.js stack. With over 330 rules across 18 specialized plugins, it provides 100% coverage for OWASP Top 10, LLM Security, and Database Hardening.

## [Explore the full Documentation](https://eslint.interlace.tools)

© 2026 Ofri Peretz. All rights reserved.

---

**Build Securely.**
I'm Ofri Peretz, a Security Engineering Leader and the architect of the Interlace Ecosystem. I build static analysis standards that automate security and performance for Node.js fleets at scale.

[ofriperetz.dev](https://ofriperetz.dev) | [LinkedIn](https://linkedin.com/in/ofri-peretz) | [GitHub](https://github.com/ofri-peretz)
