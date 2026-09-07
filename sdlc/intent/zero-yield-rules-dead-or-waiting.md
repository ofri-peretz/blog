---
id: I-18
slug: zero-yield-rules-dead-or-waiting
stage: intent
status: approved
visibility: public
opened: 2026-09-07
opened_by: claude
approved_by: ofri
---

## Claim

A lint rule that finds nothing on your codebase is one of three things, not one,
and you can tell which in about ten seconds by asking the rule to fire on its
own test fixture rather than reasoning about it.

## Audience

Anyone who has looked at a lint report, seen a rule at zero, and had to decide
whether to keep it enabled. Also plugin maintainers deciding whether a
never-firing rule is worth carrying.

## Why us

Because the honest version needs a plugin whose rules you are willing to put on
trial in public, including the one that turns out to be inert. This is the
companion to the yield-distribution piece: that article reports that six rules
of fourteen produced nothing, and this one answers the question that leaves.

## Evidence we believe exists

- [x] A real set of zero-yield rules from a measured corpus, not a hypothetical.
- [x] Each one's own invalid-case fixtures, which settle "can it fire at all"
      without argument.
- [x] At least one rule where the answer is not the obvious one.

## Kill criterion

Abandon if every zero-yield rule turns out to be the same case. If all six are
simply "your code lacks the pattern", there is no taxonomy — there is one
observation and a long article about it. The piece only exists if the check
separates them into genuinely different categories with different actions.

## Title candidates

Under the validated formula: named target + concrete number + provocative claim.

1. Six Rules Found Nothing. Only Five of Them Were Waiting.
2. A Lint Rule at Zero Is Three Different Bugs. Here's the Ten-Second Test.
3. I Asked Six Silent Rules to Fire. One Couldn't.

## Tier

T3
