---
title: "eslint-plugin-security Is the 14-Rule Generic Floor. Here's the Domain Depth to Layer on Top."
description: "eslint-plugin-security is the foundational, generic Node security linter — 14 rules, 2.4M+ weekly downloads, actively maintained. It catches the cross-cutting classics; it isn't built for SQL, JWT, crypto, or AI depth. Here's what each layer covers and how to run them together."
slug: "eslint-plugin-security-is-unmaintained-heres-what-nobody-tells-you-96h"
canonical_url: "https://ofriperetz.dev/articles/eslint-plugin-security-is-unmaintained-heres-what-nobody-tells-you-96h"
devto_url: "https://dev.to/ofri-peretz/eslint-plugin-security-is-unmaintained-heres-what-nobody-tells-you-96h"
devto_id: 3237157
published_at: "2026-02-06T06:40:05Z"
edited_at: "2026-02-06T06:54:40Z"
cover_image: "https://ofriperetz.dev/cdn/blog-cover-image/eslint-plugin-security-is-unmaintained-heres-what-nobody-tells-you-96h.png"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/eslint-plugin-security-is-unmaintained-heres-what-nobody-tells-you-96h.png"
reading_time_minutes: 7
tags:
  - "security"
  - "eslint"
  - "javascript"
  - "node"
author:
  name: "Ofri Peretz"
  username: "ofri-peretz"
  avatar: "https://media2.dev.to/dynamic/image/width=640,height=640,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Fuser%2Fprofile_image%2F3669992%2F50a1f256-472c-48a1-85e8-149459647ea7.png"
  twitter: "ofriperetzdev"
series: "ESLint Security Benchmark Series"
---

`eslint-plugin-security` is the foundational JavaScript security linter — **2.4M+
weekly downloads**, actively maintained (4.0.0 shipped February 2026, adding
`detect-bidi-characters` for Trojan-Source attacks). Its **14 rules** are the
generic floor every Node project should have.

The honest framing isn't "replace it" — it's that 14 _generic_ rules are a
**floor, not a ceiling**. They catch the cross-cutting classics; they aren't
built for the depth of SQL, JWT, crypto, or AI-agent security. The move is to
**layer** domain rules on top. Here's exactly what the floor covers, what it
doesn't, and how to run both.

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

On a fixture of 12 Node vulnerability classes, `eslint-plugin-security` flagged
**21** issues; the domain plugins flagged **46** (measured — see
[the 4-way benchmark](https://ofriperetz.dev/articles/your-eslint-security-plugin-is-missing-80-of-vulnerabilities-i-have-proof)).
The 25-finding gap is **domain depth a generic ruleset has no rule for**:

| Domain              | What's missing from a generic linter              | The layer that adds it                                                                                                  |
| ------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **PostgreSQL**      | SQL injection, connection leaks, COPY exploits    | [`eslint-plugin-pg`](https://eslint.interlace.tools/docs/security/plugin-pg) (13 rules)                                 |
| **JWT / auth**      | `alg:none`, algorithm confusion, claim validation | [`eslint-plugin-jwt`](https://eslint.interlace.tools/docs/security/plugin-jwt) (13 rules)                               |
| **Crypto & system** | weak hashes, ECB/static-IV, SSRF, zip-slip        | [`eslint-plugin-node-security`](https://eslint.interlace.tools/docs/security/plugin-node-security) (34 rules)           |
| **Browser / DOM**   | CSP, CORS, `innerHTML`, JWT-in-storage            | [`eslint-plugin-browser-security`](https://eslint.interlace.tools/docs/security/plugin-browser-security) (45 rules)     |
| **AI / LLM**        | prompt injection, tool-call agency                | [`eslint-plugin-vercel-ai-security`](https://eslint.interlace.tools/docs/security/plugin-vercel-ai-security) (19 rules) |

There's also a **precision** difference: on validated-safe code,
`eslint-plugin-security` produced 5 false positives in that benchmark
(`detect-object-injection` on allowlist-validated keys, `detect-non-literal-fs-filename`
on path-validated reads) — it pattern-matches the sink without seeing the guard.
The domain rules carry CWE/OWASP/CVSS metadata and AST-aware validation detection.

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

export default [
  security.configs.recommended, // your existing eslint-plugin-security — the generic floor (14 rules)
  secureCoding.recommended, // general OWASP source patterns
  nodeSecurity.recommended, // crypto, supply-chain, SSRF
  { files: ["**/db/**"], ...pg.recommended }, // PostgreSQL depth
  jwt.recommended, // auth depth
  // + browser-security (DOM/CSP) and vercel-ai-security (LLM) where your stack uses them
];
```

(The layering config keeps your already-installed `eslint-plugin-security`; the
install below adds the domain layers.)

Or migrate the general layer to `eslint-plugin-secure-coding` (27 rules, OWASP-mapped):

```bash
npm install --save-dev eslint-plugin-secure-coding eslint-plugin-node-security eslint-plugin-pg eslint-plugin-jwt
```

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
**layering domain depth on a solid floor**.

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

- 📦 [eslint-plugin-secure-coding](https://www.npmjs.com/package/eslint-plugin-secure-coding) · [node-security](https://www.npmjs.com/package/eslint-plugin-node-security) · [pg](https://www.npmjs.com/package/eslint-plugin-pg) · [jwt](https://www.npmjs.com/package/eslint-plugin-jwt)
- 📦 [eslint-plugin-security](https://www.npmjs.com/package/eslint-plugin-security) — the generic floor
- 📖 [Full rule docs](https://eslint.interlace.tools)
- 💻 [Source on GitHub](https://github.com/ofri-peretz/eslint)

::dev-to-cta{url="https://github.com/ofri-peretz/eslint"}
⭐ Star on GitHub if your stack needs more security depth than a generic floor.
::

---

I'm **Ofri Peretz**, a security engineering leader and the author of the
Interlace ESLint ecosystem — domain-specific static analysis for security,
reliability, and performance on the Node.js stack.

[ofriperetz.dev](https://ofriperetz.dev) · [LinkedIn](https://linkedin.com/in/ofri-peretz) · [GitHub](https://github.com/ofri-peretz)
