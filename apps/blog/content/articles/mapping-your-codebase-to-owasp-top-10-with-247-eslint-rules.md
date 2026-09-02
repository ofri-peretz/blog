---
title: "I Mapped the OWASP Top 10 to ESLint Rules. 8 Hold Up. 2 Are Vendor Theater."
description: "A real, auditable mapping of the OWASP Top 10 (2021) to ten domain-security ESLint plugins: which categories a CWE-tagged rule genuinely catches in CI, the two (Insecure Design, Vulnerable Components) that need controls beyond source analysis, and what happens when you point these rules at AI-generated code."
slug: "mapping-your-codebase-to-owasp-top-10-with-247-eslint-rules"
canonical_url: "https://ofriperetz.dev/articles/mapping-your-codebase-to-owasp-top-10-with-247-eslint-rules"
tier: "T3"
devto_url: "https://dev.to/ofri-peretz/mapping-your-codebase-to-owasp-top-10-with-247-eslint-rules-25f0"
devto_id: 3138808
published_at: "2025-12-31T18:15:25Z"
edited_at: "2026-02-05T04:58:59Z"
cover_image: "https://ofriperetz.dev/cdn/blog-cover-image/mapping-your-codebase-to-owasp-top-10-with-247-eslint-rules.jpg?v=b2"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/mapping-your-codebase-to-owasp-top-10-with-247-eslint-rules-og.jpg?v=b2"
reading_time_minutes: 8
tags:
  - "security"
  - "node"
  - "devsecops"
  - "eslint"
reactions: 1
comments: 0
views: 0
author:
  name: "Ofri Peretz"
  username: "ofri-peretz"
  avatar: "https://media2.dev.to/dynamic/image/width=640,height=640,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Fuser%2Fprofile_image%2F3669992%2F50a1f256-472c-48a1-85e8-149459647ea7.png"
  twitter: "ofriperetzdev"
series: null
---

