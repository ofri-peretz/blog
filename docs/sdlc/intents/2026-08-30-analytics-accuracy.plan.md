---
kind: plan
slug: 2026-08-30-analytics-accuracy
opened: 2026-08-30
---

# Plan: make the blog's numbers trustworthy

Intent: [`2026-08-30-analytics-accuracy.intent.md`](./2026-08-30-analytics-accuracy.intent.md)

## Ground truth

| Claim | Value | Source | Read on |
|---|---|---|---|
| Blog pageviews, August | 323 (149 people) | PostHog SQL, `$host = 'ofriperetz.dev'` | 2026-08-30 |
| Monthly trajectory May→Aug | 160 → 225 → 302 → 323 | same, grouped by month | 2026-08-30 |
| `article:playground_open` | 0 events since 2026-08-27 | PostHog SQL by event name | 2026-08-30 |
| `article:code_copy_click` | 0 events in 30d | same | 2026-08-30 |
| `short_link_click` lifetime | 2026-07-26 → 2026-08-10, then nothing | PostHog SQL grouped by day | 2026-08-30 |
| `short_link_click` identity | `uniq(distinct_id) = 1` on every single day | same | 2026-08-30 |
| Live `/go/` redirect | HTTP 302, correct Location | `curl` against production | 2026-08-30 |
| Live `/go/` capture | 3 test clicks → 0 ingested events | `curl` ×3, then PostHog SQL | 2026-08-30 |
| Per-visitor id fix is on main | yes, PR #160 | `git show origin/main:…/resolver.ts` | 2026-08-30 |
| PR #160 merge date | 2026-08-22 | `git log` | 2026-08-30 |
| `visitor_classified` bot rate | `is_bot: false` on all 234 events | PostHog SQL | 2026-08-30 |

The decisive pair: the redirect works, the capture does not, and the identity
fix landed **twelve days after** ingestion stopped — so #160 is not the cause
and reverting it would fix nothing.

## Approach

Three independent repairs. Only the third has an unknown root cause, so it is
the only one that needs investigation rather than implementation.

**A. Analysis-time population rule, not app code.** Exclude persons with
`active_days >= 3 AND events >= 50`; everyone else is a reader. Full rationale,
the measured distribution it sits in, and runnable SQL are in
[`../analysis-population.md`](../analysis-population.md).

Rejected alternatives, in the order they were tried:

- **`?internal=1` super-property flag.** Built, then removed at Ofri's call.
  Needs a deliberate visit per browser per device; forgetting one contaminates
  data silently; and it can only work forwards, leaving every existing number
  mixed.
- **Referrer-based population** ("count only readers with an external first
  referrer"). Killed by the data: 182 of ~270 people are `direct` and only 80
  come from Google, so this discards most genuine readers. It also surfaced
  that **zero** people arrived from dev.to in 60 days.
- **IP allowlist / PostHog built-in internal filtering.** IPs roam across
  laptop, phone, and networks; the built-in filter keys off identified users
  and we never call `identify`, by design.

The rule is calibrated to **fail toward including strangers** — the two
ambiguous rows near the cliff stay in the reader population. Over-counting
readers makes our numbers look worse than reality, which is the safe direction.

**B. Nothing ships in app code.** This repair is entirely a definition, which
is why it has no runtime surface to break.

**C. `short_link_click` outage — diagnose before changing.** The capture runs
inside `after()` and swallows failures into `console.warn`, which is why
twenty silent days were possible. Do not guess at a fix: read the Vercel
runtime logs for `[go] posthog capture failed` first. The two candidates worth
testing are the ingest host (`NEXT_PUBLIC_POSTHOG_HOST` defaulting to the
proxy vs the direct endpoint) and `after()` not running to completion on this
route. Whatever the cause, the outage was undetectable, so the repair has to
include a signal that would have caught it.

## Sequence

A and B are one small change and ship together. C is independent and gated on
reading production logs — it does not block A/B.

1. Population rule written down with its measured distribution. *(done)*
2. Lock: the definition exists and carries both thresholds plus runnable SQL —
   a rule that lives only in a chat log is not a rule. *(done)*
3. C: read Vercel logs, identify the ingest failure, repair, and add a
   detector so a future outage is loud. *(open — needs log access)*

## Gates

- The lock must fail when the definition file is absent or loses its
  thresholds; verified before trusting green.
- No change to the playground footer or its promise.
- No human step. That was the defect in the first approach, not a detail of it.

## Risks

- The rule is a heuristic, not ground truth. It is calibrated to over-count
  readers rather than hide them, so it errs toward making us look worse.
- The cliff can move. Re-read the distribution at each Maintain review; if a
  genuinely engaged reader ever clears the threshold, that is good news and the
  numbers move up.
- Historical baselines quoted before 2026-08-30 were computed without this
  rule and stay labelled as mixed.
