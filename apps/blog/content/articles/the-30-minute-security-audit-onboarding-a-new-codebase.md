---
title: "The 30-Minute Security Audit: 140 Gemini-Written Functions, 102 Shipped Vulnerable"
description: "A 30-minute static-analysis protocol for any inherited Node.js codebase — human- or AI-written: the three ESLint plugins to install, the jq one-liner that ranks findings by rule, and how to read the heatmap without over-trusting it. Then the same scan on a real Gemini-2.5-Pro corpus: 102 of 140 functions vulnerable, 168 findings, avg CVSS 8.3, and the rules that fired first."
slug: "the-30-minute-security-audit-onboarding-a-new-codebase"
canonical_url: "https://ofriperetz.dev/articles/the-30-minute-security-audit-onboarding-a-new-codebase"
tier: "TUTORIAL"
devto_url: "https://dev.to/ofri-peretz/the-30-minute-security-audit-onboarding-a-new-codebase-4f91"
devto_id: 3137550
published_at: "2025-12-31T06:31:46Z"
edited_at: "2026-02-05T05:33:15Z"
cover_image: "https://ofriperetz.dev/cdn/blog-cover-image/the-30-minute-security-audit-onboarding-a-new-codebase.jpg?v=b2"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/the-30-minute-security-audit-onboarding-a-new-codebase-og.jpg?v=b2"
reading_time_minutes: 8
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
series: "The Hardened Stack"
---

You just inherited a Node.js codebase. You have **30 minutes before the standup
where someone asks "how bad is it?"** — this is the exact protocol: three ESLint
plugins, four shell commands, and a ranked heatmap that tells you more about the
codebase's security posture than its previous team knew in two years.

The same handful of patterns shows up in most inherited codebases —
string-concatenated SQL, secrets in source, MD5 where a password hash should be.
A traditional audit takes weeks, a consultant, and a 200-page PDF you'll file and
forget. You have **one ESLint run**, and it returns a **measurable risk heatmap**.

