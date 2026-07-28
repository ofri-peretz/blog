---
devto_url: "https://dev.to/ofri-peretz/microsofts-eslint-security-plugin-catches-10-of-vulnerabilities-heres-what-it-misses-5gii"
devto_id: 3240750
title: "Microsoft's SDL ESLint Plugin Caught 5 Node Vulns. The Domain Plugins Caught 46 — Same File, Wrong Layer"
description: "A reproducible benchmark: @microsoft/eslint-plugin-sdl (17 rules, Angular/Electron/browser-focused) vs the Interlace security plugins, on one Node fixture. SDL's recommended config catches 5 — frontend hardening is exactly why it's the wrong layer for a Node backend, and exactly the gap your AI assistant ships into."
slug: "benchmark-microsoft-sdl-vs-interlace"
published: true
date: 2026-02-08
cover_image: "https://ofriperetz.dev/og/cover/benchmark-microsoft-sdl-vs-interlace"
social_image: "https://ofriperetz.dev/og/article/benchmark-microsoft-sdl-vs-interlace"
tags:
  - "security"
  - "eslint"
  - "devsecops"
  - "javascript"
  - security
  - node
  - devsecops
  - javascript
series: "ESLint Security Benchmark Series"
canonical_url: https://ofriperetz.dev/articles/benchmark-microsoft-sdl-vs-interlace
tier: "T3"
reading_time_minutes: 7
author:
---

Your team added `@microsoft/eslint-plugin-sdl` to CI, the pipeline went green, and someone checked "security linter" off the list. Meanwhile **37 out of 46 vulnerability classes** on a standard Node backend — SQL injection, path traversal, prototype pollution, ReDoS — have zero SDL rules watching them. The build is still green. The SQL injection is still there.

That's not a flaw in Microsoft's plugin. It's a layer mismatch that looks exactly like security coverage until something gets exploited.