247 ESLint rules mapped to the [OWASP Top 10](https://ofriperetz.dev/articles/owasp-top-10-explained) — but static analysis genuinely covers only 8 of the 10 categories. The other 2 (Insecure Design, Vulnerable Components) your linter can't touch, no matter what the vendor's "100% coverage" slide says.

Every "100% OWASP coverage by static analysis" slide is off by two — and the
vendor selling it is counting on you not opening the OWASP page to check. I've
built ten security ESLint plugins, and here's the number to your face:
**static analysis genuinely catches 8 of the 10 web categories at the source.
The other 2, it cannot.** Anyone claiming 10 is mapping a `require-secure-defaults`
rule to "Insecure Design" and hoping the auditor nods along.

"How do you address the OWASP Top 10?" is now a line item on every enterprise
security questionnaire, and the box everyone reaches for is "100% covered." That
8-of-10 is the honest answer instead — and it's the _more useful_ one, because
the line between "control you can _audit_ at the call site" and "compliance-theater
slide" is exactly which two categories you stop pretending to cover. Get that line
wrong and you ship a SOC 2 report that says "Insecure Design: covered" over a
money-moving endpoint with no rate limit. I've signed off on that report. So have you.

No single plugin gets you the 8, either. SQL injection needs database-aware
rules; JWT attacks need token-aware rules; DOM XSS needs browser-aware rules. So
the map below spans **ten domain-security plugins** (part of the
[Interlace](https://eslint.interlace.tools) ecosystem). Every rule carries a
[CWE](https://ofriperetz.dev/articles/cwe-taxonomy-explained), and most findings carry the classic OWASP category the CWE rolls up to, so
the evidence is greppable, not hand-waved — and the count is whatever your
installed version actually ships, which you can read for yourself (one-liner at
the end), not a frozen number on a slide. (Yes, the URL says a number. It was
true the day I wrote it; the only count I trust is the one your CI prints from
your own `node_modules`. Don't take mine — or any vendor's — on faith.)

> This is the **web** OWASP Top 10 (2021). The AI/LLM list is mapped separately
> in [the OWASP LLM Top 10 piece](https://ofriperetz.dev/articles/100-owasp-llm-top-10-coverage-for-vercel-ai-sdk) —
> also honestly, 8 of 10.

---

> **Skip to:** [The uncovered gap](#the-uncomfortable-gap-which-categories-your-linter-cant-touch) · [Where source analysis hands off](#a04-and-a06-where-source-analysis-hands-off-to-another-control) · [What a finding looks like](#what-a-finding-looks-like) · [Build your config](#build-your-config-layer-by-layer)

## The uncomfortable gap: which categories your linter can't touch

Before the map, the insight most teams miss: **A04 (Insecure Design) has zero genuinely automatable ESLint rules** — it's a design problem, not a code problem. The rules listed for it in the table below (`require-secure-defaults`, `no-missing-validation-pipe`) nudge toward safer defaults, but they don't catch the actual A04 vulnerabilities: missing rate limits on money-moving endpoints, replayed workflows, trust boundaries in the wrong place. Those are architectural decisions that happen before a line of code is written.

Most teams don't know this. They install a lint config, see OWASP categories in the output, and assume they're covered. The gap between "we have ESLint" and "we have OWASP coverage" is 247 rules and 2 categories — and no npm package tells you this automatically.

Here's the rule distribution across all 10 categories — rounded to show the _shape_, not a precise ledger:

| Category                  | Representative rule count | Coverage type                                   |
| ------------------------- | ------------------------- | ----------------------------------------------- |
| A03 Injection             | ~80 rules                 | Full (SQL, NoSQL, DOM, LDAP, eval)              |
| A07 Auth Failures         | ~40 rules                 | Full                                            |
| A02 Crypto Failures       | ~35 rules                 | Full                                            |
| A05 Misconfiguration      | ~30 rules                 | Full                                            |
| A01 Broken Access Control | ~25 rules                 | Full                                            |
| A08 Data Integrity        | ~20 rules                 | Full                                            |
| A09 Logging Failures      | ~10 rules                 | Full                                            |
| A10 SSRF                  | ~7 rules                  | Full                                            |
| A06 Vulnerable Components | ~5 rules                  | Partial (source hygiene only — not CVE graph)   |
| A04 Insecure Design       | ~2 rules                  | Partial (defaults nudges — not design coverage) |

Don't sum that column for a total — the counts are rounded to show the shape, and they drift every release (the title's 247 was the day-one count; these security plugins consolidated to **198 rules by v3.0.2**, measured 2026-05-30). The shape is what survives the drift: A03 alone carries more rules than A04, A06, A09, and A10 combined. If your threat model includes Insecure Design, your linter can't help — and that's the category most enterprise security questionnaires ask about first.

**Slack-quotable version:** 247 ESLint rules for OWASP Top 10 — but A04 (Insecure Design) has 0 automatable rules. If your threat model includes it, your linter can't help.

---

## Why teams don't know their coverage

The most common pattern I see: a team picks up `eslint-plugin-security` (or a bundle config), sees it run in CI, and ticks the OWASP box. They never check _which_ categories actually fire, because nothing tells them — the only way to know is to map each rule's CWE to its OWASP category and count.

If you want to verify your own install right now, skip to the [one-liner at the bottom](#build-your-config-layer-by-layer). It counts every rule across every installed Interlace plugin — the only count that matters is the one your CI prints.

---

## The map: OWASP Top 10 (2021) → plugins → rules

| #                                                                                   | Category                          | Plugins                                                       | Representative rules                                                                                                                                                                                                                                                                                                                                                                         |
| ----------------------------------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [A01](https://owasp.org/Top10/A01_2021-Broken_Access_Control/)                      | Broken Access Control             | `secure-coding`, `nestjs-security`, `lambda-security`         | [`no-missing-authentication`](https://eslint.interlace.tools/docs/security/plugin-secure-coding/rules/no-missing-authentication), [`require-guards`](https://eslint.interlace.tools/docs/security/plugin-nestjs-security/rules/require-guards), [`no-missing-authorization-check`](https://eslint.interlace.tools/docs/security/plugin-lambda-security/rules/no-missing-authorization-check) |
| [A02](https://owasp.org/Top10/A02_2021-Cryptographic_Failures/)                     | Cryptographic Failures            | `node-security`, `jwt`                                        | [`no-weak-hash-algorithm`](https://eslint.interlace.tools/docs/security/plugin-node-security/rules/no-weak-hash-algorithm), [`no-ecb-mode`](https://eslint.interlace.tools/docs/security/plugin-node-security/rules/no-ecb-mode), [`no-weak-secret`](https://eslint.interlace.tools/docs/security/plugin-jwt/rules/no-weak-secret)                                                           |
| [A03](https://owasp.org/Top10/A03_2021-Injection/)                                  | Injection                         | `pg`, `mongodb-security`, `secure-coding`, `browser-security` | [`no-unsafe-query`](https://eslint.interlace.tools/docs/security/plugin-pg/rules/no-unsafe-query), [`no-operator-injection`](https://eslint.interlace.tools/docs/security/plugin-mongodb-security/rules/no-operator-injection), [`no-innerhtml`](https://eslint.interlace.tools/docs/security/plugin-browser-security/rules/no-innerhtml)                                                    |
| [A04](https://owasp.org/Top10/A04_2021-Insecure_Design/)                            | Insecure Design _(partial)_       | `secure-coding`, `nestjs-security`                            | [`require-secure-defaults`](https://eslint.interlace.tools/docs/security/plugin-secure-coding/rules/require-secure-defaults), [`no-missing-validation-pipe`](https://eslint.interlace.tools/docs/security/plugin-nestjs-security/rules/no-missing-validation-pipe)                                                                                                                           |
| [A05](https://owasp.org/Top10/A05_2021-Security_Misconfiguration/)                  | Security Misconfiguration         | `express-security`, `browser-security`, `pg`                  | [`require-helmet`](https://eslint.interlace.tools/docs/security/plugin-express-security/rules/require-helmet), [`require-csp-headers`](https://eslint.interlace.tools/docs/security/plugin-browser-security/rules/require-csp-headers), [`no-unsafe-search-path`](https://eslint.interlace.tools/docs/security/plugin-pg/rules/no-unsafe-search-path)                                        |
| [A06](https://owasp.org/Top10/A06_2021-Vulnerable_and_Outdated_Components/)         | Vulnerable Components _(partial)_ | `node-security`                                               | [`detect-suspicious-dependencies`](https://eslint.interlace.tools/docs/security/plugin-node-security/rules/detect-suspicious-dependencies), [`require-dependency-integrity`](https://eslint.interlace.tools/docs/security/plugin-node-security/rules/require-dependency-integrity), [`lock-file`](https://eslint.interlace.tools/docs/security/plugin-node-security/rules/lock-file)         |
| [A07](https://owasp.org/Top10/A07_2021-Identification_and_Authentication_Failures/) | Authentication Failures           | `jwt`, `secure-coding`, `express-security`                    | [`no-algorithm-none`](https://eslint.interlace.tools/docs/security/plugin-jwt/rules/no-algorithm-none), [`no-algorithm-confusion`](https://eslint.interlace.tools/docs/security/plugin-jwt/rules/no-algorithm-confusion), [`no-insecure-cookie-options`](https://eslint.interlace.tools/docs/security/plugin-express-security/rules/no-insecure-cookie-options)                              |
| [A08](https://owasp.org/Top10/A08_2021-Software_and_Data_Integrity_Failures/)       | Data Integrity Failures           | `secure-coding`, `node-security`                              | [`no-unsafe-deserialization`](https://eslint.interlace.tools/docs/security/plugin-secure-coding/rules/no-unsafe-deserialization), [`no-zip-slip`](https://eslint.interlace.tools/docs/security/plugin-node-security/rules/no-zip-slip), [`no-unsafe-dynamic-require`](https://eslint.interlace.tools/docs/security/plugin-node-security/rules/no-unsafe-dynamic-require)                     |
| [A09](https://owasp.org/Top10/A09_2021-Security_Logging_and_Monitoring_Failures/)   | Logging Failures                  | `secure-coding`, `lambda-security`                            | [`no-pii-in-logs`](https://eslint.interlace.tools/docs/security/plugin-secure-coding/rules/no-pii-in-logs), [`no-env-logging`](https://eslint.interlace.tools/docs/security/plugin-lambda-security/rules/no-env-logging), [`no-error-swallowing`](https://eslint.interlace.tools/docs/security/plugin-lambda-security/rules/no-error-swallowing)                                             |
| [A10](https://owasp.org/Top10/A10_2021-Server-Side_Request_Forgery_%28SSRF%29/)     | SSRF                              | `node-security`, `lambda-security`, `browser-security`        | [`no-ssrf`](https://eslint.interlace.tools/docs/security/plugin-node-security/rules/no-ssrf), [`no-user-controlled-requests`](https://eslint.interlace.tools/docs/security/plugin-lambda-security/rules/no-user-controlled-requests), [`require-url-validation`](https://eslint.interlace.tools/docs/security/plugin-browser-security/rules/require-url-validation)                          |

Each row lists representative rules, not the whole set — A03 alone spans SQL,
NoSQL, LDAP, XPath, and DOM injection across the four plugins above, plus
command/eval (`node-security`) and prompt injection (the AI layer) elsewhere in
the ecosystem.

---

## A04 and A06: where source analysis hands off to another control

This is where "100% OWASP coverage" decks lie. Two of the ten are **not source
patterns at a call site**, so no source linter — this one included — fully
covers them. Naming the right control instead of faking a rule is what a
security reviewer actually wants:

- **A04 Insecure Design** — a missing rate limit on a money-moving endpoint, a
  trust boundary in the wrong place, a workflow that can be replayed. That's an
  _architectural_ problem. A few rules nudge toward safe defaults
  (`require-secure-defaults`, `no-missing-validation-pipe`), but the real
  control is **threat modeling and design review**, not a linter. The rules that
  exist for A04 catch symptoms of poor defaults — they don't catch the absence of
  a rate limit or a broken trust boundary. That's the gap most teams assume is covered.
- **A06 Vulnerable & Outdated Components** — a transitive dependency with a
  published CVE. That's a _Software Composition Analysis_ problem.
  `node-security` covers the **source-hygiene slice** — suspicious install
  scripts (`detect-suspicious-dependencies`), integrity/lockfile drift
  (`require-dependency-integrity`, `lock-file`) — but the CVE graph itself
  belongs to `npm audit`, Dependabot, or Snyk. Use both; they answer different
  questions.

Anyone selling you "automated 100% OWASP" is mapping a defaults rule to
"Insecure Design" and hoping you don't open the OWASP page. You should.

---

## Why these survive code review (and why AI now ships them faster)

None of the 8 categories above are exotic. They survive review for boring,
human reasons — and the same reasons are now amplified by the assistant in your
editor.

Take A03/A07. The reason `client.query('SELECT * FROM t WHERE id = ' + id)` and
`jwt.verify(token, secret)` without an `algorithms` allowlist sail through PR
review is that **they look like the happy path**. The string concatenation reads
as "build a query." The verify call reads as "check the token." A reviewer
skimming a 600-line diff at 5pm pattern-matches on intent, not on the trust
boundary — and both lines _do_ what they appear to do, right up until someone
sends `id = 1 OR 1=1` or a token with `"alg":"none"`. There's no red flag in
the syntax; the vulnerability is in what's _missing_ (a parameter slot, an
algorithm list), and humans are bad at reviewing absence.

I've watched a staff engineer — someone who would catch this instantly on a
whiteboard — approve exactly that `jwt.verify` line, because in a diff it was one
green-looking call surrounded by forty lines of legitimate refactor. The bug
wasn't a knowledge gap. It was attention budget. That's why "just train people to
review for security" never holds: it asks every reviewer to spot the absence of a
parameter, on every PR, forever, while tired. A rule never gets tired.

Now point an AI assistant at the same code. Ask it to "add an endpoint that
looks up a user by ID" and a large share of models will hand you the
concatenated query — because they were trained on the same Stack Overflow
answers that shipped it for fifteen years. I let Claude write 80 functions and
[65–75% carried a security
vulnerability](https://ofriperetz.dev/articles/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities);
when I handed it a clean NestJS service,
[the linter still found 6 holes the model
reintroduced](https://ofriperetz.dev/articles/claude-wrote-nestjs-service-eslint-found-6-security-holes).
The assistant doesn't make _new_ classes of mistake — it makes the _same_
OWASP-category mistakes, at the speed of autocomplete, and it makes them look
even more idiomatic than the human version did. And it's not one rogue model:
when I [ranked five frontier models by the security of the code they
wrote](https://ofriperetz.dev/articles/we-ranked-5-ai-models-by-security-the-leaderboard-is-wrong),
**every one of them leaked — a 49–73% vulnerability rate across all five**, with
auth-failure patterns alone showing up in 29–50% of generated functions. The
OWASP categories below are where _all_ of them leak, not a quirk of one vendor. Worse,
the fix gets re-broken: patch one AI-suggested injection and the next prompt
cheerfully reintroduces it, [the "AI hydra"
problem](https://ofriperetz.dev/articles/the-ai-hydra-problem-fix-one-ai-bug-get-two-more).

That's the actual case for mapping this to CI rather than to a checklist. A
human reviewer gets tired and a checklist gets stale, but a rule that fires on
`OWASP:A03-Injection` at the call site doesn't care whether a person or a model
typed the line. The rules below are the same whether the author has a pulse.

---

## What a finding looks like

Findings are deterministic strings — each carries the CWE, the OWASP category
the CWE rolls up to, a [CVSS](https://ofriperetz.dev/articles/cvss-scores-explained), the severity, and the compliance tags, then the
fix:

```text
src/db/tenants.ts
  8:15  error  🔒 CWE-426 OWASP:A05-Security CVSS:7.5 | Unsafe "SET search_path" detected. | CRITICAL [SOC2,PCI-DSS]
              Fix: Do not use dynamic values for search_path. Use static strings or strict validation.

src/app/chat/route.ts
  6:11  error  🔒 CWE-74 OWASP:A03-Injection CVSS:9 | User input "userMessage" passed directly to generateText prompt without validation | CRITICAL [SOC2,GDPR]
              Fix: Validate input before use: generateText({ prompt: validateInput(userInput) })
```

The inline `OWASP:Axx` tag is the classic web category the rule's CWE maps to
(CWE-74 → `A03 Injection`). Because it's a stable token, you can turn a lint run
into **audit evidence** — a coverage count per OWASP category:

```javascript
// npx eslint . --format json > security-report.json
const report = require("./security-report.json");

const byCategory = report
  .flatMap((file) => file.messages)
  .map((m) => m.message.match(/OWASP:(A\d+)/)?.[1])
  .filter(Boolean)
  .reduce((acc, cat) => ((acc[cat] = (acc[cat] || 0) + 1), acc), {});

console.log("OWASP findings by category:", byCategory);
// → { A03: 12, A05: 4, A02: 2, ... }
```

That JSON is the artifact you hand the auditor — not a slide.

---

## Build your config, layer by layer

Don't install everything. Start with the core, then add the plugins that match
your stack. `configs` is a **named export** on every plugin (the default export
is the plugin object):

```bash
# core + the specialized layers you actually run — pick your manager
npm install --save-dev eslint-plugin-secure-coding eslint-plugin-node-security eslint-plugin-jwt-security eslint-plugin-postgresql-security
yarn add -D eslint-plugin-secure-coding eslint-plugin-node-security eslint-plugin-jwt-security eslint-plugin-postgresql-security
pnpm add -D eslint-plugin-secure-coding eslint-plugin-node-security eslint-plugin-jwt-security eslint-plugin-postgresql-security
bun add -d eslint-plugin-secure-coding eslint-plugin-node-security eslint-plugin-jwt-security eslint-plugin-postgresql-security
```

```js
// eslint.config.js — flat config
import { configs as secureCoding } from "eslint-plugin-secure-coding";
import { configs as nodeSecurity } from "eslint-plugin-node-security";
import { configs as jwt } from "eslint-plugin-jwt-security";
import { configs as pg } from "eslint-plugin-postgresql-security";

export default [
  secureCoding.recommended, // A01/A03/A04/A08/A09 — general source patterns
  nodeSecurity.recommended, // A02/A06/A08/A10 — crypto, supply-chain, SSRF
  jwt.recommended, // A02/A07 — token & signature security

  // scope database rules to where queries live
  { files: ["**/db/**", "**/repositories/**"], ...pg.recommended },
];
```

> Name the file `eslint.config.mjs` if your `package.json` isn't
> `"type": "module"` — the `import` syntax above needs ESM (the plugins
> themselves are CommonJS and load fine either way via Node's CJS↔ESM interop).

Add `eslint-plugin-browser-security` (frontend, A03/A05/A07), then
`eslint-plugin-express-security` / `eslint-plugin-nestjs-security` /
`eslint-plugin-lambda-security` / `eslint-plugin-mongodb-security` as your
backend stack dictates. `eslint-plugin-vercel-ai-security` adds the LLM layer —
see [its honest OWASP-LLM map](https://ofriperetz.dev/articles/100-owasp-llm-top-10-coverage-for-vercel-ai-sdk).

> `eslint-plugin-crypto` is **deprecated** — its weak-algorithm / insecure-random
> rules were consolidated into `eslint-plugin-node-security`. Install
> node-security, not crypto.

```yaml
# CI — fail the PR on any new OWASP-tagged finding
- run: npx eslint . --max-warnings 0
```

Want the exact rule count your install ships, instead of trusting a number in a
title? Count it from your own `node_modules` — this is the only count that
matters, because it's the one running in your CI:

```bash
# rules across every interlace security plugin you've installed
for p in secure-coding node-security jwt pg mongodb-security \
         browser-security express-security nestjs-security \
         lambda-security vercel-ai-security; do
  node -e "try{console.log(Object.keys(require('eslint-plugin-'+process.argv[1]).rules).length)}catch{console.log(0)}" "$p"
done | paste -sd+ - | bc
```

---

## Compatibility

Every plugin in the map ships the same contract:

| Surface              | Support                                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Package managers** | npm, yarn, pnpm, bun — plain dev dependencies                                                                      |
| **Node**             | `>= 18.0.0`                                                                                                        |
| **ESLint**           | `^8.0.0 \|\| ^9.0.0 \|\| ^10.0.0`, flat config                                                                     |
| **Module system**    | CommonJS — loads from `eslint.config.js` or `.mjs`                                                                 |
| **Targets**          | AST-based — they read your source; the framework/driver peer is optional, never a runtime dep                      |
| **Oxlint**           | flagship rules wired via the `interlace-*` ports with ESLint↔Oxlint parity gated in CI; full sets run ESLint-first |

---

## Where this fits

This is the ecosystem-level OWASP view — the index page of a larger series. Each
category above has a deep-dive that walks the full rule set, the attack behind
it, and the code that survived review:

- [The 30-minute security audit: a static analysis protocol for onboarding](https://ofriperetz.dev/articles/the-30-minute-security-audit-onboarding-a-new-codebase) — how to run this map as a structured audit from day one
- [Benchmark: 17 ESLint security plugins compared](https://ofriperetz.dev/articles/benchmark-17-eslint-security-plugins-compared) — how the Interlace plugins compare to every alternative
- [`eslint-plugin-jwt-security`](https://ofriperetz.dev/articles/getting-started-eslint-plugin-jwt-security) — the `alg:none` bypass (A07) and 12 more auth rules
- [`eslint-plugin-postgresql-security`](https://ofriperetz.dev/articles/getting-started-eslint-plugin-postgresql-security) — SQL injection (A03), connection leaks, the N+1 insert loop
- [`search_path` hijacking](https://ofriperetz.dev/articles/searchpath-hijacking-postgresql-attack) — the A05 attack (CWE-426) most teams have never heard of
- [I let Claude write 80 functions](https://ofriperetz.dev/articles/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities) — what these rules catch when the author is a model, not a person (65–75% had a vuln)
- [We ranked 5 AI models by security](https://ofriperetz.dev/articles/we-ranked-5-ai-models-by-security-the-leaderboard-is-wrong) — 700 functions, every model leaking 49–73%, all graded by these same OWASP-tagged rules
- [OWASP LLM Top 10](https://ofriperetz.dev/articles/100-owasp-llm-top-10-coverage-for-vercel-ai-sdk) — the AI list, mapped just as honestly (also 8 of 10)

---

## Links

- 📦 [npm: eslint-plugin-secure-coding](https://www.npmjs.com/package/eslint-plugin-secure-coding) (core) · [node-security](https://www.npmjs.com/package/eslint-plugin-node-security) · [jwt](https://www.npmjs.com/package/eslint-plugin-jwt-security) · [pg](https://www.npmjs.com/package/eslint-plugin-postgresql-security)
- 📖 [Full rule docs (per-rule CWE + OWASP)](https://eslint.interlace.tools)
- 🔐 [OWASP Top 10 (2021)](https://owasp.org/www-project-top-ten/)
- 💻 [Source on GitHub — the full Interlace plugin ecosystem](https://github.com/ofri-peretz/eslint)

::dev-to-cta{url="https://github.com/ofri-peretz/eslint"}
⭐ Star on GitHub if this is on your roadmap.
::

Which OWASP Top 10 category are you least confident your CI covers — and have you verified it with actual rule-to-category mapping? I'll start: I've lost count of the "Insecure Design: covered ✅" answers sitting on top of a money-moving endpoint with no rate limit. Tell me yours.

---

_Part of the [Interlace ESLint ecosystem](https://eslint.interlace.tools). Source on [GitHub](https://github.com/ofri-peretz/eslint) · Follow: [Dev.to/ofri-peretz](https://dev.to/ofri-peretz)_
