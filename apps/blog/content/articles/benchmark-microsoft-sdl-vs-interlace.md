---
devto_url: "https://dev.to/ofri-peretz/microsofts-eslint-security-plugin-catches-10-of-vulnerabilities-heres-what-it-misses-5gii"
devto_id: 3240750
title: "Microsoft's SDL ESLint Plugin Caught 3 Node Vulns. The Domain Plugins Caught 46 — Same File, Wrong Layer"
description: "A reproducible benchmark: @microsoft/eslint-plugin-sdl (17 rules, Angular/Electron/browser-focused) vs the Interlace security plugins, on one Node fixture. SDL is a frontend-hardening tool — which is exactly why it's the wrong layer for a Node backend, and exactly the gap your AI assistant ships into."
slug: "benchmark-microsoft-sdl-vs-interlace"
published: true
date: 2026-02-08
cover_image: "https://ofriperetz.dev/og/cover/benchmark-microsoft-sdl-vs-interlace"
social_image: "https://ofriperetz.dev/og/article/benchmark-microsoft-sdl-vs-interlace"
tags:
  - security
  - node
  - ai
  - eslint
series: "ESLint Security Benchmark Series"
canonical_url: https://ofriperetz.dev/articles/benchmark-microsoft-sdl-vs-interlace
reading_time_minutes: 7
author:
  name: Ofri Peretz
  avatar: https://avatars.githubusercontent.com/u/46347627
  title: Security Engineering Leader
---

On one Node file with 12 vulnerability classes, `@microsoft/eslint-plugin-sdl`
caught **3**. The domain plugins caught **46** — same file. And you'd already
told the team the backend was covered by Microsoft's Security Development
Lifecycle, because the build went green. Your SQL injection, your path traversal,
your unsafe deserialization — all of it walked straight past the linter you
trusted, and the pipeline never went red to warn you.

That gap isn't a quality verdict, and it isn't Microsoft shipping a bad tool.
`@microsoft/eslint-plugin-sdl` is 17 rules distilled from the SDL standard, and
it's a *good* tool — for the surface it was built for. The gap is a **layer**
mismatch. Look at the rule list and the result is obvious: SDL was built to
harden **frontends** (Angular, Electron, the DOM), not Node backends. Point it
at an API and most of its rules have nothing to match.

