---
id: I-2
slug: i2-ground-truth-becomes-spec
stage: intent
status: approved
visibility: public
opened: 2026-08-30
opened_by: claude
approved_by: ofri
---

## Claim

Every numeric claim in an article carries the command that produced it and the
package version it ran against, committed in a spec — which both prevents the
five documented fabrication classes and makes staleness mechanically detectable.

## Audience

Us, and every future agent that writes here without our session context.

## Why us

The five recurring fabrication classes we have catalogued — wrong rule counts,
invented config keys, the `.configs` default-import crash, an SDK signature
that never existed, a rule's skip branch assumed rather than read — all have
one cause: **ground truth is re-derived every session and thrown away, and
some re-derivations are wrong.**

Cataloguing them in prose has not stopped them recurring. Committing the
evidence with its command does, because the next session reads the number
instead of re-deriving it, and a drifted number becomes a detectable event
rather than a silent error.

## Evidence we believe exists

- [x] Five failure classes documented with real examples
- [x] Every class has a cheap verifying command (`node -p` on the built dist, `schema[0].properties`, the rule's skip branches)

## Kill criterion

If most published claims turn out not to be mechanically reproducible — if the
majority are qualitative rather than numeric — then the evidence table is
overhead and the spec narrows to the traps checklist alone.

## Title candidates

Ships as infrastructure; the _method_ is publishable later as
"Every Number In This Post Has a Command Attached. Here's What Broke When We
Ran Them."

## Tier

n/a
