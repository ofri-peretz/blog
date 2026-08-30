---
devto_url: "https://dev.to/ofri-peretz/your-token-is-not-safer-in-a-cookie-it-is-safer-from-javascript-5e45"
devto_id: 4395479
cover_image: "https://ofriperetz.dev/cdn/blog-cover-image/client-storage-trust-boundary.jpg"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/client-storage-trust-boundary-og.jpg"
title: "Your Token Is Not Safer in a Cookie. It Is Safer From JavaScript."
description: "The localStorage-versus-cookies argument is about the wrong axis. One property decides whether an XSS bug reads your session — and it is not the container."
slug: "client-storage-trust-boundary"
published: true
date: 2026-08-02
tags:
  - "webdev"
  - "security"
  - "javascript"
  - "node"
canonical_url: https://ofriperetz.dev/articles/client-storage-trust-boundary
reading_time_minutes: 6
tier: "T1"
series: "Foundations"
author:
  name: Ofri Peretz
  avatar: https://avatars.githubusercontent.com/u/46347627
  title: Security Engineering Leader
overall_score: 9
reviews:
  discovery & hook: 9
  discovery & hook_why: 'The title travels standalone; the *opening line* doesn''t quite match it. "Every team I have worked on has had the localStorage argument" is a strong recognition hook, but your 1,058-view performers open on an uncomfor...'
  technical: 9.5
  technical_why: '**Tighten the CWE choice for the cookie-without-`HttpOnly` row.** CWE-522 (Insufficiently Protected Credentials → A07:2021) is correct for the article''s actual thesis ("credential sits in a script-readable store"), so...'
  quality: 9
  quality_why: "Rename the load-bearing anchor. `{#can-page-js-read-it}` marks the single most-citable idea in the piece, but it's a verb-phrase question. Higher-tier war stories about token theft will want to deep-link it as a noun ..."
  practitioner: 8.7
  practitioner_why: 'The blast-radius framing undersells the in-session case and a senior reader will catch it. "no exfiltration, no replay next week" assumes the attacker only rides the current session. With script execution + `credentia...'
  linkability: 8.5
  linkability_why: "**Link the CWE canonical — this is the one concrete gap.** The article cites `CWE-522` prominently and correctly links CVSS and OWASP to their canonicals, but leaves CWE pointing only at MITRE. For internal-web consis..."
  abstraction: 9.5
  abstraction_why: "**Rename the load-bearing anchor `{#can-page-js-read-it}`.** This marks the single most-citable idea in the piece — every higher-tier token-theft war story will deep-link exactly this section — but it's phrased as a q..."
  checklist: 10
  checklist_why: "Tier scope is clean; nothing required for gating. (Any prose/link-quality notes belong to the other reviewers, not this checklist pass.)"
  challenge: 7.2
  challenge_why: 'The one experiment that unlocks the Gemini XPRIZE window (open through Aug 17, $2M): run this exact read-vs-send trust-boundary test against Gemini-generated auth code — "when asked to persist a refresh token, which s...'
  voice & agenda: 9.5
  voice & agenda_why: 'The blunder-check reflex is the one fingerprint trait only implied, never staged. "The honest summary: `HttpOnly` converts *permanent theft* into *temporary misuse*. Real and worthwhile. Not immunity." is his self-sus...'
---

Every team I have worked on has had the localStorage argument. Someone says tokens belong
in cookies. Someone else says cookies mean CSRF. Both cite a blog post. The token stays
where it was.

The argument is unwinnable as stated, because both sides are describing the container —
and the container is not what decides the outcome.

---

## The axis everyone argues about {#the-wrong-axis}

Ask why one mechanism is safer and you get answers about persistence, capacity, expiry,
whether it survives a tab close. Real differences. None of them has anything to do with an
attacker.

## The axis that decides it {#can-page-js-read-it}

One question: **can JavaScript running on your origin read it?**

If yes, anything achieving script execution on your page reads it too. Not encryption —
you have nowhere to put the key. Not obfuscation — the attacker has your bundle. Not "we
only write it after login" — the attacker runs after login too.