> Part of the [ESLint Security Benchmark Series](https://ofriperetz.dev/articles/benchmark-17-eslint-security-plugins-compared) —
> same fixture, same method, one tool per post. Companion piece:
> [SonarJS has 269 rules and found 13 where the domain plugins found 46](https://ofriperetz.dev/articles/benchmark-sonarjs-vs-interlace).

## What the numbers actually are

On one Node file with 12 vulnerability classes, `@microsoft/eslint-plugin-sdl@1.1.0` running its `recommended` config caught **5** (and only **3** of those came from its own `@microsoft/sdl/*` rules). The domain plugins caught **46** — same file. And you'd already told the team the backend was covered by Microsoft's Security Development Lifecycle, because the build went green. Your SQL injection, your path traversal, your unsafe deserialization — all of it walked straight past the linter you trusted, and the pipeline never went red to warn you.

That gap isn't a quality verdict, and it isn't Microsoft shipping a bad tool. `@microsoft/eslint-plugin-sdl` is 17 rules (at v1.1.0) distilled from the SDL standard, and it's a *good* tool — for the surface it was built for. Look at the rule list and the result is obvious: SDL was built to harden **frontends** (Angular, Electron, the DOM), not Node backends. Point it at an API and most of its rules have nothing to match.

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

**What SDL wins at, honestly stated.** If you're hardening an Angular SPA, an Electron desktop app, or a Microsoft-stack browser frontend, SDL's rules are well-considered and save real time. The `no-angular-bypass-sanitizer`, `no-electron-node-integration`, and `postmessage-star-origin` rules encode real SDL guidance that a Node-backend linter won't have. SDL is also the right answer for teams already embedded in Microsoft toolchains where SDL compliance is a contractual gate. The criticism here is scoping — not quality.

**What SDL can't automate, and why.** SDL's standard also covers things no linter can touch: threat modeling sessions, architectural security reviews, human penetration testing, access control design. These require runtime context, system-level knowledge, and human judgment that static analysis structurally cannot provide. A linter running on source code cannot know whether your auth layer is correctly wired to your routes — it can only see the code in the file. Pointing this out isn't a weakness of SDL; it's a reminder that "CI is green" and "the backend is secure" are different claims. The [30-minute static analysis protocol for onboarding](https://ofriperetz.dev/articles/the-30-minute-security-audit-onboarding-a-new-codebase) covers how to combine linting with the manual checks that survive automation.

## Detection — `vulnerable.js` (12 Node vulnerability classes)

| Config                                | Engine | Security findings |
| ------------------------------------- | ------ | ----------------- |
| Oxlint built-in                       | Oxlint | 1                 |
| `@microsoft/sdl/*` rules only         | ESLint | 3                 |
| **`@microsoft/eslint-plugin-sdl` (`recommended`)** | ESLint | **5**             |
| Interlace flagship rules              | Oxlint | 5                 |
| eslint-plugin-security (recommended)  | ESLint | 21                |
| Interlace (4 plugins, recommended)    | ESLint | 46                |

**Read that table honestly — the line a senior SDL user will check first.** The
SDL *namespaced* rules (`@microsoft/sdl/*`) caught **3**: `no-inner-html`,
`no-document-write`, and `no-cookies`. Its Angular, Electron, and WinJS rules had
nothing to match — there's no Angular in a Node API. But nobody runs the bare
namespace; they run `sdl.configs.recommended`, and that config *also* turns on
four core ESLint rules (`no-eval`, `no-implied-eval`, `no-new-func`, `no-caller`)
— so on this fixture the real `recommended` number is **5** (the 3 above plus
`no-eval` and `no-new-func` firing on the `eval()` / `new Function()` sites).

One detail that surprised me and matters for fairness: `sdl.configs.recommended`
*registers* `eslint-plugin-security` as a plugin but never switches its rules to
`error` — I confirmed this with `eslint --print-config` (zero `security/*` rules
in the resolved config). So recommended does **not** quietly inherit
eslint-plugin-security's 21 findings; that 21 is what you get only if you add
`security` rules yourself. The honest headline is **5 vs 46**, and 5 is still the
generous reading.

> **A robustness note, stated plainly.** Three SDL rules (`no-insecure-random`,
> `no-insecure-url`, `no-unsafe-alloc`) **threw** on the fixture's dynamic
> `require(variable)` — a `path.basename(undefined)` inside the rule. They're
> written around browser/Angular call shapes, not Node's dynamic module loading.
> It's a fair reminder that a linter only hardens the surface it was built for.

## What a Node backend needs instead

The honest accounting, and it reconciles exactly. SDL's `recommended` config
produces **5 findings** on this file; the Interlace set produces **46**. Line them
up: SDL flags 5 lines, and **9** of the 46 Interlace findings land on those same
lines (the `innerHTML` write, the insecure cookie, and the `eval`/`Function`
sites, where SDL's core `no-eval`/`no-new-func` overlap the Interlace eval rules).
That leaves **37** Interlace findings on lines SDL never touches — and 9 + 37 = 46,
no hand-waving.

Those 37 are the Node backend surface SDL has no rule for on any config: SQL
injection, `fs` path traversal, object injection / prototype pollution, ReDoS,
weak hashing, insecure comparisons, dynamic `require`, deprecated `Buffer`. (SDL
also catches one thing the backend plugins skip — `document.write`, a pure-frontend
concern — so it isn't a subset in either direction.) That's the whole point: not
"SDL is weaker," but "SDL was never pointed at this layer."

That "37" isn't an estimate — it's the actual `ruleId` output. Here's the full
list from the Interlace run (`--format json`, counted by `ruleId`), grouped by
class, so you can diff it against your own:

<details>
<summary><strong>The 46 Interlace findings on <code>vulnerable.js</code>, by rule ID</strong> (37 land on lines SDL's recommended config never flags)</summary>

| Vulnerability class            | Rule ID (count)                                                                                                | CWE     |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------- | ------- |
| SQL injection                  | `pg/no-unsafe-query` (2), `pg/no-floating-query` (2)                                                           | CWE-89  |
| Path traversal                 | `node-security/detect-non-literal-fs-filename` (5), `node-security/no-arbitrary-file-access` (4)               | CWE-22  |
| Object injection / proto-poll. | `secure-coding/detect-object-injection` (5)                                                                    | CWE-915 |
| Unsafe deserialization / eval  | `secure-coding/no-unsafe-deserialization` (4) → CWE-502; `node-security/detect-eval-with-expression` (2), `browser-security/no-eval` (2) → CWE-95 | 502 / 95 |
| ReDoS / unsafe regex           | `secure-coding/detect-non-literal-regexp` (3), `secure-coding/no-redos-vulnerable-regex` (2), `secure-coding/no-unsafe-regex-construction` (1) | CWE-1333 |
| Weak hashing                   | `node-security/no-weak-hash-algorithm` (2)                                                                     | CWE-327 |
| Insecure comparison (timing)   | `secure-coding/no-insecure-comparison` (3)                                                                     | CWE-208 |
| Hardcoded credentials          | `secure-coding/no-hardcoded-credentials` (2)                                                                   | CWE-798 |
| Dynamic / unsafe require       | `node-security/no-unsafe-dynamic-require` (2)                                                                  | CWE-95  |
| XSS / unsafe HTML              | `browser-security/no-innerhtml` (1)                                                                            | CWE-79  |
| Insecure cookies               | `browser-security/require-cookie-secure-attrs` (2)                                                             | CWE-614 |
| XPath injection                | `secure-coding/no-xpath-injection` (1)                                                                         | CWE-643 |
| Deprecated Buffer              | `node-security/no-deprecated-buffer` (1)                                                                       | CWE-676 |

**Total: 46.** SDL's `recommended` config touches three of these rows — XSS row
(via `no-inner-html`), cookie row (via `no-cookies`), and the `eval`/`Function`
sites in the deserialization row (via core `no-eval` / `no-new-func`, which
`recommended` enables — confirm with `eslint --print-config`, where both resolve
to `"error"`). That's **9** of the 46 findings on shared lines; the other **37**
rows — SQLi, path traversal, object injection, ReDoS, weak hashing, timing,
dynamic require, deprecated Buffer — have **no SDL rule at all**.
(`eslint-plugin-security`'s `recommended` reproduces 21 of these on its own — but,
as noted above, `sdl.configs.recommended` registers that plugin without enabling
its rules; the full 46 needs the four Interlace `recommended` configs together.
Versions and exact commands in the methodology section.)

</details>

## Three bugs, end to end: what SDL can't see

Aggregate counts are easy to wave away. Here's what the coverage gap looks like on
three specific lines — the ones most likely to slip through code review because
they *look* safe.

### SQL injection (CWE-89)

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

This survives automation in SDL because catching SQL injection requires understanding the call shape of a specific database driver (`pg.query`, `mysql.execute`, `knex.raw`) and recognizing when its argument is built dynamically. That context is driver-specific and runtime-adjacent — SDL's rules were written for DOM and Angular APIs, not database access patterns.

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

Deeper on this exact pattern: [three SQL-injection shapes in node-postgres and the rule that catches each](https://ofriperetz.dev/articles/three-sql-injection-patterns-node-postgres-eslint).

### Path traversal (CWE-22)

```js
// route handler — serves files by user-supplied filename
const filePath = path.join(__dirname, 'uploads', req.query.file);
fs.readFile(filePath, 'utf8', callback);
```

**Why it ships.** `path.join` looks safe because developers associate it with "safe path construction." The CI is green. SDL has no `fs`-aware rule — `node-security/detect-non-literal-fs-filename` (an Interlace rule) flags the `fs.readFile` call because its first argument is non-literal. SDL's rules cover DOM APIs; `fs` is out of scope by design.

This survives automation in SDL because it requires correlating `fs.*` call shapes with non-literal arguments — a Node.js-specific pattern that has no analog in browser or Electron contexts.

**The fix:**

```js
// constrain the filename to a safe directory and reject traversal sequences
const filename = path.basename(req.query.file); // strips ../ sequences
const filePath = path.join(__dirname, 'uploads', filename);
if (!filePath.startsWith(path.join(__dirname, 'uploads'))) {
  return res.status(403).send('Forbidden');
}
fs.readFile(filePath, 'utf8', callback);
```

### Prototype pollution (CWE-915)

```js
// merge utility — deeply copies user-supplied object into target
function merge(target, source) {
  for (const key of Object.keys(source)) {
    target[key] = source[key]; // ← no __proto__ guard
  }
}
```

**Why it ships.** This pattern is everywhere in utilities and config merging. No one writes it intending to enable prototype pollution. SDL has no object-injection rule — `secure-coding/detect-object-injection` flags the bracket-notation assignment because the key is dynamic.

This survives automation in SDL because detecting object injection requires understanding JavaScript prototype chain semantics at the static analysis layer — a Node.js-specific risk surface that the SDL rule set doesn't cover.

**The fix:**

```js
function merge(target, source) {
  for (const key of Object.keys(source)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    target[key] = source[key];
  }
}
```

> **The alarming summary:** A team that runs only SDL on a Node backend is effectively running zero security rules on SQL injection, path traversal, prototype pollution, ReDoS, weak hashing, timing attacks, and dynamic require — the exact [CWE classes](https://ofriperetz.dev/articles/cwe-taxonomy-explained) that account for the majority of exploitable Node.js CVEs.

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

This is the part that turns a layer mismatch into a recurring incident. The 37
findings SDL's recommended config has no rule for are the *modal* mistakes an LLM
makes when it writes a Node backend: string-concatenated `pg` queries, `fs` paths
built from request input, object injection, weak hashing. (Its core `no-eval`
catches the textbook `eval(userInput)`, but the LLM-modal bug is rarely literal
`eval` — it's a `db.query` built by interpolation, which SDL never sees.) I ran the
experiment directly: when I
[let Claude write 80 backend functions, 65–75% shipped with a security
vulnerability](https://ofriperetz.dev/articles/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities) —
and it isn't a Claude problem. I extended it to
[700 AI-generated functions across 5 models from Claude and Gemini](https://ofriperetz.dev/articles/we-ranked-5-ai-models-by-security-the-leaderboard-is-wrong),
and **every model landed between a 49% and 73% vulnerability rate** — Gemini 2.5
Pro topped the chart at **73%**, and even the safest model still shipped a vuln
in nearly half its functions. These are the *exact* CWE classes SDL's recommended
config has no rule for: SQLi, path traversal, object injection, weak hashing,
ReDoS. Whether the author is Claude, Gemini, or a junior in a hurry, the backend
bug lands on a line your frontend linter was never built to read.

The uncomfortable part isn't the aggregate rate — it's that
[no single model is safe across every domain](https://ofriperetz.dev/articles/aggregate-benchmarks-lie-heres-what-700-ai-functions-look-like-by-security-domain):
the model that writes the cleanest auth code writes some of the worst file-I/O
code, so you can't pick your way out with a "secure" model. You need the layer,
not a better author.

So the failure compounds: your assistant generates a backend vuln, your
frontend-layer linter has no rule for it, your pipeline is green, and the PR
merges. SDL never sees the thing it was never built to see. The fix isn't to
distrust SDL — it's to run a linter that covers the layer where the code (and
your AI assistant) actually lives.

For a structured way to audit what your current linting config actually covers, the [30-minute static analysis protocol](https://ofriperetz.dev/articles/the-30-minute-security-audit-onboarding-a-new-codebase) maps every major Node.js risk category to specific rules — useful for spotting exactly these kinds of coverage gaps before they become incidents.

### Cover the backend layer — copy-paste

Keep SDL for your frontend. Add the domain plugins for everything Node:

```bash
npm i -D eslint eslint-plugin-secure-coding eslint-plugin-node-security \
  eslint-plugin-pg eslint-plugin-browser-security
```

```js
// eslint.config.mjs — backend + browser-surface coverage
import { configs as secureCoding } from "eslint-plugin-secure-coding";
import { configs as nodeSecurity } from "eslint-plugin-node-security";
import { configs as pg } from "eslint-plugin-pg";
import { configs as browserSecurity } from "eslint-plugin-browser-security";

export default [
  secureCoding.recommended,   // object injection, unsafe deserialization, weak hashing
  nodeSecurity.recommended,   // fs path traversal, dynamic require, deprecated Buffer
  pg.recommended,             // SQL injection in node-postgres
  browserSecurity.recommended, // innerHTML/eval/cookie — the rows that overlap SDL
];
```

That's the bulk of the 37 findings SDL's recommended config had no rule for. The
full dual-layer config — SDL scoped to `src/web/**`, the domain plugins to
`src/api/**` — is below.

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
  //  unlike the Interlace configs, which are single objects. Spread `c`
  //  FIRST, then set `files`, so our scope wins over any files key in c.)
  ...sdl.configs.recommended.map((c) => ({
    ...c,
    files: ["src/web/**", "src/electron/**"],
  })),
  // backend — the domain security plugins (their configs ARE single objects)
  { ...secureCoding.recommended, files: ["src/api/**", "src/db/**"] },
  { ...nodeSecurity.recommended, files: ["src/**"] },
  { ...pg.recommended, files: ["**/db/**"] },
];
```

The mental model that survives this article: **a security linter only hardens
the layer it was built for, and a green pipeline is not the same as a covered
one.** Audit what your "security linter" actually has rules for before you tell
the team the backend is safe.

The full rule documentation is at [eslint.interlace.tools](https://eslint.interlace.tools) — each plugin's page lists exactly which CWE classes it covers, so you can map your threat model to specific rules and verify there are no gaps.

**Which SDL requirement do you least trust your CI to catch — and have you actually verified whether your current linting config covers it?** The comments are the right place for that war story.

## Methodology — reproduce it

Honest disclosure: the fixtures are **team-authored** (`vulnerable.js`, 12 Node
vulnerability classes; `safe-patterns.js`), so they measure the Node backend
surface the Interlace rules target — SDL would score very differently on an
Angular/Electron fixture, which is its home turf. Versions (measured 2026-05-31):
`eslint@9.39`, `@microsoft/eslint-plugin-sdl@1.1.0` (17 rules),
`eslint-plugin-secure-coding@3.2.0`, `eslint-plugin-node-security@4.2.0`,
`eslint-plugin-pg@1.4.3` (the Interlace plugin — not the `pg` node-postgres
driver, which is at 8.x), `eslint-plugin-browser-security@1.2.3`. Findings counted
by `ruleId` over `--format json` output.

**What "SDL" means in the table, stated once, plainly.** The **3** is the count
of `@microsoft/sdl/*`-namespaced rules that fired. The **5** is the count from
SDL's own `recommended` config (`sdl.configs.recommended`) — which additionally
enables core `no-eval`/`no-new-func`, the source of the extra 2. SDL's three
browser-shaped rules (`no-insecure-random`, `no-insecure-url`, `no-unsafe-alloc`)
**throw** on this fixture's dynamic `require(variable)` (a `path.basename(undefined)`
inside the rule), so they're set to `off` to let the rest of the config run —
that throw is itself reported above. Note that `sdl.configs.recommended`
*registers* `eslint-plugin-security` but does **not** enable its rules at `error`
(verify with `eslint --print-config`), so it contributes 0 here.

The whole run [reproduces](https://ofriperetz.dev/articles/reproducibility-vs-replicability) from the two configs below — no private files needed:

```bash
npm i -D eslint@9 @microsoft/eslint-plugin-sdl eslint-plugin-secure-coding \
  eslint-plugin-node-security eslint-plugin-pg eslint-plugin-browser-security
```

```js
// eslint.config.sdl.mjs — SDL's own recommended config, throwing rules disabled
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const sdl = require("@microsoft/eslint-plugin-sdl");
const off = ["no-insecure-random", "no-insecure-url", "no-unsafe-alloc"];
export default [
  { files: ["**/*.js"], languageOptions: { sourceType: "commonjs" } },
  ...sdl.configs.recommended.map((c) =>
    c.rules
      ? { ...c, rules: Object.fromEntries(Object.entries(c.rules).map(([k, v]) =>
          [k, off.some((r) => k.endsWith(r)) ? "off" : v])) }
      : c,
  ),
];
```

```js
// eslint.config.interlace.mjs — the four domain plugins at recommended
import { configs as secureCoding } from "eslint-plugin-secure-coding";
import { configs as nodeSecurity } from "eslint-plugin-node-security";
import { configs as pg } from "eslint-plugin-pg";
import { configs as browserSecurity } from "eslint-plugin-browser-security";
export default [
  { files: ["**/*.js"], languageOptions: { sourceType: "commonjs" } },
  secureCoding.recommended, nodeSecurity.recommended,
  pg.recommended, browserSecurity.recommended,
];
```

```bash
npx eslint --config eslint.config.sdl.mjs vulnerable.js --format json        # → 5
npx eslint --config eslint.config.interlace.mjs vulnerable.js --format json  # → 46
```

The fixtures (`vulnerable.js`, `safe-patterns.js`) and the four-plugin benchmark
harness live in the repo's
[`packages/eslint-plugin-secure-coding/benchmark/`](https://github.com/ofri-peretz/eslint/tree/main/packages/eslint-plugin-secure-coding/benchmark);
paste the two configs above next to them to reproduce the SDL-vs-Interlace
numbers exactly.

The full 4-engine version (ESLint + Oxlint, built-in + plugins) is in
[the security-linter benchmark](https://ofriperetz.dev/articles/your-eslint-security-plugin-is-missing-80-of-vulnerabilities-i-have-proof).

For a broader framing of how to evaluate security plugins before they land in your CI — including the questions to ask when a tool's README doesn't answer them — see the [benchmark methodology in the 17-plugin comparison](https://ofriperetz.dev/articles/benchmark-17-eslint-security-plugins-compared).

### Run it on your AI's output — including Gemini

The fixture is hand-authored, but the method is the point, and it's one experiment
away from a Gemini-grounded version: ask Gemini 2.5 Pro to generate a batch of
Node route handlers, drop them in place of `vulnerable.js`, and run the same two
configs. I already have the priors — across
[700 AI-generated functions from 5 Claude and Gemini models](https://ofriperetz.dev/articles/we-ranked-5-ai-models-by-security-the-leaderboard-is-wrong),
Gemini 2.5 Pro shipped a vulnerability in **73%** of its functions, the highest in
the field — so the SDL-recommended config will catch the literal `eval`, miss the
`pg` concatenation and the `fs` path, and the domain plugins will catch the rest,
on real generated code instead of a fixture. That rerun, tagged `#googleai
#geminichallenge`, is a Build-with-Gemini XPRIZE entry; this post is the harness
it would reuse.

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

## ESLint Security Benchmark Series

Same fixture, same method, one tool per post:

- **[The benchmark hub: 17 ESLint security plugins compared](https://ofriperetz.dev/articles/benchmark-17-eslint-security-plugins-compared)** — the full field, all engines.
- **You are here:** `@microsoft/eslint-plugin-sdl` — 5 vs 46 on recommended, wrong layer.
- **[SonarJS has 269 rules and found 13](https://ofriperetz.dev/articles/benchmark-sonarjs-vs-interlace)** — the rule-count-vs-coverage companion.
- **[The 4-engine ground truth: ESLint + Oxlint, built-in + plugins](https://ofriperetz.dev/articles/your-eslint-security-plugin-is-missing-80-of-vulnerabilities-i-have-proof)** — the methodology these posts all share.

Why these numbers keep mattering: the bugs they catch are the
[same ones AI assistants reintroduce](https://ofriperetz.dev/articles/we-ranked-5-ai-models-by-security-the-leaderboard-is-wrong)
at a 49–73% clip, which is why the *layer* — not the author — is the thing to fix.

---

## Foundations

Two short references carry the measurement vocabulary this benchmark leans on: [precision, recall, and F1 for static analysis](https://ofriperetz.dev/articles/precision-recall-f1-for-static-analysis) — which works through this SDL run as one of its examples — and [the confusion matrix: TP, FP, FN, TN](https://ofriperetz.dev/articles/confusion-matrix-tp-fp-fn-tn), which pins down what the false-positive table above is actually counting.

---

## Links

- [secure-coding](https://www.npmjs.com/package/eslint-plugin-secure-coding) · [node-security](https://www.npmjs.com/package/eslint-plugin-node-security) · [pg](https://www.npmjs.com/package/eslint-plugin-pg) · [browser-security](https://www.npmjs.com/package/eslint-plugin-browser-security)
- [@microsoft/eslint-plugin-sdl](https://www.npmjs.com/package/@microsoft/eslint-plugin-sdl) — the frontend layer
- [Full rule docs](https://eslint.interlace.tools)
- [Source on GitHub](https://github.com/ofri-peretz/eslint)

::dev-to-cta{url="https://github.com/ofri-peretz/eslint"}
Star on GitHub if your Node backend — and the code your AI assistant writes for
it — needs more than a frontend security linter.
::

---

*Part of the [Interlace ESLint ecosystem](https://eslint.interlace.tools). Source on [GitHub](https://github.com/ofri-peretz/eslint) · Follow: [Dev.to/ofri-peretz](https://dev.to/ofri-peretz)*
