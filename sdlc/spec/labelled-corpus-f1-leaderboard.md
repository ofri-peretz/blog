---
slug: labelled-corpus-f1-leaderboard
stage: spec
status: approved
intent: sdlc/intent/labelled-corpus-f1-leaderboard.md
gathered: 2026-09-07
---

## Thesis

Six ESLint security plugins measured on one labelled corpus, same harness, same
day. The number that matters is not the ranking but the recall column: five
community plugins detect between 4 and 27 of 69 vulnerable fixtures. The corpus
is ours, which bounds what the ranking can be used for, and that bound is the
article's spine rather than its footnote.

## Ground truth

Source: `BENCHMARK-RESULTS.md` section B2b (`ilb-juliet`), against
`eslint-plugin-security@4.0.1`, ESLint 10.8.1, Node 24.

| Claim | Value | Command | Version | Verified |
| --- | --- | --- | --- | --- |
| labelled corpus size | 69 vulnerable fixtures (TP+FN = 69 on every row) | `BENCHMARK-RESULTS.md` B2b table | eslint 10.8.1 | 2026-09-07 |
| Interlace | TP 69 / FP 0 / FN 0 — F1 100% | same table | eslint 10.8.1 | 2026-09-07 |
| eslint-plugin-sonarjs | TP 27 / FP 9 / FN 42 — F1 51.4% | same table | eslint 10.8.1 | 2026-09-07 |
| eslint-plugin-security | TP 10 / FP 7 / FN 59 — F1 23.3% | same table | security 4.0.1 | 2026-09-07 |
| @microsoft/eslint-plugin-sdl | TP 6 / FP 2 / FN 63 — F1 15.6% | same table | eslint 10.8.1 | 2026-09-07 |
| eslint-plugin-no-unsanitized | TP 4 / FP 1 / FN 65 — F1 10.8% | same table | eslint 10.8.1 | 2026-09-07 |
| eslint-plugin-security-node | TP 4 / FP 3 / FN 65 — F1 10.5% | same table | eslint 10.8.1 | 2026-09-07 |
| every published F1 recomputes from its own TP/FP/FN | 6 of 6 match to within 0.1pp | `2·P·R/(P+R)` recomputed independently of the document | n/a | 2026-09-07 |
| best community precision | 80% — eslint-plugin-no-unsanitized (4 TP / 1 FP) | derived from the same table | eslint 10.8.1 | 2026-09-07 |

## What was checked rather than quoted

The six F1 values were not taken on trust. Each was recomputed from the row's
own TP/FP/FN and all six matched the published figure. `TP + FN = 69` holds on
every row, which is the check that the rows describe the same corpus rather
than six differently-scoped runs.

The precision column is where the honest reading lives, and it is not in the
source table: computed from the same numbers, `no-unsanitized` is the most
precise tool in the comparison at **80%** (4 TP, 1 FP). It detects little, and
what it detects it gets right. That belongs in the article.

## Bounds on the claim — load-bearing, not a caveat

The corpus is ours. That makes this a **regression gate we also publish**, not
an independent evaluation, and it means a 100% row is the expected result of
grading your own homework rather than evidence of superiority. Any article
built on this table has to say so in the body.

The specific limits:

- Fixtures were authored alongside the rules that detect them. A plugin scoped
  to a different threat surface will score low here for reasons that have
  nothing to do with its quality on its own surface.
- F1 on a self-authored corpus measures agreement with our idea of the threat
  model, not correctness in the world.
- Recall against 69 of our fixtures is not recall against the field.

## Not verified

- Whether the superset claim ("every vulnerable fixture any of the five
  detects, we also detect") holds fixture by fixture. `BENCHMARK-RESULTS.md`
  asserts it was verified individually; that verification was not re-run here
  and the article states it as a claim from the record rather than as something
  reproduced today.
- Real-source behaviour. This is a labelled-fixture measurement; the 20-project
  real-source run is a separate instrument with a separate caveat about volume
  versus correctness.
