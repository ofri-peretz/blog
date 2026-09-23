---
id: I-26
slug: burgee-change-one-import
stage: intent
status: shipped
visibility: public
opened: 2026-09-22
opened_by: claude
approved_by: 'ofri, 2026-09-23, in chat: "ok perfect lets proceed" (replying to "Reply ''approve I-26 and I-27''")'
---

> Drafted by an agent from the burgee repository's own files. Every path below
> is relative to `github.com/ofri-peretz/burgee` (local checkout
> `ofriperetz.dev/burgee`), read at commit `2d78af239e`. Approved by Ofri in
> chat on 2026-09-23; the verbatim reply is in `approved_by`.

## Claim

An existing commander CLI can be moved onto burgee by changing one import
specifier — `commander` to `burgee/commander` — and, with no other edit, the
same program answers `--json`, `--schema`, `--mcp` and `completion <shell>`;
the reader leaves knowing exactly what that swap does and does not change,
and how the compatibility behind it is graded rather than asserted.

## Audience

Maintainers of an existing commander-based CLI who have been asked to make it
usable by coding agents (structured output, a machine-readable command
description, an MCP entry point) and who will not rewrite their argument
parsing to get there. Not people choosing a CLI framework from scratch — that
is a different article with a different evidence base.

## Why us

We maintain burgee and its compatibility instrument, so we can show the
grading machinery from the inside: `packages/compat-oracle/` runs commander's
own vendored test suite against `burgee/commander` next to a control that runs
real commander (`packages/compat-oracle/README.md`). That is the part a third
party cannot easily reproduce, and it is what separates this tutorial from a
"just swap the import" claim. The same standing obliges the article to state
what the façade does not do, and to show where commander on its own is the
better-sized choice (it installs smaller — see Kill criterion 3).

## Evidence we believe exists

- [ ] The one-line diff is the documented migration path: `README.md` section
      "Already on commander? Change one import".
- [ ] The façade adds the agent surfaces to a commander-syntax program only
      when the program has not declared the option itself:
      `packages/burgee/src/commander/command.ts` (the `--json`, `--schema`,
      `--mcp` and `completion` branches), pinned by
      `packages/burgee/src/facade-surface.test.ts`.
- [ ] Compatibility is graded by commander's own suite, not by our tests:
      `packages/compat-oracle/baseline/commander.json` and the generated
      `apps/docs/content/docs/compatibility.mdx` (produced by
      `npm run compat:page`, never hand-edited). Stage 2 must re-run the oracle
      and quote the rate from that run, with the control's total as the
      denominator.
- [ ] A migration demo exists to build the walkthrough on:
      `packages/burgee/src/migrate-demo.test.ts` and `examples/`.
- [ ] The trade-offs are already published by the project and can be quoted
      rather than softened: `README.md` "The three that are not met"
      (`lighter-than-commander` is a gate the façade does not meet).

## Kill criterion

Abandon, or re-scope to a narrower claim, if stage 2 finds any of:

1. The swap needs a second edit for a mainstream commander program — a
   changed call signature, a required config, or a test that has to change.
   The title is "change one import"; if it is two, the article is false.
2. The oracle's commander rate, re-run on the gathering date against the
   control's total, is below 100% on a behaviour the tutorial's example
   exercises. A tutorial cannot walk a reader through a path the grader marks
   red.
3. Any of `--json`, `--schema`, `--mcp` or `completion` does not appear on the
   unmodified example program, or appears only when the program is written in
   burgee-native syntax. Each surface that fails is dropped from the claim;
   if `--schema` or `--mcp` fails, the article is not worth writing.

## Title candidates

Named target + concrete number + claim; numbers are placeholders until the
spec supplies them from a command.

1. Change One Import and Your commander CLI Answers `--json`, `--schema` and MCP
2. One Line of Diff, Four Agent Surfaces: Moving a commander CLI Onto burgee
3. Graded by commander's Own Test Suite: What a One-Import Migration Keeps

## Tier

TUTORIAL

## Stage 2 outcome (2026-09-23)

Re-scoped, not killed — the kill criteria's own "re-scope to a narrower claim"
branch. The tutorial program was actually run on `commander@15.0.0` and on
`burgee@0.9.2`; every figure is in `sdlc/spec/burgee-change-one-import.md`.

- **Criterion 2 held.** The oracle re-run on burgee `6377897aaf` grades
  `burgee/commander` 1360 / 1360 against a control of 1360 / 1360.
- **Criterion 3 held for `--schema`, MCP `tools/list` and completions**, on
  the unmodified program.
- **Criterion 1 fired for the half of `--json` and `--mcp` that returns
  data.** A commander action prints and returns nothing, so `--json` answers
  `data: null` after the printed line, and an MCP `tools/call` writes that line
  onto the JSON-RPC stream. The fix is a second edit per command (return the
  result, keep prose off stdout for a machine).

So the claim is narrower than the title candidates above: one import makes the
program _describe_ itself to an agent; _answering_ one takes a `return`. Two
defects in 0.9.2 surfaced on the way and are disclosed in the article rather
than routed around: an MCP tool call passes a multi-word option camelCased
(`--skipBlank`) and is refused, and the generated completions offer
`--no-<flag>` spellings the program rejects.

### Re-pinned to 0.11.1 (2026-09-23)

Both 0.9.2 defects were fixed upstream and released in `burgee@0.11.1`. The
whole tutorial was re-run on that version, from an empty directory, and the
oracle was re-run at the `burgee@0.11.1` tag: 1360 / 1360 against a
1360 / 1360 control. The article now pins 0.11.1 and reports both defects as
found and fixed. The narrowing itself is unchanged, because it is by design: a
commander action returns nothing, so `--json` still answers `data: null` until
the action returns its result.
