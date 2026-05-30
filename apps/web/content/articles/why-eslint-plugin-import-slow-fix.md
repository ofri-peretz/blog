---
title: "Post-Mortem: Why ESLint Performance Failed (And the 100x Fix)"
description: "A technical analysis of performance degradation in large-scale static analysis. The engineering journey from 45s to 0.4s linting times."
slug: "why-eslint-plugin-import-slow-fix"
canonical_url: "https://ofriperetz.dev/articles/why-eslint-plugin-import-slow-fix"
devto_url: "https://dev.to/ofri-peretz/why-eslint-plugin-import-takes-45-seconds-and-how-we-fixed-it-2nmh"
devto_id: 3137465
published_at: "2025-12-31T05:34:31Z"
edited_at: "2026-01-11T10:22:04Z"
cover_image: "https://media2.dev.to/dynamic/image/width=1000,height=420,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fofriperetz.dev%2Fcdn%2Fblog-cover-image%2Fwhy-eslint-plugin-import-slow-fix.png"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/why-eslint-plugin-import-slow-fix.png"
reading_time_minutes: 2
tags:
  - "eslint"
  - "javascript"
  - "performance"
  - "typescript"
reactions: 0
comments: 0
views: 0
author:
  name: "Ofri Peretz"
  username: "ofri-peretz"
  avatar: "https://media2.dev.to/dynamic/image/width=640,height=640,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Fuser%2Fprofile_image%2F3669992%2F50a1f256-472c-48a1-85e8-149459647ea7.png"
  twitter: "ofriperetzdev"
series: "Linter Engineering & Performance"
---

**Developer velocity dies when CI takes 45 seconds to lint. Here is the technical post-mortem of why traditional linting failed, and how we engineered a 100x speedup into the static analysis ecosystem.**

Your CI is slow. Your pre-commit hooks timeout. Developers disable linting to ship faster.

**The culprit?** `eslint-plugin-import`.

## The Performance Gap

```text
┌─────────────────────────────────────────────────────┐
│ Linting 10,000 files                                │
├─────────────────────────────────────────────────────┤
│ eslint-plugin-import:      45.0s  ███████████████████│
│ eslint-plugin-import-next:  0.4s  ▏                  │
└─────────────────────────────────────────────────────┘
```

That's **100x faster**. Not a typo.

## Why Is It So Slow?

### 1. Cold Module Resolution

```javascript
// eslint-plugin-import resolves EVERY import from scratch
import { Button } from "@company/ui"; // Resolves entire package

// On every lint run. Every file. Every import.
```

### 2. The [`no-cycle`](https://eslint.interlace.tools/docs/quality/plugin-import-next/rules/no-cycle) Problem

{% details Click to see why no-cycle is a performance killer %}

The `import/no-cycle` rule builds a complete dependency graph.

For N files with M imports each:

- **Time complexity**: O(N × M²)
- **Memory**: Entire graph in RAM
- **Result**: OOM on large monorepos

```bash
# Real GitHub issues:
# "import/no-cycle takes 70% of lint time" (#2182)
# "OOM checking circular dependencies"
# "Minutes to lint a monorepo"
```

{% enddetails %}

### 3. No Caching

Every lint run repeats the same work. No incremental analysis.

## The Solution

We rebuilt module resolution with:

| Feature         | eslint-plugin-import | eslint-plugin-import-next  |
| --------------- | -------------------- | -------------------------- |
| Caching         | ❌ None              | ✅ Cross-file shared cache |
| Cycle Detection | O(N × M²)            | O(N) with memoization      |
| TypeScript      | 🐌 Slow resolver     | ⚡ Native TS support       |
| Flat Config     | ⚠️ Partial           | ✅ Native                  |

## Quick Migration

```bash
npm uninstall eslint-plugin-import
npm install --save-dev eslint-plugin-import-next
```

```javascript
// eslint.config.js
import importNext from "eslint-plugin-import-next";

export default [importNext.configs.recommended];
```

**That's it.** Same rules, 100x faster.

## Benchmark It Yourself

::dev-to-cta{url="https://github.com/ofri-peretz/eslint"}
⭐ Star on GitHub and Run the Benchmark
::

```bash
# Compare on your own codebase
time npx eslint --no-cache . # With eslint-plugin-import
time npx eslint --no-cache . # With eslint-plugin-import-next
```

---

📦 [npm: eslint-plugin-import-next](https://www.npmjs.com/package/eslint-plugin-import-next)
📖 [Migration Guide](https://github.com/ofri-peretz/eslint/tree/main/packages/eslint-plugin-import-next#migration)

---

**The Interlace ESLint Ecosystem**
Interlace is a high-fidelity suite of static code analyzers designed to automate security, performance, and reliability for the modern Node.js stack. With over 330 rules across 18 specialized plugins, it provides 100% coverage for OWASP Top 10, LLM Security, and Database Hardening.

## [Explore the full Documentation](https://eslint.interlace.tools)

© 2026 Ofri Peretz. All rights reserved.

---

**Build Securely.**
I'm Ofri Peretz, a Security Engineering Leader and the architect of the Interlace Ecosystem. I build static analysis standards that automate security and performance for Node.js fleets at scale.

[ofriperetz.dev](https://ofriperetz.dev) | [LinkedIn](https://linkedin.com/in/ofri-peretz) | [GitHub](https://github.com/ofri-peretz)
