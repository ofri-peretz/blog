---
id: I-23
slug: rule-that-reads-variable-names
stage: intent
status: approved
visibility: public
opened: 2026-09-07
opened_by: claude
approved_by: ofri
---

## Claim

One of my own security rules decides whether code is vulnerable by
substring-matching the variable's name, which produces a false positive and a
false negative in the same rule — and renaming a variable flips the security
verdict in both directions without changing a line of behaviour.

## Audience

Anyone who writes or trusts static analysis. The failure is not specific to
XPath, to security, or to ESLint: it is what happens when a heuristic reads
identifiers instead of data flow.

## Why us

Because it is our rule, it is shipping, and the demonstration is four lines
long. Publishing someone else's version of this is a critique; publishing our
own is the only version that costs anything.

## Evidence we believe exists

- [x] A false positive on code containing no XPath at all.
- [x] A false negative on textbook concatenated XPath injection.
- [x] A root cause readable in the rule source, not inferred.
- [x] A rename that flips each verdict, proving the name is the input.

## Kill criterion

Abandon if the false positive and the false negative turn out to have separate
causes. The article's whole claim is that one heuristic produces both; two
unrelated bugs in one rule is a maintenance note, not a piece.

Abandon also if the rename does not flip the verdict — that would mean the name
is one signal among several rather than the deciding one, and the honest
article would be much weaker.

## Title candidates

Under the validated formula: named target + concrete number + provocative claim.

1. My Security Rule Flags a Zod Schema and Misses the Real XPath Injection
2. Rename the Variable, Change the Security Verdict
3. One Heuristic, One False Positive and One False Negative

## Tier

T2
