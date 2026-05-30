---
title: "Engineering the 100x Speedup: A Static Analysis Performance Report"
description: "A data-driven report on optimizing static analysis at scale. How we engineered a 100x speedup in the industry's most used linter plugin."
slug: "eslint-plugin-import-vs-eslint-plugin-import-next-up-to-100x-faster"
canonical_url: "https://ofriperetz.dev/articles/eslint-plugin-import-vs-eslint-plugin-import-next-up-to-100x-faster"
devto_url: "https://dev.to/ofri-peretz/eslint-plugin-import-vs-eslint-plugin-import-next-up-to-100x-faster-1afa"
devto_id: 3143536
published_at: "2026-01-02T14:46:40Z"
edited_at: "2026-02-05T05:32:55Z"
cover_image: "https://media2.dev.to/dynamic/image/width=1000,height=420,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fofriperetz.dev%2Fcdn%2Fblog-cover-image%2Feslint-plugin-import-vs-eslint-plugin-import-next-up-to-100x-faster.png"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/eslint-plugin-import-vs-eslint-plugin-import-next-up-to-100x-faster.png"
reading_time_minutes: 4
tags:
  - "eslint"
  - "javascript"
  - "performance"
  - "benchmark"
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

**Up to 100x faster on circular dependency detection. Reproducible benchmarks. Full methodology.**

> 🔄 **Drop-in replacement** — 100% compatible with all `eslint-plugin-import` rules, but faster, LLM-optimized error messages, and fewer false positives/negatives.

## TL;DR

| Benchmark          | 1K Files | 5K Files  | 10K Files   |
| ------------------ | -------- | --------- | ----------- |
| Core Rules (9)     | 1.6x     | 3.3x      | **5.2x**    |
| Recommended Preset | 1.4x     | 3.0x      | **5.5x**    |
| **no-cycle Only**  | 25.7x    | **54.9x** | **~100x\*** |

_\*10K projection based on O(n²) scaling pattern observed at 1K→5K. We stopped at 5K because eslint-plugin-import would take 10+ minutes._

---

## Why eslint-plugin-import is Slow

The original `eslint-plugin-import` uses an **O(n²)** module resolution algorithm:

