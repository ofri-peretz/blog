---
stage: incident
detected: 2026-01-01
detector: stale-claim | link-health | reception-band | human
severity: 1sigma | 2sigma | 3sigma
articles: []
intent: # path to the intent this opened, if it reached 3sigma
status: open # open | triaged | fixed | ignored
---

## What the detector saw

The observation, with the evidence attached. A detector that reports a
problem without the command that found it is asking a human to redo its work.

## Class

Which failure class this belongs to. If this class has been seen before, link
the prior incident — **a class that recurs twice is an eval gap, not an author
mistake**, and the fix belongs in the test suite rather than in one article.

## Triage

Rewrite | retire | ignore — and why. "Ignore" is a legitimate outcome and is
recorded, not left implicit.
