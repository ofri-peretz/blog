---
kind: plan
slug: 2026-09-03-engage-outreach-never-stalls
opened: 2026-09-03
---

# Plan: the update-branch button, and a weekly "waiting on us" series

Intent: [`2026-09-03-engage-outreach-never-stalls.intent.md`](./2026-09-03-engage-outreach-never-stalls.intent.md)

## Ground truth

| Claim | Value | Source | Read on |
| --- | --- | --- | --- |
| Open outreach PRs tracked | 25 | `/api/board` | 2026-09-03 |
| Needing our move | 6: 4 "branch behind base", 2 "merge conflict — rebase needed" | `/api/board`, `actionRequired` + `reason` | 2026-09-03 |
| Live tracker route | `/api/prs`, 15-minute cache, `?refresh=1` | `apps/engage/src/app/api/prs/route.ts` | 2026-09-03 |
| GitHub update-branch | `PUT /repos/{owner}/{repo}/pulls/{n}/update-branch`, 202 accepted, 422 on conflict | GitHub REST docs | 2026-09-03 |
| Adoption held repos | 4 on 2026-09-02 and 2026-09-03 | `adoption/history.jsonl` | 2026-09-03 |

## Approach

The tracker already classifies every PR. Add the one action the classification
licenses: for reason "branch behind base", a button that calls
`POST /api/prs/update` with the PR's owner, repo and number; the route shells
`gh api -X PUT …/update-branch` and returns GitHub's answer verbatim, then
invalidates the 15-minute cache for that PR. The weekly digest records
`prs_action_required` and `prs_behind_base` in `engage.db` for the terminal.

**Rejected: a script that rebases every stale PR on a schedule.** Silent pushes
to twenty forks is not curation; a maintainer reviewing a PR that changed
under them without a click from us is a bad surprise.

**Rejected: cloning forks locally to rebase.** GitHub's endpoint does the safe
case without a checkout; the unsafe case (conflict) should never be automated.

## Sequence

1. `/api/prs/update` (POST, JSON `{owner, repo, number}`), validates all three
   against `/^[\w.-]+$/` and an integer, runs `gh api -X PUT`, maps 202 → ok,
   422 → conflict, 403 → not ours; drops the `prs` cache entry.
2. Customers page, "Open pull requests" rows: an **Update branch** button when
   `reason === "branch behind base"`, with the result printed on the row.
3. `store.ts`: `outreach(week, open, action_required, behind_base, conflicts, at)`;
   `/api/prs` writes the current week's row on every fresh sweep.
4. `series-outreach.ts`: the two counts in the terminal under "Adoption".
5. `engage-status --week` (agents): prints the row next to the standing deltas.

## Gates

- A selfcheck for the route's input validation and the status mapping
  (202/422/403) over a stubbed `gh`.
- Manual: press the button on one of the two `interlace` PRs (our own repo,
  zero blast radius) and watch `/api/prs?refresh=1` reclassify it.
- Human: none beyond the click.

## Risks

- `gh` on the machine running the app must be authenticated with push rights
  to the fork; a 403 is shown as "not ours", which is also what it means.
- The update-branch merge commit lands on the fork branch; a maintainer who
  prefers rebases sees a merge commit. Acceptable for a lint-config PR.
