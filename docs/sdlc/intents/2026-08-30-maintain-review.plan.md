---
kind: plan
slug: 2026-08-30-maintain-review
opened: 2026-08-30
---

# Plan: the Maintain review procedure

Intent: [`2026-08-30-maintain-review.intent.md`](./2026-08-30-maintain-review.intent.md)

## Ground truth

| Claim | Value | Source | Read on |
|---|---|---|---|
| Baseline date for review #1 | 2026-08-30 | this document | 2026-08-30 |
| Reader-only August reach | 168 pageviews, 145 readers | PostHog SQL with the population rule | 2026-08-30 |
| Reader pageviews, May→Aug | 58, 153, 158, 168 | same, grouped by month | 2026-08-30 |
| Tier-2 events, all of them | 0 | PostHog SQL by event name | 2026-08-30 |
| Referrals from dev.to, 60d | 0 | `visitor_classified.referrer_domain` | 2026-08-30 |
| Months to reach 1,000 sessions | roughly 7 at current rate | 145 readers/month, arithmetic | 2026-08-30 |

That last row matters more than it looks. **The session threshold will never
fire before the 30-day cap** at current volume, so in practice review #1 lands
around 2026-09-29 and the threshold only starts governing if traffic grows by
roughly an order of magnitude. Writing it as "1,000 sessions or 30 days" is
honest about the intent while admitting which half actually binds today.

## Approach

A fixed, ordered read. The order is deliberate: outcomes before diagnostics, so
a flat North Star cannot be explained away by a lively secondary metric.

1. **Tier 1 — confirmed configurers.** External repos with a plugin in a real
   `eslint.config`. Movement here is the only thing that means someone truly
   uses this.
2. **Tier 2 — qualified intent, as counts.** `article:code_copy_click` with a
   package, `article:playground_open` and `_edit`, star clicks. Each is
   currently zero; the first question every month is which are still zero.
3. **Tier 3 — reach and crossing.** Reader pageviews and readers, over the
   population rule. Referrer mix, specifically whether dev.to is still zero.
   `short_link_click`, specifically whether it is alive at all.
4. **Tier 4 — process.** Panel scores of anything published, and whether every
   shipped initiative had an intent before its first commit.

Then write three things, and only these three:

- **What the numbers did** — including "nothing", stated plainly.
- **What that rules in or out** — the hypothesis this window killed or
  supported. If none, say the window was too short.
- **The next intent** — a file, or an explicit decision to wait another window.

**A pre-registration rule.** Before reading, write down what each open intent
predicted. The intents already name their thresholds, so this is a lookup, not
a judgement — and it is what stops a review from becoming a search for the
most flattering number after the fact.

Rejected: a generated summary. The output is an argument about what to do next,
and generating it removes the only part that has value.

## Sequence

1. Add `docs/sdlc/reviews/` and a `review.template.md` mirroring the three
   sections.
2. On the trigger date, run the four reads and fill it in.
3. Write the next intent, or the decision to wait, and link it.
4. Re-read the population distribution; confirm the cliff has not moved.

## Gates

- Every number computed with the population rule, never raw.
- Predictions written before the numbers are read.
- The review names at least one thing it could NOT conclude. A review that
  concludes everything is not reading carefully.
- Output committed. A review that lives in a chat log did not happen.

## Risks

- **Reading noise as signal.** The likeliest failure at this volume, and the
  reason for counts-not-rates plus pre-registration.
- **The ritual lapsing after one performance.** The trigger is a date nobody is
  reminded of; the honest mitigation is that the next intent produced by review
  #1 should carry the following review's trigger date in it.
- Confirmation bias toward the work we just shipped. The dev.to crossing and
  the playground fix are both ours and both recent; treat a flat result as the
  expected outcome, not a surprise to explain away.
