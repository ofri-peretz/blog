---
kind: plan
slug: 2026-08-30-distribution-article
opened: 2026-08-30
---

# Plan: the live-playground article

Intent: [`2026-08-30-distribution-article.intent.md`](./2026-08-30-distribution-article.intent.md)

## Ground truth

Re-read every row immediately before publishing; the artifact is rebuilt on
each deploy and the plugin versions move.

| Claim | Value | Source | Read on |
|---|---|---|---|
| Worker artifact, raw | 1,764,382 bytes | `wc -c` on the esbuild output | 2026-08-30 |
| Worker artifact, gzip | 463,039 bytes (452 KB) | `gzip -9 -c` piped to `wc -c` | 2026-08-30 |
| Worker artifact, brotli | 370,746 bytes (362 KB) | `brotli -q 11 -c` piped to `wc -c` | 2026-08-30 |
| What production actually sends | `content-encoding: br` | `curl -I` with `Accept-Encoding: br` | 2026-08-30 |
| ESLint version bundled | 9.39.4 | package.json of the installed dep | 2026-08-30 |
| eslint-plugin-jwt | 2.2.14, 13 rules | `node -p` against the published package | 2026-08-30 |
| eslint-plugin-node-security | 5.2.3, 42 rules | `node -p` against the published package | 2026-08-30 |
| esbuild | 0.28.2 | package.json of the installed dep | 2026-08-30 |
| Aliases needed to bundle | path, fs, os, util, oxc-resolver | `scripts/build-lint-worker.mjs` | 2026-08-30 |
| ESLint's own playground | exists, separate site | eslint.org/play | 2026-08-30 |
| typescript-eslint playground | exists, separate site | typescript-eslint.io/play | 2026-08-30 |

## Approach

Lead with the gap rather than the build: you are reading about a rule, you want
to know whether *your* code trips it, and an article can only ever show you
someone else's. Then the turn — the linter is about 362 KB over the wire, which
is small enough to simply ship.

Structure:

1. The gap, and the button that closes it.
2. `eslint/universal` exists; here is what it weighs with two real plugins in it.
3. The recipe: esbuild config, the worker, the client seam. Copy-pasteable.
4. The four traps, each with the error text that actually appeared: the
   bundler fight that forced a static artifact, a worker global having no
   `process`, native resolver bindings poisoning the graph, and ESLint itself
   running out of heap on the 1.7 MB output.
5. **The demo that was wrong for three days.** Three rules advertised, one
   able to fire, and a lock that passed because it grepped for a string instead
   of running the linter.
6. Try it — links to both live playgrounds.
7. Reproduce — exact versions and commands.

Section 5 is the piece that earns trust, and it is the one a normal write-up
would omit. It is also genuinely instructive: it is a lesson about test design,
not a confession.

Rejected framing: "we built the first in-article linter". Playgrounds are not
new, the claim would not survive a reviewer who knows the ecosystem, and it
would cost more credibility than it buys attention.

## Sequence

1. Draft against the ground-truth table.
2. Five-reviewer panel via the Workflow tool, structured output per lens.
3. Revise; re-run until every lens is ≥9.5. One to three rounds is typical.
4. Cover image — Ofri's step.
5. PR and merge. Publishing to Dev.to is a separate manual
   `publish-devto.yml` dispatch.

## Gates

- Every lens ≥9.5. A 9.3 is not close enough.
- Every number traceable to a row above, re-read on the day of publish.
- No claim that a competitor is worse; specialisation framing only.
- Cover image present before merge.
- Ofri approves publication. This one reaches strangers.

## Risks

- **Byte counts drift.** They change whenever a plugin ships rules. Quote them
  with their date and versions inline, so the article ages honestly instead of
  becoming wrong.
- Build articles can read as self-congratulation. Section 5 is the main defence;
  if a reviewer flags the tone, cut celebration rather than the failure story.
- The piece sends readers to a playground that must be working when they
  arrive. Do not publish while the playground fix in PR #209 is unmerged.
