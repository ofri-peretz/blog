---
slug: lint-harness-measured-nothing
stage: spec
status: approved
intent: sdlc/intent/lint-harness-measured-nothing.md
gathered: 2026-09-07
---

## Thesis

Three independent mechanisms make an ESLint harness report zero while reading
nothing, and all three are silent — no error, no warning, no non-zero exit
attributable to the fault. Each was hit for real, and each produced an answer
that was believed before it was checked.

## Ground truth

Every row below was executed on 2026-09-07, not recalled.

| Claim | Value | Command | Version | Verified |
| --- | --- | --- | --- | --- |
| flat config with no `files` pattern skips `.ts` entirely | `src/a.ts` containing `eval()` never linted | `eslint .` in a dir with `export default [{ rules: { "no-eval": "error" } }]` | eslint 9.39.2 | 2026-09-07 |
| that skip is completely silent | `exit=0`, empty stdout, empty stderr | same run, with the only other file clean | eslint 9.39.2 | 2026-09-07 |
| a path outside `cwd` yields zero and exit 0 | `exit=0`, empty stderr | `eslint --no-config-lookup --config <cfg> <file outside cwd>` | eslint 9.39.2 | 2026-09-07 |
| the API form reports it only in a null-`ruleId` message | `"File ignored because outside of base path."` | `ESLint.lintFiles()` with `cwd` left at the caller's repo | eslint 9.39.2 | 2026-09-07 |
| that combination produced a false clean sweep | 100 files scanned, 0 findings, 14 of 14 rules reported zero-yield | rule-yield harness before the `cwd` fix | eslint 9.39.2 | 2026-09-07 |
| the same corpus after the fix | 308 findings across 54 of the same 100 files | identical harness, `cwd` set to the target | eslint 9.39.2 | 2026-09-07 |
| a workspace symlink measures unreleased source | `prefer-event-target: code` from the workspace vs `no fixer` from the registry | `node -p` over `meta.fixable`, run in the monorepo and in a clean dir | eslint-plugin-modernization 3.1.2 vs workspace | 2026-09-07 |

## Kill criterion, tested

The intent said to abandon if any of the three raises an error, a warning, or a
non-zero exit a normal caller would see, and to abandon if they collapse into
one defect.

- **Silence:** the outside-base-path run exits 0 with empty stderr. The
  flat-config skip exits 0 with empty stdout and stderr while a file containing
  `eval()` sits unread. The stale-artifact case produces a confident, wrong
  answer with no diagnostic at all. **All three silent.**
- **Distinctness:** they fail at three different layers — path resolution
  (which files are eligible), config matching (which eligible files are
  covered), and module resolution (which build is under test). A fix for any
  one leaves the other two intact. **Not one defect.**

Both survive.

## Note on exit codes

An earlier run of the flat-config case exited 1 and looked like a warning. It
was not: the exit came from a genuine `no-eval` finding in the `.js` file that
*was* linted. Re-run with that file clean, the exit is 0. The distinction
matters enough to record, because "it exited non-zero, so it noticed" is
exactly the wrong conclusion.

## Not verified

- The two remaining harness defects recorded in
  `BENCHMARK-ARTICLE-QUEUE.md` — a stale `dist/` measuring 3.3.2 against a
  published 4.1.0, and `spec/` directories linted as production code taking one
  repo from 300 findings to 26. Neither is reproduced here and neither appears
  in the article. The stale-artifact mechanism is instead demonstrated with the
  symlink case measured today.
- Whether these are the only silent-zero mechanisms. Three is what was hit, not
  what exists.
