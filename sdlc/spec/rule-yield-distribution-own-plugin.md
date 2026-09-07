---
slug: rule-yield-distribution-own-plugin
stage: spec
status: approved
intent: sdlc/intent/rule-yield-distribution-own-plugin.md
gathered: 2026-09-07
---

## Thesis

Yield across a plugin's own rules is steeply concentrated, and the concentration
survives the checks that would make it an artifact. Two rules of fourteen carry
59.7% of findings; six carry none. The article's job is to make that shape the
subject rather than the total.

## Ground truth

Measured 2026-09-07 against `eslint-plugin-react-features` as it stands in the
workspace, over the **public** `apps/blog/src` tree of this repository — chosen
over the four private repos used in the August pass precisely because a reader
can clone it and re-run the numbers.

The harness lints an explicit file list produced by `find`, not a glob, and
prints any message with a null `ruleId` instead of skipping it. Both choices are
corrections to defects in the first version of this measurement; see Instrument
defects below.

| Claim | Value | Command | Version | Verified |
| --- | --- | --- | --- | --- |
| rules unique to react-features (no eslint-plugin-react counterpart) | 14 | bare rule names of `eslint-plugin-react-features` minus rule names of `eslint-plugin-react` | react-features 2.1.0 (workspace) | 2026-09-07 |
| files scanned | 100 `.tsx` | `find apps/blog/src -name '*.tsx'` | react-features 2.1.0 (workspace) | 2026-09-07 |
| files with at least one finding | 54 | harness output | react-features 2.1.0 (workspace) | 2026-09-07 |
| total findings | 308 | harness output | react-features 2.1.0 (workspace) | 2026-09-07 |
| top rule | `react-no-inline-functions`, 113 findings across 38 files | harness output | react-features 2.1.0 (workspace) | 2026-09-07 |
| second rule | `react-render-optimization`, 71 across 27 files | harness output | react-features 2.1.0 (workspace) | 2026-09-07 |
| remaining non-zero | hooks-exhaustive-deps 42/15, require-data-slot 35/14, no-unnecessary-rerenders 32/12, no-inline-style 9/1, no-raw-color-literal 4/2, no-arbitrary-token-class 2/2 | harness output | react-features 2.1.0 (workspace) | 2026-09-07 |
| zero-yield rules | 6 of 14 (42.9%): required-attributes, react-class-to-hooks, no-default-test-id, no-is-prefix-prop, no-kind-prop-discriminator, no-wrapper-sub-component | harness output | react-features 2.1.0 (workspace) | 2026-09-07 |
| top-1 share | 36.7% | 113/308 | react-features 2.1.0 (workspace) | 2026-09-07 |
| top-2 share | 59.7% | 184/308 | react-features 2.1.0 (workspace) | 2026-09-07 |
| top-4 share | 84.7% | 261/308 | react-features 2.1.0 (workspace) | 2026-09-07 |
| mean findings per rule | 22.0 | 308/14 | react-features 2.1.0 (workspace) | 2026-09-07 |

## Kill criterion, tested

The intent said to abandon if the distribution is flat, or if the top rule's
findings collapse into one repeated pattern in one file.

- Flatness: the top rule is 113 against a mean of 22.0. The threshold was twice
  the mean, 44.0. **Not flat.**
- Single-file artifact: `react-no-inline-functions` fires 113 times across **38
  distinct files**, and the second rule 71 times across 27. **Not one defect
  counted many times.**

The premise survives both. Recorded here because a kill criterion that is never
run against the evidence is decoration.

## Instrument defects found and fixed while gathering

Both produced a confident, plausible, wrong answer, and both failed in the
flattering direction of "nothing to report".

1. **Glob returned zero files.** `lintFiles(['<dir>/**/*.tsx'])` matched nothing
   while `find` located 100 files. Replaced with an explicit list.
2. **ESLint ignored every file, silently.** With `cwd` left at the plugin repo,
   each result carried the message *"File ignored because outside of base
   path."* — and the harness skipped any file whose messages contained a null
   `ruleId`, so those were discarded unread. Result: 100 files scanned, 0
   findings, all 14 rules reported zero-yield. Fixed by setting `cwd` to the
   target and printing null-`ruleId` messages rather than skipping them.

The defect was caught by a canary: a four-line component with an inline arrow
and an inline style, which must trigger at least two of the rules. It reported
zero. No corpus number was trusted until the canary reported 6 findings.

## Not verified

- The August 2026 figures (1,279 findings over 401 `.tsx` across four repos) are
  **not** re-derived here and must not be quoted alongside these. Different
  corpus, different rule count — the plugin has since gained four rules.
- Whether the concentration generalises beyond this corpus. One public tree is
  a shape, not a rate, and the article says so.
