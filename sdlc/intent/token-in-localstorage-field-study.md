---
id: I-18
slug: token-in-localstorage-field-study
stage: intent
status: approved
visibility: public
opened: 2026-09-14
opened_by: claude
approved_by: ofri
---

## Claim

The localStorage-versus-cookie argument is the one frontend developers have
with each other most often and measure least. Across 189 public repositories
that touch web storage, 12 put an authentication token in it — and **7 of those
12 are government digital services**. A reader finishes knowing the practice is
rarer than the discourse implies, and where it actually concentrates.

## Audience

Frontend developers who have had this argument and lost it, or won it, without
either side citing a number. Also the security-adjacent reader who assumes the
answer is "everyone does it" — the data says otherwise, and the interesting part
is who does.

## Why us

We ship the rule that detects it, which is the reason we can measure at this
scale and the reason the article must declare its own instrument's error rate.
`no-jwt-in-storage` is right 12 times out of 19 on real source; the seven misses
are all name-inference — `sessionId`, `app_authServer`, `AUTH_STATUS_KEY`.
Publishing that is not a concession, it is what makes the 12 believable.

## Evidence we believe exists

- [x] A denominator independent of the rules — files that touch web storage at
      all, found by source text before any rule runs. **1,423 files, 189 repos.**
- [x] Every finding read against its source rather than counted. **All 39 files
      classified; 12 true, 7 repos false.**
- [x] The false positives characterised, not just counted. **All seven are the
      rule matching an identifier name.**
- [x] No duplicate clones inflating the repo count. **0 among the 19 flagged.**

## Kill criterion

The thesis dies if the government concentration is an artefact of the corpus —
if the adoption scan over-sampled public-sector repositories, then "7 of 12"
describes the sample and not the world. It is a convenience sample and the
article says so. The claim is deliberately scoped to what was measured: of the
repositories examined, this is where tokens in storage concentrate. Anyone
re-running it on a different corpus may get a different mix, and the sweep is
committed so they can.

It also dies if `no-jwt-in-storage` precision is materially worse than 63% — the
12 were read by hand, so that number is as good as one reader's judgement, and
a second reader disagreeing on three of them would move the headline.

## Known risk

**Naming real organisations, including seven governments, for a security
weakness.** The framing must be landscape and non-accusatory: these are public
repositories, the pattern is a defensible trade-off in several of them, and the
article's job is to locate the practice rather than to shame anyone. Several of
the twelve are demonstrably deliberate — `bcgov_sso-requests` uses
`sessionStorage` rather than `localStorage`, and `betagouv_sante-psy` stores an
XSRF token, which is a different risk class from a bearer token. Report those
distinctions in the body, not as a footnote. Any edit that turns this into a
league table of negligent governments should be reverted.
