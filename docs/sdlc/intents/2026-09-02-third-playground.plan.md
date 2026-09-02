---
kind: plan
slug: 2026-09-02-third-playground
opened: 2026-09-02
---

# Plan: a third playground, at zero marginal cost

Intent: [`2026-09-02-third-playground.intent.md`](./2026-09-02-third-playground.intent.md)

## Ground truth

| Claim | Value | Source | Read on |
|---|---|---|---|
| Article views | ~1,058, the corpus outlier | articles corpus inventory | 2026-05 |
| Share of all blog views | ~23% from this one article | same | 2026-05 |
| Plugin the article names most | node-security, 5 mentions | grep of the article body | 2026-09-02 |
| Plugin already bundled | yes | workers/lint.worker.ts imports | 2026-09-02 |
| Rules it discusses that EXIST | weak-hash, non-literal-fs, child-process, buffer-overread, arbitrary-file-access | `node -p` against the installed 5.2.3 | 2026-09-02 |
| Rules it discusses that do NOT | no-hardcoded-credentials, no-unlimited-resource-allocation | same check | 2026-09-02 |
| Existing playgrounds | 2 | LINT_EMBEDS length | 2026-09-02 |

That second-to-last row is why the check happened before the writing. Two rule
names the article discusses are not in this plugin, and a definition naming
either would have shipped a playground that throws.

## Approach

One `LINT_EMBEDS` entry, three rules, one sample that trips all three.

Rule choice is constrained by more than availability: `detect-child-process` is
provenance-gated and needs an attacker-reachable root (`req`, `event`), which
is exactly the trap that made the node-security demo advertise three rules and
fire one. So the sample is built as a **realistic audit target** — an Express
handler with a request-derived value flowing into each sink — rather than a
list of isolated snippets.

Chosen: `no-weak-hash-algorithm`, `detect-non-literal-fs-filename`,
`detect-child-process`. All three are discussed in the article, all three fire
on one coherent handler, and the CWEs (327, 22, 78) span three different
failure families so the findings list reads as a scan rather than a repetition.

Rejected: `no-arbitrary-file-access` and `no-buffer-overread` — both exist and
both are discussed, but four findings on twelve lines reads as a contrived
gauntlet rather than code someone might have written.

## Sequence

1. Add the definition to `lint-embeds.ts`.
2. Run the real linter against the sample and confirm all three fire — the
   existing lock does this, and it is the gate that caught the last one.
3. Add the `::playground-cta` directive for the Dev.to copy.
4. Full suite, lint.

## Gates

- Every enabled rule fires on the sample — enforced by `lint-embeds-lock`,
  which runs the published plugins rather than grepping the sample.
- No new import in `lint.worker.ts`. If one is needed, the intent is wrong.
- Bundle size unchanged; the measured-claims lock holds the gate label to the
  artifact and will fail if it moves outside 8%.
- The article's slug and frontmatter are untouched.

## Risks

- **The sample can read as contrived.** It is a demo, and a reader who senses
  a gauntlet trusts the findings less. Three rules on one plausible handler is
  the compromise; more would tip it.
- A playground on the top article is also the clearest possible negative
  result. If `playground_open` stays at zero here, that is strong evidence the
  feature does not convert, and the intent commits to reading it that way
  rather than adding a fourth.
