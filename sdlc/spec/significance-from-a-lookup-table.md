---
slug: significance-from-a-lookup-table
stage: spec
intent: sdlc/intent/significance-from-a-lookup-table.md
status: draft # draft | approved | superseded
gathered: 2026-09-07
---

## Thesis

The planned claim was "comparing plugins across N rules is a
multiple-comparisons problem and we apply no correction." That half held, by
absence. But verifying it surfaced a larger defect in the same file: the one
significance test that does exist decided its verdict from a three-row lookup
table with an `|| 5.991` fallback, so any comparison with df ≥ 4 was judged
against the df=2 threshold.

**The evidence moved the article.** The intended piece was a general T0 on
multiple comparisons; that concept is already published in
`ranking-vs-measuring`. What is *not* published is the self-audit, so the
article was re-scoped to the instrument. The missing correction survives as the
closing note rather than the thesis.

**Committed, not local.** The fix and its check are on `fix/chi-squared-lookup-fallback` (PR #952, branched from 08dfad0b9), so every row below reproduces for anyone — an earlier draft's rows reproduced only in one dirty worktree, which the reproducibility lens caught.

**Reproducibility note.** Every row describing the *defect* is pinned to
`b40bc6781` via `git show`, because the defect no longer exists on HEAD — it
was fixed in the same body of work. A command that only reproduced before the
fix is not evidence anyone can re-run, which the stale-claim detector caught
and was right to.

**Instrument note.** The six rows in the sampled-verdict table are not measured
outputs of a benchmark run — they are the two functions (old lookup predicate,
new computed tail) evaluated on chosen (χ², df) pairs inside the fallback gap.
They demonstrate the defect's behaviour deterministically. They are not a claim
about how often it fired in production, and the article must not imply one.

## Ground truth

| Claim                                                       | Value                                                | Command                                                                                                              | Version              | Verified   |
| ----------------------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------- | ---------- |
| The lookup table as written                                  | `{ 1: 3.841, 2: 5.991, 3: 7.815 }`                   | `git -C ../eslint show b40bc6781:benchmarks/suites/ilb-ai/run.js \| sed -n '90,95p'`                                                                    | eslint @ b40bc6781   | 2026-09-07 |
| The fallback predicate                                       | `chiSq > (criticalValues[df] \|\| 5.991)`             | `git -C ../eslint show b40bc6781:benchmarks/suites/ilb-ai/run.js \| sed -n '90,95p'`                                                                    | eslint @ b40bc6781   | 2026-09-07 |
| Degrees of freedom are group-count driven                    | `df = models.length - 1`                             | `git -C ../eslint show b40bc6781:benchmarks/suites/ilb-ai/run.js \| sed -n '90,95p'`                                                                    | eslint @ b40bc6781   | 2026-09-07 |
| Bug introduced (four months live at time of writing)         | 2026-05-11, commit b40bc6781                         | `git -C ../eslint log --format="%ad %h" --date=short -S criticalValues -- benchmarks/suites/ilb-ai/run.js \| tail -1`              | eslint               | 2026-09-07 |
| Second site, table extended but fallback kept                | `{1,2,3,4,5}` + `\|\| 5.991`                          | `git -C ../eslint show b40bc6781:benchmarks/suites/ilb-ai/run-antigravity.js \| grep -n criticalValues`                                                 | eslint @ b40bc6781   | 2026-09-07 |
| `pValue` field was a rendered string                         | `significant ? "< 0.05" : "> 0.05"`                  | `git -C ../eslint show b40bc6781:benchmarks/suites/ilb-ai/run-antigravity.js \| grep -n 'pValue: significant'`                                          | eslint @ b40bc6781   | 2026-09-07 |
| Same field is numeric `1` on the df<2 branch                 | `pValue: 1`                                          | `git -C ../eslint show b40bc6781:benchmarks/suites/ilb-ai/run.js \| grep -n 'pValue: 1'`                                                                | eslint @ b40bc6781   | 2026-09-07 |
| No correction anywhere in either repo                        | 0 matches                                            | `git -C ../eslint grep -niE "bonferroni\|holm\|benjamini\|hochberg\|fdr\|family-?wise" -- "benchmarks/**/*.ts" "benchmarks/**/*.js" "scripts/**/*.ts" "scripts/**/*.js" \| wc -l` | eslint, bench-suite  | 2026-09-07 |
| Sampled verdict χ²=7.0, df=4 — true tail                     | p = 0.1359 (old verdict: significant)                | `npm --prefix ../eslint/benchmarks run stats:check` (asserts 0.1359 ± 1e-3)                                                             | stats.ts @ PR #952   | 2026-09-07 |
| Sampled verdict χ²=7.0, df=5 — the widest miss               | p = 0.2206 (old verdict: significant)                | `npm --prefix ../eslint/benchmarks run stats:check` — asserted to 1e-3                                                            | stats.ts @ PR #952   | 2026-09-07 |
| Sampled verdicts wrong under the table                       | 6 of 6                                               | `npm --prefix ../eslint/benchmarks run stats:check` — the old predicate and all six pairs are committed in `stats.selfcheck.ts`; it asserts all six disagree AND that every disagreement is a false positive                              | stats.ts @ PR #952   | 2026-09-07 |
| Replacement reproduces df=1 critical value                   | p(3.841, 1) = 0.05001                                | `npm --prefix ../eslint/benchmarks run stats:check`                                                                                     | stats.ts @ PR #952   | 2026-09-07 |
| Replacement reproduces df=2 critical value                   | p(5.991, 2) = 0.05001                                | `npm --prefix ../eslint/benchmarks run stats:check`                                                                                     | stats.ts @ PR #952   | 2026-09-07 |
| Replacement reproduces df=3 critical value                   | p(7.815, 3) = 0.04999                                | `npm --prefix ../eslint/benchmarks run stats:check`                                                                                     | stats.ts @ PR #952   | 2026-09-07 |
| Replacement covers df the table never had                    | p(9.488, 4) = 0.04999; p(11.07, 5) = 0.05001         | `npm --prefix ../eslint/benchmarks run stats:check`                                                                                     | stats.ts @ PR #952   | 2026-09-07 |
| Lookup tables remaining in suites after the fix              | 0                                                    | `git -C ../eslint grep -n criticalValues -- "benchmarks/suites/**" \| wc -l`                                                                | eslint @ this PR     | 2026-09-07 |
| Probe p-values, the four with no prior row                    | 0.0916 (8.0,4); 0.0611 (9.0,4); 0.0752 (10.0,5); 0.0620 (12.0,6) | `npm --prefix ../eslint/benchmarks run stats:check` — each asserted to 1e-3   | stats.ts @ PR #952   | 2026-09-07 |
| The one real firing, from stored output                       | chiSq=18.43, df=4, true p=0.001017, verdict correct  | `npm --prefix ../eslint/benchmarks run stats:check` (asserts p=0.001017 and that the verdict was correct) | eslint @ 08dfad0b9   | 2026-09-07 |
| Stored run files carrying a chi-squared verdict                | 3 of 11 files; 1 with df>=4          | `git -C ../eslint ls-tree --name-only 08dfad0b9 -- benchmarks/results/ilb-ai/ \| grep -c "\.json$"`                                        | eslint @ 08dfad0b9   | 2026-09-07 |
| Unscoped-grep phantoms, benchmarks+scripts, extension filters dropped | 3, all base64 in package-lock integrity hashes | `git -C ../eslint grep -niE "bonferroni\|holm\|benjamini\|hochberg\|fdr\|family-?wise" -- "benchmarks/**" "scripts/**" \| wc -l` | eslint @ 08dfad0b9   | 2026-09-07 |
| Characters in the fallback token `\|\| 5.991`                    | 8                                    | `printf '\|\| 5.991' \| wc -c`                                                  | —                    | 2026-09-07 |
| Self-check assertions after adding the probes + firing         | 19                                   | `npm --prefix ../eslint/benchmarks run stats:check`                           | stats.ts @ PR #952   | 2026-09-07 |

## Known traps pre-empted

- [x] **Degrees of freedom are correct.** `df = models.length - 1` is right for
      an M×2 contingency table ((M−1)×(2−1)). I checked before claiming a
      second defect — it is not one, and the article does not allege it.
- [x] **The table's own entries are right.** 3.841, 5.991 and 7.815 are the
      correct α=0.05 values for df 1–3. The defect is the fallback, not the
      data. Saying otherwise would be an easy, wrong escalation.
- [x] **"Six of six" is scoped.** These are chosen points inside the gap, not
      a production sample. The spec's instrument note and the article's own
      wording both keep this a demonstration, never a frequency claim.
- [x] **"Four months" is measured**, not estimated — from `git log -S`, not
      from the file's mtime.
- [x] **Not already covered.** `ranking-vs-measuring` (published) owns the
      concept; `lint-harness-measured-nothing` (queued) owns the parse-error
      instrument defect and has zero mentions of chi-squared. Verified by grep.
- [x] **The absence grep is extension-scoped.** Run without `*.ts`/`*.js`
      filters it returns 3, all of them base64 fragments inside
      `package-lock.json` integrity hashes (`sha512-...fdr...`). A
      case-insensitive substring search over lockfiles will always manufacture
      hits like this; scoped to source, the count is 0.
- [x] **Counts come from a clean ref, not the working tree.** An earlier draft
      said "twelve run files"; `results/ilb-ai/*.json` is **11** at 08dfad0b9,
      on origin/main and on the fix branch. 12 appears only at b40bc6781 and in
      a local checkout, where `2026-02-05-enriched-example.json` sits at top
      level rather than in `backups/` — and it carries no `chiSquared` key, so
      it could never have been one of the three. Fourth number in this article
      to go wrong via a dirty worktree; every count is now pinned to a commit.
- [x] **No line counts.** Two drafts quoted `upperGamma`/`gammaLn` lengths and
      both were wrong (50/16 and 35/15 from a dirty worktree; the committed
      values are 33 and 13). A count that shifts with formatting is not a fact
      worth carrying, so the article now describes the dependency without
      numbering it.
- [x] **Frozen identifiers** — unpublished, no `devto_id` yet, so `slug` and
      `canonical_url` are still free. They must not move after first publish.
- [x] **The defect is fixed, not just described.** Both call sites now use the
      computed tail. Publishing an article about a live defect in our own
      instrument while leaving it live is the failure this article is about.

## Outline

1. **Hook — the dictionary.** The table, verbatim. → rows 1–3.
2. **The sampled verdicts.** Six rows, true p up to 0.22. → rows 9–11.
3. **The error had a direction.** The fallback is below every threshold it
   stands in for, so it only ever converts noise into a finding. → rows 1–2.
4. **Why it survived review.** It looks like rigor; the numbers are right.
   Then the second site, where adding rows moved the cliff from df≥4 to df≥6
   without removing it. → rows 5, and the trap-check on the table's entries.
5. **The field that was not a number.** → rows 6–7.
6. **The correction I came for.** Zero matches; we published the advice.
   → row 8, linking `ranking-vs-measuring`.
7. **The fix is arithmetic.** Computed tail, reproduces the textbook values
   including the ones the table never had. → rows 12–15.
8. **The check that would have caught it.** Asserts the ordering rule the
   fallback inverted. → rows 16–17.

## Framing check

Landscape framing holds: the only instrument criticised here is our own,
and the only named external works are Bonferroni and Benjamini–Hochberg as
methods. No other project is named at all, so the banned vocabulary has no
surface to attach to. The one risk is the reverse — self-flagellation read as
false modesty — which
the closing line answers by naming the mechanism (a number trusted because it
was never recomputed) rather than the sin.
