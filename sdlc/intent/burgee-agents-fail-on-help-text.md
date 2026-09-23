---
id: I-28
slug: burgee-agents-fail-on-help-text
stage: intent
status: proposed
visibility: public
opened: 2026-09-22
opened_by: claude
approved_by:
---

> Drafted by an agent from the burgee repository's own files. Every path below
> is relative to `github.com/ofri-peretz/burgee` (local checkout
> `ofriperetz.dev/burgee`), read at commit `2d78af239e`. Nothing here is
> approved; stage 2 may not begin until `approved_by` is filled by a human.
>
> **BLOCKED — on burgee's B1 agent benchmark, which has never run.** This
> intent cannot enter stage 2 until B1 has produced a measured result. See
> Kill criterion.

## Claim

A coding agent driving a CLI that only speaks help text spends measurably
more tokens and turns to finish the same task than it does against the same
program exposing a machine-readable surface (`--schema`, a `{ ok, data }`
envelope, an exit code that distinguishes "rewrite the command" from "the
world failed") — and the reader leaves with the measured size of that gap
from a run they can repeat, not an estimate.

## Audience

People who build or maintain CLIs that coding agents now call — and people
building agents that shell out to CLIs — who have seen an agent loop on
`--help` output and want to know whether a structured surface changes the
cost, by how much, and on which kinds of task.

## Why us

burgee's benchmark suite already contains the instrument, built so that it
cannot report a number from a run that did not happen: B1 in
`benchmarks/axes/agent.ts`, five tasks in `benchmarks/tasks/*.json` each
chosen so that one floor requirement is the only difference between the two
builds (`benchmarks/tasks/README.md`), and `benchmarks/emit.test.ts`, which
fails if an unmeasured axis is written as measured. The same program runs on
both sides (burgee's demo CLI and the commander one), so the variable is the
surface, not the author. That is a claim we can make only because we own the
harness — and it obliges the article to publish the result whichever way it
falls.

## Evidence we believe exists

- [ ] A B1 run with a credential: `CLAUDE_CODE_OAUTH_TOKEN` or
      `ANTHROPIC_API_KEY`, 5 tasks × 2 builds × 5 runs = 50 agent runs
      (`.sdlc/DECISIONS.md` D-103). **Does not exist.** Every observation
      under `benchmarks/results/agent-cli-bench/` records the agent axis as
      `not-run` or `skipped` — never `measured` — and the README's gate
      table reads `agent-tokens-40pct` **unmeasured**.
- [ ] The two claims B1 settles, with their targets, as the project states
      them: `agent-tokens-40pct` and `agent-turns-30pct` in the
      `benchmarks/results/*/` `claims` block (roadmap source:
      `.sdlc/intents/burgee/intent.md`). The article reports what B1 measures
      against those targets, including "not met".
- [ ] The deterministic half is already measured and can frame the question
      without standing in for the answer: the `reliability` axis
      (`benchmarks/README.md` — hangs, exit-code accuracy, `--json`
      structured-output rate, and recovery bytes, which the README notes
      reads _against_ burgee). It measures legibility, not tokens; the
      article must not let it substitute for B1.
- [ ] The model pin is re-set before the first run, not after
      (`DEFAULT_MODEL` in `benchmarks/axes/agent.ts`; D-103 records that the
      first run starts the band history).

## Kill criterion

**Blocked condition (current state).** No stage-2 work starts until at
least one `benchmarks/results/agent-cli-bench/*.json` records
`axes.agent.status: measured`. As of 2026-09-22 not one does. Unblocking is a human
decision recorded as D-103 in the burgee repo — issuing the credential and
accepting the cost — not something this intent or its agent can do. If B1
has still not run by 2026-12-31, mark this intent `killed` with that reason
rather than leaving it open.

Once unblocked, abandon if B1 finds any of:

1. The token or turn difference between the floor and non-floor builds is
   inside run-to-run noise at 5 runs per task. A claim of "measurably more"
   needs a difference the data can separate from zero; if it cannot, the
   finding is "no measurable difference at this sample size" — publishable
   only as a short negative result, not under this claim.
2. The difference is carried by one of the five tasks. A result that holds
   on one task is an article about that task's requirement, not about help
   text.
3. The run cannot be repeated by a reader from the published harness and
   task files (for example, it depends on a private credential path or an
   unpublished model configuration).

## Title candidates

Numbers are placeholders; none may be filled in until B1 has a measured
record.

1. Agents Spend N% More Tokens on a CLI That Only Speaks `--help`
2. 50 Agent Runs, Two Builds, One Variable: What `--schema` Is Worth to an Agent
3. We Measured What Help Text Costs an Agent. It Was N Turns.

## Tier

T3
