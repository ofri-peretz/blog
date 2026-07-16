---
title: "eslint-plugin-security Caught 21 Issues. The Domain Plugins Caught 46. Here's the 25-Finding Gap."
description: "eslint-plugin-security is the foundational, actively-maintained Node security linter — 14 rules, 2.4M+ weekly downloads. On one fixture of 12 vulnerability classes it caught 21 issues and the domain plugins caught 46. Here's the 25-finding gap, why AI-generated code lives in it, and how to layer both."
slug: "eslint-plugin-security-is-unmaintained-heres-what-nobody-tells-you-96h"
canonical_url: "https://ofriperetz.dev/articles/eslint-plugin-security-is-unmaintained-heres-what-nobody-tells-you-96h"
devto_url: "https://dev.to/ofri-peretz/eslint-plugin-security-is-unmaintained-heres-what-nobody-tells-you-96h"
devto_id: 3237157
published_at: "2026-02-06T06:40:05Z"
edited_at: "2026-02-06T06:54:40Z"
cover_image: "https://ofriperetz.dev/og/cover/eslint-plugin-security-is-unmaintained-heres-what-nobody-tells-you-96h"
social_image: "https://ofriperetz.dev/og/article/eslint-plugin-security-is-unmaintained-heres-what-nobody-tells-you-96h"
reading_time_minutes: 9
tags:
  - "security"
  - "node"
  - "devsecops"
  - "javascript"
author:
  name: "Ofri Peretz"
  username: "ofri-peretz"
  avatar: "https://media2.dev.to/dynamic/image/width=640,height=640,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Fuser%2Fprofile_image%2F3669992%2F50a1f256-472c-48a1-85e8-149459647ea7.png"
  twitter: "ofriperetzdev"
series: "ESLint Security Benchmark Series"
---

The SQL injection that paged us at 2am had passed `eslint-plugin-security` clean. The query was `SELECT * FROM users WHERE id = ` + `req.params.id` — string concatenation three functions deep in a route handler. It went through code review. It went through CI. The PR was approved by two engineers who both saw the linter pass. Eighteen months later, an attacker used a `UNION SELECT` to dump the sessions table.

The linter didn't miss this because it was broken. It missed it because it has no rule for SQL injection. It never did. **That's the gap nobody states plainly.**

I ran the same fixture — 12 deliberate vulnerability classes, one JavaScript file — through `eslint-plugin-security` and through the domain plugins I've benchmarked. The incumbent with **2.4M+ weekly downloads** caught **21** issues. The domain plugins caught **46**. Same file, same engine, same run.

> "The noisy generic rule didn't just miss the bug — it trained the team to suppress the signal that would have flagged it."

The 25 missing findings weren't exotic. A SQL injection built by concatenating `req.query.field` directly into a query string. An unsafe `deserialize()` on attacker-controlled input. `Math.random()` generating a token that was supposed to be unguessable. The kind of finding that ends up in an incident channel, not a linter warning.

This is not a teardown. `eslint-plugin-security` is actively maintained — 4.0.0 shipped February 2026, adding `detect-bidi-characters` for Trojan-Source attacks — and its **14 rules** are the right baseline for every Node project. The honest framing is narrower and more useful: 14 _generic_ rules are a **floor, not a ceiling**. They catch the cross-cutting classics. They have no rule for the depth of SQL, JWT, crypto, or AI-agent security — and, as I'll show, that gap is exactly where AI-generated code now lands. Here's what the floor covers, the 25-finding hole, and how to run both.

