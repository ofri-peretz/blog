---
title: "13 Security Questions Every JS Interview Asks — and the 9 ESLint Rules That Answer Them in CI"
description: "The 13 security concepts that come up in senior JavaScript/Node interviews — SQLi, XSS, CSRF, JWT, prototype pollution, ReDoS, timing attacks — each with the bad-vs-good code, the CWE, and the exact ESLint rule that stops your AI assistant (and you) from shipping the bad version anyway."
slug: "the-security-engineer-interview-cheat-sheet-for-javascript-developers-pgn"
canonical_url: "https://ofriperetz.dev/articles/the-security-engineer-interview-cheat-sheet-for-javascript-developers-pgn"
tier: "TOPIC"
devto_url: "https://dev.to/ofri-peretz/the-security-engineer-interview-cheat-sheet-for-javascript-developers-pgn"
devto_id: 3137519
published_at: "2025-12-31T06:10:16Z"
edited_at: "2026-02-05T05:33:13Z"
cover_image: "https://ofriperetz.dev/cdn/blog-cover-image/the-security-engineer-interview-cheat-sheet-for-javascript-developers-pgn.jpg"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/the-security-engineer-interview-cheat-sheet-for-javascript-developers-pgn-og.jpg"
reading_time_minutes: 9
tags:
  - "security"
  - "javascript"
  - "node"
  - "devsecops"
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

I've run 50+ backend and full-stack loops across these 13 questions, and the pattern doesn't
break: **the candidates who define these vulnerabilities flawlessly are the same people whose
PRs I later flag for the exact bug they just defined.** Security questions are in almost every
loop now — even for roles nobody labels "security" — and every one of them tests recall. None
of them test the thing that actually ships the bug: what your editor autocompletes at 5pm on a
Friday.

