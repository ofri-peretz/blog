---
title: "Same File: eslint-plugin-security Caught 21, the Domain Plugins Caught 46. It's a Floor, Not a Ceiling."
description: "eslint-plugin-security is the foundational, actively-maintained Node security linter — 14 rules, 2.4M+ weekly downloads. On one fixture of 12 vulnerability classes it caught 21 issues and the domain plugins caught 46. Here's the 25-finding gap, why AI-generated code lives in it, and how to layer both."
slug: "eslint-plugin-security-is-unmaintained-heres-what-nobody-tells-you-96h"
canonical_url: "https://ofriperetz.dev/articles/eslint-plugin-security-is-unmaintained-heres-what-nobody-tells-you-96h"
devto_url: "https://dev.to/ofri-peretz/eslint-plugin-security-is-unmaintained-heres-what-nobody-tells-you-96h"
devto_id: 3237157
published_at: "2026-02-06T06:40:05Z"
edited_at: "2026-02-06T06:54:40Z"
cover_image: "https://ofriperetz.dev/og/cover/eslint-plugin-security-is-unmaintained-heres-what-nobody-tells-you-96h"
social_image: "https://ofriperetz.dev/og/article/eslint-plugin-security-is-unmaintained-heres-what-nobody-tells-you-96h"
reading_time_minutes: 8
tags:
  - "security"
  - "node"
  - "ai"
  - "eslint"
author:
  name: "Ofri Peretz"
  username: "ofri-peretz"
  avatar: "https://media2.dev.to/dynamic/image/width=640,height=640,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Fuser%2Fprofile_image%2F3669992%2F50a1f256-472c-48a1-85e8-149459647ea7.png"
  twitter: "ofriperetzdev"
series: "ESLint Security Benchmark Series"
---

I ran two security linters over the same file — a fixture with 12 deliberate
vulnerability classes. `eslint-plugin-security`, the incumbent with **2.4M+
weekly downloads**, caught **21** issues. The domain plugins caught **46**. Same
file, same engine, same run.

The 25 it missed weren't exotic. A SQL injection built by string-concatenating a
query. An unsafe `deserialize()` on attacker-controlled input. `Math.random()`
generating a token that's supposed to be unguessable. The kind of finding that
ends up in an incident channel, not a linter warning.

This is not a teardown. `eslint-plugin-security` is actively maintained — 4.0.0
shipped February 2026, adding `detect-bidi-characters` for Trojan-Source attacks
— and its **14 rules** are the right baseline for every Node project. The honest
framing is narrower and more useful: 14 _generic_ rules are a **floor, not a
ceiling**. They catch the cross-cutting classics. They have no rule for the depth
of SQL, JWT, crypto, or AI-agent security — and, as I'll show, that gap is
exactly where AI-generated code now lands. Here's what the floor covers, the
25-finding hole, and how to run both.

