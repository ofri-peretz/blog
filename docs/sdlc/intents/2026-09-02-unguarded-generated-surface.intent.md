---
kind: intent
slug: 2026-09-02-unguarded-generated-surface
opened: 2026-09-02
status: open
---

# Intent: no lock has ever read the generated components

## What

Bring `apps/blog/.interlace/` — 97 generated components, **17** of them
reachable from `src/` through the import graph — inside the reach of the
structural locks that already guard `src/`. Today **twelve** lock tests walk a
directory and **zero** of them can see that tree.

(An earlier draft said 61 reachable. That was a basename scan counting any
filename mentioned anywhere under `src/`; the import graph gives 17. Review
caught it — see the plan's ground truth for the correction.)

## Why now

Because it just cost three consecutive production deploys, and the lock that
should have caught it was already written and already correct.

`responsive-lock` fails a grid that declares only responsive column counts,
because the implicit base track is `auto` and cannot shrink. On 2026-09-02
exactly that shape, in `.interlace/`, pushed `/scorecard` 203px sideways at
320px with text at 200%. The lock did not fire. It roots at
`path.resolve(__dirname, "..")` — `apps/blog/src` — and `.interlace/` is a
sibling of `src/`, not a child.

Eight grids in that tree still have the defect in source, **four of them in
components `/scorecard` actually renders** — the same four that broke the page.
They render correctly now only because
[#234](https://github.com/ofri-peretz/blog/pull/234) added a CSS floor that
supplies the missing base track. **That is symptom
suppression standing in for an invariant**, and it is worth being honest that
the repo's own doctrine — a fix is not done until a check would have caught it
— is currently unmet here.

The generated tree is also the one place where "just fix the source" does not
apply: every file says `DO NOT EDIT DIRECTLY — local edits will be overwritten
on next sync`. So the answer cannot be a one-time cleanup, which is precisely
what makes it an invariant problem rather than a bug list.

## Constraints

- **Generated files stay generated.** No local edits, no `--force` sync
  bypass. Anything that must change in source changes upstream in the agents
  repo, or is enforced from outside the tree.
- **A failing lock must name the upstream fix**, not just the file. A lock
  that fails on a file nobody may edit is a trap unless it says where to go.
- The suite must not get materially slower. These are text scans; adding a
  sibling directory should be measured, not assumed free.
- No new gate on the PR path that duplicates what the deploy gate already
  does — that drift is what
  [`2026-09-02-refresh-delivery`](./2026-09-02-refresh-delivery.plan.md)'s
  sibling problem looked like, and it was fixed in #234 by deleting an
  override, not by adding a check.

## How we will know it worked

- **Binary:** `responsive-lock` extended to `.interlace/` **fails** on all
  eight known grids unscoped (proving the glob reaches the tree), then fails
  on the four reachable grids scoped (the gate that ships). A green result in
  either pass means the extension is vacuous and proves nothing — that failure
  is the whole experiment.
- **Binary:** the count of directory-walking locks that cover the generated
  tree goes from 0 to a number we chose deliberately, with the ones we
  excluded named and justified.
- **Directional:** the next reflow regression in a generated component is
  caught by a red test on a PR, not by a failed production deploy.

## Not doing

- Not deleting or migrating `.interlace/`. Whether the vendored-copy approach
  should survive is a separate and much larger question.
- Not extending every lock reflexively. Some are about `src/`-only concerns
  (route structure, article content) and pointing them at generated UI would
  produce noise, not coverage.
- Not removing #234's CSS floor. It is a genuine defence-in-depth for markup
  nobody can edit; the lock tells us when the floor is load-bearing.
