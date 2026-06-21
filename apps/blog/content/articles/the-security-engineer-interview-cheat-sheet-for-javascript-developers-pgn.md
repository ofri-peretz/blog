---
title: "13 Security Questions Every JS Interview Asks — and Why Reciting Them Won't Stop You Shipping the Bug"
description: "The 13 security concepts that come up in senior JavaScript/Node interviews — SQLi, XSS, CSRF, JWT, prototype pollution, ReDoS, timing attacks — each with the bad-vs-good code, the CWE, and the exact ESLint rule that stops your AI assistant (and you) from shipping the bad version anyway."
slug: "the-security-engineer-interview-cheat-sheet-for-javascript-developers-pgn"
canonical_url: "https://ofriperetz.dev/articles/the-security-engineer-interview-cheat-sheet-for-javascript-developers-pgn"
devto_url: "https://dev.to/ofri-peretz/the-security-engineer-interview-cheat-sheet-for-javascript-developers-pgn"
devto_id: 3137519
published_at: "2025-12-31T06:10:16Z"
edited_at: "2026-02-05T05:33:13Z"
cover_image: "https://ofriperetz.dev/og/cover/the-security-engineer-interview-cheat-sheet-for-javascript-developers-pgn"
social_image: "https://ofriperetz.dev/og/article/the-security-engineer-interview-cheat-sheet-for-javascript-developers-pgn"
reading_time_minutes: 7
tags:
  - "security"
  - "ai"
  - "node"
  - "eslint"
reactions: 0
comments: 0
views: 0
author:
  name: "Ofri Peretz"
  username: "ofri-peretz"
  avatar: "https://media2.dev.to/dynamic/image/width=640,height=640,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Fuser%2Fprofile_image%2F3669992%2F50a1f256-472c-48a1-85e8-149459647ea7.png"
  twitter: "ofriperetzdev"
series: null
---