I ran exactly this protocol on a real inherited corpus — except the "departing
engineer" was an AI. On **2026-02-09** I had **Gemini 2.5 Pro generate 140 Node.js
functions** (database, auth, file, command, config tasks; 7 iterations each, no
security guidance) and pointed the same scan at the output. The heatmap:
**102 of the 140 functions shipped with at least one vulnerability — 168 findings,
average [CVSS](https://ofriperetz.dev/articles/cvss-scores-explained) 8.3.** Top of the `uniq -c` ranking was `detect-non-literal-fs-filename`
(50 hits), then unpooled `pg` queries, child-process calls, and hardcoded
credentials in the query layer. If a human had handed me that repo on day one,
I'd have called it the worst codebase I'd inherited in a year. A model wrote it
at 36 seconds a function. (Run + numbers below.)

That's the uncomfortable part: **the heatmap looks identical whether a tired senior
or a frontier model wrote the code.** Here's the exact 30-minute protocol — and at
the end, the live Gemini run,
[reproducible](https://ofriperetz.dev/articles/reproducibility-vs-replicability)
command for command.

> **Disclosure up front:** the linter grading every number here is my own product.
> I wrote the rules and I'm holding the scorecard — read "vulnerable" as "what my
> ruleset flags," not an independent verdict. The honest answer to that: every
> command below prints _your_ numbers, not mine. The inherited-service table
> further down is illustrative — a shape, not a repo I'm quoting.
>
> **Inherited-codebase series.** This is the Node.js + PostgreSQL playbook. For
> the same protocol run on a real NestJS service —
> [12 seconds of ESLint, 47 violations across 6 vulnerability classes](https://ofriperetz.dev/articles/i-inherited-a-nestjs-codebase-the-first-lint-run-found-6-vulnerabilities)
> — see the framework-specific walkthrough.

## Step 1 — install the layers (2 min)

Three plugins cover the highest-yield server-side risks: injection, secrets, and
crypto.

```bash
# npm (yarn: yarn add -D … · pnpm: pnpm add -D … · bun: bun add -d …)
npm install --save-dev eslint-plugin-secure-coding eslint-plugin-postgresql-security eslint-plugin-node-security
```

Versions at time of writing: `eslint-plugin-secure-coding` 3.3.3 ·
`eslint-plugin-postgresql-security` 1.4.7 · `eslint-plugin-node-security` 4.4.2 (2026-07-28). Pin
them in CI — a rule added between runs moves the count with nothing in the
codebase changing.

New to these plugins? The
[eslint-plugin-secure-coding getting-started](https://ofriperetz.dev/articles/getting-started-eslint-plugin-secure-coding)
walks through the full rule set in five minutes; this article is the 30-minute
triage you run once all three are wired.

## Step 2 — configure for maximum detection (3 min)

```js
// eslint.config.mjs — `configs` is a NAMED export on every plugin
import { configs as secureCoding } from "eslint-plugin-secure-coding";
import { configs as pg } from "eslint-plugin-postgresql-security";
import { configs as nodeSecurity } from "eslint-plugin-node-security";

export default [
  secureCoding.strict, // the full secure-coding set, as errors — maximal for a scan
  pg.recommended,
  nodeSecurity.recommended,
];
```

`strict` turns the whole secure-coding rule set on as errors — including the
experimental and opinionated rules — which is exactly what you want for a first
pass, where [false positives](https://ofriperetz.dev/articles/confusion-matrix-tp-fp-fn-tn)
are cheaper than missed risk. **But know your noise floor before you trust the
count.** Our own Wild-corpus scorecard (22 OSS repos, 1.8M LOC; generated
2026-05-17) shows where the volume lives: `secure-coding/no-unlimited-resource-allocation`
fires **474 times across 19 repos** and `node-security/no-buffer-overread` **136
times** — and that second rule has no synthetic-fixture coverage, which means we
publish no [precision](https://ofriperetz.dev/articles/precision-recall-f1-for-static-analysis)
number for it at all. High volume, unmeasured accuracy: exactly the row you don't
put on a slide. The injection / secrets / crypto rules this article ranks first
are the measured ones.

So the triage rule is simple: **read the heatmap top-down and discount those two
rows** — or start from `recommended-strict` (the `recommended` set with every rule
promoted to `error`, no experimental rules) for a quieter first pass. Why two loud
rules can dominate a raw count even when most rules are tight is
[the base-rate problem](https://ofriperetz.dev/articles/base-rate-problem-explained).

## Step 3 — run it to JSON (5 min)

```bash
npx eslint . --format=json > security-audit.json
```

A finding carries the [CWE](https://ofriperetz.dev/articles/cwe-taxonomy-explained),
the [OWASP Top 10](https://ofriperetz.dev/articles/owasp-top-10-explained)
category, a CVSS, the severity, and the compliance tags — the audit evidence, in
the message:

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

The shape of a typical first run — and the **frequency** is the signal:

| Count | Rule                                                                                                                                         | Severity    | Reads as                                |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | --------------------------------------- |
| 15    | [`pg/no-unsafe-query`](https://eslint.interlace.tools/docs/security/plugin-pg/rules/no-unsafe-query)                                         | 🔴 Critical | systemic SQL injection — no query layer |
| 8     | [`secure-coding/no-hardcoded-credentials`](https://eslint.interlace.tools/docs/security/plugin-secure-coding/rules/no-hardcoded-credentials) | 🔴 Critical | secrets in source — rotate now          |
| 3     | [`node-security/no-weak-hash-algorithm`](https://eslint.interlace.tools/docs/security/plugin-node-security/rules/no-weak-hash-algorithm)     | 🔴 Critical | MD5/SHA1 in crypto paths                |

15 injections isn't 15 bugs — it's a team that never had a query layer. That's
the real finding.

Two guardrails before that number leaves your laptop. It's a **floor, not a
census**: a linter reads syntax, so a business-logic authorization hole produces
zero findings and still ends your quarter — those are
[false negatives](https://ofriperetz.dev/articles/confusion-matrix-tp-fp-fn-tn)
this protocol structurally cannot see
([static analysis vs SAST vs linting](https://ofriperetz.dev/articles/static-analysis-vs-sast-vs-linting)
draws the boundary). And once "total findings" is the number leadership tracks
weekly, it stops measuring risk and starts measuring how good your team is at
disabling rules —
[Goodhart's law](https://ofriperetz.dev/articles/goodharts-law-explained) arrives
on schedule. Track the top three rows and their fix dates, not the total.

**Why none of this got caught in code review.** The first
`client.query("SELECT ... " + id)` passed review because the reviewer was reading
for _logic_, not for
[taint](https://ofriperetz.dev/articles/taint-vs-heuristic-detection) — and then
became the copy-paste template for every query after it. The MD5 call sat in
`utils/legacy_auth.js` from before anyone on the current team joined: nobody owns
it, so nobody touches it. Hardcoded credentials read as "config we'll move to env
later." None of these are exotic mistakes. They're the default failure mode of a
team without a guardrail in CI, which is why a _machine_ pass finds in 30 minutes
what two years of human review walked past.

## What one run buys you

- **The attack surface** — group by OWASP category to see what's most exposed:
  `jq -r '.[].messages[].message' security-audit.json | grep -o 'OWASP:[^ ]*' | sort | uniq -c | sort -rn`
- **The hotspots** — group by file instead of rule to find the worst modules:
  `jq -r '.[].filePath' security-audit.json | sort | uniq -c | sort -rn`
- **The culture** — did the previous team have _any_ guardrails? The heatmap
  answers honestly.

It's not a penetration test. It's a **data-driven first slide** — and unlike the
consultant's PDF, you can re-run it weekly to measure remediation velocity.

Before you start fixing those 15 SQL findings, read
[The SQL Injection Pattern node-postgres Can't Save You From](https://ofriperetz.dev/articles/sql-injection-node-postgres-pattern)
— the parameterization fix is one line; the reason it kept shipping is the real
lesson. And if you want to know why these three plugins and not three others, the
[benchmark across 17 ESLint security plugins](https://ofriperetz.dev/articles/benchmark-17-eslint-security-plugins-compared)
measures detection rate, false-positive rate, and overlap on a shared corpus.

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
_identical_. Claude writing 80 Node.js functions with no security context — 20
prompts across four models — put **65–75% of them in the vulnerable column**, led
by the same three patterns this scan ranks first. (Full experiment:
[I Let Claude Write 80 Functions — 65–75% Had Security Vulnerabilities](https://ofriperetz.dev/articles/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities).)

And it isn't a Claude problem. When I widened the benchmark to **700
AI-generated functions across 5 models from Claude _and_ Google's Gemini** —
7 iterations per prompt, 20 security-critical tasks — every model landed in a
**49–73% vulnerability rate** (χ² = 18.43, p < 0.05 —
[a real difference, not sampling noise](https://ofriperetz.dev/articles/statistical-significance-p-value)),
and Gemini 2.5 Pro topped the table at **73%**. Different vendor, same three
patterns at the top of the heatmap. (Full data:
[We Ranked 5 AI Models by Security — The Leaderboard Is Wrong](https://ofriperetz.dev/articles/we-ranked-5-ai-models-by-security-the-leaderboard-is-wrong).)

### Run the exact protocol on a Gemini-generated diff

This isn't a thought experiment — it's the run from the top of this article, in
full. I pointed Steps 1–4 at **140 functions generated by Gemini 2.5 Pro** (Gemini
CLI v0.27.3, `-p` from an empty temp dir, 7 iterations across 20
security-critical prompts in 5 categories, no security guidance in the prompt),
measured **2026-02-09**. That scan ran four plugins — the three you just
installed plus `eslint-plugin-jwt-security` — and every rule at the top of the ranking
below comes from the three in this protocol. The same
`jq -r '.[].messages[].ruleId' | sort | uniq -c | sort -rn` heatmap, aggregated
across the run:

```text
  50  node-security/detect-non-literal-fs-filename   # path taken from input, unsanitized
  20  pg/prefer-pool-query                           # connection-per-call, no pooling
  19  node-security/detect-child-process             # shelling out on user-influenced args
  13  node-security/no-arbitrary-file-access         # fs call reachable by path traversal
  12  pg/no-hardcoded-credentials                    # DB creds inline in the query layer
  11  pg/no-select-all                               # SELECT * into the response
```

Read that ranking honestly: `pg/prefer-pool-query` and `pg/no-select-all` are
hardening rules, not injection sinks. They earn their rows, but they are not "a
frontier model wrote SQL injection." The sinks here are the file-path,
child-process and credentials lines.

**102 of 140 functions were vulnerable** — a 73% rate, **168 findings**, average
**CVSS 8.3**, generated at ~36 seconds a function. The cluster is the same one the
inherited-human heatmap surfaces: file-path injection, hardcoded secrets, unsafe
data access. Then the part that should end the "I'll just ask it to fix them"
reflex: I fed every finding back and asked Gemini to remediate its own output.
101 of the 102 vulnerable functions came back with an attempt; it fully fixed
**47 of them (47%)** and eliminated **74 of the 167 findings in those 101
functions — a 44.3% reduction, 93 still standing.** The model that wrote the
holes could not reliably close them — and that was the _second-best_ remediation
score of the five models in the run. A guardrail in CI is not optional on AI
output; it's the only thing in the loop that doesn't leave more than half the
findings exactly where it found them.

None of that is a knock on one model or one vendor — it's a systemic property of
generating code without a guardrail in the loop. So point the same
`npx eslint . --format=json` at your coding agent's output — Claude, Gemini,
Copilot, whatever writes the next commit — before the diff reaches review, and the
machine-written `client.query("SELECT ... " + id)` fails the build at the same
rule the human-written one did. The protocol doesn't change. The author does.

---

## Compatibility

All three plugins ship the same contract:

| Surface              | Support                                                                                                                                                                                                                                                                                 |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Package managers** | npm, yarn, pnpm, bun                                                                                                                                                                                                                                                                    |
| **Node**             | `>= 18.0.0`                                                                                                                                                                                                                                                                             |
| **ESLint**           | `^8.0.0 \|\| ^9.0.0 \|\| ^10.0.0`, flat config                                                                                                                                                                                                                                          |
| **Module system**    | Plugins ship CommonJS; your config can be `eslint.config.js` or `.mjs`                                                                                                                                                                                                                  |
| **Oxlint**           | flagship rules (incl. `pg/no-unsafe-query`) run today via the oxlint JS-plugin tier — same plugin source, [measured ~13–22× faster wall time](https://github.com/ofri-peretz/eslint/blob/main/benchmark-results/oxlint-jstier-vs-eslint.md) (oxlint 1.63.0 vs eslint 9.39.4, 905 files) |

---

## Links

- 📦 [eslint-plugin-secure-coding](https://www.npmjs.com/package/eslint-plugin-secure-coding) — core OWASP coverage
- 📦 [eslint-plugin-postgresql-security](https://www.npmjs.com/package/eslint-plugin-postgresql-security) — PostgreSQL / data-layer
- 📦 [eslint-plugin-node-security](https://www.npmjs.com/package/eslint-plugin-node-security) — crypto & system
- 📖 [Full rule docs (per-rule CWE)](https://eslint.interlace.tools)
- 💻 [Source on GitHub](https://github.com/ofri-peretz/eslint) — ⭐ if the heatmap told you something your code review didn't
- 📊 [Benchmark: 17 ESLint security plugins compared](https://ofriperetz.dev/articles/benchmark-17-eslint-security-plugins-compared)
- 🔍 [I inherited a NestJS codebase — the first lint run found 6 vulnerabilities](https://ofriperetz.dev/articles/i-inherited-a-nestjs-codebase-the-first-lint-run-found-6-vulnerabilities)

::dev-to-cta{url="https://www.npmjs.com/package/eslint-plugin-secure-coding"}
📦 `npm i -D eslint-plugin-secure-coding` — the one install that turns the
30-minute audit into a gate that runs on every commit after it.
::

**Then run the four commands on the worst service you've inherited and tell me the
top line of your heatmap.** What was your `uniq -c | sort -rn` number-one rule —
and how long had it been quietly shipping before the scan named it?

And when the heatmap has to become a plan, read
[Mapping Your Codebase to the OWASP Top 10 with ESLint](https://ofriperetz.dev/articles/mapping-your-codebase-to-owasp-top-10-with-247-eslint-rules)
— same `security-audit.json`, reorganised into the framework your leadership
already recognises. The heatmap gets you the meeting; the mapping gets you the
headcount.

---

_Part of the [Interlace ESLint ecosystem](https://eslint.interlace.tools). Source on [GitHub](https://github.com/ofri-peretz/eslint) · Follow: [Dev.to/ofri-peretz](https://dev.to/ofri-peretz)_

---

I'm **Ofri Peretz**, a security engineering leader and the author of the
Interlace ESLint ecosystem — domain-specific static analysis for security,
reliability, and performance on the Node.js stack.

[ofriperetz.dev](https://ofriperetz.dev) · [LinkedIn](https://linkedin.com/in/ofri-peretz) · [GitHub](https://github.com/ofri-peretz)
