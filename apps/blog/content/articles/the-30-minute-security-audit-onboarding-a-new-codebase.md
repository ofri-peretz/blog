---
title: "The 30-Minute Security Audit: I Ran It on 140 Gemini-Written Functions. 102 Shipped Vulnerable."
description: "A 30-minute static-analysis protocol for any inherited Node.js codebase — human- or AI-written: the three ESLint plugins to install, the jq one-liner that ranks findings by rule, and how to read the heatmap. Then the same scan on a real Gemini-2.5-Pro corpus: 102 of 140 functions vulnerable, avg CVSS 8.3, and the rules that fired first."
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
  - "devsecops"
  - "javascript"
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

You just inherited a Node.js codebase. You have **30 minutes before the standup
where someone asks "how bad is it?"** — this is the exact protocol: three ESLint
plugins, four shell commands, and a ranked heatmap that tells you more about the
codebase's security posture than its previous team knew in two years.

The same handful of vulnerability patterns shows up in most inherited codebases —
string-concatenated SQL, secrets in source, MD5 where a password hash should be.
A traditional audit takes weeks, a consultant, and a 200-page PDF you'll file and
forget. You have **one ESLint run** — and it returns a **measurable risk heatmap**
you can put in front of a board.

I ran exactly this protocol on a real inherited corpus last month — except the
"departing engineer" was an AI. I had **Gemini 2.5 Pro generate 140 Node.js
functions** (database, auth, file, command, config tasks; 7 iterations each, no
security guidance) and pointed the same scan at the output. The heatmap:
**102 of the 140 functions shipped with at least one vulnerability — 168 findings,
average CVSS 8.3.** Top of the `uniq -c` ranking was `detect-non-literal-fs-filename`
(50 hits), then hardcoded credentials and `SELECT *` straight out of `pg`. If a
human had handed me that repo on day one, I'd have called it the worst codebase
I'd inherited in a year. A model wrote it in 36 seconds a function. (Run + numbers
below.)

That's the uncomfortable part: **the heatmap looks identical whether a tired senior
or a frontier model wrote the code.** Here's the exact 30-minute protocol — and at
the end, the live Gemini run, reproducible command for command.

