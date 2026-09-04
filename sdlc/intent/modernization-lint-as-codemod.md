---
id: I-11
slug: modernization-lint-as-codemod
stage: intent
status: approved
visibility: public
opened: 2026-09-04
opened_by: claude
approved_by: ofri
---

## Recorded after the draft, before the publish

Backfilled. The draft dates from 2026-08-14; this intent was written when the
draft came up for scoring, before publication.

## Claim

Some lint rules are not style opinions, they are codemods with a ratchet
attached: the rewrite is mechanical, the semantics are identical, and the
adoption path is "run the fixer once, read one diff" rather than "triage a
backlog". A reader finishes able to tell that class of rule apart from the
normal kind, and knowing that a rule's yield says nothing about its worth.

## Audience

Developers who have a modernization or codemod backlog they keep not doing,
and who have been burned by turning on a rule that produced hundreds of
findings they then had to argue about. Not people looking for a style guide.

## Why us

We publish the plugin, so the fixability of each rule is a fact we own rather
than infer, and the second half of the claim is one we can only make credibly
against ourselves: the "fires on everything, all noise" example is our own
rule in our own plugin, named. An article that praised our modernization rules
while using someone else's plugin as the negative example would be worth much
less.

## Evidence we believe exists

- [x] The four rules exist in the published package and their names load.
- [x] Which of them carry a fixer is readable from rule metadata.
- [x] A modernization run over a real repo yields a small, specific number.
- [x] A high-yield rule on the same corpus yields a much larger one, so the
      comparison can be made on identical input rather than by anecdote.

## Kill criterion

Abandon if the findings are not in fact mechanically safe — if `--fix` on any
of these rules can change behaviour rather than spelling, the whole "read it as
one diff" thesis collapses and the honest advice becomes "triage them like any
other rule".

It did not fire, but it came close in a way worth recording: the draft claimed
all four rules were 100% auto-fixable, and two of them are not. The thesis
survives because the findings measured all came from the two that are — but the
adoption advice as written was false, and stating it precisely was the single
biggest fix this article needed.

## Title candidates

1. 55 Places My Code Predates the Language. All Auto-Fixed.
2. The Lint Rules That Are Really Codemods
3. Eight Findings Worth More Than 110

## Tier

T3
