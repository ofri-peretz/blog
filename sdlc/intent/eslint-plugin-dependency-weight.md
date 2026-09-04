---
id: I-15
slug: eslint-plugin-dependency-weight
stage: intent
status: approved
visibility: public
opened: 2026-09-04
opened_by: claude
approved_by: ofri
---

## Recorded after the draft, before the publish

Backfilled at scoring time, before publication.

## Claim

Every raw install-count in a dependency-weight argument hides the same
69-package ESLint baseline, and the direct-dependency count everyone quotes
predicts almost nothing. A reader finishes with a four-line method that
produces a number they can defend.

## Audience

Developers who have seen "this package installs 205 things" used as an
argument, in either direction, and had no way to tell whether the number meant
anything.

## Why us

We publish a plugin suite, so we are a party to this argument and cannot make
it from outside. That is exactly why the article has to concede: it prints our
own row, states plainly that `eslint-plugin-promise` adds one package against
our two, and points out that the smallest tree on the page belongs to a package
we have argued elsewhere is unmaintained. An article that measured everyone
else and stopped before its own row would not be worth publishing.

## Evidence we believe exists

- [x] Bare `eslint` resolves to a fixed, countable number of packages.
- [x] Per-plugin trees can be resolved without downloading, so the method costs
      seconds and anyone can repeat it.
- [x] Direct-dependency counts and resolved-tree counts disagree enough to make
      the point.
- [x] The union of a realistic plugin set is far smaller than the sum of its
      parts.

## Kill criterion

Abandon if the baseline turns out not to be shared — if plugins resolve
different ESLint sub-trees, subtracting a single baseline is invalid and the
whole method collapses into arithmetic that looks rigorous and is not.

It did not fire, and the combined measurement is what rules it out: the union
of eslint plus three heavy plugins is 228 packages, far below 69 + 135 + 125 +
136, which is only possible because the trees genuinely overlap.

## Title candidates

1. Your ESLint Plugin Installs 205 Packages. 69 Are ESLint.
2. The Baseline Nobody Subtracts
3. Direct Dependencies Do Not Predict Install Weight

## Tier

T3
