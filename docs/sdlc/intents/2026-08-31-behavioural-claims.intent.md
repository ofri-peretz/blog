---
kind: intent
slug: 2026-08-31-behavioural-claims
opened: 2026-08-31
status: open
---

# Intent: find the locks that claim a behaviour and check only text

## What

Audit the lock suite for tests whose **claim is behavioural** but whose
**evidence is textual**, and convert those. Not all text-based locks — most are
legitimate — only the ones asserting that something *works* by checking that
something is *written*.

## Why now

Because it is the dominant failure of the week, four times over, and each one
survived review:

1. **The playground demo.** The lock asserted "the sample is vulnerable" by
   grepping it for `eval(` / `exec(`. Three rules were advertised, one could
   fire, and the test passed for three days in production.
2. **`short_link_click`.** The redirect returned a correct 302 for twenty days
   while every capture was dropped. Nothing asserted the write landed.
3. **The gate label.** "~400 KB" sat 10.5% from a 362 KB bundle. Nothing
   connected the sentence to the artifact.
4. **The drift check.** Reported IN SYNC for a file that would not compile,
   because reversing a delta that was never applied is a no-op.

Same shape every time: **a check reported healthy about something it never
actually verified.** Individually each looked like a small oversight. Four in a
week is a pattern in how we write locks, and patterns are worth a pass.

## Constraints

- **Structural locks are legitimate and must not be swept up.** Pinning
  required sections, frozen event names, forbidden class patterns, or a
  provenance header is a claim *about the text*, and text is the right evidence.
  The repo's own doctrine names these; this audit must not read as an argument
  against them.
- The test is: *if this claim were false at runtime, would this assertion still
  pass?* If yes, the evidence does not match the claim.
- Converting a lock must not make the suite slow or flaky. A lock that needs a
  browser is usually a sign the claim belongs somewhere else, not that the suite
  needs a browser.
- No mass rewrite. Each conversion is a judgement, and a wrong conversion adds
  a slow test that still proves nothing.

## How we will know it worked

- A written list of every lock whose claim outruns its evidence, with a verdict
  per entry: **convert**, **narrow the claim**, or **correct as-is**.
- Every conversion **verified failing** against the broken state it is supposed
  to catch. That is the only evidence a lock is worth its runtime, and it is
  what the four bugs above all lacked.
- "Narrow the claim" is a legitimate and expected outcome: a grep that stops
  describing itself as proof of behaviour is no longer lying, even unchanged.

## Not doing

- Not chasing coverage percentage. The playground lock had coverage; it had the
  wrong assertion.
- Not converting structural locks to rendered ones for uniformity.
- Not adding a browser to the unit suite.
