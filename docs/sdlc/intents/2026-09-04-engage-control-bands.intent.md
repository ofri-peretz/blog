---
kind: intent
slug: 2026-09-04-engage-control-bands
opened: 2026-09-04
status: open
---

# Intent: a breach in the numbers writes the next intent, without anyone looking

## What

Stage 6 of the SDLC for the engagement stack: control bands on the series
that now exist — views per day, read time, comments per day, replies waiting,
the impact score — watched weekly by a deterministic script that applies the
Western Electric rules over a rolling window, logs 1σ drift, and on a 2σ or
3σ breach writes `docs/sdlc/intents/<date>-control-band-<id>.intent.md` on a
branch and opens the PR. No model decides that something is wrong.

## Why now

- The playbook says Maintain writes back; nothing in this stack does. Every
  regression this week was found by someone looking.
- The data is deep enough now: 183 days of daily analytics, and the standing,
  yield and impact rows accrue daily from here.
- The eslint repo already runs this exact watcher shape; mirroring it is one
  file and one config.

## Constraints

- Detection is deterministic and unit-tested; the watcher never calls a model.
- 1σ logs. 2σ and 3σ write an intent and open a PR; a human accepts it.
- A band exists only for a metric with a stable baseline; a noisy metric
  produces noisy intents and a watcher that cries wolf gets switched off.
- Runs from the loop on this machine because the series live in `engage.db`.

## How we will know it worked

| Signal | Now | Target |
| --- | --- | --- |
| Bands defined with window, minPoints and direction | 0 | 5 |
| Weekly run logged, report stored | none | every Monday |
| A 2σ breach opens an intent PR | never | first real breach |
| False breaches per quarter | — | ≤ 1 |

## Not doing

- Banding the arena rank or the follower count.
- Auto-merging the intents the watcher opens.