Question #7 on this list is JWTs. In a [700-function benchmark I ran across 5 AI
models](https://ofriperetz.dev/articles/we-ranked-5-ai-models-by-security-the-leaderboard-is-wrong),
Claude Opus generated vulnerable JWT code **7 out of 7 times** — leaking
sensitive data into the token payload on every single run. A candidate who can
recite the `algorithm: none` bypass cold will still merge that diff, because the
model wrote it and the diff looked clean. Reciting the answer and *not shipping
the bug* are two different skills, and interviews only test the first one.

I've interviewed 50+ backend and full-stack engineers, and the pattern is
relentless: the candidates who define these vulnerabilities flawlessly are the
same people whose PRs I later flag for the exact bug they just defined. Security
questions show up in almost every loop now — even for roles that aren't labeled
"security" — and they all test recall. None of them test the thing that
actually ships the bug: what your editor autocompletes at 5pm on a Friday.

It's gotten worse with AI in the loop. Ask Copilot or Claude to "query the user
by id" and you'll often get string-interpolated SQL — the same CWE-89 the
candidate aced an hour earlier. The model has read every Stack Overflow answer,
including the wrong ones, and it has no opinion about which it pastes.

So here are the **13 questions** that come up the most — each with the answer in
one breath, the bad-vs-good code, the CWE, and the part most cheat-sheets skip:
**the ESLint rule that fails CI when you (or your assistant) ship the bad
version anyway.**

The best answer to "how do you stay current?" isn't "I read CVEs." It's "I
encode the answer to every one of these into a rule, so neither I nor an AI can
merge the wrong version." This is how.

If you'd rather run the list against your own codebase than read it as trivia,
it's one install — [full config and the per-surface matrix are below](#the-great-answer-enforce-it-dont-memorize-it):

```bash
npm install --save-dev eslint-plugin-secure-coding eslint-plugin-node-security \
  eslint-plugin-jwt eslint-plugin-pg eslint-plugin-browser-security eslint-plugin-express-security
```

---

## The fundamentals (asked ~90% of the time)

### 1. SQL Injection

```javascript
db.query(`SELECT * FROM users WHERE id = ${userId}`); // ❌
db.query("SELECT * FROM users WHERE id = $1", [userId]); // ✅
```

**Say:** "Parameterized queries separate data from code." **CWE-89.** Enforced by
`pg/no-unsafe-query`.

This is the one I most often watch get *re-introduced*. A candidate explains it
perfectly, then a week later asks an assistant to "add a search filter," gets a
template literal back, and merges it because the diff looked small. The rule
catches the interpolation regardless of who typed it — there's a whole
breakdown of the three shapes it has to detect in
[Three SQL Injection Patterns in node-postgres](https://ofriperetz.dev/articles/three-sql-injection-patterns-node-postgres-eslint).

### 2. XSS (and its three types)

Stored (saved to the DB), reflected (echoed from the URL), and DOM (written by
client JS). The browser-side fix is the same reflex:

```javascript
element.innerHTML = userInput; // ❌
element.textContent = userInput; // ✅
```

**CWE-79.** Enforced by `browser-security/no-innerhtml`.

*Why it survives review:* the `innerHTML` almost always started life rendering a
*trusted* string — a hard-coded template, an icon, a bit of formatted markup. It
passed review because at the time the input genuinely was safe. Then a feature
landed that routed user content through the same helper, and the assignment never
changed. The diff that introduces the vulnerability touches the *caller*, not the
`innerHTML` line — so the reviewer looking at the dangerous line sees code that's
been there for a year. The rule flags the sink regardless of when the taint
arrived.

### 3. Password storage

```javascript
crypto.createHash("md5").update(password); // ❌
await bcrypt.hash(password, 12); // ✅
```

**Say:** "bcrypt or argon2, per-user salt, a deliberate work factor." Two CWEs
live here: a fast general-purpose hash (MD5/SHA-1) is **CWE-327** (broken
algorithm), and even a "real" hash with too low a work factor is **CWE-916**
(insufficient computational effort). The first is the one a linter can see
syntactically — `node-security/no-weak-hash-algorithm` flags the `md5`/`sha1`
call directly.

*Why it survives review:* the `createHash("md5")` line usually predates the
auth rewrite. It started life hashing an ETag or a cache key — a perfectly fine
use of MD5 — and someone later reached for "the hash function we already have"
when they added password storage. The reviewer sees a familiar helper, not a
credential path. The rule doesn't care about intent; it flags every weak-hash
call site and lets you allow-list the genuinely benign ones.

---

## Intermediate (asked ~70% of the time)

### 4. CSRF

Cross-Site Request Forgery rides an authenticated user's cookies to perform
actions they didn't intend. **Prevention:** synchronizer tokens, `SameSite`
cookies, origin checks. **CWE-352.** Enforced by
`express-security/require-csrf-protection`.

*Why it survives review:* the app started as a JSON API where CSRF "doesn't
apply" — no cookies, bearer tokens only. Then one team added a cookie session
for the admin panel, and every state-changing route inherited the cookie auth
without anyone re-opening the CSRF question. Nobody reviews "did this still-stateless-looking
endpoint just become CSRF-able?" because the route handler didn't change — the
auth middleware around it did. The rule flags the unprotected mutating route, not
the day the cookie showed up.

### 5. The Same-Origin Policy

Browsers isolate by origin (scheme + host + port). The controlled relaxations are
CORS, `postMessage`, and (legacy) JSONP — and an over-broad CORS policy
re-opens everything (**CWE-942**). `browser-security/no-permissive-cors` catches
the wildcard.

### 6. Timing attacks

```javascript
if (userToken === secretToken) {
} // ❌ leaks via comparison time
crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b)); // ✅ constant-time
```

**CWE-208.** Enforced by `node-security/no-timing-unsafe-compare`.

*Why it survives review:* `===` on two secrets looks *more* correct than the
`timingSafeEqual` alternative, not less — it's the obvious, readable comparison,
and the test suite passes identically either way because timing leaks don't show
up in unit tests. A reviewer has no red flag to react to; the bug is in how long
the line takes, not in what it returns. The rule knows the operands are secrets
and flags the variable-time compare the eye reads as fine.

### 7. JWTs

Verify the signature, check `exp`, never accept `algorithm: "none"`, and store in
an `httpOnly` cookie — **not** `localStorage`. **CWE-347** for the `none` bypass
(`jwt/no-algorithm-none`); the storage mistake is `browser-security/no-jwt-in-storage`.
The `none` bypass is worth seeing in full — it's [a one-line auth bypass that
most verify-then-trust code waves through](https://ofriperetz.dev/articles/the-jwt-algorithm-none-attack-the-vulnerability-in-1-line-of-code-d9g).

---

## Advanced (asked ~50% of the time)

### 8. Prototype pollution

```javascript
obj[key] = value; // ❌ key="__proto__" pollutes Object.prototype
if (key !== "__proto__" && key !== "constructor" && key !== "prototype")
  obj[key] = value; // ✅
```

**CWE-1321.** Caught by `secure-coding/detect-object-injection` (the rule's own
finding tags CWE-915; CWE-1321 is the canonical JS-prototype-pollution entry).

*Why it survives review:* the dynamic assignment lives inside an innocuous
helper — a config merger, a query-string parser, a `deepMerge` someone copied
off Stack Overflow — and it was written and reviewed against trusted input. The
vulnerability only appears when a later caller pipes a request body through that
helper, and that diff touches the *caller*, not the `obj[key] = value` line. The
reviewer sees a merge utility that's been stable for a year. The rule flags the
unguarded computed write itself, no matter how trusted the original caller was.

### 9. Content Security Policy

An HTTP header that restricts what can load: `default-src 'self'; script-src 'self' 'nonce-…'`.
A missing CSP is a **CWE-693** protection-mechanism failure; the absence-of-header
finding from `browser-security/require-csp-headers` tags **CWE-1021** (the
UI-redress / clickjacking surface CSP's `frame-ancestors` closes). The companion
`no-unsafe-inline-csp` flags the `'unsafe-inline'` that defeats the policy you did
ship.

### 10. ReDoS

```javascript
/^(a+)+$/.test("aaaaaaaaaaaaaaaaaaaaaaaa!"); // ❌ catastrophic backtracking
```

Regular-Expression Denial of Service. Caught by
`secure-coding/no-redos-vulnerable-regex`.

---

## Architecture (asked ~40% of the time)

### 11. Designing secure authentication

- Password hashing (bcrypt/argon2)
- Rate limiting on login + account lockout after repeated failures
- MFA
- Secure session management
- Password reset via time-limited tokens

Most of this is architectural, but the enforceable slice is real: the missing
rate limiter is `express-security/require-rate-limiting`. On a login route that
gap is **CWE-307** (excessive authentication attempts — i.e. brute force); the
rule's general finding is the broader **CWE-770** (no limit on resource
allocation), which is the same defect seen from the resource side. It survives
review because rate limiting is "ops' job" in everyone's mental model until the
credential-stuffing run shows up in the logs.

### 12. Secrets management

Environment variables at minimum; a secrets manager (Vault, AWS Secrets Manager)
in production; nothing in code or git history; a rotation policy. **CWE-798** —
`secure-coding/no-hardcoded-credentials` is the backstop for the last one. Entropy
scoring doesn't cut it on its own — see
[No Hardcoded Credentials: Why Entropy Isn't Enough](https://ofriperetz.dev/articles/no-hardcoded-credentials-entropy-isnt-enough)
for why pattern-only detection misses real secrets, and
[Hardcoded Secrets + AI Agents](https://ofriperetz.dev/articles/hardcoded-secrets-ai-agents-autofix)
for the compounding problem when an AI agent is the one committing the leak.

### 13. Securing a REST API

AuthN (JWT/OAuth2), AuthZ (RBAC/ABAC), input validation, rate limiting, HTTPS
only, and a tight CORS policy — `express-security/require-helmet` plus the rate
and CORS rules above cover the configuration half.

---

## Quick-reference: the six with a one-line code fix

| Vulnerability      | Prevention            | CWE                                                          | Enforced by                               |
| ------------------ | --------------------- | ------------------------------------------------------------ | ----------------------------------------- |
| SQL Injection      | Parameterized queries | [CWE-89](https://cwe.mitre.org/data/definitions/89.html)     | `pg/no-unsafe-query`                      |
| XSS                | Output encoding       | [CWE-79](https://cwe.mitre.org/data/definitions/79.html)     | `browser-security/no-innerhtml`           |
| Timing attack      | `timingSafeEqual`     | [CWE-208](https://cwe.mitre.org/data/definitions/208.html)   | `node-security/no-timing-unsafe-compare`  |
| Weak password hash | bcrypt / argon2       | [CWE-327](https://cwe.mitre.org/data/definitions/327.html)   | `node-security/no-weak-hash-algorithm`    |
| Prototype poll.    | Key allow-list        | [CWE-915](https://cwe.mitre.org/data/definitions/915.html)   | `secure-coding/detect-object-injection`   |
| ReDoS              | Linear-time regex     | [CWE-1333](https://cwe.mitre.org/data/definitions/1333.html) | `secure-coding/no-redos-vulnerable-regex` |

---

## The test interviews can't run: paste it back to your AI

There is a structural reason AI coding assistants reproduce these exact bugs: they
were trained on the same public corpus that contains both the vulnerable patterns
and the secure rewrites — but the vulnerable versions outnumber the rewrites by a
wide margin (Stack Overflow answers accumulate years of "works for me" before
anyone updates them). The model has no internal security reviewer; it generates the
most statistically likely completion, which is the version most developers shipped.
Across a [benchmark of 700 AI-generated functions across 5 models](https://ofriperetz.dev/articles/aggregate-benchmarks-lie-heres-what-700-ai-functions-look-like-by-security-domain),
every model reproduced at least one of the 13 bug classes on this list — and
[choosing a different plugin alone shifts your detection rate significantly](https://ofriperetz.dev/articles/benchmark-17-eslint-security-plugins-compared).
The rule is the correction signal the model never got during training.

Here's the experiment that reframed this whole list for me. Take the 13 bad-vs-good
snippets above, throw away the good halves, and ask a coding assistant to "fix" or
"refactor" or "add a feature to" the bad ones. A meaningful share come back still
vulnerable — sometimes the model even re-introduces the exact pattern you removed,
because it's optimizing for "looks like working code," not "passes a security
review." I went through this in detail with an 80-function run in
[I Let Claude Write 80 Functions — 65-75% Had Security Vulnerabilities](https://ofriperetz.dev/articles/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities)
(remediation only landed 50-54% of the time when I fed the findings back), and the
follow-on problem — fixing one finding only to spawn the next — in
[The AI Hydra Problem](https://ofriperetz.dev/articles/the-ai-hydra-problem-fix-one-ai-bug-get-two-more).

And before you assume this is a "bad model" problem you can solve by switching
vendors: it isn't. When I ran the same 20 prompts across Claude *and* Gemini —
[700 functions, 5 models](https://ofriperetz.dev/articles/we-ranked-5-ai-models-by-security-the-leaderboard-is-wrong) —
every model landed between a **49% and 73% vulnerability rate**, and the rankings
inverted by category. Claude Opus wrote insecure JWTs 7/7 (question #7 here);
Gemini 2.5 Flash wrote them perfectly 0/7 — but Flash lost other categories Claude
won. There is no model you can pick that gets this list right by default. The rule
doesn't care which model — or which human — typed the diff; it fails the same CWE
the same way every time.

There's a deeper reason the interview format misses these. Every question above
is phrased as *"what's wrong with this code?"* — a commission bug, a line that's
present and incorrect. But most of what I flag in AI-generated PRs is the
opposite: an *omission*. The missing rate limiter on the login route. The absent
`httpOnly` flag. The CSP header that was never sent. The model didn't write the
wrong thing — it just never wrote the guard, because the prompt never asked for
it. You can't spot an omission by reviewing the diff; there's nothing red to
react to. That's exactly the negative space a rule lives in: it asserts the guard
*should* be there and fails when it isn't.

The interview tests whether *you* know the answer. It can't test whether your
editor's autocomplete does — and it definitely can't test for the line nobody
wrote. That's the gap a rule closes: it sits between the generated diff and
`main` and fails the build on the same CWE the interview asked about — every
time, for every author, human or model.

## The "great" answer: enforce it, don't memorize it

Reciting these in an interview proves you know them. Wiring them into CI proves
neither you nor your assistant can ship them. Each concept above maps to a rule in
a domain-specific [Interlace](https://eslint.interlace.tools) plugin — install the
layers your stack uses and the bad version gets flagged (run with
`--max-warnings 0` in CI so every finding blocks, not just the `error`-tier ones):

```bash
# npm (yarn/pnpm/bun: same packages, that manager's -D/--dev flag)
npm install --save-dev eslint-plugin-secure-coding eslint-plugin-node-security \
  eslint-plugin-jwt eslint-plugin-pg eslint-plugin-browser-security eslint-plugin-express-security
```

```js
// eslint.config.mjs — `configs` is a NAMED export (default export is the plugin).
// Every plugin follows the identical `configs as X` -> X.recommended pattern,
// so all six layers wire the same way — no per-plugin special-casing.
import { configs as secureCoding } from "eslint-plugin-secure-coding";
import { configs as nodeSecurity } from "eslint-plugin-node-security";
import { configs as jwt } from "eslint-plugin-jwt";
import { configs as pg } from "eslint-plugin-pg";
import { configs as browserSecurity } from "eslint-plugin-browser-security";
import { configs as expressSecurity } from "eslint-plugin-express-security";

export default [
  secureCoding.recommended,
  nodeSecurity.recommended,
  jwt.recommended,
  pg.recommended,
  browserSecurity.recommended,
  expressSecurity.recommended,
];
```

| Surface              | Support                                                    |
| -------------------- | ---------------------------------------------------------- |
| **Package managers** | npm, yarn, pnpm, bun                                       |
| **Node**             | `>= 18.0.0`                                                |
| **ESLint**           | `^8.0.0 \|\| ^9.0.0 \|\| ^10.0.0`, flat config             |
| **Module system**    | CommonJS — `eslint.config.js` or `.mjs`                    |
| **Oxlint**           | flagship rules wired via the `interlace-*` ports, CI-gated |

For the full OWASP picture (and the two categories static analysis honestly
can't reach), see
[the OWASP Top 10 mapping](https://ofriperetz.dev/articles/mapping-your-codebase-to-owasp-top-10-with-247-eslint-rules).

**Related reading in this security-on-the-Node-stack series:**

- [The 30-Minute Security Audit](https://ofriperetz.dev/articles/the-30-minute-security-audit-onboarding-a-new-codebase) — run these rules against a codebase you've just inherited and triage the findings.
- [Three SQL Injection Patterns in node-postgres](https://ofriperetz.dev/articles/three-sql-injection-patterns-node-postgres-eslint) — the three shapes `pg/no-unsafe-query` has to catch (question #1 in depth).
- [The JWT `algorithm: none` Attack](https://ofriperetz.dev/articles/the-jwt-algorithm-none-attack-the-vulnerability-in-1-line-of-code-d9g) — question #7 as a one-line, paste-into-your-codebase exploit.
- [I Let Claude Write 80 Functions](https://ofriperetz.dev/articles/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities) — the data behind "your AI re-introduces these."

---

## Links

- 📦 [eslint-plugin-secure-coding](https://www.npmjs.com/package/eslint-plugin-secure-coding) · [node-security](https://www.npmjs.com/package/eslint-plugin-node-security) · [jwt](https://www.npmjs.com/package/eslint-plugin-jwt) · [pg](https://www.npmjs.com/package/eslint-plugin-pg) · [browser-security](https://www.npmjs.com/package/eslint-plugin-browser-security)
- 📖 [Full rule docs (per-rule CWE)](https://eslint.interlace.tools)
- 💻 [Source on GitHub](https://github.com/ofri-peretz/eslint)

---

Which of these 13 is the one your team actually shipped — the textbook bug
everyone could define in the interview and still merged into `main`? For me it
was the `md5` password hash hiding behind an "it was already imported." Tell me
yours in the comments; I'm collecting the failure modes the cheat-sheets never
mention.

::dev-to-cta{url="https://github.com/ofri-peretz/eslint"}
⭐ Star on GitHub if you'd rather enforce this list than memorize it for the next interview.
::

---

I'm **Ofri Peretz**, a security engineering leader and the author of the
Interlace ESLint ecosystem — domain-specific static analysis for security,
reliability, and performance on the Node.js stack.

[ofriperetz.dev](https://ofriperetz.dev) · [LinkedIn](https://linkedin.com/in/ofri-peretz) · [GitHub](https://github.com/ofri-peretz)