That gap is [Goodhart's law](https://ofriperetz.dev/articles/goodharts-law-explained) doing its
usual work — the moment "can define SQL injection" became the thing a loop scores, it stopped
being evidence of "won't ship SQL injection." Here's the measurement, from my own benchmark:
across [700 AI-generated functions from 5 models](https://ofriperetz.dev/articles/we-ranked-5-ai-models-by-security-the-leaderboard-is-wrong),
**Claude Opus 4.6** put sensitive user data in the JWT payload on **7 runs out of 7**. Ask any
assistant to "query the user by id" and you'll often get string-interpolated SQL — the same
[CWE-89](https://ofriperetz.dev/articles/cwe-taxonomy-explained) the candidate aced an hour
earlier. A model has read every Stack Overflow answer, including the wrong ones, and it holds
no opinion about which one it pastes.

This is, unavoidably, a cheat sheet — 13 questions, definitions, code, CWEs, same shape as
every other one. What makes it different: **9 of the 13 map to an ESLint rule you can add to CI
today.** Not "be careful about this" — a rule that fails the build when the bad version ships,
whether a human or an assistant wrote it. The other 4 get a weaker kind of rule — presence
checks rather than bug detection — and I'll say which and why. Three of the nine — timing
attacks, the JWT `algorithm: none` bypass, and prototype pollution (§6, §7, §8) — are the ones
I've watched trip up engineers with a decade of experience, because the vulnerable line reads
as _more_ correct than the fix, not less.

The best answer to "how do you stay current?" isn't "I read CVEs." It's "I encode the answer to
every one of these into a rule, so neither I nor an assistant can merge the wrong version."
This is how.

---

## SQL Injection, XSS, and Password Storage: the 3 JavaScript security questions you'll always face (asked ~90% of the time)

### 1. SQL Injection

SQL injection happens the moment user input gets concatenated into a query string instead of passed as a bound parameter — and it's still CWE-89 whether a human typed the interpolation or an assistant suggested it.

```javascript
db.query(`SELECT * FROM users WHERE id = ${userId}`); // ❌
db.query("SELECT * FROM users WHERE id = $1", [userId]); // ✅
```

**Say:** "Parameterized queries separate data from code." **CWE-89.** Enforced by
`pg/no-unsafe-query`.

I've watched this exact diff get waved through: a candidate explains parameterized queries perfectly in the loop, then a week later asks an assistant to "add a search filter" on the same table, gets a template literal back, and merges it because the diff looked small and the surrounding code already used string templates for logging. Green CI, no lint gate, nobody looked twice.

**ESLint automation:** `pg/no-unsafe-query` flags all three shapes of this bug — string concatenation, template literals, and `.format()` patterns — regardless of who typed it. There's a whole breakdown in [Three SQL Injection Patterns in node-postgres](https://ofriperetz.dev/articles/three-sql-injection-patterns-node-postgres-eslint), and the plugin itself is covered in [node-postgres Will Happily Build a CVSS 9.8 SQL Injection For You](https://ofriperetz.dev/articles/getting-started-eslint-plugin-pg).

### 2. XSS (and its three types)

Stored (saved to the DB), reflected (echoed from the URL), and DOM (written by
client JS). The browser-side fix is the same reflex:

```javascript
element.innerHTML = userInput; // ❌
element.textContent = userInput; // ✅
```

**CWE-79.** Enforced by `browser-security/no-innerhtml`.

The `innerHTML` line almost always started life rendering a _trusted_ string — a hard-coded template, an icon, a bit of formatted markup. It passed review because at the time the input genuinely was safe. Then a feature landed that routed user content through the same helper, and the assignment itself never changed. The diff that introduces the vulnerability touches the _caller_, not the `innerHTML` line — so a reviewer staring at the dangerous line sees code that's been stable for a year and has no reason to flag it.

**ESLint automation:** `browser-security/no-innerhtml` flags the sink regardless of when the [taint](https://ofriperetz.dev/articles/taint-vs-heuristic-detection) arrived. It doesn't matter if the string was trusted last year. The full rule set for this surface is in [Your Frontend Stores JWTs in localStorage and Posts to '\*'](https://ofriperetz.dev/articles/getting-started-eslint-plugin-browser-security).

### 3. Password storage

The fast, general-purpose hash that's fine for an ETag is a credential-storage vulnerability the moment it touches a password field:

```javascript
crypto.createHash("md5").update(password).digest("hex"); // ❌
await bcrypt.hash(password, 12); // ✅
```

**Say:** "bcrypt or argon2, per-user salt, a deliberate work factor." Two CWEs
live here: a fast general-purpose hash (MD5/SHA-1) is **CWE-327** (broken
algorithm), and even a "real" hash with too low a work factor is **CWE-916**
(insufficient computational effort).

I've reviewed this exact diff and waved it through myself, years ago: the `createHash("md5")` line predated the auth rewrite I was reviewing. It started life hashing an ETag — a perfectly fine use of MD5 — and someone later reached for "the hash function we already have" when they bolted on password storage. I saw a familiar helper, not a credential path, and approved it in about four seconds.

**ESLint automation:** `node-security/no-weak-hash-algorithm` flags the `md5`/`sha1` call directly. The first CWE is the one a linter can see syntactically; the work-factor one requires a human judgment call on the bcrypt cost argument.

---

## Intermediate (asked ~70% of the time)

### 4. CSRF

Cross-Site Request Forgery rides an authenticated user's cookies to perform
actions they didn't intend. **Prevention:** synchronizer tokens, `SameSite`
cookies, origin checks. **CWE-352.** Enforced by
`express-security/require-csrf-protection`.

The app that gets bitten by this usually started as a JSON API where CSRF "doesn't apply" — no cookies, bearer tokens only. Then one team added a cookie session for the admin panel, and every state-changing route inherited the cookie auth without anyone re-opening the CSRF question. Nobody reviews "did this still-stateless-looking endpoint just become CSRF-able?" because the route handler itself didn't change — the auth middleware wrapped around it did, in a completely different PR, reviewed by a different person.

**ESLint automation:** `express-security/require-csrf-protection` flags unprotected mutating routes — that's the enforceable slice. The decision to introduce cookie auth in the first place, and what it does to every existing route's threat model, is architecture no rule catches; see [Your Express App Has No Helmet, No Rate Limit, and a ReDoS in Its Routes](https://ofriperetz.dev/articles/getting-started-with-eslint-plugin-express-security) for the rest of that surface.

### 5. The Same-Origin Policy

Browsers isolate by origin (scheme + host + port). The controlled relaxations are
CORS, `postMessage`, and (legacy) JSONP — and an over-broad CORS policy
re-opens everything (**CWE-942**).

No rule picks the policy for you — the origin list is a design decision, not a syntax check. The misconfiguration it enables is enforceable, though: `browser-security/no-permissive-cors` catches the `Access-Control-Allow-Origin: *` wildcard that's the most common mistake. The review question that covers the rest is "which origins does this endpoint need to serve, and does the config allow anything wider than that list?" — a reflected `Origin` header counts as wider.

**The follow-up that separates recall from understanding:** _when does CORS not help you?_ CORS
is enforced by the browser, for the browser — it protects your users' tabs, not your server. A
`curl`, a mobile client, or a server-side proxy ignores the header entirely. If an endpoint has
to be safe, it needs authorization; a CORS policy is not a substitute for one.

### 6. Timing attacks

A `===` comparison on two secrets returns faster the sooner the bytes diverge — which means an attacker who measures response time can recover a token one byte at a time, even though the comparison "works" on every test case you'll ever write:

```javascript
if (userToken === secretToken) {
} // ❌ leaks via comparison time
if (
  a.length === b.length &&
  crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))
) {
} // ✅ constant-time (length check first — timingSafeEqual throws on mismatched lengths)
```

**CWE-208.** Enforced by `node-security/no-timing-unsafe-compare`.

I flagged this exact line in a webhook-signature check last year, and the author pushed back — reasonably. The `===` version was _more_ readable than my `timingSafeEqual` suggestion, passed every test in the suite, and had shipped for two years with zero incidents. I couldn't point to a single failing test to justify the change; the only argument I had was "an attacker measuring response time byte-by-byte," which sounds theoretical until you're the one explaining the CVE. Timing leaks don't show up in unit tests. A reviewer has no red flag to react to; the bug is in how long the line takes, not in what it returns.

**ESLint automation:** `node-security/no-timing-unsafe-compare` knows the operands are secrets and flags the variable-time compare the eye reads as fine.

### 7. JWTs

Verify the signature, check `exp`, never accept `algorithm: "none"`, and store in
an `httpOnly` cookie — **not** `localStorage`. **CWE-347** for the `none` bypass
(`jwt/no-algorithm-none`); the storage mistake is `browser-security/no-jwt-in-storage`.

The `algorithm: none` bypass is a one-line change to the JWT header that most verify-then-trust code waves through without error — it's [a one-line auth bypass that most verify-then-trust code misses entirely](https://ofriperetz.dev/articles/the-jwt-algorithm-none-attack-the-vulnerability-in-1-line-of-code-d9g). In the 700-function benchmark, Claude Opus 4.6 didn't miss a guard here — it _generated_ the misconfiguration, putting sensitive user data in the payload 7 runs out of 7.

Fixing `algorithm: none` doesn't close the adjacent bug that surprises engineers who think they're done: the **HS256/RS256 confusion attack**. If your verifier accepts either algorithm and you sign with RS256 (asymmetric — public key is, well, public), an attacker can forge a token by signing it with HS256 _using your public key as the HMAC secret_. The verifier checks the signature with the same public key, sees a valid HMAC, and trusts a token you never issued. The fix is the same allowlist discipline as `algorithm: none` — pin one algorithm per verifier — but it's a different bug, and "I fixed the none bypass" is not the same sentence as "I fixed the algorithm confusion."

**ESLint automation:** four rules, four distinct failure modes — `jwt/no-algorithm-none` for the bypass, `jwt/no-algorithm-confusion` and `jwt/require-algorithm-whitelist` for the HS256/RS256 forgery, and `browser-security/no-jwt-in-storage` for the storage mistake. One detail worth knowing: `jwt/no-sensitive-payload` — the rule that flags exactly what Opus 4.6 did 7/7 — ships as a `warn`, not an `error`, which is why the `--max-warnings 0` line further down isn't optional. Full rule set: [jsonwebtoken Will Verify a Token Signed With algorithm: none](https://ofriperetz.dev/articles/getting-started-eslint-plugin-jwt).

---

## Advanced (asked ~50% of the time)

### 8. Prototype pollution

A computed property write with an attacker-controlled key can target `__proto__` and mutate `Object.prototype` itself — every object in the process inherits the polluted property from that point on:

```javascript
obj[key] = value; // ❌ key="__proto__" pollutes Object.prototype
const target = Object.create(null); // ✅ no prototype to pollute
target[key] = value;
```

A denylist of `["__proto__", "constructor", "prototype"]` is the fix most cheat-sheets show, but it's incomplete — it misses `valueOf`, `toString`, and other properties reachable through the prototype chain that a determined attacker can still abuse. `Object.create(null)` (or a real allowlist of expected keys) is the fix that doesn't depend on remembering every dangerous key name.

**CWE-1321.** Caught by `secure-coding/detect-object-injection`.

I found this one in a `deepMerge` helper that had been in a config-loading path for three years, untouched, with its own passing tests. Nobody had reason to reopen it — until a teammate wired the same helper up to merge incoming webhook payloads into a settings object, because it was already there and already tested. The helper didn't change. The diff that made it exploitable was entirely in the caller, two files away, reviewed by someone who had never looked at the merge function and had no reason to. That's the pattern across every dynamic-assignment helper I've had to explain after the fact: a config merger, a query-string parser, a `deepMerge` someone copied off Stack Overflow — written and reviewed against trusted input, then quietly repointed at a request body.

**ESLint automation:** `secure-coding/detect-object-injection` flags the unguarded computed write itself, no matter how trusted the original caller was.

### 9. Content Security Policy

An HTTP header that restricts what can load: `default-src 'self'; script-src 'self' 'nonce-…'`.
A missing CSP is a **CWE-693** protection-mechanism failure, and that's the CWE
`browser-security/require-csp-headers` tags on the absence finding (a CSP missing
`frame-ancestors` specifically is a separate, narrower clickjacking gap, CWE-1021).

The CSP header is set in middleware — nowhere near the route handler, the component, or the line where an XSS payload would actually fire. It's the kind of control that's invisible in a feature diff, which is exactly why it's easy to skip when a team is heads-down on shipping.

**ESLint automation:** `browser-security/require-csp-headers` flags the absence, and `browser-security/no-unsafe-inline-csp` flags the `'unsafe-inline'` that defeats the policy you did ship. This is why CSP isn't one of the nine: both rules check for the _presence_ of a config value, not a vulnerable code pattern — a real, useful automation, but a different tier than "this specific line is the bug."

### 10. ReDoS

A nested quantifier like `(a+)+` has exponentially many ways to match a failing input, and the regex engine tries all of them before giving up — that's Regular-Expression Denial of Service:

```javascript
/^(a+)+$/.test("aaaaaaaaaaaaaaaaaaaaaaaa!"); // ❌ catastrophic backtracking on non-matching input
/^a+$/.test("aaaaaaaaaaaaaaaaaaaaaaaa!"); // ✅ linear-time, same intent, no nested quantifier
```

**CWE-1333.** The regex looks syntactically valid and passes every normal test input you'd write by hand — the catastrophic backtracking only triggers on adversarial input specifically crafted to maximize backtracking, which is exactly the input class unit tests never include. A single request with the right string can pin a Node event-loop thread for seconds to minutes.

**ESLint automation:** `secure-coding/no-redos-vulnerable-regex` catches catastrophic backtracking patterns statically before they ever reach a runtime, so the adversarial input never has to be imagined by a human reviewer.

---

## Architecture (asked ~40% of the time)

### 11. Designing secure authentication

- Password hashing (bcrypt/argon2)
- Rate limiting on login + account lockout after repeated failures
- MFA
- Secure session management
- Password reset via time-limited tokens

Nobody ships MFA or session rotation because a linter told them to — that part is architecture, full stop. But the enforceable slice is real: `express-security/require-rate-limiting` catches the missing rate limiter. On a login route that gap is **CWE-307** (excessive authentication attempts); the rule's general finding is **CWE-770** (no limit on resource allocation).

**The review question the rule can't ask for you:** "who owns the rate limit on this specific route — is it named in a code comment or a ticket, or is it assumed?" Rate limiting dies in the gap between "the app team" and "the infra team," where each assumes the other covered it. It surfaces the first time a credential-stuffing run shows up in the logs, which is the worst possible time to discover the assumption was wrong. MFA, session management, and token rotation stay architectural review.

### 12. Secrets management

Environment variables at minimum; a secrets manager (Vault, AWS Secrets Manager)
in production; nothing in code or git history; a rotation policy. **CWE-798.**

Hardcoded secrets rarely look like secrets in a diff — they look like a test credential, a placeholder value, or a string that "will be replaced before production." The commit lands, the string gets copied to staging as a shortcut, and the rotation that was supposed to happen "before prod" never gets scheduled because nothing broke.

**ESLint automation:** `secure-coding/no-hardcoded-credentials` is the backstop. Entropy scoring doesn't cut it on its own — see [No Hardcoded Credentials: Why Entropy Isn't Enough](https://ofriperetz.dev/articles/no-hardcoded-credentials-entropy-isnt-enough) for why pattern-only detection misses real secrets, and [Hardcoded Secrets + AI Agents](https://ofriperetz.dev/articles/hardcoded-secrets-ai-agents-autofix) for the compounding problem when an AI agent is the one committing the leak. Like CSP, this doesn't join the nine: the rule catches literal strings that _look_ like secrets, not the process failure (a real credential rotated into a "temporary" env var and never rotated out) that causes most leaks in practice.

### 13. Securing a REST API

AuthN (JWT/OAuth2), AuthZ (RBAC/ABAC), input validation, rate limiting, HTTPS
only, and a tight CORS policy.

Of all 13, this is the one where the hard part isn't code at all — the RBAC/ABAC design, the AuthZ model, and the threat model are architecture, decided long before anyone opens an editor. But the configuration half is fully automatable.

**The review question that substitutes for a lint rule here:** "for this endpoint, what role or attribute check runs before the handler body executes, and where does it live?" If the answer is "the frontend doesn't show the button" instead of a server-side check, you've found the gap.

**ESLint automation:** `express-security/require-helmet` plus the rate and CORS rules above cover the configuration layer. The authorization design is yours to own.

---

## Quick-reference: the 9 questions a rule answers for you

| Vulnerability       | Prevention            | CWE                                                          | Enforced by                                |
| ------------------- | --------------------- | ------------------------------------------------------------ | ------------------------------------------ |
| SQL Injection       | Parameterized queries | [CWE-89](https://cwe.mitre.org/data/definitions/89.html)     | `pg/no-unsafe-query`                       |
| XSS                 | Output encoding       | [CWE-79](https://cwe.mitre.org/data/definitions/79.html)     | `browser-security/no-innerhtml`            |
| Timing attack       | `timingSafeEqual`     | [CWE-208](https://cwe.mitre.org/data/definitions/208.html)   | `node-security/no-timing-unsafe-compare`   |
| Weak password hash  | bcrypt / argon2       | [CWE-327](https://cwe.mitre.org/data/definitions/327.html)   | `node-security/no-weak-hash-algorithm`     |
| Prototype pollution | `Object.create(null)` | [CWE-1321](https://cwe.mitre.org/data/definitions/1321.html) | `secure-coding/detect-object-injection`    |
| ReDoS               | Linear-time regex     | [CWE-1333](https://cwe.mitre.org/data/definitions/1333.html) | `secure-coding/no-redos-vulnerable-regex`  |
| JWT `none` bypass   | Allowlist algorithms  | [CWE-347](https://cwe.mitre.org/data/definitions/347.html)   | `jwt/no-algorithm-none`                    |
| JWT in storage      | `httpOnly` cookie     | [CWE-922](https://cwe.mitre.org/data/definitions/922.html)   | `browser-security/no-jwt-in-storage`       |
| Permissive CORS     | Explicit origin list  | [CWE-942](https://cwe.mitre.org/data/definitions/942.html)   | `browser-security/no-permissive-cors`      |
| CSRF                | Synchronizer tokens   | [CWE-352](https://cwe.mitre.org/data/definitions/352.html)   | `express-security/require-csrf-protection` |

Ten rules, nine questions — JWT needs two. Every row names a **CWE class**, which is _what_ the
bug is, not how bad it is: the same CWE-89 is a
[CVSS](https://ofriperetz.dev/articles/cvss-scores-explained) 5.3 on an internal read-only
report and a 9.8 on a public auth endpoint. Rules classify; your context scores.

The remaining four questions — CSP (§9), secrets (§12), authentication design (§11), REST
authorization (§13) — do have rules, but a weaker kind: they check that a config value is
_present_ (`require-csp-headers`, `require-helmet`, `require-rate-limiting`) or that a string
_looks_ like a secret. Worth having, all of them. They just can't say "this specific line is the
bug," which is the bar the ten above clear. And the architecture underneath them — which origins
to allow, what your RBAC model is, when a JSON API quietly became CSRF-able — is nobody's lint
rule.

---

## Why AI coding assistants reproduce these exact security bugs

There is a structural reason AI coding assistants reproduce these exact bugs: they
were trained on the same public corpus that contains both the vulnerable patterns
and the secure rewrites — but the vulnerable versions outnumber the rewrites by a
wide margin. The model has no internal security reviewer; it generates the most statistically likely completion, which is the version most developers shipped.

Across a [benchmark of 700 AI-generated functions across 5 models](https://ofriperetz.dev/articles/aggregate-benchmarks-lie-heres-what-700-ai-functions-look-like-by-security-domain),
every model reproduced at least one of the 13 bug classes on this list. Which plugin you install
moves your numbers more than which model you use: on the same 40-vulnerability corpus,
`eslint-plugin-security` v2.1.1 scores **50.0%
[precision](https://ofriperetz.dev/articles/precision-recall-f1-for-static-analysis) / 27.5%
recall** while the Interlace ecosystem v3.0.2 scores **100% / 100%** (measured 2026-05-30 on
Node v24.12.0 / ESLint 9.39.2; the v2.1.1 numbers were measured on ESLint 8.57.0). That second
figure comes from fixtures I wrote myself, which is exactly why they're public —
[ground truth](https://ofriperetz.dev/articles/ground-truth-in-security-testing) nobody else
can inspect is an assertion, and a perfect score on your own corpus is a regression test
wearing a benchmark's clothes. The less flattering view, across
[17 plugins](https://ofriperetz.dev/articles/benchmark-17-eslint-security-plugins-compared), is
the one worth reading. Either way: the rule is the correction signal the model never got during
training.

Here's the experiment that reframed this list for me. Take the 13 bad-vs-good snippets above,
throw away the good halves, and ask an assistant to "fix" the bad ones. Some come back still
vulnerable — sometimes carrying the exact pattern you just removed, because the model optimizes
for "looks like working code," not "passes a security review." The 80-function version of that
run is in [I Let Claude Write 80 Functions](https://ofriperetz.dev/articles/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities):
feeding the findings back produced a correct fix only **50-54%** of the time. The follow-on
problem — one fix spawning the next finding — is
[The AI Hydra Problem](https://ofriperetz.dev/articles/the-ai-hydra-problem-fix-one-ai-bug-get-two-more).

And before you assume this is a "bad model" problem you can solve by switching
vendors: it isn't. When I ran the same 20 prompts across Claude _and_ Gemini —
[700 functions, 5 models](https://ofriperetz.dev/articles/we-ranked-5-ai-models-by-security-the-leaderboard-is-wrong) —
every model landed between a **49% and 73% vulnerability rate** (Claude Haiku 4.5 lowest,
Gemini 2.5 Pro highest), and the rankings inverted by category. Claude Opus 4.6 wrote insecure
JWTs 7/7 (question #7 here). Gemini 2.5 Flash drew **zero flags, 0/7**, on the identical prompt
— and that turned out to be a
[false negative](https://ofriperetz.dev/articles/confusion-matrix-tp-fp-fn-tn) in my own
ruleset, not clean code: Flash signed the entire `user` object _and_ fell back to a hardcoded
secret, one level deeper than the rule was looking. There is no model you can pick that gets
this list right by default, and no ruleset that catches everything. The rule doesn't care which
model — or which human — typed the diff; it fails the same CWE the same way every time.

There's a deeper reason the interview format misses these. Every question above is phrased as
_"what's wrong with this code?"_ — a commission bug, a line that's present and incorrect. But
most of what I flag in AI-generated PRs is the opposite: an _omission_. The missing rate limiter
on the login route. The absent `httpOnly` flag. The CSP header that was never sent. The model
didn't write the wrong thing — it just never wrote the guard, because the prompt never asked for
one. You can't spot an omission by reading a diff; there's nothing red to react to.

That negative space is where a rule lives. It asserts the guard _should_ be there and fails when
it isn't — sitting between the generated diff and `main`, failing the build on the same CWE the
interview asked about, every time, for every author, human or model.

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

| Surface              | Support                                                                  |
| -------------------- | ------------------------------------------------------------------------ |
| **Package managers** | npm, yarn, pnpm, bun                                                     |
| **Node**             | `>= 18.0.0`                                                              |
| **ESLint**           | `^8.0.0 \|\| ^9.0.0 \|\| ^10.0.0`, flat config                           |
| **Module system**    | ESM — `eslint.config.mjs`, or `eslint.config.js` with `"type": "module"` |
| **Oxlint**           | flagship rules wired via the `interlace-*` ports, CI-gated               |

Six layers at once will surface findings you disagree with. When one does, that's a
[false positive](https://ofriperetz.dev/articles/confusion-matrix-tp-fp-fn-tn) _for your
codebase_ — turn that rule off for that path, not the plugin. Disabling a whole layer to
silence one rule is how a lint config ends up catching nothing while still appearing in
`package.json`.

For the full [OWASP Top 10](https://ofriperetz.dev/articles/owasp-top-10-explained) picture
(and the two categories [static analysis](https://ofriperetz.dev/articles/static-analysis-vs-sast-vs-linting)
honestly can't reach), see
[our mapping of 247 ESLint rules onto it](https://ofriperetz.dev/articles/mapping-your-codebase-to-owasp-top-10-with-247-eslint-rules).

**← previous in this security-on-the-Node-stack series:** [The 30-Minute Security Audit](https://ofriperetz.dev/articles/the-30-minute-security-audit-onboarding-a-new-codebase) · **next →** [I Inherited a NestJS Codebase](https://ofriperetz.dev/articles/i-inherited-a-nestjs-codebase-the-first-lint-run-found-6-vulnerabilities)

**Related reading in this security-on-the-Node-stack series:**

- [The 30-Minute Security Audit](https://ofriperetz.dev/articles/the-30-minute-security-audit-onboarding-a-new-codebase) — run these rules against a codebase you've just inherited and triage the findings.
- [Benchmark: 17 ESLint Security Plugins Compared](https://ofriperetz.dev/articles/benchmark-17-eslint-security-plugins-compared) — which plugin actually catches the most of these 13 bug classes, with data.
- [Three SQL Injection Patterns in node-postgres](https://ofriperetz.dev/articles/three-sql-injection-patterns-node-postgres-eslint) — the three shapes `pg/no-unsafe-query` has to catch (question #1 in depth).
- [The JWT `algorithm: none` Attack](https://ofriperetz.dev/articles/the-jwt-algorithm-none-attack-the-vulnerability-in-1-line-of-code-d9g) — question #7 as a one-line, paste-into-your-codebase exploit.
- [I Let Claude Write 80 Functions](https://ofriperetz.dev/articles/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities) — the data behind "your AI re-introduces these."
- [I Inherited a NestJS Codebase](https://ofriperetz.dev/articles/i-inherited-a-nestjs-codebase-the-first-lint-run-found-6-vulnerabilities) — the 6 vulnerability classes it found map directly onto this list, in a real inherited codebase.
- [Full rule docs](https://eslint.interlace.tools) — per-rule CWE mapping and configuration options for all 20 plugins.

---

## Links

- 📦 [eslint-plugin-secure-coding](https://www.npmjs.com/package/eslint-plugin-secure-coding) · [node-security](https://www.npmjs.com/package/eslint-plugin-node-security) · [jwt](https://www.npmjs.com/package/eslint-plugin-jwt) · [pg](https://www.npmjs.com/package/eslint-plugin-pg) · [browser-security](https://www.npmjs.com/package/eslint-plugin-browser-security) · [express-security](https://www.npmjs.com/package/eslint-plugin-express-security)
- 📖 [Full rule docs (per-rule CWE)](https://eslint.interlace.tools)
- 💻 [Source on GitHub](https://github.com/ofri-peretz/eslint) — every rule above, with its fixtures and its failures

---

Which JavaScript security interview question has stumped you most recently — and would your
ESLint config have caught it in CI? Mine was the `md5` password hash from §3, the one I
approved in about four seconds. Tell me yours in the comments; I'm collecting the failure modes
the cheat-sheets never mention.

If you want to watch this list meet a codebase that never asked for it, that's the next one:
[I Inherited a NestJS Codebase — the First Lint Run Found 6 Vulnerabilities](https://ofriperetz.dev/articles/i-inherited-a-nestjs-codebase-the-first-lint-run-found-6-vulnerabilities).
Six of the classes above, in someone else's repo, on day one.

::dev-to-cta{url="https://eslint.interlace.tools"}
📦 `npm install` the layers your stack uses — per-rule CWE mapping, config, and the ESLint + Oxlint wiring for all 20 plugins.
::

---

I'm **Ofri Peretz**, a security engineering leader and the author of the
Interlace ESLint ecosystem — domain-specific static analysis for security,
reliability, and performance on the Node.js stack.

[ofriperetz.dev](https://ofriperetz.dev) · [LinkedIn](https://linkedin.com/in/ofri-peretz) · [GitHub](https://github.com/ofri-peretz) · [Twitter/X](https://x.com/ofriperetzdev)

---

_Part of the [Interlace ESLint ecosystem](https://eslint.interlace.tools). Source on [GitHub](https://github.com/ofri-peretz/eslint) · Follow: [Dev.to/ofri-peretz](https://dev.to/ofri-peretz)_
