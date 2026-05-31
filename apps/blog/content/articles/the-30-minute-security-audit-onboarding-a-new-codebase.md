---
title: "I Inherited a 3,000-Line Codebase. One ESLint Run Found 26 Critical Security Bugs."
description: "How to turn an inherited Node.js codebase into a measurable risk heatmap in one ESLint run: the three plugins to install, the jq one-liner that ranks findings by rule, and how to read the result — 15 SQL injections and 8 hardcoded credentials before your first standup."
slug: "the-30-minute-security-audit-onboarding-a-new-codebase"
canonical_url: "https://ofriperetz.dev/articles/the-30-minute-security-audit-onboarding-a-new-codebase"
devto_url: "https://dev.to/ofri-peretz/the-30-minute-security-audit-onboarding-a-new-codebase-4f91"
devto_id: 3137550
published_at: "2025-12-31T06:31:46Z"
edited_at: "2026-02-05T05:33:15Z"
cover_image: "https://media2.dev.to/dynamic/image/width=1000,height=420,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fofriperetz.dev%2Fcdn%2Fblog-cover-image%2Fthe-30-minute-security-audit-onboarding-a-new-codebase.png"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/the-30-minute-security-audit-onboarding-a-new-codebase.png"
reading_time_minutes: 5
tags:
  - "eslint"
  - "security"
  - "node"
  - "devsecops"
reactions: 11
comments: 6
views: 0
author:
  name: "Ofri Peretz"
  username: "ofri-peretz"
  avatar: "https://media2.dev.to/dynamic/image/width=640,height=640,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Fuser%2Fprofile_image%2F3669992%2F50a1f256-472c-48a1-85e8-149459647ea7.png"
  twitter: "ofriperetzdev"
series: null
---

You just inherited a codebase — an acquisition, a departing senior engineer, or
you're the new lead and nobody can explain the 3,000-line `utils/legacy_auth.js`.
The only question that matters on day one is: **how bad is it?**

A traditional audit takes weeks, a consultant, and a 200-page PDF you'll file and
forget. You don't have weeks. You have one ESLint run — and it returns a
**measurable risk heatmap** you can put in front of a board. Here's the exact
process, and the kind of result a representative inherited service produces:
**26 critical-severity findings** — 15 SQL injections, 8 hardcoded credentials,
3 broken hashes — before the first standup.

## Step 1 — install the layers (2 min)

Three plugins cover the highest-yield server-side risks: injection, secrets, and
crypto.

```bash
# npm (yarn: yarn add -D … · pnpm: pnpm add -D … · bun: bun add -d …)
npm install --save-dev eslint-plugin-secure-coding eslint-plugin-pg eslint-plugin-node-security
```

## Step 2 — configure for maximum detection (3 min)

```js
// eslint.config.mjs — `configs` is a NAMED export on every plugin
import { configs as secureCoding } from "eslint-plugin-secure-coding";
import { configs as pg } from "eslint-plugin-pg";
import { configs as nodeSecurity } from "eslint-plugin-node-security";

export default [
  secureCoding.strict, // the full secure-coding set, as errors — maximal for a scan
  pg.recommended,
  nodeSecurity.recommended,
];
```

`strict` turns the whole secure-coding rule set on as errors — exactly what you
want for a first pass, where false positives are cheaper than missed risk.

## Step 3 — run it to JSON (5 min)

```bash
npx eslint . --format=json > security-audit.json
```

A finding carries the CWE, the OWASP category, a CVSS, the severity, and the
compliance tags — the audit evidence, in the message:

```text
src/utils/crypto.js
  42:18  error  🔒 CWE-327 OWASP:A04-Cryptographic CVSS:7.5 | Use of weak hash algorithm: md5. md5 is cryptographically broken and unsuitable for security purposes. | CRITICAL [PCI-DSS,HIPAA,ISO27001,NIST-CSF]
               Fix: Replace with sha256: crypto.createHash("sha256").update(data)
```

