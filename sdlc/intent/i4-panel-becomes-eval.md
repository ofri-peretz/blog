---
id: I-4
slug: i4-panel-becomes-eval
stage: intent
status: approved
visibility: public
opened: 2026-08-30
opened_by: claude
approved_by: ofri
---

## Claim

The five-reviewer panel moves from a manual in-session fan-out to a scripted
workflow whose verdict is a committed JSON file — same five lenses, same 9.5
bar, but reproducible by someone who did not invent it.

## Audience

Us.

## Why us

The panel already works. Growth/Hook, Security-Correctness,
Structure/Framing/Voice, Compatibility, Reproducibility — every lens ≥ 9.5,
1–3 rounds typical. What it lacks is durability: the verdict is a number in a
chat log, so it cannot be diffed, re-run, or trusted a month later.

An eval that only one person can run is a review, not an eval.

## Evidence we believe exists

- [x] `article-review-scores.json` — the output shape already exists from a prior 85-agent run
- [x] The panel is already run via the Workflow tool (default agent; `Explore` fails to return StructuredOutput)

## Kill criterion

If panel scores prove unstable across identical re-runs — the same draft
scoring 9.6 and 8.9 on separate invocations — then the lens rubrics are
underspecified and this intent blocks on tightening them first.

## Title candidates

n/a

## Tier

n/a
