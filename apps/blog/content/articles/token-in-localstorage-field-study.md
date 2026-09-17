---
title: "13 Repos Keep a Credential in Web Storage. Seven Are Governments."
description: "A field study of 1,423 storage call sites in 189 public repositories. The practice is rarer than the argument about it, and it concentrates somewhere specific."
slug: "token-in-localstorage-field-study"
canonical_url: "https://ofriperetz.dev/articles/token-in-localstorage-field-study"
tier: "T3"
published_at: null
cover_image: "https://ofriperetz.dev/cdn/blog-cover-image/token-in-localstorage-field-study.jpg"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/token-in-localstorage-field-study-og.jpg"
reading_time_minutes: 4
quality:
  panel_version: "1.0.0"
  reviewed: "2026-09-14"
  spec: sdlc/spec/token-in-localstorage-field-study.md
  lenses:
    growth_hook: 9.6
    security_correctness: 9.5
    structure_framing_voice: 9.5
    compatibility: 9.5
    reproducibility: 9.7
tags:
  - "webdev"
  - "security"
  - "javascript"
  - "eslint"
author:
  name: "Ofri Peretz"
  username: "ofri-peretz"
  twitter: "ofriperetzdev"
series: null
---

"Never put a JWT in localStorage" is the most repeated piece of frontend security advice and the least measured. So I measured it.

258,117 source files. **1,423 touch web storage** — that is the denominator, found by reading source text before any rule ran. They live in 189 public repositories.

Thirteen of those repositories put a credential in storage — eleven of them a bearer token. **Seven of the thirteen are government digital services.**

| | |
|---|---|
| Helsinki · `kukkuu-admin` | `localStorage.setItem(API_TOKEN, user.access_token)` |
| UK ONS · `eq-author-app` | `localStorage.setItem("accessToken", user.ra)` |
| US GSA · `srt-ui` | `localStorage.setItem('token', data.token)` |
| Canada · `cds-snc` | `localStorage.setItem("token", response.access_token)` |
| France · `betagouv` ×2 | `xsrfToken`, `NATIVE_TOKEN_KEY` |
| British Columbia · `sso-requests` | `sessionStorage.setItem(TOKEN_SESSION, …)` |

The non-government six are `cloudflare-os`, `headlamp`, `mozilla_fxa`, `solid-playground`, `wix_skills` and a Twilio app that stores a passcode.

## The rate is the boring half {#rate}

Thirteen out of 189 is about 7%. If you came expecting an epidemic, there isn't one — most code touching web storage keeps credentials out of it.

What makes seven percent interesting is *where* it lands. Public-sector frontends are built by rotating contractors against procurement deadlines, and they inherit whatever the OIDC tutorial did. The tutorial put the token in `localStorage`.

That is a mechanism, not an accusation. Two of the seven — Helsinki and the UK ONS — store a **refresh** token beside the access token, and that is the part that matters: an access token expires in minutes, a refresh token is a long-lived credential sitting where any injected script can read it synchronously. That is the whole argument: web storage is [a trust boundary you share with every script on the page](https://ofriperetz.dev/articles/client-storage-trust-boundary), and one [DOM sink](https://ofriperetz.dev/articles/dom-sink-taxonomy) is all it takes to cross it. The six non-government hits are developer tools, playgrounds and internal consoles, where the threat model is genuinely different.

## Two of the thirteen are not the mistake you think {#nuance}

Reading the code changes the verdict twice.

`bcgov_sso-requests` uses `sessionStorage`, not `localStorage` — same XSS exposure, but the token dies with the tab instead of persisting. `betagouv_sante-psy` stores an **XSRF** token, which is a different risk class entirely: it is meant to be readable by your own page, and it is not a bearer credential. That is why the count above says *credential* and not *auth token*: eleven of the thirteen are bearer tokens, and the two that are not are this XSRF token and a Twilio app passcode. `bcgov` is a bearer token — it is on this list for the store it chose, not for what it stores.

Counting them all as "a JWT in localStorage" would have been technically defensible and substantively wrong.

## My own rule is right 13 times out of 19 {#precision}

`no-jwt-in-storage` flagged 19 repositories. I read all 39 files. Six repos are false positives, and all six fail the same way — the rule matched an identifier *name* rather than proving a credential:

```js
localStorage.setItem("sessionId", sessionId);      // a demo session id
sessionStorage.setItem('app_authServer', config);  // a server URL
localStorage.setItem(AUTH_STATUS_KEY, 'success');  // the string "success"
```

Also flagged: a co-browse session descriptor, a telemetry session, a sandbox id, and an example `user` object. That is **68% precision** on real source.

I am reporting it because the thirteen are only believable if you know what the instrument does when it is wrong. A field study that publishes its hit rate and not its miss rate is a marketing page.

One more, worth its own line: `no-cookie-auth-tokens` fired **zero** times across all 1,423 files. A rule that never fires in a corpus this size is telling you about the rule, not the corpus.

## Run it {#method}

```js
// eslint.config.mjs — after `npm i -D eslint-plugin-browser-security`
import browser from "eslint-plugin-browser-security";

export default [
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    plugins: { "browser-security": browser },
    rules: { "browser-security/no-jwt-in-storage": "error" },
  },
];
```

Expect to read the hits rather than trust them — [ground truth is the hard half](https://ofriperetz.dev/articles/ground-truth-in-security-testing) of any audit like this. The corpus here is an adoption scan, not a random draw from GitHub, so "7 of 13" describes what I looked at. Point it at a different corpus and the mix will move.

---

More of these — [follow on dev.to](https://dev.to/ofri-peretz).

_Open your own repo and grep for `setItem`. Is the thing you find a bearer token, or did you just name a variable badly?_

---

**Related:**

- [Ground Truth in Security Testing](https://ofriperetz.dev/articles/ground-truth-in-security-testing)
- [The CWE Taxonomy, Explained](https://ofriperetz.dev/articles/cwe-taxonomy-explained)

[npm](https://www.npmjs.com/package/eslint-plugin-browser-security) · [GitHub](https://github.com/ofri-peretz/eslint)
