---
stage: incident
detected: 2026-08-30
detector: human
severity: 2sigma
articles: []
intent: sdlc/intent/i5-review-passes.md
status: triaged
---

## What the detector saw

The stage-5 review pass failed on the first pull request that exercised it —
PR #210, the one introducing the chain.

```
"subtype": "error_max_turns",
"is_error": true,
"num_turns": 21,
"total_cost_usd": 0.8487
##[error]Execution failed: Reached maximum number of turns (20)
```

The agent read the diff across 21 turns, hit the action's default 20-turn
ceiling, and exited before posting anything. Net result: $0.85 spent, zero
findings returned, and a red check that says nothing about the code.

## Class

**Budget, not rubric.** `REVIEW.md` was never reached — the agent ran out of
turns while reading. Reading a file costs roughly a turn and this PR touches
102 files, so 20 was always going to fail on a corpus-wide change.

Correction to the first draft of this incident: 20 was **not** the action's
default. It was pinned explicitly in a `claude_args` block already present in
the workflow, further down the same `with:`. Missing that produced a second
failure, below.

The instructive part is the failure _mode_. A review that dies mid-read
reports red, which is loud and safe. The dangerous variant is a review that
trims its own scope to fit the budget and reports green — passing not because
the code is clean but because the rubric was never applied. That is why the
mitigation is two-part rather than a bigger number:

- `claude_args: "--max-turns 60"`, sized for the largest PR this repo
  realistically sees.
- The prompt now instructs triage on a large diff: group mechanical or
  repeated changes, sample a few to confirm the pattern, and spend the depth
  on files that carry logic.

`REVIEW.md` records the standing rule for a recurrence: raise the budget or
split the PR, never narrow the rubric.

## Triage

**Fixed in `a37d207`.** The review pass is not a required check, so PR #210
remains `MERGEABLE` / `CLEAN` on the four gating checks (`build-test`,
`browser-audit`, `eslint`, `oxlint`) while this is sorted.

One unverified edge remains, recorded rather than papered over: the run
triggered by the fix itself (`33332438122`) reports `failure` with no job data
retrievable through the API and cannot be re-run, so the corrected budget has
not yet been observed succeeding end to end. It is verified as _configuration_
— `claude_args` is a supported input on the pinned action SHA — but not yet as
a _green run_. This commit retriggers it.

## Second failure — the fix broke the workflow outright

The first fix added a **new** `claude_args` key without noticing the one
already in the file. Duplicate keys are a YAML parse error, so the workflow
stopped parsing entirely.

The symptom is worth recording because it is nearly silent: GitHub creates a
run with **zero jobs**, marks it `failure`, and serves no log. `gh run view
--log-failed` returns _"log not found"_, and `.../jobs` returns
`total_count: 0`. On the PR it looks like a failing review; it is actually a
workflow that no longer runs at all. Two pushes produced phantom runs before
the cause was found, and it was only found by parsing every workflow file
locally with a real YAML parser.

Fixed by editing the existing block in place (`--max-turns 20` → `60`) and
deleting the duplicate. Locked by
`apps/blog/src/__tests__/workflow-yaml-lock.test.ts`, which parses every
workflow file, requires triggers and at least one job with steps, and was
verified to fail when the duplicate key is reintroduced.

**Class note:** this is the second self-inflicted defect on this branch caught
by a machine rather than by reading (the first rewrote two cover assets). Both
were invisible locally and both are now locked. That is the chain working, but
it is also the honest cost of a corpus-wide change: the review pass that would
have caught them was the thing being fixed.

Re-check: the next `claude-code-review.yml` run on this branch should be a
`pull_request` run with one job that completes without `error_max_turns`.
