---
kind: plan
slug: 2026-09-02-unguarded-generated-surface
opened: 2026-09-02
---

# Plan: point the locks at the tree nobody may edit

Intent: [`2026-09-02-unguarded-generated-surface.intent.md`](./2026-09-02-unguarded-generated-surface.intent.md)

## Ground truth

| Claim | Value | Source | Read on |
|---|---|---|---|
| Generated components (`.tsx`) in `.interlace/` | 97 | `grep -rl 'AUTO-GENERATED FILE' --include=*.tsx` | 2026-09-02 |
| Generated files, all types | 109 | same, no include filter | 2026-09-02 |
| Reachable by name from `src/` | 61 | basename scan of `src/**` | 2026-09-02 |
| Import specifiers `src/` uses | `#interlace/components/{analytics,scorecard}/…` | grep on `from "…interlace…"` | 2026-09-02 |
| Lock tests that walk a directory | 12 | grep `readdirSync\|globSync` in `src/__tests__` | 2026-09-02 |
| Of those, covering `.interlace/` | **0** | every root resolves to `apps/blog/src` | 2026-09-02 |
| Grids in `.interlace/` with responsive-only columns | 8 | grep for `grid` + `*:grid-cols-` without a base | 2026-09-02 |
| Production deploys failed from this | 3 | `5de4ba3`, `25dbea7`, `1cb8d6a` | 2026-09-02 |

The last two rows are the argument. Eight instances of a defect the repo
already knows how to detect, and three deploys that died on it.

**61 reachable, not 97, and the difference matters.** A lock over all 97 would
fail on components nothing renders, which is noise dressed as rigour. Scope to
what `src/` can reach and say so.

## Approach

**Extend the locks that already encode a universal invariant; leave the rest
alone.** `responsive-lock` is the reference case: "a responsive grid declares a
base column count" is true of any grid anywhere, so its search space was simply
wrong. Compare `rss-and-draft-exposure-lock`, which is about the article corpus
and has no business reading UI components.

Three steps, in this order, because the first one is the experiment:

1. **Extend `responsive-lock` to `.interlace/` and watch it go red on the eight
   grids.** Verified failing FIRST. A green extension means the glob missed the
   tree and the whole exercise is theatre — this repo has produced exactly that
   failure twice already (the `@/` alias miscount, and a regex that could not
   match its target), so it is the likeliest way this goes wrong.
2. **Decide per-lock, in writing, for the other eleven.** Each gets extended or
   gets a one-line reason it should not be. The output is a table in the
   finding, not a silent choice.
3. **Make the failure message actionable.** A generated file cannot be edited,
   so the assertion must say: fix upstream in the agents repo at
   `apps/interlace-docs-baseline/`, then `npm run sync`. Without that a red
   lock is a dead end for whoever hits it.

**On the eight grids themselves:** they cannot be fixed here. Either the
upstream baseline is corrected and re-synced, or the lock is pointed at
`.interlace/` with those eight recorded as a known, dated allowlist that must
shrink. Prefer the upstream fix; the allowlist is the fallback when the agents
repo is not to hand — as it was not today, since
`apps/interlace-docs-baseline/` does not exist in the local checkout.

Rejected: **deleting #234's CSS floor once the lock is green.** The floor
protects markup that regenerates from a source this repo does not own, and a
sync could reintroduce the defect between one deploy and the next. Belt and
braces is correct when one of them is outside your control.

Rejected: **a lint rule instead of a vitest lock.** `eslint-plugin-react-features`
could express this, but the repo's structural invariants live in
`src/__tests__/*-lock.test.ts` and splitting the same class of check across two
mechanisms is how one of them rots.

## Sequence

1. Extend `responsive-lock`'s scan root to include `.interlace/`, scoped to
   reachable components. Run it. **Expect red on 8.**
2. Record the eight with their file:line in the finding.
3. Fix upstream if the agents repo is available; otherwise land the lock with a
   dated allowlist and open the upstream work as its own intent.
4. Walk the remaining eleven locks; extend or exclude each with a reason.
5. Measure suite runtime before and after. Report both numbers.
6. Write the finding, including at least one lock this could not decide about.

## Gates

- **Step 1 must be seen failing.** No exceptions. This intent exists because a
  correct lock did not fire; shipping another lock that does not fire would be
  the same mistake with extra confidence.
- Every one of the twelve gets an explicit verdict. Silence is not a verdict.
- No generated file edited locally, no `--force` on sync.
- Suite runtime reported, not assumed.
- If the allowlist path is taken, it carries a date and an owning intent.

## Risks

- **A vacuous green.** The single likeliest failure, and it has precedent here
  twice. Mitigated by step 1's required red, and only by that.
- **Noise from unreachable components.** 36 of 97 are not referenced from
  `src/`; failing on those trains people to ignore the lock. Scope to reachable
  and revisit if the reachability scan proves too loose — it matches on
  basename, which will over-count before it under-counts.
- **The upstream repo is not here.** `apps/interlace-docs-baseline/` was not in
  the local agents checkout on 2026-09-02, so step 3 may block. That is why the
  allowlist fallback is written down rather than improvised later.
- **Extending the wrong locks** costs runtime and produces findings nobody
  acts on. Step 4's written verdict is the check on that.