> **ESLint Security Benchmark Series** · [← Prev: I Let Claude Write 80 Functions. 65–75% Had Security Vulnerabilities.](https://ofriperetz.dev/articles/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities) · **You are here: The 21-vs-46 Floor** · [Next: The AI Hydra Problem — Fix One AI Bug, Get Two More →](https://ofriperetz.dev/articles/the-ai-hydra-problem-fix-one-ai-bug-get-two-more)

## What the 14 rules cover (the generic floor)

`detect-child-process`, `detect-eval-with-expression`, `detect-non-literal-require`,
`detect-non-literal-fs-filename`, `detect-non-literal-regexp`,
`detect-unsafe-regex`, `detect-object-injection`, `detect-possible-timing-attacks`,
`detect-pseudoRandomBytes`, `detect-buffer-noassert`, `detect-new-buffer`,
`detect-disable-mustache-escape`, `detect-no-csrf-before-method-override`,
`detect-bidi-characters`.

These are real, valuable, language-level checks — command injection, eval, unsafe
regex, the object-injection sink, timing comparisons. Every Node app benefits.

## What a generic floor can't reach

The 21-vs-46 gap is **domain depth a generic ruleset has no rule for**. The
fixture and both runs are in [the 4-way benchmark](https://ofriperetz.dev/articles/your-eslint-security-plugin-is-missing-80-of-vulnerabilities-i-have-proof)
— team-authored `vulnerable.js`, 12 classes, reproducible — so you can re-run it
rather than take the number on faith. Here's where the 25 missing findings live:

| Domain              | What's missing from a generic linter              | The layer that adds it                                                                                                  |
| ------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **PostgreSQL**      | SQL injection, connection leaks, COPY exploits    | [`eslint-plugin-pg`](https://eslint.interlace.tools/docs/security/plugin-pg) (13 rules)                                 |
| **JWT / auth**      | `alg:none`, algorithm confusion, claim validation | [`eslint-plugin-jwt`](https://eslint.interlace.tools/docs/security/plugin-jwt) (13 rules)                               |
| **Crypto & system** | weak hashes, ECB/static-IV, SSRF, zip-slip        | [`eslint-plugin-node-security`](https://eslint.interlace.tools/docs/security/plugin-node-security) (35 rules)           |
| **Browser / DOM**   | CSP, CORS, `innerHTML`, JWT-in-storage            | [`eslint-plugin-browser-security`](https://eslint.interlace.tools/docs/security/plugin-browser-security) (45 rules)     |
| **AI / LLM**        | prompt injection, tool-call agency                | [`eslint-plugin-vercel-ai-security`](https://eslint.interlace.tools/docs/security/plugin-vercel-ai-security) (19 rules) |

There's also a **precision** difference: on validated-safe code,
`eslint-plugin-security` produced 5 false positives in that benchmark
(`detect-object-injection` on allowlist-validated keys, `detect-non-literal-fs-filename`
on path-validated reads) — it pattern-matches the sink without seeing the guard.
The domain rules carry CWE/OWASP/CVSS metadata and AST-aware validation detection.

### Why the real injection survives code review

This is the part that bites in production, and it's a process failure, not a tool
bug. `detect-object-injection` fires on `obj[key]` _even after_
`VALID_KEYS.includes(key)`. A reviewer sees the warning on obviously-safe code,
confirms the guard is right there, and reaches for the fastest fix that makes the
diff green: a file-level `/* eslint-disable security/detect-object-injection */`.
Now the rule is off for the whole file. Three months later someone adds a
genuinely unvalidated `obj[req.query.field]` two functions down — and the rule
that would have caught it is the one your own team disabled to clear a false
positive. The noisy generic rule didn't just miss the bug; it _trained the team_
to suppress the signal that would have flagged it. AST-aware validation detection
matters precisely because it keeps the rule quiet on the guarded case, so nobody
ever reaches for the blanket disable.

Want the 25-finding gap measured on _your_ repo, not a fixture? It's one install
on top of the floor you already have — [full layering config is below](#the-layering-pattern):

```bash
npm install --save-dev eslint-plugin-secure-coding eslint-plugin-node-security eslint-plugin-pg eslint-plugin-jwt eslint-plugin-browser-security eslint-plugin-vercel-ai-security
```

## Where AI-generated code lands

Here's why this stopped being academic for me. The 25-finding gap isn't a corner
case anymore — it's the exact shape of the code your team is now generating with
an assistant.

**The failure:** I gave Claude a single prompt — "build a NestJS users service" —
and got 200 lines that compiled clean, passed the generic floor, and would have
sailed through review on a busy afternoon. **The consequence:** it
[shipped six security holes](https://ofriperetz.dev/articles/claude-wrote-nestjs-service-eslint-found-6-security-holes)
— `password` in every response body, an admin endpoint with no auth guard, a
login route with no rate limit. None of those have a rule in the generic floor,
because a generic linter pattern-matches sinks and an AI assistant doesn't write
the obvious sink — it writes code that _looks_ reviewed and omits the guard.
**Why it survived:** the same reason the Gemini-Pro database code survives in the
sibling benchmark — production-shaped code earns trust it hasn't proven. The
service had DTOs, decorators, a clean module structure; every signal a reviewer
is trained to read as "this person knows what they're doing." The missing auth
guard hid behind competent scaffolding.

And it's not one model. Across a
[700-function benchmark on 5 models](https://ofriperetz.dev/articles/aggregate-benchmarks-lie-heres-what-700-ai-functions-look-like-by-security-domain),
Claude's vulnerability rate ran **65–75%** — and the failure _classes_ (missing
authorization, missing validation, leaked secrets) are consistent across models.

Gemini is the same story with a different worst-domain. In that 5-model run,
**Gemini 2.5 Flash generated vulnerable PostgreSQL code 75% of the time** — same
per-domain rate as Claude's database number — yet wrote JWT-creation code
_perfectly_ (`0/7` on `generateJWT`, never leaking the payload). Aggregate
"which model is safest" misses this entirely: every model has a domain where it's
a coin-flip, and a generic floor has no rule for any of them. If you want to turn
this into a [Build with Gemini XPRIZE](https://dev.to/challenges) entry rather
than just read it, the adaptation path is concrete: run the same team-authored
`vulnerable.js` fixture against `gemini-2.5-flash` (the benchmark already ships
the `gemini -p --model gemini-2.5-flash` harness), lint the output with the
domain layers below, and publish the per-domain gap with `#googleai`
`#geminichallenge`. The methodology doesn't change — only the model under test
and two tags do.

It gets worse when you ask the model to fix what you found. Re-prompting an LLM
to remediate a vulnerability — without a deterministic linter in the loop —
introduces _new_ vulnerability categories at [4× the rate](https://ofriperetz.dev/articles/the-ai-hydra-problem-fix-one-ai-bug-get-two-more):
cut one head, two grow back. The generic floor can't break that loop because it
has no rule for most of what the model gets wrong. A domain ruleset that knows
JWT, SQL, and serialization contracts is the deterministic gate that stops the
regenerate-and-pray cycle. Same `npm install`, run on the AI output before it
reaches review.

## The layering pattern

You don't have to choose. Keep the generic floor for the classics, add domain
plugins where your stack needs depth:

```js
// eslint.config.mjs — `configs` is a NAMED export on the Interlace plugins
import security from "eslint-plugin-security";
import { configs as secureCoding } from "eslint-plugin-secure-coding";
import { configs as nodeSecurity } from "eslint-plugin-node-security";
import { configs as pg } from "eslint-plugin-pg";
import { configs as jwt } from "eslint-plugin-jwt";
import { configs as browserSecurity } from "eslint-plugin-browser-security";
import { configs as vercelAiSecurity } from "eslint-plugin-vercel-ai-security";

export default [
  security.configs.recommended, // your existing eslint-plugin-security — the generic floor (14 rules)
  secureCoding.recommended, // general OWASP source patterns
  nodeSecurity.recommended, // crypto, supply-chain, SSRF
  { files: ["**/db/**"], ...pg.recommended }, // PostgreSQL depth
  jwt.recommended, // auth depth
  { files: ["**/*.{tsx,jsx}", "**/client/**"], ...browserSecurity.recommended }, // DOM/CSP, scoped to front-end
  { files: ["**/ai/**", "**/agents/**"], ...vercelAiSecurity.recommended }, // LLM tool-call / prompt-injection
];
```

This keeps your already-installed `eslint-plugin-security` as the floor and adds
the domain layers from the `npm install` above. If you'd rather consolidate the
general layer onto one OWASP-mapped package, `eslint-plugin-secure-coding`
(28 rules) is a drop-in replacement for the generic source patterns.

## Where OWASP fits

For the full picture of which OWASP Top 10 categories static analysis genuinely
covers — and the two it honestly can't — see
[the OWASP Top 10 mapping](https://ofriperetz.dev/articles/mapping-your-codebase-to-owasp-top-10-with-247-eslint-rules)
(it's 8 of 10, not "100%"). The point isn't a coverage scoreboard; it's matching
rule depth to your stack's real attack surface.

## A note on the incumbent

`eslint-plugin-security` pioneered JavaScript security linting and is still the
right baseline — 2.4M downloads, an `eslint-community`-maintained project that
shipped a major version in 2026. This isn't a teardown; it's the case for
**layering domain depth on a solid floor**. Keep the floor. Add the rules for the
attack surface your stack actually has.

(One honesty note on the URL: the slug on this article says "unmaintained." That
was my original take and it was wrong — the plugin ships major versions. I left
the slug so the link doesn't break, but the title and the argument above are the
corrected version.)

This is part of my [ESLint Security Benchmark Series](https://ofriperetz.dev/articles/benchmark-17-eslint-security-plugins-compared),
where I run the same fixtures and AI prompts across the whole landscape of
security linters and publish the numbers.

One question, because I think the answer is universal: **go grep your codebase
for `eslint-disable security/`.** How many of those disables sit on genuinely
unvalidated code that someone silenced to clear a false positive — and how long
has it been there? That's the gap, and I'd bet you have one. Tell me what you
found.

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

- 📦 [eslint-plugin-secure-coding](https://www.npmjs.com/package/eslint-plugin-secure-coding) · [node-security](https://www.npmjs.com/package/eslint-plugin-node-security) · [pg](https://www.npmjs.com/package/eslint-plugin-pg) · [jwt](https://www.npmjs.com/package/eslint-plugin-jwt) · [browser-security](https://www.npmjs.com/package/eslint-plugin-browser-security) · [vercel-ai-security](https://www.npmjs.com/package/eslint-plugin-vercel-ai-security)
- 📦 [eslint-plugin-security](https://www.npmjs.com/package/eslint-plugin-security) — the generic floor
- 📖 [Full rule docs](https://eslint.interlace.tools)
- 💻 [Source on GitHub](https://github.com/ofri-peretz/eslint)

::dev-to-cta{url="https://github.com/ofri-peretz/eslint"}
⭐ Star on GitHub if your team ships AI-generated code and a generic floor isn't catching it.
::

---

I'm **Ofri Peretz**, a security engineering leader and the author of the
Interlace ESLint ecosystem — domain-specific static analysis for security,
reliability, and performance on the Node.js stack.

[ofriperetz.dev](https://ofriperetz.dev) · [LinkedIn](https://linkedin.com/in/ofri-peretz) · [GitHub](https://github.com/ofri-peretz)
