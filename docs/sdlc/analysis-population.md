# Who counts as a reader

Every blog metric is computed over a **population**, and at ~11 pageviews a
day the choice of population changes the answer. One person browsing their own
site is a visible fraction of every number: August 2026 read 52
`loom:weave_change` events across 2 people, which was us.

This file is the single definition of who gets excluded, so two analyses run a
month apart are comparable.

## The rule

Exclude any person who, in the window being analysed, has **both**:

- `active_days >= 3`, and
- `events >= 50`

Everyone else counts as a reader.

## Why this shape

The activity distribution has a cliff rather than a gradient. Measured
2026-08-30 over 60 days on `$host = 'ofriperetz.dev'`:

| events | active days | distinct paths | reading |
|---|---|---|---|
| 609 | 24 | 5 | owner, primary browser |
| 275 | 9 | 8 | owner |
| 220 | 5 | 7 | owner, build week |
| 140 | 3 | 5 | owner, build week |
| 73 | 1 | 7 | ambiguous — **kept** |
| 67 | 5 | 4 | ambiguous — kept |
| ≤24 | 1–2 | 1–2 | readers |

Nobody discovers an eleven-view-a-day blog and then returns on twenty-four
separate days. The threshold sits in the gap, not on a judgement call about
any individual.

## Why not a flag in the app

A `?internal=1` super-property flag was built and removed. Three reasons it
loses to this rule:

1. It needs a deliberate visit **per browser, per device** — and the failure
   mode of forgetting one is silent contamination that looks like real data.
2. It only works **forwards**. Every number we already have would stay mixed.
   This rule applies retroactively to the full history.
3. It requires ongoing discipline from a human. This requires nothing.

The cost is that the rule is a heuristic, not ground truth. It is calibrated
to **fail toward including strangers** rather than hiding them: the two
ambiguous rows above stay in the reader population. Over-counting readers
makes our numbers look worse than reality, which is the safe direction for a
metric we make decisions from.

## Applying it

```sql
-- Reader-only population for any blog metric.
WITH heavy AS (
  SELECT person_id
  FROM events
  WHERE properties.$host = 'ofriperetz.dev'
    AND timestamp > now() - INTERVAL 60 DAY
  GROUP BY person_id
  HAVING uniq(toDate(timestamp)) >= 3 AND count() >= 50
)
SELECT count() AS events, uniq(person_id) AS readers
FROM events
WHERE properties.$host = 'ofriperetz.dev'
  AND timestamp > now() - INTERVAL 30 DAY
  AND person_id NOT IN (SELECT person_id FROM heavy);
```

Keep the `heavy` window wider than the metric window, so a device that was
busy last month is still recognised this month.

## Maintenance

Re-read the distribution at each **Maintain** review (see
[README.md](README.md)). Two things to check: whether the cliff is still in
the same place, and whether genuinely engaged readers have started appearing
above the threshold. If a real reader ever clears it, that is good news and
the thresholds move up.

A PostHog cohort would let this apply automatically inside saved insights.
Creating one needs the `cohort:write` scope, which the current API key lacks —
until then the SQL above is the definition, and insights are filtered by hand.
