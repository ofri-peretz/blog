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
102 files, so the default was always going to fail on a corpus-wide change.

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

Re-check: the next `claude-code-review.yml` run on this branch should complete
without `error_max_turns` and post a summary comment on the PR.
