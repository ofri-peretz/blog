---
kind: review
number: N
opened: YYYY-MM-DD
window_start: YYYY-MM-DD
window_end: YYYY-MM-DD
trigger: 30-day cap | 1,000 sessions
---

# Maintain review #N — YYYY-MM-DD

> Procedure: [`../intents/2026-08-30-maintain-review.plan.md`](../intents/2026-08-30-maintain-review.plan.md).
> Population rule: [`../analysis-population.md`](../analysis-population.md) — every
> figure below is computed over it, never over raw traffic. Half of August's raw
> traffic was us.
>
> **Counts, not rates.** At this volume a percentage swings wildly on single-digit
> changes and invites over-reading.

## 0. Pre-registration — written BEFORE any number is read

This section is filled in first and is not edited afterwards. It exists so the
review cannot become a search for the most flattering number after the fact.
The open intents already name their thresholds, so this is a lookup.

| Open intent | What it predicted | Threshold it named |
|---|---|---|
| | | |

Anything read before this table is complete does not count as a prediction.

## 1. Tier 1 — confirmed configurers

External repos with a plugin in a real `eslint.config`. The only tier that
means someone truly uses this.

| Metric | Last review | This review | Δ |
|---|---|---|---|
| Confirmed configurers | | | |

## 2. Tier 2 — qualified intent, as counts

Each of these has been zero. The first question every month is which are
*still* zero.

| Event | Last review | This review | Still zero? |
|---|---|---|---|
| `article:code_copy_click` (with a package) | | | |
| `article:playground_open` | | | |
| `article:playground_edit` | | | |
| star clicks | | | |
| `newsletter:subscribe_submit` | | | |
| confirmed subscribers | | | |

## 3. Tier 3 — reach and crossing

| Metric | Last review | This review | Δ |
|---|---|---|---|
| Reader pageviews (population rule) | | | |
| Readers (population rule) | | | |
| Pages per reader | | | |
| Referrer mix (direct / google / github / dev.to) | | | |
| `short_link_click` — alive at all? | | | |

`short_link_click` gets its own row because it was dead for twenty days and
nothing noticed. Confirm liveness before reading its value.

## 4. Tier 4 — process

| Metric | This review |
|---|---|
| Panel scores of anything published this window | |
| Did every shipped initiative have an intent before its first commit? | |
| Open intents whose status field disagrees with their repo state | |

That last row exists because on 2026-09-02 five intents were marked `open`
while their work had fully landed. A stale status is a lie the next session
believes.

## 5. What the numbers did

Plainly, including "nothing". A flat result is the expected outcome at this
volume, not a surprise to explain away.

## 6. What that rules in or out

The hypothesis this window killed or supported. If none, say the window was
too short — that is a valid outcome and it is not a failure of the review.

## 7. What this review could NOT determine

Required. A review that concludes everything has stopped looking.

## 8. The next intent

Either a link to a new `intent.md`, or an explicit decision to wait another
window. **Whichever it is, it carries the next review's trigger date**, because
nothing else reminds anyone.

- Next review triggers on: **YYYY-MM-DD** (30-day cap) or 1,000 sessions,
  whichever lands first.

## 9. Cliff re-check

Re-read the population distribution and confirm the threshold cliff has not
moved. If a genuinely engaged reader now clears it, that is good news and the
reader numbers move up.

| Claim | Value | Source | Read on |
|---|---|---|---|
| Cliff still at `active_days >= 3 AND events >= 50` | | | |
