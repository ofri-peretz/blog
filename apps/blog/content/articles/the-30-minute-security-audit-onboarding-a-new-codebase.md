---
title: "I Inherited a 3,000-Line Codebase. 30 Minutes of ESLint Found 26 Critical Bugs."
description: "A 30-minute static-analysis protocol for an inherited Node.js codebase: the three ESLint plugins to install, the jq one-liner that ranks findings by rule, and how to read the result — 15 SQL injections and 8 hardcoded credentials before your first standup. Plus what the same scan finds in AI-generated code."
slug: "the-30-minute-security-audit-onboarding-a-new-codebase"
canonical_url: "https://ofriperetz.dev/articles/the-30-minute-security-audit-onboarding-a-new-codebase"
devto_url: "https://dev.to/ofri-peretz/the-30-minute-security-audit-onboarding-a-new-codebase-4f91"
devto_id: 3137550
published_at: "2025-12-31T06:31:46Z"
edited_at: "2026-02-05T05:33:15Z"
cover_image: "https://ofriperetz.dev/og/cover/the-30-minute-security-audit-onboarding-a-new-codebase"
social_image: "https://ofriperetz.dev/og/article/the-30-minute-security-audit-onboarding-a-new-codebase"
reading_time_minutes: 5
tags:
  - "security"
  - "node"
  - "ai"
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

I've reviewed hundreds of Node.js + PostgreSQL codebases, and the same handful
of vulnerability patterns shows up in most of them — string-concatenated SQL,
secrets in source, MD5 where a password hash should be. So when you inherit a
codebase — an acquisition, a departing senior engineer, or you're the new lead
and nobody can explain the 3,000-line `utils/legacy_auth.js` — the only question
that matters on day one is: **how bad is it?**

A traditional audit takes weeks, a consultant, and a 200-page PDF you'll file and
forget. You don't have weeks. You have **30 minutes and one ESLint run** — and it
returns a **measurable risk heatmap** you can put in front of a board. Here's the
exact protocol, and the kind of result a representative inherited service
produces: **26 critical-severity findings** — 15 SQL injections, 8 hardcoded
credentials, 3 broken hashes — before the first standup.

> The numbers below are illustrative of a typical inherited service; the point is
> the **method** — every command here runs on _your_ repo and prints _your_
> numbers in under 30 minutes. Reproduce it and the heatmap is yours, not mine.

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

**Why none of this got caught in code review.** It survived for the most ordinary
reason there is: the first `client.query("SELECT ... " + id)` shipped on a Friday,
passed review because the reviewer was reading for _logic_, not for taint, and
became the copy-paste template for every query after it. The MD5 call was in
`utils/legacy_auth.js` from before anyone on the current team joined — nobody owns
it, so nobody touches it. Hardcoded credentials read as "config we'll move to env
later." None of these are exotic mistakes. They're the default failure mode of a
team without a guardrail in CI, which is exactly why a _machine_ pass finds in 30
minutes what two years of human review walked past.

## What one run buys you

- **The attack surface** — group by OWASP category to see what's most exposed:
  `jq -r '.[].messages[].message' security-audit.json | grep -o 'OWASP:[^ ]*' | sort | uniq -c | sort -rn`
- **The hotspots** — group by file instead of rule to find the worst modules:
  `jq -r '.[].filePath' security-audit.json | sort | uniq -c | sort -rn`
- **The culture** — did the previous team have _any_ guardrails? The heatmap
  answers honestly.

It's not a penetration test. It's a **data-driven first slide** — and unlike the
consultant's PDF, you can re-run it weekly to measure remediation velocity.

Once you have the heatmap, two follow-ups turn the slide into a plan. To map the
ranked rules onto a framework leadership recognizes, see
[Mapping Your Codebase to the OWASP Top 10 with ESLint](https://ofriperetz.dev/articles/mapping-your-codebase-to-owasp-top-10-with-247-eslint-rules).
And before you start fixing those 15 SQL findings, read
[The SQL Injection Pattern node-postgres Can't Save You From](https://ofriperetz.dev/articles/sql-injection-node-postgres-pattern)
— the parameterization fix is one line, but the reason it kept shipping is the
real lesson.

## Then make it permanent

```yaml
# CI — the audit becomes a gate; errors fail the build, and --max-warnings 0
# also blocks any warning-level rule
- run: npx eslint . --max-warnings 0
```

The same `[PCI-DSS,HIPAA,ISO27001,…]` tags in each finding become your audit
evidence, and the structured messages are built for AI assistants to action.

## The codebase you inherit next won't be human-written

The inherited-codebase framing has a successor problem: a growing share of the
code you'll audit was written by an AI assistant, and the heatmap looks
_identical_. When I had Claude generate 80 common Node.js functions with no
security context — 20 prompts across four models — **65–75% shipped with a
vulnerability**, statistically consistent across every model, and the dominant
patterns were the same three this scan ranks first: string-concatenated SQL,
hardcoded secrets, weak hashing. (Full experiment:
[I Let Claude Write 80 Functions — 65–75% Had Security Vulnerabilities](https://ofriperetz.dev/articles/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities).)

That's not a knock on any one model — the newest model scored no better than the
older ones, which is the point: it's a systemic property of generating code
without a guardrail in the loop. So the same `npx eslint . --format=json` you run
on an inherited service is the gate you want on AI-generated diffs: point it at
the output of your coding agent before the diff reaches review, and the
machine-written `client.query("SELECT ... " + id)` fails the build at the same
rule the human-written one did. The protocol doesn't change. The author does.

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

**Run the four commands on the worst service you've inherited and tell me the top
line of your heatmap.** What was your `uniq -c | sort -rn` number-one rule — and
how long had it been quietly shipping before the scan named it? That's the war
story I want in the comments.

---

I'm **Ofri Peretz**, a security engineering leader and the author of the
Interlace ESLint ecosystem — domain-specific static analysis for security,
reliability, and performance on the Node.js stack.

[ofriperetz.dev](https://ofriperetz.dev) · [LinkedIn](https://linkedin.com/in/ofri-peretz) · [GitHub](https://github.com/ofri-peretz)
