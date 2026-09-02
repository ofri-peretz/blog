---
kind: plan
slug: 2026-09-02-refresh-delivery
opened: 2026-09-02
---

# Plan: close the last inch

Intent: [`2026-09-02-refresh-delivery.intent.md`](./2026-09-02-refresh-delivery.intent.md)

## Ground truth

| Claim | Value | Source | Read on |
|---|---|---|---|
| plugin-stats workflow added | 2026-08-25 | git log on the workflow file | 2026-09-02 |
| loom-embeds workflow added | 2026-08-26 | same | 2026-09-02 |
| Schedules | Mondays 09:30 and 15:30 UTC | the cron lines | 2026-09-02 |
| Last run | 2026-08-31, completed success | gh run list | 2026-09-02 |
| Bot PRs ever opened | 2 | gh pr list --author app/github-actions | 2026-09-02 |
| Bot PRs ever merged | 0 | same | 2026-09-02 |
| plugin-stats.json last changed on main | 2026-08-25, when it was added | git log on the data file | 2026-09-02 |
| Size of the pending change | 20 added / 20 removed lines | PR #214 files | 2026-09-02 |

The last two rows together are the intent: there is a real, computed update
sitting in a branch, and the file it would replace has never moved.

## Approach

**Enable auto-merge on the bot's own PRs, gated on the checks that already
run.** GitHub's auto-merge lands a PR when required checks pass, which turns
the PR from a stopping point into an audit trail — exactly what it should have
been. The workflow enables it on the PR it just created; nothing else changes.

The safety argument is that the gate is unchanged. `build-test` runs the locks
over the committed data, so a malformed refresh fails CI and auto-merge simply
never fires. Landing without a human is only acceptable *because* the checks
are the reviewer, and that is true here in a way it would not be for prose.

Rejected: committing straight to `main` from the workflow. Branch protection
exists for good reasons and a bot with push rights to `main` is a much larger
change than the problem justifies.

Rejected: a notification so someone remembers to merge. That is the reminder
this already is, and the evidence says reminders do not land — two PRs, zero
merges, eight days. `watcher-liveness` closed today on the principle that a
signal for a condition nobody acts on is not worth building.

Rejected: widening auto-merge to all PRs. Ten human PRs are also open, some
since July, and they are a separate problem with a separate answer. Mixing
them in would let a content change land unread.

## Sequence

1. Add the auto-merge step to both refresh workflows, scoped to the PR each
   one just opened.
2. Merge the two PRs already open (#214, #215) by hand — they are the backlog,
   not the test.
3. Wait for Monday 2026-09-07 and check whether the data file moved without
   intervention. That is the only real verification.
4. Deliberately break a refresh (malformed JSON) and confirm CI blocks the
   auto-merge rather than landing it.

## Gates

- Step 4 is required before this is called done. Auto-merge that cannot be
  stopped is worse than the stale data it replaces.
- Step 3 cannot be simulated — a manual dispatch proves the mechanism but not
  the schedule, and the schedule firing correctly is already established.
- Auto-merge scoped to bot-authored data PRs only.

## Risks

- **Landing wrong data automatically.** Mitigated by the existing locks, and
  step 4 proves they bite. If those locks are among the ones the
  behavioural-claims audit has not yet reached, that is an argument for
  auditing them before enabling this.
- Auto-merge can mask a genuinely broken sync that produces valid-but-wrong
  numbers — CI checks shape, not truth. The measured-claims lock covers one
  such number; the rest are unguarded, and this plan does not fix that.
- Weekly cadence means one verification opportunity per week. Do not shorten
  the schedule to test faster; that trades a real signal for a convenient one.