(The CLI also appends the rule's doc URL to the `Fix:` line; trimmed here.)

## Step 4 — build the heatmap (20 min)

Rank the findings by rule. This one line is the whole heatmap:

```bash
jq -r '.[].messages[].ruleId' security-audit.json | sort | uniq -c | sort -rn
```

A real run looks like this — and the **frequency** is the signal:

| Count | Rule                                                                                                                                         | Severity    | Reads as                                |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | --------------------------------------- |
| 15    | [`pg/no-unsafe-query`](https://eslint.interlace.tools/docs/security/plugin-pg/rules/no-unsafe-query)                                         | 🔴 Critical | systemic SQL injection — no query layer |
| 8     | [`secure-coding/no-hardcoded-credentials`](https://eslint.interlace.tools/docs/security/plugin-secure-coding/rules/no-hardcoded-credentials) | 🔴 Critical | secrets in source — rotate now          |
| 3     | [`node-security/no-weak-hash-algorithm`](https://eslint.interlace.tools/docs/security/plugin-node-security/rules/no-weak-hash-algorithm)     | 🔴 Critical | MD5/SHA1 in crypto paths                |

15 injections isn't 15 bugs — it's a team that never had a query layer. That's
the real finding.

## What one run buys you

- **The attack surface** — group by OWASP category to see what's most exposed:
  `jq -r '.[].messages[].message' security-audit.json | grep -o 'OWASP:[^ ]*' | sort | uniq -c | sort -rn`
- **The hotspots** — group by file instead of rule to find the worst modules:
  `jq -r '.[].filePath' security-audit.json | sort | uniq -c | sort -rn`
- **The culture** — did the previous team have _any_ guardrails? The heatmap
  answers honestly.

It's not a penetration test. It's a **data-driven first slide** — and unlike the
consultant's PDF, you can re-run it weekly to measure remediation velocity.

## Then make it permanent

```yaml
# CI — the audit becomes a gate; errors fail the build, and --max-warnings 0
# also blocks any warning-level rule
- run: npx eslint . --max-warnings 0
```

The same `[PCI-DSS,HIPAA,ISO27001,…]` tags in each finding become your audit
evidence, and the structured messages are built for AI assistants to action.

---

## Compatibility

All three plugins ship the same contract:

| Surface              | Support                                                                |
| -------------------- | ---------------------------------------------------------------------- |
| **Package managers** | npm, yarn, pnpm, bun                                                   |
| **Node**             | `>= 18.0.0`                                                            |
| **ESLint**           | `^8.0.0 \|\| ^9.0.0 \|\| ^10.0.0`, flat config                         |
| **Module system**    | Plugins ship CommonJS; your config can be `eslint.config.js` or `.mjs` |
| **Oxlint**           | flagship rules wired via the `interlace-*` ports, parity-gated in CI   |

---

## Links

- 📦 [eslint-plugin-secure-coding](https://www.npmjs.com/package/eslint-plugin-secure-coding) — core OWASP coverage
- 📦 [eslint-plugin-pg](https://www.npmjs.com/package/eslint-plugin-pg) — PostgreSQL / data-layer
- 📦 [eslint-plugin-node-security](https://www.npmjs.com/package/eslint-plugin-node-security) — crypto & system
- 📖 [Full rule docs (per-rule CWE)](https://eslint.interlace.tools)
- 💻 [Source on GitHub](https://github.com/ofri-peretz/eslint)

::dev-to-cta{url="https://github.com/ofri-peretz/eslint"}
⭐ Star on GitHub if you've ever inherited a codebase and had no idea how bad it was.
::

---

I'm **Ofri Peretz**, a security engineering leader and the author of the
Interlace ESLint ecosystem — domain-specific static analysis for security,
reliability, and performance on the Node.js stack.

[ofriperetz.dev](https://ofriperetz.dev) · [LinkedIn](https://linkedin.com/in/ofri-peretz) · [GitHub](https://github.com/ofri-peretz)
