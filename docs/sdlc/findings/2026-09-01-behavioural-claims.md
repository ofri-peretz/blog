---
kind: finding
intent: 2026-08-31-behavioural-claims
date: 2026-09-01
status: partial
---

# Finding: the claim to fix is the word "fires"

Intent: [`../intents/2026-08-31-behavioural-claims.intent.md`](../intents/2026-08-31-behavioural-claims.intent.md)

**This is a partial audit.** Three files examined in depth out of a corrected
search space of 17. Recorded now because the first three already changed the
shape of the problem, and because a finding that waits for completeness is a
finding nobody acts on.

## The search space was wrong, and I would have published it

The intent quoted **24 of 47** files as asserting only on source text. That is
wrong. The heuristic looked for imports matching `from "../"` — and this
codebase imports through the `@/` alias, so every file using it was
misclassified as "never executes the code it tests".

Corrected: **17 of 48.**

| Measure | First pass | Corrected |
|---|---|---|
| Total test files | 47 | 48 |
| Assert only on file text | 24 | 17 |
| Reason for the gap | `@/` alias not counted | — |

That is the second measurement error in this intent's own paperwork — the plan
already records the first, a regex that could not match its target and would
have passed silently. An audit about checks that never verify what they claim
has now produced two of them. The lesson is not "be careful"; it is that a
heuristic over a codebase you have not read produces a confident wrong list,
which the plan predicted and I did anyway.

## What the three files showed

| File | Claim | Evidence | Verdict |
|---|---|---|---|
| `rss-and-draft-exposure-lock` | drafts never leak | runs the real feed and sitemap over 11 real drafts | **correct as-is** |
| `series-nav-lock` | ordering, reciprocity | calls `buildSeriesContext` on the live corpus | **correct as-is** |
| `analytics-events-lock` | 14 surfaces *fire* their event | grep of the source | **narrow the claim** |

The two highest-stakes locks are sound. `rss-and-draft-exposure` is the one
whose failure would leak unpublished writing, and it iterates 11 genuinely
unpublished articles — not a vacuous loop over an empty set.

## The real finding

`analytics-events-lock` has a `describe("each surface fires its event")` block
with **14 assertions**, every one of them a grep. They read like:

> `it("read depth fires once per milestone from a passive, self-removing listener")`

Text cannot establish any of that. It cannot show the listener is passive, that
it removes itself, or that a milestone fires once rather than twice.

And the context makes it vivid: **every event named in that block reads zero in
production.** Fourteen assertions claiming things fire, and no evidence that any
of them ever has.

**But most should be narrowed, not converted.** "Is a `TrackedLink` carrying
slug + package" is a structural claim, and source text is legitimate evidence
for it. What over-claims is the word *fires*. Renaming those tests to say what
they check — that the surface is *wired* — costs nothing and removes false
confidence, which is most of the value here.

One deserves converting: **read-depth**. Once-per-milestone and self-removal are
real behaviours, they are exactly the kind that break silently, and a rendered
test can assert them.

## The rule that actually predicts rot (revised twice)

After five files, a filter that works — and two that did not.

**Rejected: "text-based files are suspect."** That was the search space, and it
was wrong twice over. Two of the first three files audited execute the code
they test and were misclassified by a heuristic that missed the `@/` alias.

**Rejected: "negative greps are where the rot is."** Tempting after two hits,
but `homepage-lock` holds 21 negative assertions and they are almost all
sound: `not.toMatch(/<Skills\b/)` claims the homepage does not import a
section, and source text is exactly the right evidence for that.

**The filter that holds:**

> A negative assertion is sound when the claim is itself TEXTUAL — a component
> is not imported, a class string is not open-coded, a raw hex is not present.
> It is unsound when it encodes ONE SPELLING OF A LOGIC ERROR, because logic
> has unlimited spellings and the pattern only knows one.

`not.toMatch(/<Skills\b/)` — the thing asserted *is* the text. Sound.

`not.toMatch(/totalStars:\s*github\??\.totalStars\s*\?\?\s*0/)` — the thing
asserted is *a fallback behaviour*, wearing one costume out of many. Unsound,
and it was guarding a bug that had already shipped.

Also worth separating: a negative assertion against **rendered output**
(`expect(html).not.toContain(...)`) is behavioural evidence and belongs in the
sound column regardless.

## Running tally, 5 of 17

| File | Verdict |
|---|---|
| `rss-and-draft-exposure-lock` | sound — runs the feed over 11 real drafts |
| `series-nav-lock` | sound — calls buildSeriesContext on the live corpus |
| `npm-lifetime-total-lock` | sound, and stronger than I credited; complemented |
| `homepage-lock` (21 negatives) | sound — structural absence, structural evidence |
| `analytics-events-lock` | narrowed — 14 assertions said *fires* |
| `homepage-stats-lock` | **converted** — a logic-spelling grep over a shipped bug |

## The decision this licenses

1. Rename the wiring assertions from *fires* to *is wired as*. Cheap, and it
   stops the suite claiming more than it knows.
2. Convert read-depth to a rendered test, verified failing first.
3. Continue the audit over the remaining 14 files, ordered by consequence.

## What this could not determine

Whether the other 14 files hold. Three were read; the rest are unexamined, and
nothing here should be read as clearing them. The two corrected measurements
above are the reason to say so explicitly rather than let a partial pass imply
a whole one.
