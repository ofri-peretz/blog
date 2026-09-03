---
kind: intent
slug: 2026-09-02-refresh-delivery
opened: 2026-09-02
status: open
---

# Intent: make the weekly refreshes actually land

## What

Close the gap between "the refresh workflow succeeded" and "the site shows
fresh data". Today those are different things, and only the first one is
visible anywhere.

## Why now

Because the pipeline has a **0% delivery rate over its entire lifetime**, and
every individual part of it reports success.

- `plugin-stats-refresh.yml` and `loom-embeds-refresh.yml` were added
  2026-08-25 and 08-26, both scheduled for Mondays.
- Both fired correctly on Monday 2026-08-31. Both completed green.
- Both opened a PR. **Neither PR has been merged.**
- `apps/blog/src/data/plugin-stats.json` on `main` is still the version
  committed on 2026-08-25 — the day the pipeline was built. It has never once
  been refreshed.

The bot has opened two PRs, ever. Two are still open. Zero merged, zero closed.

This is the same shape as `short_link_click`, one layer up: a green workflow,
a healthy dashboard, and no effect in the world. There the write was dropped
silently; here the write becomes a pull request that nobody is watching for.
An automated job whose last step requires a human to notice it is not
automated, it is a reminder — and nothing is reminding anyone.

The next Monday is 2026-09-07. Without a change it will open a third PR that
also does not merge.

## Constraints

- These PRs change committed data that the site renders. Landing them
  unreviewed means trusting the sync, so whatever lands must be validated by
  checks rather than by a person's attention.
- The existing locks on that data must gate it. Auto-landing a malformed
  refresh would be strictly worse than stale data.
- Branch protection on `main` stays. The fix is not a direct push.
- No new notification channel before establishing that the mechanism works —
  the `watcher-liveness` intent argues exactly that. (It is still `status:
  open`; an earlier draft here said it "closed today", which the file on this
  branch contradicts. The reasoning holds either way — the closure claim was
  the only wrong part. Review.)

## How we will know it worked

- **Binary:** after the next scheduled run, `plugin-stats.json` on `main`
  differs from the 2026-08-25 version without anyone having clicked anything.
- **Binary:** a refresh that produces malformed data does NOT land, and says
  why.

## Not doing

- Not auto-merging anything that is not machine-generated data. This applies
  to the refresh bots' own PRs, not to the ten human PRs also sitting open.
- Not deleting the PR step. A PR is a good audit trail; the defect is that it
  is also the stopping point.


---

## Progress (2026-09-02, steps 1-3 of the plan)

Auto-merge is armed on **all three** refresh workflows, in **both** paths — the
PR it just created, and the already-open PR that creation-time auto-merge can
never reach. `refresh-delivery-lock.test.ts` pins both, and was verified
failing by reverting `bench-receipts-refresh.yml` to its pre-fix state (2 tests
red), then passing on restore.

Step 2 is also done: #214 and #215 were merged by hand on 2026-09-02 — the
first bot PRs ever to land.

**NOT done, and the intent stays open for them:**

- **Step 4**, the only real verification: whether `plugin-stats.json` on `main`
  moves after the Monday 2026-09-07 run, with nobody touching it. That cannot
  be simulated — a manual dispatch proves the mechanism, not the schedule.
- **Step 5**, the required gate: deliberately break a refresh and confirm CI
  blocks the auto-merge rather than landing it. Auto-merge that cannot be
  stopped is worse than the stale data it replaces.
- `bench-receipts` still reaches `gh pr create` never — it ran on 2026-08-31
  and opened nothing. Arming it is forward-compatibility, not a fix; expect no
  behaviour change from it until that upstream failure is diagnosed.
