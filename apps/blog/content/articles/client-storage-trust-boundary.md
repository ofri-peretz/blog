---
cover_image: "https://ofriperetz.dev/cdn/blog-cover-image/client-storage-trust-boundary.jpg"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/client-storage-trust-boundary-og.jpg"
title: "Your Token Is Not Safer in a Cookie. It Is Safer From JavaScript."
description: "The localStorage-versus-cookies argument is about the wrong axis. One property decides whether an XSS bug reads your session — and it is not the container."
slug: "client-storage-trust-boundary"
published: false
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
overall_score: 8.8
reviews:
  discovery & hook: 9
  discovery & hook_why: "The opening is recognition-based, not number-based. \"Every team I have worked on has had the localStorage argument. It goes the same way each time.\" earns a nod, but your top performers open with an uncomfortable *sta..."
  technical: 9
  technical_why: "Consider disambiguating the CWE choice for the *cookie-without-HttpOnly* row specifically. CWE-522 (Insufficiently Protected Credentials → A07:2021) is correct for the \"token sits in a readable store\" thesis, but the ..."
  quality: 8.8
  quality_why: "The two `dom-sink-taxonomy` links are framed as an already-published node in this series (\"a companion piece in this series, works through why the sources that reach them outnumber the sinks\") but the slug is UNMATCHE..."
  practitioner: 8.6
  practitioner_why: "**Publish `dom-sink-taxonomy` first, or don't frame it as already-shipped.** The piece calls it \"a companion piece in this series … works through why the sources that reach them outnumber the sinks\" and makes \"close t..."
  linkability: 7.5
  linkability_why: "**The load-bearing \"next step\" points at an unpublished article, presented as already existing.** In `#why-it-recurs` the piece says \"Close the sink paths first — a companion piece in this series, [DOM sinks and sourc..."
  abstraction: 9.5
  abstraction_why: "Rename the load-bearing anchor. `{#can-page-js-read-it}` marks the single most-citable idea in the piece — every higher-tier war story about token theft will deep-link it — but it's phrased as a question, not a noun a..."
  checklist: 10
  checklist_why: "None required for tier scope. The article stays cleanly at T1: every worked example is a general web-platform primitive, every standard cited is external (MITRE/OWASP/IETF/MDN), and the only product connections are ou..."
  challenge: 7.4
  challenge_why: "Companion link presented as already-published, but UNMATCHED. The body calls DOM sinks and sources \"a companion piece in this series\" that \"works through why the sources that reach them outnumber the sinks\" — stated i..."
  voice & agenda: 9.5
  voice & agenda_why: "The one metaphor — \"a filing cabinet in a public lobby\" / \"not a vault\" — is apt, singular, and travels, so it's correct for this piece. But it's off the house palette (chess / ocean / value investing / dogs). Fine on..."
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

| Mechanism | Readable by page JS | Under XSS |
| --- | --- | --- |
| `localStorage` | yes | gone |
| `sessionStorage` | yes | gone |
| IndexedDB | yes | gone |
| Cache API | yes | gone |
| Cookie without `HttpOnly` | yes | gone |
| Cookie with `HttpOnly` | **no** | survives |

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

`HttpOnly` protects the token from being *read*. It does not stop it being *used*.

Script on your origin can still `fetch` with `credentials: "include"`, and the browser
attaches the cookie. The attacker does not hold your session; they operate it, from your
page, while it is open. Smaller blast radius — no exfiltration, no replay next week — but
not nothing.

The honest summary: `HttpOnly` converts *permanent theft* into *temporary misuse*. Real
and worthwhile. Not immunity.

## So what counts as sensitive {#what-counts}

Stop asking "is this sensitive" — a word that invites negotiation. Ask: **if an attacker
had this value, what could they do, and for how long?**

- **Session token** — act as the user until expiry.
- **Refresh token** — mint new sessions, far longer. Higher risk, and the one most often
  parked in `localStorage` *because* it needs to persist.
- **Cached API response with personal data** — disclosure, not takeover. The Cache API is
  the mechanism people forget is storage at all.
- **Feature flag, theme, draft** — nothing. Put it anywhere.

That ordering puts refresh tokens above session tokens, which is the reverse of how they
usually get handled.

## And the CSRF half? {#csrf}

Never on the same axis either. CSRF is the browser *attaching* a cookie to a request the
user did not intend — a property of ambient authority, not storage — and `SameSite`
addresses it directly.

That is why the debate feels unresolvable: one camp describes a read primitive, the other
a send primitive. `HttpOnly` answers the first, `SameSite` the second. Orthogonal flags on
the same cookie. Choosing between `localStorage` and cookies answers neither.

## Where this lands in the standards {#standards}

Reading storage you should not have access to is
[CWE-522](https://cwe.mitre.org/data/definitions/522.html), insufficiently protected
credentials, under
[A07:2021](https://owasp.org/Top10/A07_2021-Identification_and_Authentication_Failures/).
`HttpOnly` and `Secure` are specified in
[RFC 6265 §4.1.2.5–6](https://datatracker.ietf.org/doc/html/rfc6265#section-4.1.2.6);
`SameSite` is not in RFC 6265 at all — it arrived later in
[RFC 6265bis](https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-rfc6265bis), still
a draft despite universal implementation. Both are documented on
[MDN's Set-Cookie page](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie).

For severity language, that is what
[CVSS is for](https://ofriperetz.dev/articles/cvss-scores-explained);
[the OWASP categories](https://ofriperetz.dev/articles/owasp-top-10-explained) give you
shared vocabulary without adjectives.

## Why the argument keeps happening {#why-it-recurs}

All five equivalent rows are reached the same way: script execution on your origin. So
storage is *downstream* of the XSS question, and a team that has not settled how untrusted
data reaches a DOM sink is arguing about where to put the token while leaving the door
open. A forthcoming companion piece works through why those sources outnumber the sinks.

---

_What is in your `localStorage` right now? Not what you think — open devtools and look. I
have found a refresh token, a full user object with an email, and a cached permissions
array in codebases I would have defended._

---

I write about measurement and static analysis at
[dev.to/ofri-peretz](https://dev.to/ofri-peretz).
