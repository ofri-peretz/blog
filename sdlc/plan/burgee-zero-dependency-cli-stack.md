---
slug: burgee-zero-dependency-cli-stack
stage: plan
spec: sdlc/spec/burgee-zero-dependency-cli-stack.md
status: built
---

## Files that change

| File                                                                               | Change                                                      |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `sdlc/intent/burgee-zero-dependency-cli-stack.md`                                  | `proposed` to `approved`, with the owner's words and date   |
| `sdlc/spec/burgee-zero-dependency-cli-stack.md`                                    | new: every number, with the command that produced it        |
| `sdlc/plan/burgee-zero-dependency-cli-stack.md`                                    | new: this file                                              |
| `apps/blog/content/articles/burgee-zero-dependency-cli-stack.md`                   | new: the article, `published: false`, no `devto_id`         |
| `apps/blog/public/cdn/blog-cover-image/burgee-zero-dependency-cli-stack{,-og}.jpg` | cover and OG crop at the slug stem                          |
| `sdlc/review/burgee-zero-dependency-cli-stack.json`                                | the five-lens panel, written by reviewers who did not draft |

## Work order

1. Re-derive part 1's method exactly (`npm i --package-lock-only`, count
   `node_modules/` keys) and add one byte line (install with
   `--ignore-scripts`, sum file sizes, symlinks and `.bin` skipped).
2. Measure every incumbent burgee's README "Replaces" column names, one at a
   time; then the nine family packages; then three stacks: one incumbent per
   layer (commander and yargs variants) and the layers where burgee publishes a
   100% graded drop-in.
3. Count maintainer accounts across each resolved tree from registry
   packuments.
4. Re-run burgee's bare bundle gates (its esbuild command, its fixture shape)
   and its cold-start fixtures, to cross-check the three unmet gates.
5. Cross-check against burgee's own README "Measured" section and
   `.sdlc/bands/foundation-ceilings.json`; record every disagreement and its
   cause in the spec instead of choosing one number.
6. Write under the 800-word publish cap, strictly from the spec.
7. Five-lens panel by separate reviewer agents; iterate to 9.5 on every lens.

## Risks

- **The registry moved mid-measurement.** burgee `0.10.0` published during
  stage 2 before two of its family dependencies existed. Every figure is
  re-measured after the release settled and the resolved versions are pinned
  in the spec.
- **"Zero dependencies" read loosely.** Three of the nine declare family
  dependencies. The article says "no dependency outside the family" and
  counts `npm i burgee` as the six packages it is.
- **A flattering denominator.** The one-per-layer stack includes layers
  where burgee's drop-in is below 100% or not graded at all. The article
  prints the graded-only stack too, where the byte comparison reverses.
- **Timing on a loaded machine.** The local cold-start re-runs were taken at
  a 1-min load average of 84 to 168; they are printed as a range with the load,
  never as a gate value.

## Proof of success

```bash
npm run test -- sdlc-chain-lock sdlc-quality-lock
npm run lint
npm run format
npm run build
```
