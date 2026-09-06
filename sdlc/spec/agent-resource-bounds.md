---
slug: agent-resource-bounds
stage: spec
status: approved
intent: sdlc/intent/agent-resource-bounds.md
gathered: 2026-09-06
---

## Thesis

One missing config object on an AI SDK call is three separate resource defects,
and they file under three different CWEs — 770 (no output cap), 400 (no
timeout), 404 (no abort on a stream). The article's job is to show that the
three are one shape, not three tips.

The evidence narrowed one claim. The draft's aside about step count was the
riskiest sentence in the piece, because it asserts an SDK *default* rather than
an SDK *parameter* — and a default is the kind of thing that is true when
written and false two minors later. It checks out on the shipped package, and
the row below records the command, so the next person can re-run it instead of
trusting the sentence.

## Ground truth

Measured against the `ai` package as actually installed in this workspace, not
against documentation. Per [rule premise vs SDK default], a docs claim about a
default is not evidence; the compiled artefact is.

| Claim                                          | Value                                                                 | Command                                                                              | Version    | Verified   |
| ---------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ---------- | ---------- |
| installed SDK version under test               | 7.0.31                                                                | `node -p "require('ai/package.json').version"`                                        | ai 7.0.31  | 2026-09-06 |
| `stopWhen` defaults to a 1-step ceiling        | `stopWhen = isStepCount(1)`, at two call sites                        | `grep -no "stopWhen = [a-zA-Z0-9_()]*" node_modules/ai/dist/index.js`                 | ai 7.0.31  | 2026-09-06 |
| those two sites are `streamText`/`generateText` | lines 4992 and 8439 of the same bundle                                | same grep; compare against the `declare function` lines in `dist/index.d.ts`          | ai 7.0.31  | 2026-09-06 |
| `isStepCount` is the public `stepCountIs`      | `isStepCount as stepCountIs` in the export list                       | `grep -no "isStepCount as stepCountIs" node_modules/ai/dist/index.js`                 | ai 7.0.31  | 2026-09-06 |
| output cap parameter is `maxOutputTokens`      | `maxOutputTokens?: number`                                            | `grep -n "maxOutputTokens" node_modules/ai/dist/index.d.ts`                           | ai 7.0.31  | 2026-09-06 |
| `maxTokens` no longer exists                   | zero occurrences in the public types                                  | `grep -n "\bmaxTokens\b" node_modules/ai/dist/index.d.ts` — no output                 | ai 7.0.31  | 2026-09-06 |
| the rename landed in v5, not earlier           | `chore: rename maxTokens to maxOutputTokens`, under heading `## 5.0.0` | `grep -n "rename maxTokens" node_modules/ai/CHANGELOG.md`, then read the nearest `##`  | ai 7.0.31  | 2026-09-06 |
| all three rules exist and are named as written | `require-max-tokens`, `require-request-timeout`, `require-abort-signal` | `ls packages/eslint-plugin-vercel-ai-security/src/rules/`                             | plugin 1.3.6 | 2026-09-06 |
| plugin's declared ESLint range                 | `^8.0.0 \|\| ^9.0.0 \|\| ^10.0.0`                                     | `node -p "require('./package.json').peerDependencies.eslint"` in the plugin package   | plugin 1.3.6 | 2026-09-06 |
| plugin's declared Node minimum                 | `>=18.0.0`                                                            | `node -p "require('./package.json').engines.node"` in the plugin package              | plugin 1.3.6 | 2026-09-06 |
| an oxlint entry point exists                   | `./oxlint` subpath exporting the whole plugin object                  | read `src/oxlint.ts`; `exports` map in the plugin's `package.json`                    | plugin 1.3.6 | 2026-09-06 |

## What this changes in the article

Two rows changed the prose rather than merely confirming it:

**The ESLint range.** The draft shipped a flat-config-only snippet. The plugin's
peer range is 8 ∥ 9 ∥ 10, so flat-config-only was not a *constraint* being
documented — it was a gap in the snippet. An eslintrc block was added, because
telling an ESLint 8 reader nothing is worse than telling them no.

**The step-count aside.** It survives unchanged, and that is the point of
recording it. It was the one sentence that could have been correct by luck.

## Known limits of this spec

The version rows pin `ai` at 7.0.31 and the plugin at 1.3.6. A default is a
moving target: `stopWhen` could acquire a different ceiling in any minor, and
the article's aside would silently become wrong. The commands are recorded so
that re-verification is a minute's work, not an investigation.

Nothing here was verified against the SDK's published documentation, on
purpose. Docs describe intent; `dist/` describes what ships.
