---
kind: plan
slug: 2026-09-04-engage-ties
opened: 2026-09-04
---

# Plan: fold the comment ledger by person, date the last exchange, split the followers

Intent: [`2026-09-04-engage-ties.intent.md`](./2026-09-04-engage-ties.intent.md)

## Ground truth

| Claim       | Value                                                                        | Source                        | Read on    |
| ----------- | ---------------------------------------------------------------------------- | ----------------------------- | ---------- |
| Comments    | 38 inbound with author, 84 outbound with the article's author, all dated     | `devto_comments`              | 2026-09-04 |
| Followers   | 1,924 total; 4 resolved as prior accounts, 526 as same-day, 1,394 unresolved | `devto_followers`             | 2026-09-04 |
| Mutual ties | 1                                                                            | `/api/standing`               | 2026-09-04 |
| Fill rate   | 150 accounts a day after the throttle at 400                                 | impact-ingest `--fill-joined` | 2026-09-04 |

## Approach

`lib/ties.ts`: fold the comment rows by counterpart, the comment's author
for inbound and the article's author for outbound. Each tie carries in and
out counts, the last date each way, days since the last exchange, mutual,
and a state from the thresholds. `going cold` is mutual ties sorted by days
since, oldest first; `owed` is inbound-only ties sorted newest first.
`/api/ties` reads the two tables through the existing paged helper and
caches one hour. The panel prints the two lists and the follower split.

**Rejected: reading the network graph.** The graph samples articles; the
warehouse is the record of our own exchanges and is the one to fold.

## Sequence

1. `lib/ties.ts` with selfcheck: folding, direction, dates, states, the
   two orderings.
2. `/api/ties`.
3. Home page panel "Ties".

## Gates

- Selfcheck red before step 1, green after.
- `tsc`, hygiene lock, `npm run selfcheck` green.
- Human: none.

## Risks

- Outbound rows record the article's author, so a reply we left in someone
  else's thread counts toward the article's author, not the person we
  answered. Stated on the panel.
