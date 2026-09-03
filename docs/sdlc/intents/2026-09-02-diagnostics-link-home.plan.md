---
kind: plan
slug: 2026-09-02-diagnostics-link-home
opened: 2026-09-02
---

# Plan: settle the URL contract before a single one ships

> **WITHDRAWN 2026-09-02 — the premise was false.** All 503 of 503 rules
> already carry `meta.docs.url`. This plan is kept, not deleted, because its
> ground-truth table contains the error and deleting it would remove the
> evidence. Every number in the table below marked WRONG is preserved
> deliberately. See the intent for the correction.

Intent: [`2026-09-02-diagnostics-link-home.intent.md`](./2026-09-02-diagnostics-link-home.intent.md)

## Ground truth

| Claim | Value | Source | Read on |
|---|---|---|---|
| ~~Rules with a `docs.url`~~ | ~~0~~ **WRONG — it is 503 of 503** | grepped SOURCE for a literal the factory injects | 2026-09-02 |
| Rules with a `docs.url`, measured at runtime | **503 of 503** | require each package, read `meta.docs.url` | 2026-09-02 |
| ~~Rule source files~~ | ~~102 in the sampled packages~~ WRONG | flat glob missed nested rules; 57 packages have a rules dir | 2026-09-02 |
| Rules, counted at runtime | **503** across 19 loadable packages | require each package | 2026-09-02 |
| Blog pageviews | ~323 / month | analytics | 2026-08 |
| Repositories running the plugins | thousands | outreach database | 2026-08 |

The asymmetry is the argument: the tool speaks to far more developers than the
site does, at a better moment, and says nothing.

## Approach

**Design the URL first and treat it as an API.** It ships inside published
packages; a released version cannot be edited, and a 404 in a CI log is worse
than silence. Shape, ownership and redirect behaviour are settled and locked
before the first one is printed.

Proposed: `https://ofriperetz.dev/r/<plugin>/<rule>` — short enough for a
terminal, no campaign parameters, and the `/r/` prefix keeps it out of the
article namespace so `url-philosophy`'s slug grammar is unaffected.

**The destination is a reproduction, not a description.** A developer arrives
holding a specific diagnostic; the page opens with the smallest code that
triggers it, already reporting it, editable. Prose sits underneath for whoever
wants it. That inversion is the whole idea — the terminal already told them
*what*, the page should show them *why*.

**Static first.** Server-render the description and a fixed example so the page
is useful with JavaScript disabled, then hydrate the live reproduction. A CI log
opened on a locked-down machine is a realistic arrival, not an edge case.

Rejected: **linking to the existing docs site.** It documents rules but does not
run them, and the reproduction is the differentiator.

Rejected: **shipping URLs and building pages after.** The order is fixed by
which half is irrevocable.

## Sequence

1. Settle and lock the URL shape, including what happens when a rule is renamed
   or removed. Renames are the case that will actually occur.
2. Build one rule page end-to-end, verified by running it — the page must
   report the diagnostic, not merely mention the rule name.
3. Lock the mapping in both directions: a rule without a page fails, a page
   without a rule fails.
4. Only then, add `meta.docs.url` in the plugin repo — a separate, coordinated
   change with its own release.
5. Watch for arrivals with no referer and no campaign. That signature is a
   terminal or an editor, and it is currently zero.

## Gates

- No `docs.url` ships before step 3 passes. Irrevocability is the whole reason
  this order is not negotiable.
- The rename/removal contract is written and tested before step 4.
- No tracking parameters in the printed URL, enforced by a lock, not a habit.
- The page renders usefully with JavaScript off — verified with JS disabled,
  not assumed from server rendering.

## Risks

- **A rename after release strands URLs inside packages nobody upgrades.** The
  redirect contract has to assume old versions run forever, because they do.
- **102 rule pages is a lot of surface** and most will be visited rarely. Build
  one, measure whether anything arrives, and let evidence decide the rest —
  generating all of them first is how a site acquires 102 thin pages.
- **The signal may be genuinely zero.** Developers dismiss diagnostics without
  reading them. That would be worth knowing, and it is cheap to learn from one
  rule before committing to a hundred.
