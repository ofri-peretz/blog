---
id: I-21
slug: recall-fix-we-reverted
stage: intent
status: killed
visibility: public
opened: 2026-09-07
opened_by: claude
approved_by: ofri
killed: 2026-09-07
---

## Claim

We found a real 300-file gap in one of our own rules, built the fix, measured it,
and threw it away — because closing the gap took the rule from 29 findings to
2,243 at roughly 25% precision, and a rule that is wrong three times in four is
not coverage.

## Audience

Anyone who maintains a static-analysis rule and has been asked why it does not
catch a case a neighbour catches. Also engineers choosing between two linters on
the basis of what each one finds.

## Why us

Because the interesting version of this article requires publishing a fix that
worked, on a gap that was real, and admitting it was not shipped. A vendor
writing about precision-over-recall from theory picks a flattering example. This
one cost us a genuine detection.

## Evidence we believe exists

- [x] The gap, with the specific construct a neighbour caught and we did not.
- [x] Before and after finding counts on the same corpus.
- [x] A hand-read precision estimate on the new findings.
- [x] The narrower change that did ship, isolating what had no recall cost.

## Kill criterion

Abandon if the fix's precision turns out to be defensible — anything above
roughly 50% on the hand-read sample and the honest conclusion is that we should
have shipped it, which is a different and shorter article.

Also abandon if the 300-file gap cannot be substantiated as a real detection
gap rather than a difference in what the two rules are scoped to detect. A
scope difference dressed as a recall gap would make the whole piece a
misunderstanding of our own rule.

## Title candidates

Under the validated formula: named target + concrete number + provocative claim.

1. We Fixed a Real Recall Gap. It Cost 2,214 Findings and We Reverted It.
2. Our Rule Missed 300 Files. The Fix Was Worse Than the Miss.
3. 29 Findings to 2,243, at 25% Precision — the Fix We Threw Away

## Tier

T2

## Killed — 2026-09-07

Not disproven — unevidenced, and too expensive to evidence from here.

The headline numbers (a 300-file recall gap, findings 29 -> 2,243, ~25%
precision on a hand-read of 18, overall precision falling ~45% -> ~30%) exist
only as prose in `BENCHMARK-RESULTS.md`. No result artifact carries them. The
one file containing `2243` is `benchmarks/results/ilb-perf-import-shapes/2026-08-02.json`,
a throughput suite with nothing to do with this rule — a coincidence, not a
source.

Two supporting specifics were checkable and neither matched the current source:

- The record names the deciding test group as `"rule partition: attributed
  taint reports, bare identifiers do not"`. `no-unsafe-regex-construction.test.ts`
  has no such group; its describes are Valid Code, Invalid Code, Pattern Length
  Limits, allowLiterals Option, Dynamic Flags Detection.
- The record says the narrow change that shipped was `new RegExp(re.source,
  re.flags)` no longer reporting. No `re.source` handling appears in the rule's
  `index.ts`.

Either the rule has moved since the write-up or the write-up was imprecise.
Both readings mean the same thing for publishing: the article's entire value is
that the numbers are real and self-critical, and reporting a reverted fix whose
before/after cannot be reproduced would be the failure the piece is nominally
about.

Reopen when the measurement is re-run and emitted as a result file — the
experiment is cheap to repeat if the fix is still on a branch. Do not reopen
from the prose.
