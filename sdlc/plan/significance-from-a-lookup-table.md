---
slug: significance-from-a-lookup-table
stage: plan
spec: sdlc/spec/significance-from-a-lookup-table.md
status: draft
---

## Files that change

| File | Change |
| --- | --- |
| `eslint:benchmarks/lib/stats.ts` | add `chiSquaredPValue` + regularized incomplete gamma (`gammaLn`, `upperGamma`) |
| `eslint:benchmarks/lib/stats.selfcheck.ts` | new — 11 assertions, incl. the regression the table hid |
| `eslint:benchmarks/package.json` | new script `stats:check` |
| `eslint:benchmarks/suites/ilb-ai/run.js` | drop the table; call the computed tail; `pValue` becomes numeric |
| `eslint:benchmarks/suites/ilb-ai/run-antigravity.js` | same, second site |
| `blog:content/articles/significance-from-a-lookup-table.md` | the article |
| `blog:sdlc/{intent,spec,plan,review}/significance-from-a-lookup-table.*` | the chain |

The code changes live in the **eslint** repo and the article in **blog-public**.
Two repos, two PRs; the article must not merge before the fix, or it describes
a live defect as fixed.

## Work order

1. Fix `stats.ts`, prove the self-check fails on the old predicate and passes on the new. *(done)*
2. Rewire both call sites; confirm zero `criticalValues` remain in `suites/`. *(done)*
3. Write the article strictly against the spec's ground-truth table. *(done)*
4. Run the five-lens panel to 9.5; write `sdlc/review/<slug>.json` + the `quality` block. *(pending)*
5. Generate cover + OG assets at the slug stem. *(pending)*
6. Human approves the intent and the spec, then both PRs. *(pending — not mine)*

## Risks

- **"6 of 6" reads as a production frequency.** It is six chosen points inside
  the fallback gap. The spec carries an instrument note; the article says
  "I sampled six statistics that land in that gap". Keep that wording.
- **Over-claiming a second defect.** `df = models.length - 1` is *correct*
  here. Checked, and deliberately not alleged.
- **The article outliving the fix.** If the eslint PR stalls, the article
  claims a fix that is not on main. Gate publish on that PR merging.
- **Cover assets.** `cover_image` / `social_image` stems are frozen to the slug
  at first publish; generating them late is fine, renaming them later is not.

## Proof of success

- `npm run -w @interlace/benchmarks stats:check` → 11 assertions, exit 0.
- The old predicate, run against the same six pairs, exits 1 with 6 disagreements.
- `grep -rn criticalValues benchmarks/suites/ | wc -l` → 0.
- Five lenses ≥ 9.5; `sdlc-spec-evidence-lock` and `sdlc-quality-lock` green.
