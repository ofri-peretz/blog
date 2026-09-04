---
slug: ai-agents-rebranded-my-oss-ecosystem-two-pipelines-were-dead
stage: spec
intent: sdlc/intent/ai-agents-rebranded-my-oss-ecosystem-two-pipelines-were-dead.md
status: approved
gathered: 2026-09-04
---

## Thesis

Two delivery pipelines failed without ever showing red — one served a stale
build while every deploy reported success, the other emitted no checks at all,
which the merge button renders as invitingly as a pass. The portable output is
one rule: a change is done when a request to production returns the thing you
shipped.

This article is an incident write-up, so it divides cleanly into **mechanism**,
which is checkable and was checked, and **incident facts**, which are
single-event observations nobody can re-run. The table below is only the first
kind. The second is enumerated underneath rather than dressed up with a
command.

## Ground truth

| Claim                                                          | Value                 | Command                                                                                         | Version            | Verified   |
| -------------------------------------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------- | ------------------ | ---------- |
| the pinned CLI exists and when it published                    | 54.20.1 on 2026-07-03 | read `time['54.20.1']` from the npm registry document for `vercel`                              | 54.20.1            | 2026-09-04 |
| the drifted CLI exists and when it published                   | 58.4.4 on 2026-07-30  | read `time['58.4.4']` from the same document                                                    | 58.4.4             | 2026-09-04 |
| majors an unpinned npx could cross in that window              | 4                     | 54 to 58 between those two publish dates                                                        | registry           | 2026-09-04 |
| the fix is actually in the repo                                | present               | `git show origin/main:.github/workflows/deploy-docs.yml` contains `VERCEL_CLI_VERSION: 54.20.1` | eslint@origin/main | 2026-09-04 |
| every call consumes the pin, which is the article's own caveat | 4 invocations         | same file: `npx "vercel@$VERCEL_CLI_VERSION"` on the pull, both build calls and the deploy      | eslint@origin/main | 2026-09-04 |
| the sibling deploy workflow is pinned too                      | vercel@56.3.2         | `git show origin/main:.github/workflows/deploy.yml`                                             | eslint@origin/main | 2026-09-04 |
| the disabled-workflow command is real and returns a state      | works, e.g. `active`  | `gh workflow list --all --json name,state -R ofri-peretz/blog`                                  | gh CLI             | 2026-09-04 |

**Read `origin/main`, not the working tree.** The first attempt at the two
workflow rows was run against a local checkout sitting on an unrelated branch,
and returned both a false negative (no pin found) and a false positive (an
unpinned `vercel@latest` that does not exist on main). Both rows above were
re-taken with `git show origin/main:`.

## Incident facts, not re-runnable

Recorded so that nobody later mistakes them for measurements a reader can
reproduce:

- 13 pull requests across 5 repositories in one night
- 1,580 tests green on the rebrand merge
- production serving a build from mid-July for two weeks
- 4 PRs merged since May against an empty check rollup
- a build artifact of 18,316 files against a 15,000-file deploy cap

The last one carries the right disclosure in the article already — "measured on
our plan, not quoted from docs" — which is the correct treatment for a platform
limit that varies by account. One of the five repositories is private, so even
the PR count cannot be audited from outside.

## Known traps pre-empted

- [x] **Export shape** — no plugin import appears.
- [x] **Rule counts** — none claimed.
- [x] **Config option names** — the only configuration shown is a workflow env
      var, checked against the file on `origin/main`.
- [x] **Detection logic** — no rule behaviour described.
- [x] **Frozen identifiers** — unpublished. The slug carries no number.

## Outline

1. The two dead pipelines — incident facts, none in the table.
2. **Merged is a feeling. Live is a measurement.** — the CLI version rows, the
   pin rows, and the `gh workflow list` row.
3. **The live check** — no numeric claim; the portable artifact.
4. **What the agents could not do** — no numeric claim.

## Framing check

Landscape. The only external party named is a platform whose CLI shipped a
behaviour change across a major, described factually with both version numbers
and no blame — the article puts the fault on its own unpinned invocation. No
comparison, so the fixture disclosure does not apply.
