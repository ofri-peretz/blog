---
kind: intent
slug: 2026-09-03-engage-outreach-never-stalls
opened: 2026-09-03
status: open
---

# Intent: no outreach PR waits on us — whose move it is, on screen, with the safe move one click away

## What

Every open PR we have on someone else's repository shows whose move it is, and
the one move that is always safe — bringing our own branch up to date with the
base — is a button on the tracker rather than a clone, a rebase and a push. A
weekly count of PRs waiting on us becomes a standing series, so a stall shows
up as a number before it shows up as a closed PR.

## Why now

- The live PR tracker (ported 2026-09-03) reports **6 of 25** open outreach PRs
  needing a move from us: 4 "branch behind base", 2 "merge conflict — rebase
  needed". Two of the four are on our own `interlace` repo.
- "Branch behind base" is our fork branch against an upstream that moved. The
  fix is mechanical and GitHub exposes it as one API call
  (`PUT /repos/{o}/{r}/pulls/{n}/update-branch`); it never touches a
  maintainer's tree.
- The adoption series has been flat at 4 held repos for the last two daily
  rows while 20 promotion PRs sit open. A PR a maintainer cannot merge because
  it is behind is a PR that ages out.

## Constraints

- **Only our own head branches move.** The update-branch call fails when we
  lack push rights; that failure is shown, never retried elsewhere.
- **Conflicts stay human.** A 422 from the API is a real conflict and is
  surfaced as such; nothing force-pushes.
- **One click, one PR.** No batch button; the curator model holds for code as
  it does for comments.
- **`gh` auth on this Mac is the credential.** Nothing new is stored.

## How we will know it worked

| Signal | Now | Target |
| --- | --- | --- |
| Open outreach PRs needing our move | 6 of 25 | 0 at the weekly check, 4 weeks running |
| PRs "behind base" older than 7 days | 4 | 0 |
| Median days a PR sits in "our move" | unmeasured | < 3 |
| Weekly row written | none | every Monday, with the standing digest |

## Not doing

- Resolving conflicts automatically.
- Opening new outreach PRs; the pipeline that finds candidates is its own intent.
- Nudging maintainers. Their move is theirs.
