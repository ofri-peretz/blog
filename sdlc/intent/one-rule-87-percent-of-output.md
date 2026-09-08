---
id: I-20
slug: one-rule-87-percent-of-output
stage: intent
status: killed
visibility: public
opened: 2026-09-07
opened_by: claude
approved_by: ofri
killed: 2026-09-07
---

## Claim

When a single rule produces 87% of a plugin's findings across a 20-project
corpus, that rule has stopped being a rule and become a default — and the shape
of the distribution tells you more about what a security linter will cost your
team than its total does.

## Audience

Engineers evaluating a security linter, and anyone who has switched one off
after the first run. Also maintainers deciding whether a high-volume rule
belongs in a `recommended` preset.

## Why us

We hold a like-for-like measurement of both plugins on the same corpus, which
almost nobody publishes. The obligation that comes with it is that our own
distribution goes in the same table, our own volume is far lower, and the
sampled precision behind these counts is ours to disclose rather than to omit.

## Evidence we believe exists

- [x] A per-rule breakdown for both plugins over the same real-source corpus.
- [x] A concentration steep enough to be the subject rather than a footnote.
- [x] A measured precision sample that bounds what the volume actually means.

## Kill criterion

Abandon if the concentration disappears once the corpus is read honestly —
specifically, if the dominant rule's findings turn out to be one repository, or
if our own distribution is equally concentrated, in which case the article is
describing a property of lint corpora rather than of that rule.

Also abandon if the volume difference cannot be separated from a correctness
difference. Findings are not defects, and a piece that quietly treats a lower
count as a better result would be the exact error this corpus was built to
avoid.

## Title candidates

Under the validated formula: named target + concrete number + provocative claim.

1. One Rule Produced 87% of a Security Plugin's Findings
2. 20,334 of 23,325 Findings Came From a Single Rule
3. Nine Rules, One of Them Is the Plugin

## Tier

T3

## Killed — 2026-09-07

The kill criterion could not be tested, which under this repo's rules is the
same as failing it.

The criterion said to abandon if the dominant rule's findings turn out to be
one repository. `benchmark-2026-08-14.json` carries per-rule totals for the
whole corpus and per-repo totals for each side, but **not** per-rule counts per
repository — and its own note says the raw per-repo numbers include 2,132
"rule definition not found" messages per side that "are not decomposed per
repo". So the corpus-level 87.2% is solid and the per-repo spread is unknown.

That distinction is not academic here. The companion article
`rule-yield-distribution-own-plugin` makes the file-count column the thing that
separates a real concentration from one defect counted many times, and says so
in print. Publishing a 20,334-finding concentration without the equivalent
check would hold someone else's plugin to a looser standard than our own, in
the same week, on the same argument.

Unblocking is a re-run that emits per-rule counts per repository. Nothing about
the thesis is disproven — only unevidenced. Reopen as a new intent when that
run exists; do not reopen this one, so the gap stays legible.

Verified corpus-level figures, for whoever picks this up:
`security/detect-object-injection` 20,334 of 23,325 (87.2%) across 20 repos and
23,682 files; top two rules 22,609 (96.9%); bottom five rules 142 (0.6%) — that
last figure is the one the internal article queue attached to "every other
rule", where the correct value is 2,991 (12.8%).