> Part of the [ESLint Security Benchmark Series](https://ofriperetz.dev/articles/benchmark-17-eslint-security-plugins-compared) —
> same fixture, same method, one tool per post. Companion piece:
> [SonarJS has 269 rules and found 13 where the domain plugins found 46](https://ofriperetz.dev/articles/benchmark-sonarjs-vs-interlace).

## What SDL's 17 rules actually target

```text
no-angular-bypass-sanitizer        no-angularjs-bypass-sce
no-angular-sanitization-trusted-urls   no-angularjs-enable-svg
no-angularjs-sanitization-whitelist    no-electron-node-integration
no-inner-html      no-html-method     no-document-write    no-document-domain
no-cookies         no-insecure-url    no-insecure-random   no-unsafe-alloc
no-msapp-exec-unsafe   no-postmessage-star-origin   no-winjs-html-unsafe
```

Five are Angular/AngularJS-specific, one is Electron, two are WinJS/MSApp,
several are DOM/browser (`innerHTML`, `document.write`, `postMessage`,
cookies). That's a **frontend / MS-stack** security surface — and a good one for
that surface.

## Detection — `vulnerable.js` (12 Node vulnerability classes)

| Config                               | Engine | Security findings |
| ------------------------------------ | ------ | ----------------- |
| Oxlint built-in                      | Oxlint | 1                 |
| **@microsoft/eslint-plugin-sdl**     | ESLint | **3**             |
| Interlace flagship rules             | Oxlint | 5                 |
| eslint-plugin-security (recommended) | ESLint | 21                |
| Interlace (4 plugins, recommended)   | ESLint | 46                |

SDL's 3 came from the only rules that fit a backend file: `no-inner-html`,
`no-document-write`, and `no-cookies`. Its Angular, Electron, and WinJS rules had
nothing to match — there's no Angular in a Node API.

> **A robustness note, stated plainly.** Three SDL rules (`no-insecure-random`,
> `no-insecure-url`, `no-unsafe-alloc`) **threw** on the fixture's dynamic
> `require(variable)` — a `path.basename(undefined)` inside the rule. They're
> written around browser/Angular call shapes, not Node's dynamic module loading.
> It's a fair reminder that a linter only hardens the surface it was built for.

## What a Node backend needs instead

The 43 findings SDL has no rule for (46 total minus the 3 it caught) are the
Node backend surface: SQL injection, `fs` path traversal, object injection /
prototype-pollution, unsafe deserialization, ReDoS, weak hashing, insecure
comparisons. None are in SDL's scope.

That "43" isn't an estimate — it's the actual `ruleId` output. Here's the full
list from the Interlace run (`--format json`, counted by `ruleId`), grouped by
class, so you can diff it against your own:

<details>
<summary><strong>The 46 Interlace findings on <code>vulnerable.js</code>, by rule ID</strong> (43 of these classes have no SDL rule)</summary>

| Vulnerability class            | Rule ID (count)                                                                                                | CWE     |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------- | ------- |
| SQL injection                  | `pg/no-unsafe-query` (2), `pg/no-floating-query` (2)                                                           | CWE-89  |
| Path traversal                 | `node-security/detect-non-literal-fs-filename` (5), `node-security/no-arbitrary-file-access` (4)               | CWE-22  |
| Object injection / proto-poll. | `secure-coding/detect-object-injection` (5)                                                                    | CWE-915 |
| Unsafe deserialization / eval  | `secure-coding/no-unsafe-deserialization` (4), `node-security/detect-eval-with-expression` (2), `browser-security/no-eval` (2) | CWE-502 |
| ReDoS / unsafe regex           | `secure-coding/detect-non-literal-regexp` (3), `secure-coding/no-redos-vulnerable-regex` (2), `secure-coding/no-unsafe-regex-construction` (1) | CWE-1333 |
| Weak hashing                   | `node-security/no-weak-hash-algorithm` (2)                                                                     | CWE-327 |
| Insecure comparison (timing)   | `secure-coding/no-insecure-comparison` (3)                                                                     | CWE-208 |
| Hardcoded credentials          | `secure-coding/no-hardcoded-credentials` (2)                                                                   | CWE-798 |
| Dynamic / unsafe require       | `node-security/no-unsafe-dynamic-require` (2)                                                                  | CWE-95  |
| XSS / unsafe HTML              | `browser-security/no-innerhtml` (1)                                                                            | CWE-79  |
| Insecure cookies               | `browser-security/require-cookie-secure-attrs` (2)                                                             | CWE-1004 |
| XPath injection                | `secure-coding/no-xpath-injection` (1)                                                                         | CWE-643 |
| Deprecated Buffer              | `node-security/no-deprecated-buffer` (1)                                                                       | CWE-1325 |

**Total: 46.** SDL's 3 (`no-inner-html`, `no-document-write`, `no-cookies`)
overlap only the XSS and cookie rows. Every other row — SQLi, path traversal,
object injection, deserialization, ReDoS, weak hashing, timing — has **no SDL
rule at all**. (`security-recommended` reproduces 21 of these; the full 46 needs
the four `recommended` configs together. Versions and exact commands in the
methodology section.)

</details>

## One bug, end to end: the SQL line SDL can't see

Aggregate counts are easy to wave away, so walk a single finding the whole way.
Line 78 of the fixture — a line that has shipped in real services I've reviewed:

```js
// vulnerable.js — queryDatabase(userId, orderBy)
db.query('SELECT * FROM users WHERE id = ' + userId);
```

**Why a reviewer waves this through.** It's not incompetence — it's context
collapse. `userId` *reads* like an integer from a typed route param, the diff is
one line in a 400-line PR, and the CI badge is green because the SDL linter ran
and found nothing to say about it. The reviewer isn't approving SQL injection;
they're trusting a green check that was scoped to a layer this file isn't on.
SDL has no `query`-aware rule, so the line is invisible to it — not downgraded to
a warning, *absent from the output entirely*.

**What the domain rule does instead.** `pg/no-unsafe-query` keys on the
`.query()` call shape and flags any argument built by concatenation or
interpolation:

```text
vulnerable.js:78:10  error  SQL Injection Risk: unsafe SQL query detected.
  Variable interpolation found. Use parameterized queries ($1, $2)
  instead of string concatenation.  [CWE-89]  pg/no-unsafe-query
```

**The fix is the smallest possible diff** — hand the value to the driver as a
parameter so it's never part of the SQL string:

```js
// parameterized — the driver escapes $1; the query string is now constant
db.query('SELECT * FROM users WHERE id = $1', [userId]);
```

That is the entire loop the aggregate number hides, repeated 46 times across the
file. SDL is silent on this specific line not because it's a weak linter, but
because a `query`-shape rule was never in its frontend-hardening scope. (Deeper
on this exact pattern:
[three SQL-injection shapes in node-postgres and the rule that catches each](https://ofriperetz.dev/articles/three-sql-injection-patterns-node-postgres-eslint).)

## Why this mismatch survives review

Nobody approves "ship SQL injection." What gets approved is a green pipeline.
`@microsoft/eslint-plugin-sdl` carries the Microsoft name and the letters *SDL* —
the same standard that gates a lot of enterprise shops — so when it lands in CI
and the build goes green, "do we have a security linter?" quietly becomes "yes,
the Microsoft one." The plugin did exactly what it promised; it just promised to
harden a surface this repo doesn't have. The rules that *would* have caught the
backend bugs were never installed, so there was nothing red for a reviewer to
question. A passing security linter on the wrong layer is more dangerous than no
linter, because it converts an open question into a settled one.

I keep meeting this pattern in code review, and lately I keep meeting it in
AI-generated code too — same root cause, faster.

## The AI angle: assistants reintroduce exactly what SDL can't see

This is the part that turns a layer mismatch into a recurring incident. The 43
findings SDL has no rule for are the *modal* mistakes an LLM makes when it writes
a Node backend: string-concatenated `pg` queries, `fs` paths built from request
input, `JSON`/`eval`-shaped deserialization, object injection. I ran the
experiment directly: when I
[let Claude write 60 backend functions, 65–75% shipped with a security
vulnerability](https://ofriperetz.dev/articles/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities),
and the same classes recur
[across models](https://ofriperetz.dev/articles/we-ranked-5-ai-models-by-security-the-leaderboard-is-wrong) —
whether the author is Claude, Gemini, or a junior in a hurry.

So the failure compounds: your assistant generates a backend vuln, your
frontend-layer linter has no rule for it, your pipeline is green, and the PR
merges. SDL never sees the thing it was never built to see. The fix isn't to
distrust SDL — it's to run a linter that covers the layer where the code (and
your AI assistant) actually lives. Reproduce it yourself: paste an
AI-generated route handler into the fixture directory below and run both configs.

### Cover the backend layer — copy-paste

Keep SDL for your frontend. Add the domain plugins for everything Node:

```bash
npm i -D eslint eslint-plugin-secure-coding eslint-plugin-node-security eslint-plugin-pg
```

```js
// eslint.config.mjs — backend coverage in three lines
import { configs as secureCoding } from "eslint-plugin-secure-coding";
import { configs as nodeSecurity } from "eslint-plugin-node-security";
import { configs as pg } from "eslint-plugin-pg";

export default [
  secureCoding.recommended, // object injection, unsafe deserialization
  nodeSecurity.recommended, // fs path traversal, command injection
  pg.recommended,           // SQL injection in node-postgres
];
```

That's the 43 findings SDL had no rule for. The full dual-layer config — SDL
scoped to `src/web/**`, the domain plugins to `src/api/**` — is below.

## False positives — `safe-patterns.js`

| Config                       | False positives                                                        |
| ---------------------------- | ---------------------------------------------------------------------- |
| Oxlint built-in              | 0                                                                      |
| Interlace @ Oxlint           | 0                                                                      |
| @microsoft/eslint-plugin-sdl | 1 (`no-inner-html` on a DOMPurify-sanitized assignment — conservative) |
| Interlace @ ESLint           | 3 (a perf rule + a conservative-by-design rule)                        |
| eslint-plugin-security       | 5 (genuine — validated-key + path-validated)                           |

## Use the right layer

If you ship Angular, Electron, or a browser frontend, **SDL is a sensible
hardening layer for that code** — it encodes Microsoft's SDL guidance for those
surfaces. For the Node backend (APIs, data layer, crypto, serverless), reach for
the domain plugins. They're different layers of the same app:

```js
// eslint.config.mjs
import sdl from "@microsoft/eslint-plugin-sdl";
import { configs as secureCoding } from "eslint-plugin-secure-coding";
import { configs as nodeSecurity } from "eslint-plugin-node-security";
import { configs as pg } from "eslint-plugin-pg";

export default [
  // frontend bundle — SDL where Angular/Electron/DOM code lives.
  // (SDL's configs are flat-config ARRAYS, so map files onto each entry —
  //  unlike the Interlace configs, which are single objects.)
  ...sdl.configs.common.map((c) => ({
    files: ["src/web/**", "src/electron/**"],
    ...c,
  })),
  // backend — the domain security plugins (their configs ARE single objects)
  { files: ["src/api/**", "src/db/**"], ...secureCoding.recommended },
  { files: ["src/**"], ...nodeSecurity.recommended },
  { files: ["**/db/**"], ...pg.recommended },
];
```

The mental model that survives this article: **a security linter only hardens
the layer it was built for, and a green pipeline is not the same as a covered
one.** Audit what your "security linter" actually has rules for before you tell
the team the backend is safe.

What's the security tool *you* trusted that turned out to be scoped to the wrong
layer — the SAST that only spoke one language, the SCA that ignored your lockfile,
the linter green on a surface you didn't have? I want the war story in the
comments.

## Methodology — reproduce it

Honest disclosure: the fixtures are **team-authored** (`vulnerable.js`, 12 Node
vulnerability classes; `safe-patterns.js`), so they measure the Node backend
surface the Interlace rules target — SDL would score very differently on an
Angular/Electron fixture, which is its home turf. Versions (measured 2026-05-31):
`eslint@9.39`, `@microsoft/eslint-plugin-sdl@1.1.0` (17 rules),
`eslint-plugin-secure-coding@3.2.0`, `node-security@4.2.0`, `pg@1.4.3`,
`browser-security@1.2.3`. Each plugin's rules at `error`, `--format json`,
counted by `ruleId` (SDL's three throwing rules disabled so the rest could run).

```bash
npm i -D eslint@9 @microsoft/eslint-plugin-sdl eslint-plugin-secure-coding \
  eslint-plugin-node-security eslint-plugin-pg eslint-plugin-browser-security
npx eslint --config eslint.config.sdl.mjs test-files/vulnerable.js --format json
npx eslint --config eslint.config.interlace.mjs test-files/vulnerable.js --format json
```

Fixtures and both config files live in the repo's
[`packages/eslint-plugin-secure-coding/benchmark/`](https://github.com/ofri-peretz/eslint/tree/main/packages/eslint-plugin-secure-coding/benchmark).

The full 4-engine version (ESLint + Oxlint, built-in + plugins) is in
[the security-linter benchmark](https://ofriperetz.dev/articles/your-eslint-security-plugin-is-missing-80-of-vulnerabilities-i-have-proof).

---

## Compatibility

| Surface              | Support                                                                                                                                                                       |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Package managers** | npm, yarn, pnpm, bun                                                                                                                                                          |
| **Node**             | `>= 18.0.0`                                                                                                                                                                   |
| **ESLint**           | Interlace plugins `^8 \|\| ^9 \|\| ^10`; **`@microsoft/eslint-plugin-sdl` requires `^9`**. Flat config (on ESLint 8 the Interlace plugins need `ESLINT_USE_FLAT_CONFIG=true`) |
| **Module system**    | Plugins ship CommonJS; your config can be `eslint.config.js` or `.mjs`                                                                                                        |
| **Oxlint**           | Interlace flagship rules run via the `interlace-*` ports, parity-gated                                                                                                        |

---

## Links

- 📦 [secure-coding](https://www.npmjs.com/package/eslint-plugin-secure-coding) · [node-security](https://www.npmjs.com/package/eslint-plugin-node-security) · [pg](https://www.npmjs.com/package/eslint-plugin-pg) · [browser-security](https://www.npmjs.com/package/eslint-plugin-browser-security)
- 📦 [@microsoft/eslint-plugin-sdl](https://www.npmjs.com/package/@microsoft/eslint-plugin-sdl) — the frontend layer
- 📖 [Full rule docs](https://eslint.interlace.tools)
- 💻 [Source on GitHub](https://github.com/ofri-peretz/eslint)

::dev-to-cta{url="https://github.com/ofri-peretz/eslint"}
⭐ Star on GitHub if your Node backend — and the code your AI assistant writes for
it — needs more than a frontend security linter.
::

---

I'm **Ofri Peretz**, a security engineering leader and the author of the
Interlace ESLint ecosystem — domain-specific static analysis for security,
reliability, and performance on the Node.js stack.

[ofriperetz.dev](https://ofriperetz.dev) · [LinkedIn](https://linkedin.com/in/ofri-peretz) · [GitHub](https://github.com/ofri-peretz)
