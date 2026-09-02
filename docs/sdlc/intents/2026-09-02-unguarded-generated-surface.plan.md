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
| Generated components (`.tsx`) in `.interlace/` | 97 | grep for the AUTO-GENERATED banner | 2026-09-02 |
| Generated files, all types | 109 | same, no include filter | 2026-09-02 |
| `#interlace/` import specifiers in `src/` | 10, across **2** files | parsed `import`/`export … from` lines | 2026-09-02 |
| ~~…across 4 files~~ | ~~4~~ WRONG | `grep -rl` also matched two comments | 2026-09-02 |
| Generated files reachable, following imports | **17** | import-graph walk from those 10 | 2026-09-02 |
| ~~Reachable by basename scan~~ | ~~61~~ WRONG | counted any filename mentioned anywhere | 2026-09-02 |
| Lock tests that walk a directory | 12 | grep for readdirSync or globSync in `src/__tests__` | 2026-09-02 |
| Of those, covering `.interlace/` | **0** | every root resolves to `apps/blog/src` | 2026-09-02 |
| Grids in `.interlace/` with responsive-only columns | 8 total, **4 reachable** | class-string scan | 2026-09-02 |
| Deploys that failed the layout gate | 3 consecutive | `5de4ba3`, `25dbea7`, `1cb8d6a` | 2026-09-02 |

**The 61 was wrong and the correction matters.** It came from a basename scan
— any `.interlace/` filename mentioned anywhere under `src/` counted as
reachable, which counts comments, unrelated identifiers, and files that merely
share a name. Following the actual import graph from the 10 real `#interlace/`
specifiers gives **17**. Review caught it; the method was the error, not the
arithmetic, and it is the third measurement mistake this SDLC directory has
recorded. A heuristic over a codebase you have not read produces a confident
wrong list — which is written in `2026-08-31-behavioural-claims.plan.md` in as
many words, by me, before I did it again.

**And "4 files" was the same mistake again, one paragraph later.** `grep -rl`
matched two files that only mention `#interlace/` in a comment. Parsing the
import lines gives **2** — `app/layout.tsx` (2) and `app/scorecard/page.tsx`
(8), which is where the 10 specifiers come from. The 10 was right because
comments were not counted toward it; the file count was not. Review caught it,
in the same review that caught the 61. Four measurement errors now, and every
one of them a grep standing in for a parse.

**On the three deploys:** all three failed the layout gate, but `5de4ba3` is
itself the commit that FIXED the article reflows — its deploy failed on a
`/scorecard` case it never claimed to address. Read the row as "three
consecutive deploys were blocked by this gap", not "three commits introduced
it". The distinction matters because it is the gate working, not the gate
misfiring.

The last two rows are the argument. Eight instances of a defect the repo
already knows how to detect, and three deploys that died on it.

**17 reachable, not 97 — and not 61 either.** A lock over all 97 would fail on
components nothing renders, which is noise dressed as rigour. Scope to what
`src/` can actually reach through imports.

The scoping choice is load-bearing and the plan must state it rather than leave
it to whoever implements: **scoped to reachable, step 1 should go red on 4, not
8.** Those four are `momentum-panel`, `momentum-panel-skeleton`, `ratchet-grid`
and `ratchet-grid-skeleton` — precisely the components that broke `/scorecard`
and the production deploy. The other four defective grids sit in unreachable
files; they are real defects but nothing renders them, so they belong in the
finding as a note, not in a gate.

## Approach

**Extend the locks that already encode a universal invariant; leave the rest
alone.** `responsive-lock` is the reference case: "a responsive grid declares a
base column count" is true of any grid anywhere, so its search space was simply
wrong. Compare `rss-and-draft-exposure-lock`, which is about the article corpus
and has no business reading UI components.

Three steps, in this order, because the first one is the experiment:

1. **Extend `responsive-lock` to `.interlace/` and watch it go red.** Verified
   failing FIRST. A green extension means the glob missed the tree and the
   whole exercise is theatre — this repo has produced exactly that failure
   twice already (the `@/` alias miscount, and a regex that could not match its
   target), so it is the likeliest way this goes wrong.

   **Two counts, two purposes, and they must not be conflated** — an earlier
   draft of this plan said "8" here and "4" in the ground truth, which cannot
   both be the gate:
   - **Unscoped**, over all of `.interlace/`: expect red on **8**. This is a
     one-off diagnostic that proves the glob reaches the tree at all.
   - **Scoped to reachable**, which is what actually ships: expect red on
     **4**. This is the gate.

   Run the unscoped pass once to prove reach, then scope down. If the scoped
   pass is green while the unscoped one is red, the scoping is wrong, not the
   lock.