> **The inherited-service table further down is illustrative** — a shape, not a
> single repo I'm quoting. Every command here runs on _your_ codebase and prints
> _your_ numbers; the Gemini figures above and below are first-party, from a run
> you can reproduce. The heatmap is yours, not mine.
>
> **Inherited-codebase series.** This is the Node.js + PostgreSQL playbook. For
> the same protocol run on a real NestJS service —
> [12 seconds of ESLint, 47 violations across 6 vulnerability classes](https://ofriperetz.dev/articles/i-inherited-a-nestjs-codebase-the-first-lint-run-found-6-vulnerabilities)
> — see the framework-specific walkthrough.

> **30 minutes, 7 ESLint plugins, and you'll know more about a codebase's security posture than its previous team did in 2 years.**

## Step 1 — install the layers (2 min)

Three plugins cover the highest-yield server-side risks: injection, secrets, and
crypto.

```bash
# npm (yarn: yarn add -D … · pnpm: pnpm add -D … · bun: bun add -d …)
npm install --save-dev eslint-plugin-secure-coding eslint-plugin-pg eslint-plugin-node-security
```

New to these plugins? The
[eslint-plugin-secure-coding getting-started](https://ofriperetz.dev/articles/getting-started-eslint-plugin-secure-coding)
walks through the full rule set in five minutes; this article is the 30-minute
triage you run once all three are wired.

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

`strict` turns the whole secure-coding rule set on as errors — including the
experimental and opinionated rules — which is exactly what you want for a first
pass, where false positives are cheaper than missed risk. **But know your noise
floor before you trust the count.** On our own 149-rule precision audit across a
multi-repo Wild corpus, almost all of `strict`'s noise concentrates in two rules:
`secure-coding/no-unlimited-resource-allocation` (474 hits, ~91% landing on edge
constructs) and `node-security/no-buffer-overread` (~95% edge ratio). The
injection / secrets / crypto rules this article ranks first are tight by
comparison. So the triage rule is simple: on the first run, **read the heatmap
top-down and mentally discount those two rows** — or start from `recommended-strict`
(same rules, no experimental ones) if you want a quieter first pass and a higher
trust floor on every line.

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

If you want to know which plugins actually earn their keep, the
[benchmark across 17 ESLint security plugins](https://dev.to/ofri-peretz/i-benchmarked-17-eslint-security-plugins-only-one-found-every-vulnerability-c83)
measures detection rate, false-positive rate, and overlap on a shared corpus — so
you're choosing the three plugins for this protocol based on data, not intuition.

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
vulnerability**, and the dominant patterns were the same three this scan ranks
first: string-concatenated SQL, hardcoded secrets, weak hashing. (Full
experiment:
[I Let Claude Write 80 Functions — 65–75% Had Security Vulnerabilities](https://ofriperetz.dev/articles/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities).)

And it isn't a Claude problem. When I widened the benchmark to **700
AI-generated functions across 5 models from Claude _and_ Google's Gemini** —
7 iterations per prompt, 20 security-critical tasks — every model landed in a
**49–73% vulnerability rate** (χ² = 18.43, p < 0.05), and Gemini 2.5 Pro topped
the table at **73%**. Different vendor, same three patterns at the top of the
heatmap. (Full data:
[We Ranked 5 AI Models by Security — The Leaderboard Is Wrong](https://ofriperetz.dev/articles/we-ranked-5-ai-models-by-security-the-leaderboard-is-wrong).)

### Run the exact protocol on a Gemini-generated diff

This isn't a thought experiment — it's the run from the top of this article, in
full. I pointed Steps 1–4 at **140 functions generated by Gemini 2.5 Pro** (via
the Gemini CLI, 7 iterations across 20 security-critical prompts in 5 categories,
`securityContext: false`). The same `jq -r '.[].messages[].ruleId' | sort | uniq -c | sort -rn`
heatmap, aggregated across the run, ranks the rules like this on a frontier
model's output:

```text
  ~50  node-security/detect-non-literal-fs-filename   # path taken from input, unsanitized
  ~22  pg/no-hardcoded-credentials                    # DB creds inline in the query layer
  ~20  pg/prefer-pool-query                           # connection-per-call, no pooling
  ~19  node-security/detect-child-process             # shelling out on user-influenced args
  ~16  pg/no-select-all                               # SELECT * into the response
  ~16  secure-coding/no-hardcoded-credentials         # secrets in source
```

**102 of 140 functions were vulnerable** — a 73% rate, 168 total findings, average
**CVSS 8.3**, generated at ~36 seconds a function. The cluster is the same one the
inherited-human heatmap surfaces: file-path injection, hardcoded secrets, unsafe
data access. Then the part that should end the "I'll just ask it to fix them"
reflex: I fed every finding back and asked Gemini to remediate. It fully fixed
**47 of 101** functions and left **93 of 167 vulnerabilities standing — a 44%
overall fix rate.** The model that wrote the holes could not reliably close them.
A guardrail in CI is not optional on AI output; it's the only thing in the loop
that doesn't have a 56% miss rate.

That's the point: it's not a knock on any one model or vendor — it's a systemic
property of generating code without a guardrail in the loop. So the same
`npx eslint . --format=json` you run on an inherited service is the gate you want
on AI-generated diffs: point it at the output of your coding agent — Claude,
Gemini, Copilot, whatever writes the next commit — before the diff reaches
review, and the machine-written `client.query("SELECT ... " + id)` fails the
build at the same rule the human-written one did. The protocol doesn't change.
The author does.

---

## Compatibility

All three plugins ship the same contract:

| Surface              | Support                                                                |
| -------------------- | ---------------------------------------------------------------------- |
| **Package managers** | npm, yarn, pnpm, bun                                                   |
| **Node**             | `>= 18.0.0`                                                            |
| **ESLint**           | `^8.0.0 \|\| ^9.0.0 \|\| ^10.0.0`, flat config                         |
| **Module system**    | Plugins ship CommonJS; your config can be `eslint.config.js` or `.mjs` |
| **Oxlint**           | flagship rules (incl. `pg/no-unsafe-query`) run today via the oxlint JS-plugin tier — [same code, measured 50–230× faster](https://github.com/ofri-peretz/eslint/blob/main/benchmark-results/oxlint-jstier-vs-eslint.md) |

---

## Links

- 📦 [eslint-plugin-secure-coding](https://www.npmjs.com/package/eslint-plugin-secure-coding) — core OWASP coverage
- 📦 [eslint-plugin-pg](https://www.npmjs.com/package/eslint-plugin-pg) — PostgreSQL / data-layer
- 📦 [eslint-plugin-node-security](https://www.npmjs.com/package/eslint-plugin-node-security) — crypto & system
- 📖 [Full rule docs (per-rule CWE)](https://eslint.interlace.tools)
- 💻 [Source on GitHub](https://github.com/ofri-peretz/eslint)
- 📊 [Benchmark: 17 ESLint security plugins compared](https://dev.to/ofri-peretz/i-benchmarked-17-eslint-security-plugins-only-one-found-every-vulnerability-c83)
- 🔍 [I inherited a NestJS codebase — the first lint run found 6 vulnerabilities](https://dev.to/ofri-peretz/i-inherited-a-nestjs-codebase-the-first-lint-run-found-6-vulnerabilities-55ma)

::dev-to-cta{url="https://github.com/ofri-peretz/eslint"}
⭐ Star on GitHub if you've ever inherited a codebase and had no idea how bad it was.
::

**Run the four commands on the worst service you've inherited and tell me the top
line of your heatmap.** What was your `uniq -c | sort -rn` number-one rule — and
how long had it been quietly shipping before the scan named it? That's the war
story I want in the comments.

---

*Part of the [Interlace ESLint ecosystem](https://eslint.interlace.tools). Source on [GitHub](https://github.com/ofri-peretz/eslint) · Follow: [Dev.to/ofri-peretz](https://dev.to/ofri-peretz)*

---

I'm **Ofri Peretz**, a security engineering leader and the author of the
Interlace ESLint ecosystem — domain-specific static analysis for security,
reliability, and performance on the Node.js stack.

[ofriperetz.dev](https://ofriperetz.dev) · [LinkedIn](https://linkedin.com/in/ofri-peretz) · [GitHub](https://github.com/ofri-peretz)
