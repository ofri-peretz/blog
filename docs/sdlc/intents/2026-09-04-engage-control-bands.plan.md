---
kind: plan
slug: 2026-09-04-engage-control-bands
opened: 2026-09-04
---

# Plan: mirror the eslint watcher; five bands; Monday from the loop

Intent: [`2026-09-04-engage-control-bands.intent.md`](./2026-09-04-engage-control-bands.intent.md)

## Ground truth

| Claim | Value | Source | Read on |
| --- | --- | --- | --- |
| Reference watcher | `eslint/cadence/scripts/control-bands.ts`: Western Electric rules 1–4, tiers 1σ log / 2σ diagnose / 3σ act, `.agent/control-bands.json` | file header | 2026-09-04 |
| Series depth | devto.daily_views 183 points; standing.* and impact.* from 2026-09-03 | `/api/series` | 2026-09-04 |
| Where the series live | `engage.db` on this machine, served by `/api/series` | `lib/series-*.ts` | 2026-09-04 |
| Loop cadence | `engage-run.sh auto` every 5 min from `agents-main`, state files per day/hour | `engage-run.sh` | 2026-09-04 |

## Approach

`apps/engage/.agent/control-bands.json` names the bands; `scripts/control-bands.mjs`
reads them, pulls each series from the running app, computes mean and σ over
the window's baseline, applies the four rules to the newest points on the
"worse" side only, and writes `.cache/control-bands.json`. With
`--write-intents`, a 2σ or 3σ breach clones a fresh worktree of this repo,
writes the intent from the template, pushes `intent/control-band-<id>-<date>`
and opens the PR. The loop runs it on Mondays.

**Rejected: running it in CI.** The series are local; CI cannot see them.

## Sequence

1. `.agent/control-bands.json`: `devto.daily_views` (lower is worse, window 28,
   minPoints 14), `devto.read_time_avg_s` (lower), `devto.daily_comments`
   (lower), `standing.replies_waiting` (higher), `impact.score` (lower,
   minPoints 8).
2. `scripts/control-bands.mjs` with `--report` (default) and `--write-intents`;
   `scripts/control-bands.check.mjs` pins the four rules on fixtures.
3. `/api/bands` serves the latest report; a "Control bands" line under the
   stalled-feeds section.
4. `agents`: `engage-run.sh auto` runs the watcher Mondays 09:00–10:00 CST
   with `--write-intents`, state file per ISO week.

## Gates

- Check script red before step 2, green after.
- Human: accept any intent the watcher opens.

## Risks

- Cumulative series would trend forever; only rates and gauges are banded.
