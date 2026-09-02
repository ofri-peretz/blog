---
kind: plan
slug: 2026-08-31-behavioural-claims
opened: 2026-08-31
---

# Plan: audit claims against their evidence

Intent: [`2026-08-31-behavioural-claims.intent.md`](./2026-08-31-behavioural-claims.intent.md)

## Ground truth

| Claim | Value | Source | Read on |
|---|---|---|---|
| Test files | 47 | `ls src/__tests__` | 2026-08-31 |
| Total assertions | 976 | grep for `expect(` | 2026-08-31 |
| Files asserting only on file text | 17 of 48 | no import from `../` OR `@/` | 2026-09-01 |
| ~~First measurement~~ | ~~24 of 47~~ WRONG | missed the `@/` alias entirely | 2026-08-31 |
| Known bad locks this week | 4 | the incidents in the intent | 2026-08-31 |
| Already converted | 1, the playground sample | `lint-embeds-lock.test.ts` | 2026-08-30 |

**17 of 48 is not 17 bad tests, and the number must not be quoted that way.**
Most are structural locks doing exactly the right thing with exactly the right
evidence. The 17 is the *search space*, not the finding.

The count was **24 of 47** until 2026-09-01, and it was wrong: the heuristic
matched `from "../"` while this codebase imports through the `@/` alias, so
every file using it was counted as never executing the code it tests. Two of
the three files audited first were misclassified that way and turned out sound.

That is twice now that this intent's own paperwork has carried a check which
did not verify what it claimed — the pseudocode regex above, and this count.
The plan predicted it in as many words ("a heuristic would produce a confident
wrong list") and it happened anyway, which is the strongest argument in the
file for reading the remaining 14 by hand rather than measuring them.

## Approach

One question per lock, applied by hand:

> If the behaviour this test describes were broken at runtime, would this
> assertion still pass?

If yes, the evidence does not match the claim. Three verdicts:

- **Convert** — run the real thing. The playground lock is the reference: it
  went from grepping a sample for `eval(` to running `Linter.verify()` against
  the published plugins and asserting every enabled rule actually fires.
- **Narrow the claim** — often the cheapest correct answer. A grep that stops
  describing itself as proof of behaviour is no longer lying. Renaming a test
  from "the sample is vulnerable" to "the sample contains the tokens the rules
  look for" costs nothing and removes the false confidence.
- **Correct as-is** — structural claim, textual evidence, properly matched.
  Expected to be the majority verdict.

**Order by blast radius, not by file order.** A lock guarding something a reader
touches (the playground, the subscribe path, the redirect) earns scrutiny before
one guarding an internal invariant, because a false green there ships to people.

Rejected: an automated classifier for "behavioural claim". The signal is in the
test's *name and intent* versus its assertion — which is a reading task. A
heuristic would produce a confident wrong list, and this audit exists precisely
because a confident wrong signal is the failure mode.

## Sequence

1. List the 24 with their claims, from the test names.
2. Apply the question to each; record the verdict and the reason.
3. Convert the ones that need it, **each verified failing first** against the
   broken state it should catch.
4. Rename the ones being narrowed.
5. Write the finding: what the audit found, and what it could not determine.

## Gates

- Every conversion seen failing before it is believed. No exceptions — this is
  the gate the four incidents all skipped.
- No structural lock converted for uniformity.
- Suite runtime must not materially regress; if a conversion needs a browser,
  that is a signal the claim belongs in a different layer.
- The finding names at least one lock it could not decide about. An audit that
  resolves everything cleanly has probably stopped looking.

## Risks

- **Converting the wrong ones** adds slow tests that still prove nothing —
  strictly worse than the grep, because it costs runtime as well as confidence.
- **Audit fatigue at 24 files.** Order by blast radius so value front-loads and
  stopping early still leaves the important ones done.
- The reference conversion (the playground) needed the real published packages
  in the test. Not every claim has an equivalent oracle available in-process,
  and "narrow the claim" is the honest answer when it does not.
