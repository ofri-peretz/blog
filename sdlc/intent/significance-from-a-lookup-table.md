---
id: I-000
slug: significance-from-a-lookup-table
stage: intent
status: proposed # proposed | approved | killed | shipped
visibility: public # public | internal  (internal lives in the private agents repo)
opened: 2026-09-08
opened_by: claude
approved_by: # required before stage 2 may begin
---

> **Order-of-work disclosure.** This intent was written *after* the evidence in
> stage 2 was gathered, which is the shape this template explicitly warns
> against. The sequence was: a planned node claimed "our benchmark applies no
> multiple-comparisons correction"; verifying that claim surfaced a larger
> defect in the same file; the defect was fixed; then this chain was opened
> retroactively. The claim below is therefore not a bet — it is already
> settled. Recorded rather than disguised, because a rationalisation that
> announces itself can at least be discounted. **Not yet approved: the
> `approved_by` field is a human's, and the agent that gathered the evidence
> does not get to sign off on it.**

## Claim

The one significance test in my own benchmark decided "statistically
significant" from a three-row lookup table with a fallback, so every comparison
with five or more groups was judged against a threshold meant for three — and
the error could only ever manufacture significance, never withhold it.

## Audience

Engineers who maintain a benchmark, leaderboard, or A/B harness that prints a
significance verdict — specifically the ones who inherited the statistics from
a snippet and have never recomputed the number their dashboard shows. Not
"people interested in statistics": people who own a number other people trust.

## Why us

This is a self-audit of our own instrument, not a critique of anyone else's.
That is the only reason it is ours to write: the corpus already carries the
foundational piece telling readers to count their comparisons
(`ranking-vs-measuring`), and the honest follow-up is that we published the
advice and did not apply it. Nobody outside this repo could write that
sentence with the same standing, and pointing the same finding at another
project's harness would turn a self-audit into the framing this repo forbids.

## Evidence we believe exists

- [x] No multiple-comparisons correction anywhere in the benchmark packages
- [x] A chi-squared test that exists but is not corrected
- [x] The lookup fallback silently borrowing a wrong threshold
- [x] A second copy of the same function with the same defect
- [x] A `pValue` field that is not a p-value

## Kill criterion

Any of the following would have killed it:

1. A correction is applied somewhere and I simply had not found it.
2. The lookup table is only ever reached with df ∈ {1,2,3}, making the
   fallback unreachable — a latent bug, not a live one, and not an article.
3. The defect is already covered by a published or queued article
   (`ranking-vs-measuring` covers the *concept*; `lint-harness-measured-nothing`
   covers a *different* instrument defect). If either owned this finding, the
   node should be retired rather than written.

None fired. (3) was the close one and is the reason the article is scoped to
the instrument rather than to multiple comparisons in general.

## Title candidates

1. I Audited My Own Significance Test. 6 of 6 Verdicts Were False Positives.
2. My Benchmark's p-Value Was a String. It Said "< 0.05" Because a Boolean Told It To.
3. The Lookup Table That Manufactured Statistical Significance for Four Months.

## Tier

T0
