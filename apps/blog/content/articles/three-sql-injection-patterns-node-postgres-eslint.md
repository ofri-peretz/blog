---
title: "Gemini 2.5 Pro Wrote Unsafe SQL 96% of the Time: 3 Node.js Injection Patterns — and the ESLint Rule That Catches Them"
description: "Direct concatenation, template literals, and cross-line variable taint: the three structural forms of SQL injection in node-postgres codebases. Why each survives code review, why AI assistants regenerate all three — across a 700-function benchmark, database queries were the worst domain for every Claude and Gemini model — and how one pg-specific ESLint rule catches them statically, no matter who or what wrote the line."
slug: "three-sql-injection-patterns-node-postgres-eslint"
canonical_url: "https://ofriperetz.dev/articles/three-sql-injection-patterns-node-postgres-eslint"
devto_url: "https://dev.to/ofri-peretz/three-sql-injection-patterns-that-still-ship-in-nodejs-and-the-linter-that-catches-them-onb"
devto_id: 3787090
published_at: null
cover_image: "https://media2.dev.to/dynamic/image/width=1000,height=420,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fofriperetz.dev%2Fcdn%2Fblog-cover-image%2Fthree-sql-injection-patterns-node-postgres-eslint.png"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/three-sql-injection-patterns-node-postgres-eslint.png"
reading_time_minutes: 7
tags:
  - "security"
  - "node"
  - "ai"
  - "eslint"
reactions: 0
comments: 0
views: 0
author:
  name: "Ofri Peretz"
  username: "ofri-peretz"
  avatar: "https://media2.dev.to/dynamic/image/width=640,height=640,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Fuser%2Fprofile_image%2F3669992%2F50a1f256-472c-48a1-85e8-149459647ea7.png"
  twitter: "ofriperetzdev"
series: "AI Security Benchmark Series"
---

TypeScript passed it clean. The code reviewer approved it. It shipped to production. Three months later, a penetration tester sent a report.

