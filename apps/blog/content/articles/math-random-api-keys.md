---
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/math-random-api-keys.jpg"
cover_image: "https://ofriperetz.dev/cdn/blog-cover-image/math-random-api-keys.jpg"
title: "Math.random() Is Not Secure. I Found It Generating API Keys in a 44K-Star Repo."
description: "Math.random() is a PRNG, not a CSPRNG — its outputs are predictable once an attacker recovers the internal state. I found this pattern in a 44K-star open-source codebase generating integration API keys. Here is the attack class, the ESLint rule that catches it, and the one-line fix."
slug: "math-random-api-keys"
published: true
date: "2026-05-30"
tags:
  - "security"
  - "javascript"
  - "node"
  - "devsecops"
devto_id: 3781862
tier: "TOPIC"
canonical_url: "https://ofriperetz.dev/articles/math-random-api-keys"
author:
  name: "Ofri Peretz"
  username: "ofri-peretz"
  avatar: "https://media2.dev.to/dynamic/image/width=640,height=640,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Fuser%2Fprofile_image%2F3669992%2F50a1f256-472c-48a1-85e8-149459647ea7.png"
  twitter: "ofriperetzdev"
---

The top Stack Overflow answer for "generate a unique token in JavaScript" returns this:

```javascript
Math.random().toString(36).substring(2);
```