2. **Decide per-lock, in writing, for the other eleven.** Each gets extended or
   gets a one-line reason it should not be. The output is a table in the
   finding, not a silent choice.
3. **Make the failure message actionable.** A generated file cannot be edited,
   so the assertion must say: fix upstream in the agents repo at
   `apps/interlace-docs-baseline/`, then `npm run sync`. Without that a red
   lock is a dead end for whoever hits it.

**On the defective grids themselves:** they cannot be fixed here. Either the
upstream baseline is corrected and re-synced, or the lock lands with them
recorded as a dated allowlist that must shrink. Prefer the upstream fix; the
allowlist is the fallback when the agents repo is not to hand — as it was not
today, since `apps/interlace-docs-baseline/` does not exist in the local
checkout.

**Allowlist spec, so it is not improvised later.** File:
`apps/blog/src/__tests__/fixtures/interlace-grid-allowlist.json`. Shape: an
array of `{ "file": "<path>:<line>", "class": "<the class string>", "since":
"YYYY-MM-DD", "intent": "<slug>" }`. The lock asserts every offender it finds
is present in the allowlist AND that the allowlist contains no entry it did not
find — so a fixed grid fails the lock until its entry is deleted. That is the
ratchet: it can only shrink, the same contract as
`sdlc/baseline/unscored.json`. Header comment states, in one line, that these
are upstream defects in generated files and that the fix is in the agents repo,
not here.

Rejected: **deleting #234's CSS floor once the lock is green.** The floor
protects markup that regenerates from a source this repo does not own, and a
sync could reintroduce the defect between one deploy and the next. Belt and
braces is correct when one of them is outside your control.

Rejected: **a lint rule instead of a vitest lock.** `eslint-plugin-react-features`
could express this, but the repo's structural invariants live in
`src/__tests__/*-lock.test.ts` and splitting the same class of check across two
mechanisms is how one of them rots.

## Sequence

1. Extend `responsive-lock`'s scan root to include `.interlace/`. Run it
   UNSCOPED first — **expect red on 8**, which proves the glob reaches the
   tree. Then scope to reachable components — **expect red on 4**, which is
   the gate that ships. Both numbers recorded; neither assumed.
2. Record the eight with their file:line in the finding.
3. Fix upstream if the agents repo is available; otherwise land the lock with a
   dated allowlist and open the upstream work as its own intent.
4. Walk the remaining eleven; extend or exclude each with a reason. Two are
   worth flagging in advance so the verdict pass does not stall on them:
   - `interlace-floor-lock.test.ts` is named after the design system but roots
     at `apps/blog/src` and has never read `.interlace/`. It is the one whose
     name most invites the wrong assumption; whatever the verdict, say why the
     name and the scope disagree.
   - `markdown-heading-anchors.test.ts` is in the 12 because it walks a
     directory, but it is not a `*-lock.test.ts` by CLAUDE.md's convention. It
     still needs a verdict; it just is not a "lock" in the naming sense. (This
     is why step 4 says eleven: 12 minus `responsive-lock`.)
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
- **Reachability is now measured the other way round, and so is its risk.**
  80 of the 97 are not reachable; failing on those trains people to ignore the
  lock, which is why the gate is scoped. But note the method changed: the
  discredited basename scan over-counted, while the import-graph walk that
  replaced it can **under**-count — it follows static `from "…"` specifiers
  only. Three files under `src/` use dynamic `import()`, and `.interlace/`
  has one `index.ts` barrel; neither is followed today. Under-counting is the
  worse failure here, because a component that renders but is not in the
  scoped set is exactly the gap this intent exists to close. If step 1's
  scoped pass is red on fewer than 4, suspect the walk before suspecting the
  grids.

  (The phrase "matches on basename" survived in this bullet from the draft the
  ground truth corrects above. Review caught the leftover — the same defect the
  intent's success criterion had: a claim updated in one place and not the
  other.)
- **The upstream repo is not here.** `apps/interlace-docs-baseline/` was not in
  the local agents checkout on 2026-09-02, so step 3 may block. That is why the
  allowlist fallback is written down rather than improvised later.
- **Extending the wrong locks** costs runtime and produces findings nobody
  acts on. Step 4's written verdict is the check on that.