> **AI Security Benchmark Series** — [Part 1: 80 functions, 65–75% vulnerable](https://ofriperetz.dev/articles/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities) · [Part 2: the Hydra problem](https://ofriperetz.dev/articles/the-ai-hydra-problem-fix-one-ai-bug-get-two-more) · [Part 3: 5 models ranked](https://ofriperetz.dev/articles/we-ranked-5-ai-models-by-security-the-leaderboard-is-wrong) · [Part 4: the domain breakdown](https://ofriperetz.dev/articles/aggregate-benchmarks-lie-heres-what-700-ai-functions-look-like-by-security-domain) · **Applied (you are here): the database domain, weaponized → guarded** → next up, the [full node-postgres failure surface](https://ofriperetz.dev/articles/sql-injection-node-postgres-pattern).

The vulnerable line:

```javascript
const result = await pool.query(
  "SELECT * FROM orders WHERE user_id = " + req.query.userId
);
```

SQL injection has been a known problem for decades. OWASP A03:2021. Parameterized queries are widely understood. And it still ships — not because developers don't know, but because the three structural forms that actually appear in node-postgres codebases look harmless in code review, one line at a time. ([CWE-89](https://cwe.mitre.org/data/definitions/89.html))

And now there's a second author on the team that reaches for those exact three forms by default: the coding assistant. Trained on the same corpus that produced this bug for twenty years, it regenerates it on demand — cleaner-looking, which makes it harder to catch. I [benchmarked five Claude and Gemini models across 700 generated functions](https://ofriperetz.dev/articles/we-ranked-5-ai-models-by-security-the-leaderboard-is-wrong): database queries were the worst security domain for *every* model, topping out at a **96% vulnerable-generation rate** for the most capable one. The line above is what that 96% looks like when a human ships it.

Here are the three patterns, why each survives review, why AI assistants reproduce all three, and how a pg-specific ESLint rule catches them statically — no matter who (or what) wrote the line.

---

## Why a pg-specific rule — not a generic SQL injection linter

Most SQL injection detectors work on one signal: string concatenation near a SQL keyword. If they see `"SELECT" + variable`, they flag it. This produces false positives on non-query string building, and misses injection via template literals — which is syntactically distinct from `+` but equally dangerous.

A pg-specific rule knows three things a generic tool doesn't:

1. **The API surface.** Only fires on `.query()` calls — `pool.query()`, `client.query()`. Not on other string operations that happen to mention SQL keywords.

2. **The parameterization contract.** pg uses `$1, $2` positional placeholders, with values passed as the second argument array. The rule never inspects that second argument — it decides on the *shape of the first*: a plain string literal (`"SELECT ... WHERE id = $1"`) is structurally safe and is left silent, while a `+` concatenation or a `${...}` template literal in that first slot is the injection surface and fires. The values array is the developer's job; the rule's job is to guarantee the query *string* was never built from untrusted input. A corollary: `client.query("SELECT..." + x, [])` is still flagged — not because the array is empty, but because the `+` in the first argument is unsafe no matter what follows it.

3. **Cross-line assignment taint.** When a SQL string is built via concatenation and stored in a variable before `.query()`, the variable is marked tainted. The rule tracks that taint across the assignment and fires at the `.query()` call, pointing at the variable whose value was built unsafely.

This is why the rule's spec classifies every pattern correctly. Its [behavioral test suite](https://github.com/ofri-peretz/eslint/blob/main/packages/eslint-plugin-pg/src/rules/no-unsafe-query/index.spec.ts) holds 8 valid cases that stay silent (parameterized `$1` + values array, `pg-format`, safe-init variables) and 7 invalid cases that fire (direct concatenation, template literals, and cross-line taint — including `+=` augmented assignment). There is one known false-positive class — covered in the trade-offs section below — but the core patterns have no FPs on legitimate parameterized code. The rule is intraprocedural — taint tracking doesn't cross function boundaries — but the direct-access patterns below are the ones that actually appear in production code.

---

## Pattern 1: Direct string concatenation

```javascript
// ❌ Flagged — string + user input in a .query() call
const result = await client.query(
  "SELECT * FROM users WHERE email = '" + email + "'"
);
```

**Why it survives code review:** The concatenation looks harmless in isolation. The reviewer sees string building. Their mental model doesn't ask "where does `email` come from?" — that context lives in the route handler, several stack frames up. Nobody holds the full data-flow in mind while reviewing a database layer.

```javascript
// ✅ Parameterized — rule stays silent
const result = await client.query(
  "SELECT * FROM users WHERE email = $1",
  [email]
);
```

The `$1` placeholder + second-argument values array is pg's escaping contract. The database driver handles quoting and type coercion. This pattern cannot be accidentally broken.

---

## Pattern 2: Template literal interpolation

```javascript
// ❌ Flagged — same vulnerability, different syntax
const result = await pool.query(
  `SELECT * FROM orders WHERE user_id = ${userId} AND status = '${status}'`
);
```

**Why this is especially dangerous:** Template literals feel like interpolation — "variables in a string." Developers who know concatenation is unsafe sometimes don't connect template expressions to the same risk. The syntax is cleaner, so the code feels safer. It isn't.

The detection here is unambiguous: any `${...}` expression inside the first argument to `.query()` — without a corresponding values array as the second argument — is a SQL injection surface.

```javascript
// ✅ Parameterized — stays silent
const result = await pool.query(
  "SELECT * FROM orders WHERE user_id = $1 AND status = $2",
  [userId, status]
);
```

Note: a concatenation with a sanitization wrapper — `client.query("WHERE id = " + sanitize(userId))` — is still flagged. The rule cannot verify that `sanitize()` is pg-safe. Parameterization is always the fix.

---

## Pattern 3: Cross-line variable assignment

This is the pattern that gets through code review most often.

```javascript
const sql = "SELECT * FROM products WHERE category = '" + category + "'"; // taints `sql`
const result = await client.query(sql); // ❌ Flagged here — tainted variable passed to .query()
```

At the `.query(sql)` call, `sql` looks like a named variable. Nothing at that call site suggests injection. The reviewer's eye is on the call — not on where `sql` was built two lines earlier.

The rule tracks this: when a SQL string is assigned via concatenation or template interpolation, the variable is tainted. If that variable is subsequently passed to `.query()`, the rule fires at the `.query()` call, pointing at the variable whose value was built unsafely.

```javascript
// ✅ Safe — stays silent
const sql = "SELECT * FROM products WHERE category = $1";
const result = await client.query(sql, [category]);
```

**The pentester's report? Pattern 3.** The `sql` variable nobody traced back to `req.query`.

---

## Your AI assistant ships all three by default

These three patterns predate AI. They got harder the moment a coding assistant joined the team — because the assistant was trained on the same corpus that produced them.

Ask Claude, Gemini, or Copilot to "write a function that fetches orders for a user id from Postgres," and watch which form it reaches for. In my runs it lands on Pattern 1 or Pattern 2 more often than parameterized `$1` — not because the model doesn't know parameterization, but because string-built SQL is the statistically dominant shape in its training data, and the prompt asked for a query, not for a *safe* query. Parameterization is a constraint. The prompt described behavior, so the model fulfilled behavior. (Try it yourself — the output is non-deterministic, so re-run a few times and watch the failure *class* stay constant even as the exact line changes.)

This is the same negative-space failure I measured at scale. When I let [Claude write 80 functions, 65–75% carried at least one security defect](https://ofriperetz.dev/articles/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities). And it isn't a Claude problem — it's a *training-corpus* problem, so it shows up in every vendor. When I [ranked five Claude and Gemini models across 700 generated functions and 332 ESLint security rules](https://ofriperetz.dev/articles/we-ranked-5-ai-models-by-security-the-leaderboard-is-wrong), database queries were the single worst domain — and `pg/no-unsafe-query`, the rule in this article, was one of the rules doing the flagging:

| Model (database domain) | Vulnerable generation rate |
| --- | --- |
| Claude Haiku 4.5 | 39% |
| Claude Opus 4.6 | 61% |
| Claude Sonnet 4.5 | 71% |
| Gemini 2.5 Flash | 75% |
| Gemini 2.5 Pro | **96%** |

Read that bottom row again. The model with the *deepest* model of Postgres — connection pooling, env-var config, column enumeration — generated unsafe database code 96% of the time, because [elaborate, senior-looking code is exactly where the parameterization bug hides](https://ofriperetz.dev/articles/aggregate-benchmarks-lie-heres-what-700-ai-functions-look-like-by-security-domain). The model that "won" generation (Haiku, 39%) won by writing *simple, parameterized* queries. Competence-signaling is not safety. It's the database-layer cousin of the [NestJS service Claude shipped with six holes](https://ofriperetz.dev/articles/claude-wrote-nestjs-service-eslint-found-6-security-holes) — and when I [ran the identical NestJS prompt through Claude and the Gemini CLI](https://ofriperetz.dev/articles/claude-vs-gemini-nestjs-security-same-prompt-different-errors), Claude shipped 6 security errors and Gemini 2, from the same plugin. The vendor changes the count. It does not change the fact that you have to lint the output.

The uncomfortable part for review: AI-generated SQL looks *more* trustworthy than the human kind. It's clean, consistently formatted, and uses a tidy template literal. Pattern 2 — the template-literal form — is exactly what a reviewer skims past as "modern, readable code." The linter doesn't skim. It sees `${userId}` inside the first argument to `.query()` and fires, whether a human or a model typed it.

**Run it on your assistant's output before you run it on your colleague's.** Same rule, same install, no model-specific tuning:

```bash
npm install eslint-plugin-pg --save-dev
```

```javascript
// eslint.config.mjs
import pg from "eslint-plugin-pg";

export default [
  {
    plugins: { pg },
    rules: { "pg/no-unsafe-query": "error" },
  },
];
```

Because the rule is structural — not model-aware — the methodology transfers to any assistant, and it's small enough to run yourself in two minutes:

```bash
# Generate the same function from two vendors, zero security instructions
claude --print "Write a Node.js function that fetches orders for a user id from Postgres" > claude-out.js
gemini -p "Write a Node.js function that fetches orders for a user id from Postgres" > gemini-out.js

# Score both with the same rule — no model-specific tuning
npx eslint claude-out.js gemini-out.js
```

The model changes; the three patterns don't. And here's the part that turns the linter from a gate into a fixer: in the 700-function benchmark, the worst database generator (Gemini Pro, 96%) was also the *best* database remediator. Across the whole database domain — the bucket `pg/no-unsafe-query` reports into, alongside its sibling rules — Gemini Pro [fixed 25 of 27 vulnerable database functions (93%) once it was handed the specific structural violation](https://ofriperetz.dev/articles/aggregate-benchmarks-lie-heres-what-700-ai-functions-look-like-by-security-domain). The clearest worked case in that data is column enumeration: told *"CWE-1049: avoid `SELECT *`, enumerate explicit columns,"* it restructures the query correctly almost every time. The same loop applies to `no-unsafe-query`: the model doesn't reach for `$1` from a behavior prompt, but a rule that names the exact defect at the exact line is the feedback it acts on. That's the cycle — the assistant generates, the rule names the defect, the assistant remediates — and it's why this slots into the [Build with Gemini](https://dev.to/challenges) framing of "evaluate, then improve, model output." (The 93% is a domain-level fix rate on n=27, Wilson CI ≈ [77%–98%] — directionally strong, not a guarantee.)

---

## What about ORM escape hatches?

Most production Node.js teams use Prisma, Drizzle, Knex, or TypeORM. Those ORMs parameterize by default — but they all have raw query escape hatches (`$queryRaw`, `knex.raw`, `sequelize.literal`) where Pattern 1 and 2 reappear. A pg-specific rule won't catch those; the relevant rules are in the ORM's own lint ecosystem.

For teams using pg directly — internal APIs, data pipelines, microservices — the three patterns above cover the injection surface. Prisma shops have different lint priorities.

---

## The trade-offs (and the one false positive)

The install and config are above — `pg/no-unsafe-query` set to `error` is the whole setup. Two things worth knowing before you turn it on in CI:

**vs. Semgrep/CodeQL:** Interprocedural SAST tools can trace taint across function boundaries. ESLint can't — it's intraprocedural. The trade-off: ESLint runs in your editor on every keystroke and in pre-commit hooks with no CI pipeline required. For a pg team that wants SQL injection feedback where they see TypeScript errors — including on the SQL an AI assistant just generated — that speed matters more than the wider taint scope.

Known false positive: `client.query("SELECT * FROM " + SCHEMA_NAME)` where `SCHEMA_NAME` is a hardcoded constant. The rule fires because it can't distinguish constants from dynamic inputs. Workaround: use `pg-format` for identifier quoting, or restructure to a parameterized form.

Full rule docs and configuration: [eslint.interlace.tools/docs/security/plugin-pg/rules/no-unsafe-query](https://eslint.interlace.tools/docs/security/plugin-pg/rules/no-unsafe-query)

---

_One question, and I genuinely want the war story: has a `$1` parameterized query in your codebase ever been "cleaned up" back into concatenation or a template literal — by a teammate who thought they were tidying it, or by the AI assistant you standardized on when you asked it for "a Postgres query" with no security instructions? Which of the three patterns was it, and how far did it ship before someone caught it?_

---

_Part of the **AI Security Benchmark Series** — the same lint-the-output methodology, applied across vendors and frameworks. The corpus benchmark data referenced above:_

**→ Related (the AI angle):** [We Ranked 5 AI Models by Security — the database domain, in detail](https://ofriperetz.dev/articles/we-ranked-5-ai-models-by-security-the-leaderboard-is-wrong) · [Same NestJS prompt: Claude got 6 security errors, Gemini got 2](https://ofriperetz.dev/articles/claude-vs-gemini-nestjs-security-same-prompt-different-errors) · [Aggregate benchmarks lie — 700 AI functions by security domain](https://ofriperetz.dev/articles/aggregate-benchmarks-lie-heres-what-700-ai-functions-look-like-by-security-domain)

**→ Related (the pg layer):** [Your node-postgres Data Layer Fails 4 Ways in Production — SQL injection is only the first](https://ofriperetz.dev/articles/sql-injection-node-postgres-pattern) · [node-postgres will happily build a CVSS 9.8 SQL injection for you — 13 ESLint rules say no](https://ofriperetz.dev/articles/getting-started-eslint-plugin-pg) · [30 minutes of ESLint found 26 critical bugs in an inherited codebase](https://ofriperetz.dev/articles/the-30-minute-security-audit-onboarding-a-new-codebase)

---

### Get `eslint-plugin-pg`

[![npm version](https://img.shields.io/npm/v/eslint-plugin-pg.svg?label=eslint-plugin-pg)](https://www.npmjs.com/package/eslint-plugin-pg) [![npm downloads](https://img.shields.io/npm/dm/eslint-plugin-pg.svg)](https://www.npmjs.com/package/eslint-plugin-pg)

Drop the three-pattern guard into any pg project in under two minutes:

```bash
npm install eslint-plugin-pg --save-dev
```

```javascript
// eslint.config.mjs — minimal: just the SQL-injection rule
import pg from "eslint-plugin-pg";

export default [
  { plugins: { pg }, rules: { "pg/no-unsafe-query": "error" } },
];

// …or take the whole pg floor (no-select-all, prefer-pool-query,
// no-hardcoded-credentials, +more) in one line:
// rules: { ...pg.configs.recommended.rules }
```

**[📦 npm](https://www.npmjs.com/package/eslint-plugin-pg)** · **[📖 Rule docs](https://eslint.interlace.tools/docs/security/plugin-pg/rules/no-unsafe-query)** · **[⭐ Star on GitHub](https://github.com/ofri-peretz/eslint)** · **[Follow the series on Dev.to](https://dev.to/ofri-peretz)**

If `pg/no-unsafe-query` catches a line in your codebase — human-written or AI-generated — I want to hear which of the three patterns it was. Drop it in the comments.