> **ESLint Security Benchmark Series** · [← Prev: I Let Claude Write 80 Functions. 65–75% Had Security Vulnerabilities.](https://ofriperetz.dev/articles/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities) · **You are here: The 21-vs-46 Floor** · [Next: The AI Hydra Problem — Fix One AI Bug, Get Two More →](https://ofriperetz.dev/articles/the-ai-hydra-problem)

## What the 14 rules cover (the generic floor)

`detect-child-process`, `detect-eval-with-expression`, `detect-non-literal-require`,
`detect-non-literal-fs-filename`, `detect-non-literal-regexp`,
`detect-unsafe-regex`, `detect-object-injection`, `detect-possible-timing-attacks`,
`detect-pseudoRandomBytes`, `detect-buffer-noassert`, `detect-new-buffer`,
`detect-disable-mustache-escape`, `detect-no-csrf-before-method-override`,
`detect-bidi-characters`.

These are real, valuable, language-level checks — command injection, eval, unsafe regex, the object-injection sink, timing comparisons. Every Node app benefits.

## What a generic floor can't reach — with code

The 21-vs-46 gap is **domain depth a generic ruleset has no rule for**. The fixture and both runs are in [the 4-way benchmark](https://ofriperetz.dev/articles/your-eslint-security-plugin-is-missing-80-of-vulnerabilities-i-have-proof) — team-authored `vulnerable.js`, 12 classes, reproducible — so you can re-run it rather than take the number on faith.

Here's what each gap archetype looks like as actual code.

### Archetype 1: SQL injection (the gap that paged us)

```js
// Vulnerable — eslint-plugin-security: no warning
app.get('/users/:id', async (req, res) => {
  const query = 'SELECT * FROM users WHERE id = ' + req.params.id;
  const result = await pool.query(query);  // string-concatenated, attacker-controlled
  res.json(result.rows);
});
```

`eslint-plugin-security` has no rule for SQL injection — it pattern-matches dangerous Node.js APIs (eval, child_process, non-literal require) but SQL is ORM/driver-specific. `eslint-plugin-pg` catches this with `no-string-concatenation` and flags the line with a `CWE-89` annotation.

The fix:

```js
// Safe — parameterized query
app.get('/users/:id', async (req, res) => {
  const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
  res.json(result.rows);
});
```

### Archetype 2: JWT `alg:none` that read as defensive

```js
// Vulnerable — eslint-plugin-security: no warning
function verifyToken(token) {
  // Developer was being careful — pinned the algorithm list explicitly
  return jwt.verify(token, process.env.JWT_SECRET, {
    algorithms: ['HS256', 'none']  // 'none' means: accept unsigned tokens
  });
}
```

The author had _added_ that options object on purpose. The reviewer saw an explicit `algorithms` array, read it as the secure-by-default pattern, and approved it. Nobody noticed that `'none'` in that list tells the library to accept an **unsigned** token. An attacker sets the header to `{"alg":"none"}`, drops the signature, and `verify` returns the forged payload as valid. `eslint-plugin-security` has no rule here — there is no dangerous sink, no `eval`. `eslint-plugin-jwt` flags `algorithms` arrays that include `'none'` with `jwt/no-algorithm-none`.

```js
// Safe
return jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
```

### Archetype 3: `Math.random()` for security tokens

```js
// Vulnerable — eslint-plugin-security: no warning
function generateSessionToken() {
  return Math.random().toString(36).slice(2);  // predictable, not cryptographic
}
```

`detect-pseudoRandomBytes` fires on `crypto.pseudoRandomBytes()` — a deprecated Node.js method — but not on `Math.random()`. A generic linter has no rule mapping `Math.random()` usage context to security-sensitive code paths. `eslint-plugin-node-security` catches this with `no-math-random-for-security` when the result is used in auth, token, or session contexts.

```js
// Safe
function generateSessionToken() {
  return require('crypto').randomBytes(32).toString('hex');
}
```

### The 25-finding gap by domain

| Domain              | Missing findings | What's missing from a generic linter              | The layer that adds it                                                                                                  |
| ------------------- | :--------------: | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **PostgreSQL**      | ~12              | SQL injection, connection leaks, COPY exploits    | [`eslint-plugin-pg`](https://eslint.interlace.tools/docs/security/plugin-pg) (13 rules)                                 |
| **JWT / auth**      | ~6               | `alg:none`, algorithm confusion, claim validation | [`eslint-plugin-jwt`](https://eslint.interlace.tools/docs/security/plugin-jwt) (13 rules)                               |
| **Crypto & system** | ~5               | weak hashes, ECB/static-IV, SSRF, zip-slip        | [`eslint-plugin-node-security`](https://eslint.interlace.tools/docs/security/plugin-node-security) (35 rules)           |
| **Browser / DOM**   | ~2               | CSP, CORS, `innerHTML`, JWT-in-storage            | [`eslint-plugin-browser-security`](https://eslint.interlace.tools/docs/security/plugin-browser-security) (45 rules)     |
| **AI / LLM**        | ~0 in fixture    | prompt injection, tool-call agency                | [`eslint-plugin-vercel-ai-security`](https://eslint.interlace.tools/docs/security/plugin-vercel-ai-security) (19 rules) |

There's also a **precision** difference: on validated-safe code, `eslint-plugin-security` produced 5 false positives in that benchmark (`detect-object-injection` on allowlist-validated keys, `detect-non-literal-fs-filename` on path-validated reads) — it pattern-matches the sink without seeing the guard.

### Why the real injection survives code review

This is the part that bites in production, and it's a process failure, not a tool bug. `detect-object-injection` fires on `obj[key]` _even after_ `VALID_KEYS.includes(key)`. A reviewer sees the warning on obviously-safe code, confirms the guard is right there, and reaches for the fastest fix that makes the diff green: a file-level `/* eslint-disable security/detect-object-injection */`. Now the rule is off for the whole file. Three months later someone adds a genuinely unvalidated `obj[req.query.field]` two functions down — and the rule that would have caught it is the one your own team disabled to clear a false positive.

**Why teams don't notice**: The blanket disable was added by an engineer who's since left. The file grew. Nobody associates the current `obj[req.query.field]` with a disable comment they didn't write, three hundred lines up. The cognitive gap is time + distance + attribution. That's how it stays hidden.

The noisy generic rule didn't just miss the bug; it _trained the team_ to suppress the signal that would have flagged it. AST-aware validation detection matters precisely because it keeps the rule quiet on the guarded case, so nobody ever reaches for the blanket disable.

### Why the JWT `none` attack survives code review

**Why teams don't notice**: The `algorithms` option looks _more_ careful than the insecure default. Reviewers are trained to reward explicit configuration. When the vulnerable pattern is "developer was being extra careful," the code review process is actively misled. There's no process heuristic that catches "your explicit allowlist includes the bypass value" — only a rule that knows the JWT spec can.

### Why `Math.random()` tokens survive code review

**Why teams don't notice**: `Math.random()` is a standard library function with no warning label. It's not deprecated. It passes all linters that don't have domain-specific session-token rules. The only way to catch it is a rule that reasons about context (is this result used as a security token?) rather than just flagging the call site. Most teams don't know to grep for it until an audit.

---

If you want the 25-finding gap measured on _your_ repo, not a fixture, [the 30-minute security audit protocol](https://dev.to/ofri-peretz/the-30-minute-security-audit-onboarding-a-new-codebase-4f91) walks through exactly this layering process as a first-day onboarding step.

## What to do TODAY if you're using eslint-plugin-security

Here's the concrete migration path:

**Step 1: Audit your existing suppression debt**

```bash
# Find all security/ suppression comments and when they were introduced
git log -S 'eslint-disable security/' --format='%ad %s' --date=short -- .

# List every active suppression in your codebase
grep -rn 'eslint-disable.*security/' \
  --include='*.js' --include='*.ts' --include='*.jsx' --include='*.tsx' .
```

Review every result. For each `detect-object-injection` disable: confirm the code under it still has a guard. If you can't prove it does, treat it as unreviewed.

**Step 2: Install the domain layers**

```bash
npm install --save-dev \
  eslint-plugin-node-security \
  eslint-plugin-pg \
  eslint-plugin-jwt \
  eslint-plugin-browser-security \
  eslint-plugin-vercel-ai-security
```

**Step 3: Add the config** (keep your existing `eslint-plugin-security` — this layers on top)

```js
// eslint.config.mjs
import security from "eslint-plugin-security";
import { configs as nodeSecurity } from "eslint-plugin-node-security";
import { configs as pg } from "eslint-plugin-pg";
import { configs as jwt } from "eslint-plugin-jwt";
import { configs as browserSecurity } from "eslint-plugin-browser-security";
import { configs as vercelAiSecurity } from "eslint-plugin-vercel-ai-security";

export default [
  security.configs.recommended,           // your existing floor (14 rules)
  nodeSecurity.recommended,               // crypto, supply-chain, SSRF
  { files: ["**/db/**"], ...pg.recommended },              // SQL depth
  jwt.recommended,                        // auth depth
  { files: ["**/*.{tsx,jsx}", "**/client/**"], ...browserSecurity.recommended }, // DOM/CSP
  { files: ["**/ai/**", "**/agents/**"], ...vercelAiSecurity.recommended },      // LLM
];
```

**Step 4: Triage the new findings**

The first run on an existing codebase will produce findings. Don't bulk-suppress. Triage them with CWE metadata: the domain rules carry `CWE-89`, `CWE-327`, `CWE-338` annotations on every finding, which tells you the exploitability class before you decide whether to fix or accept-risk.

A full comparison of how these plugins rank against each other is in the [benchmark of 17 ESLint security plugins](https://dev.to/ofri-peretz/i-benchmarked-17-eslint-security-plugins-only-one-found-every-vulnerability-c83).

## Where AI-generated code lands

Here's why this stopped being academic for me. The 25-finding gap isn't a corner case anymore — it's the exact shape of the code your team is now generating with an assistant.

I gave Claude a single prompt — "build a NestJS users service" — and got 200 lines that compiled clean, passed the generic floor, and would have sailed through review on a busy afternoon. It [shipped six security holes](https://ofriperetz.dev/articles/i-inherited-a-nestjs-codebase-the-first-lint-run-found-6-vulnerabilities) — `password` in every response body, an admin endpoint with no auth guard, a login route with no rate limit. None of those have a rule in the generic floor, because a generic linter pattern-matches sinks and an AI assistant doesn't write the obvious sink — it writes code that _looks_ reviewed and omits the guard.

**Why it survives**: The service had DTOs, decorators, a clean module structure — every signal a reviewer is trained to read as "this person knows what they're doing." The missing auth guard hid behind competent scaffolding.

Across a [700-function benchmark on 5 models](https://ofriperetz.dev/articles/aggregate-benchmarks-lie-heres-what-700-ai-functions-look-like-by-security-domain), Claude's vulnerability rate ran **65–75%** — and the failure _classes_ (missing authorization, missing validation, leaked secrets) are consistent across models. Gemini 2.5 Flash generated vulnerable PostgreSQL code 75% of the time in that run, yet wrote JWT creation code perfectly (`0/7` on `generateJWT`). Aggregate "which model is safest" misses this entirely: every model has a domain where it's a coin-flip, and a generic floor has no rule for any of them.

It gets worse when you ask the model to fix what you found. Re-prompting an LLM to remediate a vulnerability — without a deterministic linter in the loop — introduces _new_ vulnerability categories at [4× the rate](https://ofriperetz.dev/articles/the-ai-hydra-problem): cut one head, two grow back. A domain ruleset that knows JWT, SQL, and serialization contracts is the deterministic gate that stops the regenerate-and-pray cycle.

## Where OWASP fits

For the full picture of which OWASP Top 10 categories static analysis genuinely covers — and the two it honestly can't — see [the OWASP Top 10 mapping](https://ofriperetz.dev/articles/mapping-your-codebase-to-owasp-top-10-with-247-eslint-rules) (it's 8 of 10, not "100%"). The point isn't a coverage scoreboard; it's matching rule depth to your stack's real attack surface.

## A note on the incumbent

`eslint-plugin-security` pioneered JavaScript security linting and is still the right baseline — 2.4M downloads, an `eslint-community`-maintained project that shipped a major version in 2026. This isn't a teardown; it's the case for **layering domain depth on a solid floor**. Keep the floor. Add the rules for the attack surface your stack actually has.

This is part of my [ESLint Security Benchmark Series](https://ofriperetz.dev/articles/your-eslint-security-plugin-is-missing-80-of-vulnerabilities-i-have-proof), where I run the same fixtures and AI prompts across the whole landscape of security linters and publish the numbers. The full rule docs for all domain plugins are at [eslint.interlace.tools](https://eslint.interlace.tools).

---

If `eslint-plugin-security` fired on your codebase today, would your team know which findings are actually exploitable and which are noise — and more importantly, would they know which real vulnerabilities it's silently passing?

Run this to find out:

```bash
# Find when the first security/ suppression was introduced
git log -S 'eslint-disable security/' --format='%ad %s' --date=short -- . | tail -1

# List every active suppression
grep -rn 'eslint-disable.*security/' \
  --include='*.js' --include='*.ts' --include='*.jsx' --include='*.tsx' .
```

**Reply with the date of your oldest `eslint-disable security/` and which rule it silenced.** I'd bet it's `detect-object-injection`, it's older than the engineer who added it remembers, and nobody has checked whether the code under it is still guarded. Mine was 2 years and 9 months old. What's yours?

---

## Compatibility

The domain layers ship the same contract:

| Surface              | Support                                                                |
| -------------------- | ---------------------------------------------------------------------- |
| **Package managers** | npm, yarn, pnpm, bun                                                   |
| **Node**             | `>= 18.0.0`                                                            |
| **ESLint**           | `^8.0.0 \|\| ^9.0.0 \|\| ^10.0.0`, flat config                         |
| **Module system**    | Plugins ship CommonJS; your config can be `eslint.config.js` or `.mjs` |
| **Oxlint**           | flagship rules run via the `interlace-*` ports, parity-gated in CI     |

---

## Links

- 📦 [eslint-plugin-node-security](https://www.npmjs.com/package/eslint-plugin-node-security) · [pg](https://www.npmjs.com/package/eslint-plugin-pg) · [jwt](https://www.npmjs.com/package/eslint-plugin-jwt) · [browser-security](https://www.npmjs.com/package/eslint-plugin-browser-security) · [vercel-ai-security](https://www.npmjs.com/package/eslint-plugin-vercel-ai-security)
- 📦 [eslint-plugin-security](https://www.npmjs.com/package/eslint-plugin-security) — the generic floor
- 📖 [Full rule docs](https://eslint.interlace.tools)
- 💻 [Source on GitHub](https://github.com/ofri-peretz/eslint)

::dev-to-cta{url="https://github.com/ofri-peretz/eslint"}
⭐ Star on GitHub if your team ships AI-generated code and a generic floor isn't catching it.
::

---

*Part of the [Interlace ESLint ecosystem](https://eslint.interlace.tools). Source on [GitHub](https://github.com/ofri-peretz/eslint) · Follow: [Dev.to/ofri-peretz](https://dev.to/ofri-peretz)*
