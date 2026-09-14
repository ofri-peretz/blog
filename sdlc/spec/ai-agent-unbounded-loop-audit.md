---
slug: ai-agent-unbounded-loop-audit
stage: spec
status: approved
intent: sdlc/intent/ai-agent-unbounded-loop-audit.md
gathered: 2026-09-14
---

## Thesis

`agent-resource-bounds` argued that a missing config object on an AI SDK call is
three resource defects. This is the field study behind that argument: how often
real, public, well-maintained repositories actually omit those bounds. The
answer is not "sometimes" — **12 of the 14 public repositories in the corpus that
call the AI SDK ship at least one generation call with no output cap.**

The honest half of the finding is the concentration. See "What this changes".

## Provenance of the instrument

The obvious prior art was `corpus-truth/sdk-exposure-2026-08-10.json`, a
107,382-file sweep already showing 87 in-SDK findings across the four bound
rules. **It could not support this article.** It recorded `{scanned, errors,
rules}` and nothing else — no corpus roots, no repository list, and no
denominator, so 87-out-of-unknown is a count and not a rate. It also loaded
rules from `/Users/ofri/repos/ofriperetz.dev/eslint-pgq/packages`, a checkout
that no longer exists, so it could not be re-run to find out.

`corpus-truth/ai-bounds-sweep.mts` replaces it and records the denominator as a
first-class output. Three defects were found and fixed in the new harness before
any number below was trusted:

| Defect in the harness                                                    | Effect                                                         | Fix                                                     |
| ------------------------------------------------------------------------ | -------------------------------------------------------------- | ------------------------------------------------------- |
| `SDK_PKGS.some(p => specifiersIn(src).has(p))` re-scanned each file 10×   | ~10× slower; no wrong numbers                                  | compute the specifier set once, after a substring reject |
| `repoOf` took the first path segment BELOW the root                      | with one root per repo it reported `src`/`app` as "repository" | repo = `basename(root)`, longest-prefix match            |
| verification run left `cwd` in the scratch dir                           | `files` glob matched nothing → **silent zero findings**        | `cwd` = corpus root                                      |

The corpus itself carried a defect: `eslint/tmp/adopt` holds the same project
under two names. `git remote` cannot detect this — every directory sits inside
the enclosing `eslint` working tree and reports `ofri-peretz/eslint`. Content
fingerprinting (sorted relative path + size) found 2 duplicate clones among the
16 SDK-bearing directories, so all figures below are over **14** distinct
projects.

## Ground truth

Measured with the **published** plugin, not the working tree: a field study asks
what a reader running `npm i` would see.

| Claim                                          | Value                                    | Command                                                                     | Version         | Verified   |
| ---------------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------- | --------------- | ---------- |
| plugin under test                              | 2.1.3                                    | `node -p "require('eslint-plugin-vercel-ai-security/package.json').version"` | plugin 2.1.3    | 2026-09-14 |
| linter under test                              | 9.39.5                                   | `node -p "require('eslint/package.json').version"`                          | eslint 9.39.5   | 2026-09-14 |
| candidate source files in the 14 repos         | 20,004                                   | `npx tsx ai-bounds-sweep.mts <14 roots>` → `candidateFiles`                  | sweep 2026-09-14 | 2026-09-14 |
| files importing the AI SDK                     | 474                                      | same run → `sdkFiles`                                                       | sweep 2026-09-14 | 2026-09-14 |
| **files with a generation call site**          | **116**  ← the denominator               | same run → `callFiles`                                                      | sweep 2026-09-14 | 2026-09-14 |
| distinct projects in the corpus                | 14 (16 dirs − 2 duplicate clones)        | `dedupe.ts` content fingerprint over the SDK-bearing dirs                    | 2026-09-14      | 2026-09-14 |
| no output cap — files                          | 103 of 116 (88.8%)                       | same run → `bounds["…/require-max-tokens"].callFiles`                       | sweep 2026-09-14 | 2026-09-14 |
| no output cap — repositories                   | **12 of 14**                             | `verify.mts` per-repo breakdown                                             | sweep 2026-09-14 | 2026-09-14 |
| no timeout — files / repos                     | 50 of 116 (43.1%) / 9 of 14              | same                                                                        | sweep 2026-09-14 | 2026-09-14 |
| no abort signal — files / repos                | 44 of 116 (37.9%) / 7 of 14              | same                                                                        | sweep 2026-09-14 | 2026-09-14 |
| largest single contributor (`cloudflare_agents`) | 52 of the 103 no-cap files (50.5%)     | `verify.mts` per-repo breakdown                                             | sweep 2026-09-14 | 2026-09-14 |
| parse/config errors across the run             | 0                                        | same run → `parseErrors`                                                    | sweep 2026-09-14 | 2026-09-14 |

Per-repo, no output cap: cloudflare_agents 52 · sentry-javascript 33 ·
vercel_examples 5 · antiwork_shortest 2 · directus_directus 2 · getsentry_junior 2 ·
vercel_chat 2 · 302ai_302-AI-Studio 1 · ai-elements 1 · auth0_auth0-evals 1 ·
vercel-labs_agent-eval 1 · vercel_streamdown 1.

## The fourth bound is excluded, deliberately

`require-max-steps` is **not** claimed. Two independent reasons:

1. The SDK defaults `stopWhen` to `stepCountIs(1)` (verified in the
   `agent-resource-bounds` spec against `ai` 7.0.31), so a tool loop is already
   bounded unless someone raised the ceiling on purpose. A rule firing on the
   default reports a non-defect.
2. Spot-checking 4 of its 25 flagged files found a confirmed false positive:
   `cloudflare_agents/packages/agents/src/tests/observability/ai-sdk-v6-integration.test.ts`
   contains both `stopWhen` and `stepCountIs` and was flagged anyway.

Its measured figures (29 findings, 25 files, 4 repos) are in the JSON and must
not be quoted in prose.

## Finding validation

Four findings per surviving rule were read against their source. All true
positives. The one that needed work:

`302ai_302-AI-Studio/electron/main/server/router.ts:391` flags
`await generateText(streamTextOptions)` — an indirect options object the rule
cannot see into, which is the classic false-positive shape. Checked: the object
spreads `baseConfig`, which sets `model`, `messages`, `providerOptions` and
`tools` and nothing else, and the whole 1,500-line file contains exactly one
occurrence of `timeout|abortSignal|maxOutputTokens`. True positive.

## What this changes in the article

**The percentage is not the headline; the repo count is.** `cloudflare_agents`
contributes 52 of the 103 no-cap files, so "88.8% of call sites" is one repo's
file layout as much as an industry fact. The article must lead with *12 of 14
repositories* — which survives removing any single project — and state the
concentration in the body rather than in a footnote.

**Say that 5 of the 14 are Vercel's own.** ai-elements, vercel-labs_agent-eval,
vercel_chat, vercel_examples and vercel_streamdown are the SDK vendor's own
repositories, and they appear in the findings. That is the least cherry-picked
evidence available and it must be framed as landscape, not indictment: example
code is deliberately minimal, and that is precisely the mechanism — the shape
people copy is the shape with no ceiling.

**n = 14 is small and must be stated.** The corpus is an adoption-scan
convenience sample, not a random draw from npm. The claim is "this is what the
SDK's own ecosystem looks like", not "this is the population rate".
