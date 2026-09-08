---
id: I-22
slug: labelled-corpus-f1-leaderboard
stage: intent
status: approved
visibility: public
opened: 2026-09-07
opened_by: claude
approved_by: ofri
---

## Claim

Six ESLint security plugins on one labelled corpus produce a spread from 10.5%
to 100% F1 — and the honest way to read that table is as a statement about what
each tool was scoped to detect, not as a ranking, because the corpus was
authored by the party scoring 100%.

## Audience

Engineers picking a security linter, who have seen a comparison table before
and want to know what one is worth. Secondarily, anyone who publishes benchmark
tables and has to decide how loudly to disclose the conflict.

## Why us

Nobody has published a like-for-like measurement of this category — same
corpus, same harness, same day. We can, and the price of publishing it is
saying plainly that we wrote the fixtures. An article that buries that is worth
less than no article.

## Evidence we believe exists

- [x] TP/FP/FN per plugin on a single labelled corpus.
- [x] Enough detail to recompute every published F1 independently.
- [x] At least one axis where a community plugin reads better than ours.

## Kill criterion

Abandon if the published F1 values do not recompute from their own TP/FP/FN, or
if `TP + FN` differs between rows — either would mean the rows are not
describing one corpus and the table is not a comparison at all.

Abandon also if no community plugin looks good on any axis available from the
data. A table where the author is ahead on every dimension is not a comparison,
it is a brochure, and this corpus would not be the place to find out otherwise.

## Title candidates

Under the validated formula: named target + concrete number + provocative claim.

1. Six Security Linters, One Corpus: 10.5% to 100%, and Why I Wrote the Corpus
2. The Most Precise Plugin in My Benchmark Scored 10.8%
3. I Graded Five Plugins on Fixtures I Wrote. Here's What That's Worth.

## Tier

T2
