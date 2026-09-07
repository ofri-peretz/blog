# How we run the AI-native SDLC here

Six phases, from the AI-native SDLC playbook, mapped onto what this repo
actually does. The point of writing it down is that **two of the six were
missing**, and they were the two that make the other four compound.

Build is no longer the constraint. A change that would have been a sprint is
now an afternoon, which means the bottleneck moved to judgment: what is true,
what is worth publishing, and what a number licenses us to claim. The gates
below exist to keep speed from turning into confident mistakes.

| # | Phase | Artifact it produces | State |
|---|-------|----------------------|-------|
| 1 | Plan | `intent.md` | **was missing** — this directory |
| 2 | Design | `plan.md` + verified ground truth | **was partial** |
| 3 | Build | the change itself | strong |
| 4 | Test | locks + the five-reviewer panel | strong |
| 5 | Deploy | PR, required checks, squash merge | strong |
| 6 | Maintain | a review that writes the next intent | **was missing** |

## 1. Plan — `intent.md`

One file per initiative, written *before* the first edit, in
`docs/sdlc/intents/YYYY-MM-DD-<slug>.intent.md`. Copy
[`templates/intent.template.md`](templates/intent.template.md).

It answers four questions and nothing else: what is wanted, why now, which
constraints bind, and **how we will know it worked**. That last one is the
reason the file exists — an initiative that cannot name the signal it should
move is an initiative that will never be evaluated.

## 2. Design — `plan.md`

The approach, the sequencing, and — for anything making a factual claim — the
**ground-truth block**: every number read off the published package or a live
query at the time of writing, with the command that produced it. Copy
[`templates/plan.template.md`](templates/plan.template.md).

This is where our recurring failure mode gets caught. Rule counts, export
shapes, and version claims drift; a number written from memory is a defect
with a long fuse. If a claim cannot be traced to a command, it does not ship.

## 3. Build

Agent-assisted, against `CLAUDE.md` and the skill library — the institutional
knowledge that keeps house conventions, framing rules, and the DS-first
boundary from being re-litigated every session.

## 4. Test — the gates

Two layers, and they are not interchangeable:

- **Locks** (`src/__tests__/*-lock.test.ts`) pin invariants a future change
  could silently break. A lock must be shown failing on the unfixed state
  before it counts — a green test proves nothing until you have watched it go
  red. Prefer behavioural locks over textual ones: a lock that greps source
  for a string passes happily while the behaviour it was guarding is broken.
- **The five-reviewer panel** for articles: Growth/Hook, Security-Correctness,
  Structure/Framing/Voice, Compatibility, Reproducibility. Gate is ≥9.5 on
  every lens. Record the scores; they are Tier-4 data, not scratch output.

## 5. Deploy

Branch, PR, required checks green, squash merge. Branch protection is the
approval gate and is not bypassed. Merging to `main` publishes nothing —
Dev.to publishing is a separate manual `workflow_dispatch` on
`publish-devto.yml` (`dry_run` defaults to true). The push trigger was removed
2026-07-19 after the Capsule-0 incident, when a merge auto-fired a live bulk
publish of the whole corpus. See CLAUDE.md → Shipping.

## 6. Maintain — the phase we skipped

Publishing is not the finish line. A Maintain review reads the metric tree
back into the next `intent.md`, and closes the loop that makes the previous
five phases worth running.

**Trigger it on data, not on a date.** At current volume a weekly review would
mostly read noise. Run it when either **1,000 blog sessions** have accumulated
since the last review, or **30 days** have passed — whichever comes first.

Each review writes three things: what the numbers did, what that rules in or
out, and the next intent. If a review produces no next intent, say so
explicitly — "nothing learned yet, extend the window" is a valid and honest
outcome.

### What its absence cost us

Two defects, both found on 2026-08-30 by looking rather than by any alarm:

- The node-security playground advertised three rules and could only ever fire
  one. It shipped, passed its lock, and was wrong in production for three days.
  The lock grepped the sample for `/eval\(|exec\(/` — which a silent rule still
  matches.
- `short_link_click`, our highest-volume event, stopped being ingested on
  2026-08-10 and nobody noticed for twenty days.

Neither is a Build failure. Both are Maintain failures.