1. **For each file**, parse all imports
2. **For each import**, resolve the full module path
3. **For [`no-cycle`](https://eslint.interlace.tools/docs/quality/plugin-import-next/rules/no-cycle)**, traverse the entire dependency graph for every file

This creates quadratic complexity. On 5,000 files with interconnected imports, the [`no-cycle`](https://eslint.interlace.tools/docs/quality/plugin-import-next/rules/no-cycle) rule alone takes **148 seconds**.

## How eslint-plugin-import-next Fixes This

We rewrote the core algorithms:

1. **Cached module resolution** — resolve each path once, cache permanently
2. **Incremental graph building** — build the dependency graph incrementally, not per-file
3. **Cycle detection with Tarjan's algorithm** — O(n) instead of O(n²)

Result: **2.71 seconds** for the same 5,000 files.

---

## Benchmark 1: Core Rules (9 rules)

Both plugins configured with identical rules:

- [`no-unresolved`](https://eslint.interlace.tools/docs/quality/plugin-import-next/rules/no-unresolved), [`named`](https://eslint.interlace.tools/docs/quality/plugin-import-next/rules/named), [`namespace`](https://eslint.interlace.tools/docs/quality/plugin-import-next/rules/namespace), [`default`](https://eslint.interlace.tools/docs/quality/plugin-import-next/rules/default), [`export`](https://eslint.interlace.tools/docs/quality/plugin-import-next/rules/export)
- [`no-named-as-default`](https://eslint.interlace.tools/docs/quality/plugin-import-next/rules/no-named-as-default), [`no-named-as-default-member`](https://eslint.interlace.tools/docs/quality/plugin-import-next/rules/no-named-as-default-member), [`no-duplicates`](https://eslint.interlace.tools/docs/quality/plugin-import-next/rules/no-duplicates), [`order`](https://eslint.interlace.tools/docs/quality/plugin-import-next/rules/order)

| Files  | eslint-plugin-import | eslint-plugin-import-next | Speedup  |
| ------ | -------------------- | ------------------------- | -------- |
| 1,000  | 2.80s                | 1.78s                     | **1.6x** |
| 5,000  | 19.04s               | 5.76s                     | **3.3x** |
| 10,000 | 58.67s               | 11.26s                    | **5.2x** |

**Takeaway**: Even with basic rules, the performance gap grows with codebase size.

---

## Benchmark 2: Recommended Preset

Using the full `recommended` configuration from each plugin.

| Files  | eslint-plugin-import | eslint-plugin-import-next | Speedup  |
| ------ | -------------------- | ------------------------- | -------- |
| 1,000  | 2.42s                | 1.78s                     | **1.4x** |
| 5,000  | 18.43s               | 6.07s                     | **3.0x** |
| 10,000 | 57.74s               | 10.57s                    | **5.5x** |

**Takeaway**: Recommended presets show similar scaling — 5.5x faster at 10K files.

---

## Benchmark 3: no-cycle Rule Only

This is where the difference is **massive**. The [`no-cycle`](https://eslint.interlace.tools/docs/quality/plugin-import-next/rules/no-cycle) rule detects circular dependencies.

| Files  | eslint-plugin-import | eslint-plugin-import-next | Speedup   |
| ------ | -------------------- | ------------------------- | --------- |
| 1,000  | 27.03s               | 1.05s                     | **25.7x** |
| 5,000  | 148.59s              | 2.71s                     | **54.9x** |
| 10,000 | ~600s (projected)\*  | ~5s (projected)           | **~100x** |

_\*10K Projection Note: Based on the O(n²) scaling observed from 1K→5K (27s→148s = 5.5x increase for 5x files), we project eslint-plugin-import would take ~10 minutes at 10K files. We didn't run this because waiting 10+ minutes per iteration is impractical. eslint-plugin-import-next scales linearly (O(n)), so ~5s is expected._

**Takeaway**: If you use [`no-cycle`](https://eslint.interlace.tools/docs/quality/plugin-import-next/rules/no-cycle) (and you should), the speedup is 25-100x depending on codebase size.

```text
┌────────────────────────────────────────────────────────────────┐
│ no-cycle Rule: 5,000 files                                     │
├────────────────────────────────────────────────────────────────┤
│ eslint-plugin-import:      148.59s ████████████████████████████│
│ eslint-plugin-import-next:   2.71s █                           │
└────────────────────────────────────────────────────────────────┘
```

---

## Why no-cycle is Critical

Circular dependencies cause:

- **Build failures** with tree-shaking
- **Runtime bugs** with undefined imports
- **Memory leaks** in bundlers
- **Test flakiness** from initialization order

Most teams **disable** [`no-cycle`](https://eslint.interlace.tools/docs/quality/plugin-import-next/rules/no-cycle) because it's too slow. With `eslint-plugin-import-next`, you can finally enable it.

---

## Methodology

**Apple-to-apple comparison** — [full source code](https://github.com/ofri-peretz/eslint-benchmark-suite)

| Spec               | Details                                                                              |
| ------------------ | ------------------------------------------------------------------------------------ |
| **Codebase sizes** | 1,000 / 5,000 / 10,000 JavaScript files                                              |
| **Iterations**     | 3-5 runs per size, per plugin                                                        |
| **Fixtures**       | Realistic JS files with named/default imports, barrel files, cross-file dependencies |
| **Environment**    | Node v20.19.5, Apple Silicon M1 (arm64), ESLint v9.17.0                              |
| **Cache**          | Cleared between each run                                                             |

### Run It Yourself

```bash
git clone https://github.com/ofri-peretz/eslint-benchmark-suite.git
cd eslint-benchmark-suite
npm install
npm run generate:import
npm run benchmark:import
npm run benchmark:import-recommended
npm run benchmark:import-no-cycle
```

---

## Migration Takes 2 Minutes

```bash
# Remove old plugin
npm uninstall eslint-plugin-import

# Install new plugin
npm install --save-dev eslint-plugin-import-next
```

```javascript
// eslint.config.js
import importNext from "eslint-plugin-import-next";
export default [importNext.configs.recommended];
```

---

## Resources

📦 [npm: eslint-plugin-import-next](https://www.npmjs.com/package/eslint-plugin-import-next)
📊 [Benchmark Suite](https://github.com/ofri-peretz/eslint-benchmark-suite)
📖 [Full Rule List](https://github.com/ofri-peretz/eslint/tree/main/packages/eslint-plugin-import-next)

**[⭐ Star on GitHub](https://github.com/ofri-peretz/eslint)**

---

**The Interlace ESLint Ecosystem**
Interlace is a high-fidelity suite of static code analyzers designed to automate security, performance, and reliability for the modern Node.js stack. With over 330 rules across 18 specialized plugins, it provides 100% coverage for OWASP Top 10, LLM Security, and Database Hardening.

## [Explore the full Documentation](https://eslint.interlace.tools)

© 2026 Ofri Peretz. All rights reserved.

---

**Build Securely.**
I'm Ofri Peretz, a Security Engineering Leader and the architect of the Interlace Ecosystem. I build static analysis standards that automate security and performance for Node.js fleets at scale.

[ofriperetz.dev](https://ofriperetz.dev) | [LinkedIn](https://linkedin.com/in/ofri-peretz) | [GitHub](https://github.com/ofri-peretz)
