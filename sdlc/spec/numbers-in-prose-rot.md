---
slug: numbers-in-prose-rot
stage: spec
status: approved
intent: sdlc/intent/numbers-in-prose-rot.md
gathered: 2026-09-07
---

## Thesis

A derived prose document accumulated figures that its own cited source does not
contain. Nothing detected it because nothing recomputes prose. Four distinct
drift modes, found in one audit of twelve planned pieces.

## Ground truth

The document is an internal article queue naming
`benchmarks/results/published/benchmark-2026-08-14.json` as its source. Every
row below was checked against that file and against every other file under
`benchmarks/results/` on 2026-09-07.

| Claim | Value | Command | Version | Verified |
| --- | --- | --- | --- | --- |
| the canonical corpus totals | interlace 1,375 / competitor 23,325 across 20 repos, 23,682 files | read `realSource` from benchmark-2026-08-14.json | 2026-08-14 run | 2026-09-07 |
| document asserts a different pair | "981 findings at 47% precision against 21,557 at 20%" | read from the queue document | n/a | 2026-09-07 |
| `21557` in any result file | zero occurrences | `grep -rlF 21557 benchmarks/results/` | all runs | 2026-09-07 |
| `4311` in any result file | zero occurrences | `grep -rlF 4311 benchmarks/results/` | all runs | 2026-09-07 |
| a real figure attached to the wrong set | document says "every other rule combined accounts for 0.6%" | read from the queue document | n/a | 2026-09-07 |
| what 0.6% actually is | the bottom FIVE rules — 142 of 23,325 | summed from `realSource.byRule.competitor` | 2026-08-14 run | 2026-09-07 |
| what "every other rule" actually is | 2,991 — 12.8% | 23,325 − 20,334 | 2026-08-14 run | 2026-09-07 |
| the figure that does verify | `security/detect-object-injection` 20,334 of 23,325 = 87.2% | same byRule map | 2026-08-14 run | 2026-09-07 |
| two further claims contradicted by data | `detect-crlf` "297 files" and `unhandled-async` "176 files"; result files record 1 each | `grep` of the rule ids in the result JSONs | 2026-08-23, 2026-05-11 runs | 2026-09-07 |

## Kill criterion, tested

The intent said to abandon if the missing numbers live somewhere unsearched, or
if the drift is explainable as a stale citation to an earlier run.

- **Not unsearched.** `21557` and `4311` return zero files across the whole of
  `benchmarks/results/`, not merely the cited file.
- **Not a stale citation.** A stale citation would be internally consistent with
  *some* run. The pair 981/21,557 is not the totals of any run; the canonical
  pair for the corpus it describes is 1,375/23,325, and the document names that
  file as its source. The drift is between the prose and its own stated source.

Survives both.

## The four modes, distinguished

1. **Figure with no source at all** — 21,557 and 4,311.
2. **Figure contradicting the cited source** — 981 against 1,375.
3. **Real figure, wrong subject** — 0.6% is the bottom five rules, presented as
   "every other rule".
4. **Figure contradicted by a later run** — 297 and 176 files against result
   data recording 1 each.

Only the third is recoverable by reading carefully. The others need the source
open beside the prose.

## Not verified

- Whether the numbers were correct when first written. This audit establishes
  that they do not hold now against available artifacts; it does not establish
  when they stopped holding, and the article does not claim they were ever
  fabricated.
- Whether other documents in the same repository carry the same drift. Only the
  article queue was audited.