| Mechanism                 | Readable by page JS | Under XSS |
| ------------------------- | ------------------- | --------- |
| `localStorage`            | yes                 | gone      |
| `sessionStorage`          | yes                 | gone      |
| IndexedDB                 | yes                 | gone      |
| Cache API                 | yes                 | gone      |
| Cookie without `HttpOnly` | yes                 | gone      |
| Cookie with `HttpOnly`    | **no**              | survives  |

Five of those six rows are the same row. The debate spends its energy on a distinction
that exists only in the last line — and it is not the cookie that creates it, it is the
flag.

## `HttpOnly` is the boundary {#httponly}

`HttpOnly` is unusual: a capability the browser withholds from your own code. You cannot
opt back in at runtime. No API reads it, no devtools trick your bundle can perform. The
value goes out on requests to its domain and is otherwise unreachable.

Almost nothing else in the browser works this way. Everything in the first five rows is a
filing cabinet in a public lobby — useful, convenient, not a vault, and never described as
one by anyone who built it.

## The corollary people skip {#the-corollary}

`HttpOnly` protects the token from being _read_. It does not stop it being _used_.

Script on your origin can still `fetch` with `credentials: "include"`, and the browser
attaches the cookie. The attacker does not hold your session; they operate it, from your
page, while it is open. Smaller blast radius — no exfiltration, no replay next week — but
not nothing.

The honest summary: `HttpOnly` converts _permanent theft_ into _temporary misuse_. Real
and worthwhile. Not immunity.

## So what counts as sensitive {#what-counts}

Stop asking "is this sensitive" — a word that invites negotiation. Ask: **if an attacker
had this value, what could they do, and for how long?**

- **Session token** — act as the user until expiry.
- **Refresh token** — mint new sessions, far longer. Higher risk, and the one most often
  parked in `localStorage` _because_ it needs to persist.
- **Cached API response with personal data** — disclosure, not takeover. The Cache API is
  the mechanism people forget is storage at all.
- **Feature flag, theme, draft** — nothing. Put it anywhere.

## And the CSRF half? {#csrf}

Never on the same axis either. CSRF is the browser _attaching_ a cookie to a request the
user did not intend — a property of ambient authority, not storage — and `SameSite`
addresses it directly.

That is why the debate feels unresolvable: one camp describes a read primitive, the other
a send primitive. `HttpOnly` answers the first, `SameSite` the second — orthogonal flags on
the same cookie.

## Where this lands in the standards {#standards}

Reading storage you should not have access to is
[CWE-522](https://cwe.mitre.org/data/definitions/522.html) — insufficiently protected
credentials — under
[A07:2021](https://owasp.org/Top10/A07_2021-Identification_and_Authentication_Failures/).
`HttpOnly` and `Secure` are specified in
[RFC 6265 §4.1.2.5–6](https://datatracker.ietf.org/doc/html/rfc6265#section-4.1.2.6);
`SameSite` arrived later, in
[RFC 6265bis](https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-rfc6265bis), still
a draft despite universal implementation. Both are on
[MDN's Set-Cookie page](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie).
For severity language, use
[CVSS](https://ofriperetz.dev/articles/cvss-scores-explained) and
[the OWASP categories](https://ofriperetz.dev/articles/owasp-top-10-explained).

## Why the argument keeps happening {#why-it-recurs}

All five equivalent rows are reached the same way: script execution on your origin. So
storage is _downstream_ of the XSS question, and a team that has not settled how untrusted
data reaches a DOM sink is arguing about where to put the token while leaving the door
open. [DOM sinks and sources](https://ofriperetz.dev/articles/dom-sink-taxonomy), the
companion piece in this series, works through why those sources outnumber the sinks.

---

_What is in your `localStorage` right now? Not what you think — open devtools and look. I
have found a refresh token, a full user object with an email, and a cached permissions
array in codebases I would have defended._

---

I write about measurement and static analysis at
[dev.to/ofri-peretz](https://dev.to/ofri-peretz).