It appears in password reset tokens, session IDs, invite codes, and API keys across the JavaScript ecosystem. I found it verbatim in [calcom/cal.diy](https://github.com/calcom/cal.diy) (~44K stars) — the MIT open-source edition of Cal.com:

```javascript
const apiKey = `cal_live_${Math.random().toString(36).substring(2)}`;
```

`Math.random()` is a PRNG, not a CSPRNG. An attacker who observes consecutive outputs from a server-side process can recover the internal state and predict every future token. Here is the attack, the ESLint rule that catches this pattern automatically, and the one-line fix.

---

## Why Math.random() is dangerous for tokens

`Math.random()` is a pseudo-random number generator — fast, but deterministic. Given V8's initial seed, its entire output sequence is fixed. An attacker who observes enough outputs can recover the 128-bit internal state and predict every future call.

```javascript
// What you write:
const token = Math.random().toString(36).substring(2);

// V8 uses xorshift128+ under the hood.
// After observing a handful of consecutive Math.random() calls from the same process:
// → internal state recoverable (see d0nutptr/v8_rand_buster)
// → all future Math.random() outputs predictable
// → all future tokens predictable
```

**[CWE-338](https://ofriperetz.dev/articles/cwe-taxonomy-explained): Use of Cryptographically Weak Pseudo-Random Number Generator.**

### The exploit

xorshift128+ is algebraically invertible. Given full-precision doubles (52 bits each), the 128-bit internal state can be recovered. The [v8_rand_buster](https://github.com/d0nutptr/v8_rand_buster) implementation recovers state from 3–4 consecutive `Math.random()` outputs. The following shows the attack flow — the concrete values are illustrative; v8_rand_buster handles the actual algebra.

```javascript
// Illustrative pseudocode — attacker collects consecutive Math.random() outputs:
//   cal_live_k7f2m9p8x3z  →  Math.random() returned 0.38914728471823...
//   cal_live_hq5r1n6wzt   →  Math.random() returned 0.72342901847612...
//   cal_live_p9x4b2m7vy   →  Math.random() returned 0.15678234019876...

// Feed full-precision doubles to state-recovery:
// → internal xorshift128+ state reconstructed (s0, s1 recovered algebraically)

// Predict the next Math.random() call:
// → 0.59123847561029...  →  "cal_live_s2v8n3k1xq"
// Attacker knows the next key before it is issued.
```

xorshift128+ is algebraically invertible: given output values (full 52-bit precision), the 128-bit internal state can be solved. v8_rand_buster recovers state from 3–4 consecutive outputs. The practical requirement is consecutive outputs from the same process — which is achievable when key generation is observable and isolated.

**Two attack surfaces, depending on where the code runs:**

_Client-side (the calcom/cal.diy case):_ The key is generated in the user's own browser. Client-side key generation exposes the credential in the client's environment before it reaches the server — visible in network logs, browser devtools, extensions, or XSS. The PRNG weakness is secondary to the architectural problem of minting a secret in the browser at all.

_Server-side (the more general case):_ If `Math.random()` generates tokens in a server process, an attacker who observes multiple consecutive tokens (e.g., via multiple signups, password resets, or API requests) can recover internal state and predict the next token — including tokens for other users. This is the scenario where state recovery attacks apply most cleanly.

---

## Where this pattern appears

```javascript
// Top Stack Overflow pattern for "generate unique token":
const token = Math.random().toString(36).substring(2, 15);

// Session ID (with Date.now() — adds a predictable timestamp, not additional unpredictability):
const sessionId =
  Date.now().toString(36) + Math.random().toString(36).substring(2);

// Invite code:
const inviteToken = Math.random().toString(36).substring(2, 8).toUpperCase();

// The calcom/cal.diy pattern:
const apiKey = `cal_live_${Math.random().toString(36).substring(2)}`;
```

The first three are less exploitable than the calcom/cal.diy pattern — partial substrings leak less state per observation. But all four use a PRNG for a value that should be a CSPRNG.

---

## Why it survives code review

- `Math.random()` literally has "random" in the name
- The output looks unpredictable: `k7f2m9p8x3z`
- No runtime errors — tokens generate correctly, tests pass
- Reviewers focus on the business logic, not PRNG security properties

Nobody reviews token generation and asks "is this the right _kind_ of random?" I didn't catch the calcom/cal.diy line by being clever either — `cal_live_` and `Math.random()` on the same line stops being subtle the moment you're looking for it. It's the chess habit: distrust the move that looks free. A token that _looks_ random is exactly the one worth a second glance. The ESLint rule takes that second glance on every commit, so nobody has to remember to.

> **Source context:** calcom/cal.diy is the MIT open-source edition of Cal.com (the enterprise codebase runs separately under AGPL as `calcom/cal.com`). The `Math.random()` line is in a client-side React component. For client-side code, the architectural problem — generating a secret in the browser — is the primary concern. The PRNG weakness is secondary, but it compounds. The state-recovery attack in the Exploit section applies directly to server-side equivalents of this pattern.

---

## The ESLint rule that catches it

`eslint-plugin-node-security/no-math-random-crypto` fires when `Math.random()` is assigned to a variable whose name matches any of 18+ security-sensitive patterns: `token`, `key`, `secret`, `session`, `auth`, `csrf`, `nonce`, `otp`, `code`, `verify`, and more.

**On [false positives](https://ofriperetz.dev/articles/confusion-matrix-tp-fp-fn-tn):** React's list reconciliation `key` prop doesn't trigger this — the rule checks `Math.random()` assignments, not JSX attributes. `code` for HTTP status codes or country codes won't trigger either, because the rule only fires when `Math.random()` is the value being assigned. If you have legitimate non-security uses of a `key` variable fed by `Math.random()` (rare but possible), configure `allowInTests: true` or use an ESLint disable comment with a note explaining why.

```text
node-security/no-math-random-crypto
CWE-338 | Math.random() used in cryptographic context 'apiKey'
Use crypto.randomBytes() or crypto.randomUUID() instead
  apps/web/components/apps/make/Setup.tsx (line varies by version)
```

This fires on the calcom/cal.diy line.

---

## The fix — server-side vs client-side

**Server-side (Node.js API route, Express, NestJS):**

```javascript
import crypto from "node:crypto";

// Opaque token — hex string, 48 characters:
const apiKey = `cal_live_${crypto.randomBytes(24).toString("hex")}`;

// UUID format:
const id = crypto.randomUUID();
```

**Client-side / browser (the deeper issue in the calcom/cal.diy case):**

Generating secret API keys client-side is itself the architectural problem — the key is visible in client memory and potentially in browser devtools. The right fix is to move key generation server-side and return the key via an authenticated API call. If you must generate randomness in the browser, use Web Crypto:

```javascript
// Web Crypto — available in all modern browsers and Node.js 19+:
const array = new Uint8Array(24);
globalThis.crypto.getRandomValues(array);
const token = Array.from(array)
  .map((b) => b.toString(16).padStart(2, "0"))
  .join("");
```

`globalThis.crypto.getRandomValues()` uses the OS CSPRNG and is safe in both browser and Node.js environments.

---

## The config

```javascript
// eslint.config.mjs
import nodeSecurity from "eslint-plugin-node-security";
import tsParser from "@typescript-eslint/parser";

export default [
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],
    languageOptions: { parser: tsParser },
    plugins: { "node-security": nodeSecurity },
    rules: {
      "node-security/no-math-random-crypto": "error",
    },
  },
];
```

```bash
npm install --save-dev eslint-plugin-node-security
npx eslint src/
```

Full rule documentation at [eslint.interlace.tools](https://eslint.interlace.tools/docs/security/plugin-node-security/rules/no-math-random-crypto).

Note: this rule catches the PRNG problem. It won't flag client-side key generation as an architectural issue — that's a separate concern for code review.

If you're auditing older code for this class of vulnerability more broadly, the [30-minute security audit protocol](https://ofriperetz.dev/articles/the-30-minute-security-audit-onboarding-a-new-codebase) covers Math.random() alongside credential handling, JWT configuration, and input validation in a single pass.

---

_Have you run this against your codebase yet? I'm specifically curious where it shows up — expected places like token generation, or somewhere that surprised you._

---

_See also:_
_[Exploit Analysis: The JWT Algorithm 'none' Attack (And the Guard)](https://ofriperetz.dev/articles/the-jwt-algorithm-none-attack-the-vulnerability-in-1-line-of-code-d9g)_

---

📦 [`eslint-plugin-node-security`](https://www.npmjs.com/package/eslint-plugin-node-security) · [Rule docs](https://eslint.interlace.tools/docs/security/plugin-node-security/rules/no-math-random-crypto)

<!-- markdownlint-disable MD034 -->

{% cta https://github.com/ofri-peretz/eslint %}
⭐ Star on GitHub
{% endcta %}

<!-- markdownlint-enable MD034 -->

---

[GitHub](https://github.com/ofri-peretz) | [X](https://x.com/ofriperetzdev) | [LinkedIn](https://linkedin.com/in/ofri-peretz) | [Dev.to](https://dev.to/ofri-peretz) | [ofriperetz.dev](https://ofriperetz.dev)
