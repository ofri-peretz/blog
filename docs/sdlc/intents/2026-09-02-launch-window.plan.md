---
kind: plan
slug: 2026-09-02-launch-window
opened: 2026-09-02
---

# Plan: one read, at +48h

Intent: [`2026-09-02-launch-window.intent.md`](./2026-09-02-launch-window.intent.md)

## Ground truth

| Claim | Value | Source | Read on |
|---|---|---|---|
| Dev.to publish time | 2026-09-02 13:07Z | the publish workflow run | 2026-09-02 |
| Dev.to URL | ...-362-kb-...-3a4m | the run log | 2026-09-02 |
| Referrals from dev.to, prior 60d | 0 | visitor_classified.referrer_domain | 2026-08-30 |
| `article:playground_open`, lifetime | 0 | PostHog by event name | 2026-08-30 |
| `short_link_click` | alive since the fix | 5 rows, 3 ids, live probe | 2026-08-31 |
| Reader baseline | 168 pageviews, 145 readers | population rule, August | 2026-08-30 |

## Approach

Run the four reads once, at +48h, and write a finding with the same three
sections every review uses: what the numbers did, what that rules in or out,
the next intent or an explicit wait.

**Pre-register the predictions now**, before any data exists, because that is
what stops a read becoming a search for the most flattering number:

- Dev.to referrals: **> 0**. Any number above zero is a first.
- `article:playground_open`: **> 0**, and the weaker of the two — a reader has
  to cross AND click a gate that costs 362 KB.
- Reader pageviews on the new article: no prediction. There is no base rate for
  a launch here, so a number would be invented.

Rejected: watching a live dashboard. The traffic is small enough that hour-by-
hour movement is noise, and the temptation to react to it is the actual risk.

## Sequence

1. At +48h, run the three counts plus the referrer split.
2. Write the finding.
3. If the crossing worked, the next intent is depth — the reader-depth finding
   set its own revisit trigger at 800 monthly reader pageviews, which a launch
   could plausibly cross, and that intent is currently closed on the grounds
   that the measurement could not distinguish anything at 127 opportunities.
4. If it did not, the next intent is the crossing itself, not the playground.

## Gates

- Population rule applied to every figure.
- Predictions written before the read. They are above, so this is now binding.
- The finding must name what it could not determine.

## Risks

- **A launch spike flatters everything.** A day of unusual traffic is not a new
  baseline, and nothing measured here should be quoted as one.
- Dev.to's own referrer can be stripped by its app or by privacy settings, so
  a zero on referrals is weaker evidence than a zero on playground_open. Read
  them together.
- The temptation after a good number is to build; after a bad one, to rebuild.
  The intent's job is to make the next step follow from the reading.
