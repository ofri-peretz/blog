---
title: "8 of the OWASP Top 10 Are ESLint Rules. 2 Aren't — and That's the Honest Audit Answer."
description: "A real, auditable mapping of the OWASP Top 10 (2021) to ten domain-security ESLint plugins: which categories a CWE-tagged rule genuinely catches in CI, and the two (Insecure Design, Vulnerable Components) that need controls beyond source analysis."
slug: "mapping-your-codebase-to-owasp-top-10-with-247-eslint-rules"
canonical_url: "https://ofriperetz.dev/articles/mapping-your-codebase-to-owasp-top-10-with-247-eslint-rules"
devto_url: "https://dev.to/ofri-peretz/mapping-your-codebase-to-owasp-top-10-with-247-eslint-rules-25f0"
devto_id: 3138808
published_at: "2025-12-31T18:15:25Z"
edited_at: "2026-02-05T04:58:59Z"
cover_image: "https://ofriperetz.dev/cdn/blog-cover-image/mapping-your-codebase-to-owasp-top-10-with-247-eslint-rules.png"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/mapping-your-codebase-to-owasp-top-10-with-247-eslint-rules.png"
reading_time_minutes: 8
tags:
  - "eslint"
  - "security"
  - "owasp"
  - "devsecops"
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

"How do you address the OWASP Top 10?" is now a line item on every enterprise
security questionnaire. The honest answer is more useful than a "100% covered"
checkbox — because **static analysis genuinely catches 8 of the 10 web
categories at the source, and the other 2 are not source patterns at all.**
Knowing which is which is the difference between a control you can _audit_ and a
compliance-theater slide.

No single plugin covers it. SQL injection needs database-aware rules; JWT
attacks need token-aware rules; DOM XSS needs browser-aware rules. So the map
below spans **ten domain-security plugins** (part of the 19-plugin
[Interlace](https://eslint.interlace.tools) ecosystem). Every rule carries a
CWE, and most findings carry the classic OWASP category the CWE rolls up to, so
the evidence is greppable, not hand-waved.

> This is the **web** OWASP Top 10 (2021). The AI/LLM list is mapped separately
> in [the OWASP LLM Top 10 piece](https://ofriperetz.dev/articles/100-owasp-llm-top-10-coverage-for-vercel-ai-sdk) —
> also honestly, 8 of 10.

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
| [A10](https://owasp.org/Top10/A10_2021-Server-Side_Request_Forgery_SSRF/)           | SSRF                              | `node-security`, `lambda-security`, `browser-security`        | [`no-ssrf`](https://eslint.interlace.tools/docs/security/plugin-node-security/rules/no-ssrf), [`no-user-controlled-requests`](https://eslint.interlace.tools/docs/security/plugin-lambda-security/rules/no-user-controlled-requests), [`require-url-validation`](https://eslint.interlace.tools/docs/security/plugin-browser-security/rules/require-url-validation)                          |

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
  control is **threat modeling and design review**, not a linter.
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

## What a finding looks like

Findings are deterministic strings — each carries the CWE, the OWASP category
the CWE rolls up to, a CVSS, the severity, and the compliance tags, then the
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
npm install --save-dev eslint-plugin-secure-coding eslint-plugin-node-security eslint-plugin-jwt eslint-plugin-pg
yarn add -D eslint-plugin-secure-coding eslint-plugin-node-security eslint-plugin-jwt eslint-plugin-pg
pnpm add -D eslint-plugin-secure-coding eslint-plugin-node-security eslint-plugin-jwt eslint-plugin-pg
bun add -d eslint-plugin-secure-coding eslint-plugin-node-security eslint-plugin-jwt eslint-plugin-pg
```

```js
// eslint.config.js — flat config
import { configs as secureCoding } from "eslint-plugin-secure-coding";
import { configs as nodeSecurity } from "eslint-plugin-node-security";
import { configs as jwt } from "eslint-plugin-jwt";
import { configs as pg } from "eslint-plugin-pg";

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

This is the ecosystem-level OWASP view. Each plugin has a deep-dive that walks
its full rule set and the attacks behind them:

- [`eslint-plugin-jwt`](https://ofriperetz.dev/articles/getting-started-eslint-plugin-jwt) — the `alg:none` bypass and 12 more auth rules
- [`eslint-plugin-pg`](https://ofriperetz.dev/articles/getting-started-eslint-plugin-pg) — SQL injection, connection leaks, the N+1 insert loop
- [`search_path` hijacking](https://ofriperetz.dev/articles/searchpath-hijacking-postgresql-attack) — the A05 attack most teams have never heard of
- [OWASP LLM Top 10](https://ofriperetz.dev/articles/100-owasp-llm-top-10-coverage-for-vercel-ai-sdk) — the AI list, mapped just as honestly

---

## Links

- 📦 [npm: eslint-plugin-secure-coding](https://www.npmjs.com/package/eslint-plugin-secure-coding) (core) · [node-security](https://www.npmjs.com/package/eslint-plugin-node-security) · [jwt](https://www.npmjs.com/package/eslint-plugin-jwt) · [pg](https://www.npmjs.com/package/eslint-plugin-pg)
- 📖 [Full rule docs (per-rule CWE + OWASP)](https://eslint.interlace.tools)
- 🔐 [OWASP Top 10 (2021)](https://owasp.org/www-project-top-ten/)
- 💻 [Source on GitHub — the 19-plugin ecosystem](https://github.com/ofri-peretz/eslint)

::dev-to-cta{url="https://github.com/ofri-peretz/eslint"}
⭐ Star on GitHub if "how do you cover the OWASP Top 10?" has ever landed in your inbox.
::

---

I'm **Ofri Peretz**, a security engineering leader and the author of the
Interlace ESLint ecosystem — domain-specific static analysis for security,
reliability, and performance on the Node.js stack.

[ofriperetz.dev](https://ofriperetz.dev) · [LinkedIn](https://linkedin.com/in/ofri-peretz) · [GitHub](https://github.com/ofri-peretz)
