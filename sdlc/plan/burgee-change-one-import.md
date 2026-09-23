---
slug: burgee-change-one-import
stage: plan
spec: sdlc/spec/burgee-change-one-import.md
status: built
---

## Files that change

- `apps/blog/content/articles/burgee-change-one-import.md` — new, `published: false`
- `apps/blog/public/cdn/blog-cover-image/burgee-change-one-import.jpg` — cover
- `apps/blog/public/cdn/blog-cover-image/burgee-change-one-import-og.jpg` — social crop
- `sdlc/intent/burgee-change-one-import.md` — approval recorded, stage-2 outcome
- `sdlc/spec/burgee-change-one-import.md` — ground truth
- `sdlc/spec/burgee-change-one-import.repro.mjs` — builds and runs the tutorial
  program so every behavioural row is a single command
- `sdlc/review/burgee-change-one-import.json` — written by the panel

## Work order

1. Record the owner's approval on the intent, verbatim, with its date.
2. Build the tutorial for real: a two-command commander CLI on
   `commander@15.0.0`, swapped to `burgee@0.9.2`, in a scratch directory. Run
   every surface the intent names, on the untouched program, before writing.
3. Re-run the compat oracle on burgee origin/main (control and target), as the
   intent requires, rather than quoting the README's rate.
4. Evaluate the three kill criteria against what ran. Criterion 1 fired for
   the data half of `--json`/`--mcp`: re-scope, and say so in the intent.
5. Encode every observed value as a repro probe; write the spec rows against
   the probes; run the stale-claim detector over the new rows only.
6. Write the article against the spec, under the 800-word publish cap.
   Every code block is either the executed file (prettier-formatted, since the
   repo's format check covers markdown) or a transcript pasted from the run.
7. Cover on the flat-ground chassis: `validate-hooks`, `verify-hook-facts`,
   `cover-check`, and a look at both crops.
8. Panel: the devto-review reviewers plus the five-lens panel, iterated until
   every lens clears 9.5; write the review JSON and the frontmatter `quality`.

## Risks

- **The tutorial is about our own product and finds our own defects.** Two
  0.9.2 defects (MCP multi-word options; completion `--no-` flags) and a docs
  drift are disclosed in the article. Mitigation: they are measured, named,
  and scoped; the owner can choose to fix burgee before dispatching, which
  would shorten the defects section, not invalidate the rest.
- **Version drift.** Every behavioural claim is pinned to `burgee@0.9.2`. A
  later release that fixes the defects makes the article stale, not wrong; the
  weekly detector re-runs the probes against the pinned version, so a
  re-pin is a deliberate edit.
- **Word cap.** Code blocks count toward the 800-word cap in
  `publish-gate.ts`; transcripts are kept to the lines that carry the claim.

## Proof of success

```bash
npm run test -- sdlc-quality-lock sdlc-chain-lock
node sdlc/spec/burgee-change-one-import.repro.mjs all
npm run format
npm run build
```
