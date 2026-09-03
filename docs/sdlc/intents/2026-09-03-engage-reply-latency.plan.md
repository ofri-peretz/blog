---
kind: plan
slug: 2026-09-03-engage-reply-latency
opened: 2026-09-03
---

# Plan: keep the answered threads, and measure from dev.to's clock

Intent: [`2026-09-03-engage-reply-latency.intent.md`](./2026-09-03-engage-reply-latency.intent.md)

## Ground truth

| Claim                  | Value                                                         | Source                                          | Read on    |
| ---------------------- | ------------------------------------------------------------- | ----------------------------------------------- | ---------- |
| Inbox waiting          | 35 (UI), 23 pending drafts, 6 older than 30 days              | `/api/threads`, `engage-inbox-notify --dry-run` | 2026-09-03 |
| Standing latency today | 2,326 h, median over `handledAt` marks                        | `/api/standing`                                 | 2026-09-03 |
| Bulk mark              | 28 records `sent` with identical `handledAt` 2026-08-10       | `app/api/threads/route.ts` comment              | 2026-09-03 |
| Inbox builder          | walks comment trees, keeps only threads with no reply from us | `apps/engage/src/lib/inbox.ts`                  | 2026-09-03 |
| Reconciler scope       | comment drafts only                                           | `agents/footprint/scripts/engage-reconcile.ts`  | 2026-09-03 |

## Approach

The inbox builder already sees our reply in the tree when it exists. Keep it:
return `answered: [{commentId, at, repliedAt}]` next to `threads`, where
`repliedAt` is our reply's `created_at` on dev.to. Standing reads latency from
that list; replies waiting stays the unanswered list. The daily banner names
the oldest. No new fetches.

**Rejected: extending the agents reconciler to replies.** It would re-crawl
trees the app crawls every 12 hours. One crawler, one cache.

## Sequence

1. `lib/inbox.ts`: while walking, when a child comment by us is found under a
   thread root, record `{commentId, at, repliedAt: child.created_at}`; return
   `answered` alongside `threads`. `inbox.selfcheck.ts` gains a fixture tree with
   one answered and one unanswered thread and pins both lists.
2. `/api/standing`: `reply_latency_h` = median over `answered` in the last 30
   days; `replies_waiting` = actionable unanswered. Drop the `handledAt` path.
3. `/api/threads`: expose `answeredCount` and `oldestWaitingDays`; the Threads
   panel header shows "oldest 23d".
4. `engage-inbox-notify.ts`: banner text becomes "N replies waiting · oldest Xd",
   read from `/api/threads` when the app is up, from the drafts file otherwise.

## Gates

- `inbox.selfcheck.ts` red on step 1's fixture before the change (no `answered`
  list), green after.
- `standing.selfcheck.ts` already pins the median; add a case that an
  `answered` entry without `repliedAt` is ignored, never counted as 0 h.
- Human: none; this is measurement.

## Risks

- Threads answered before the reply-drafts era have no local record; the
  observed list covers them anyway, which is the point.
- A 30-day window on few answers is noisy; the row also stores the count, and
  the panel prints "over N" beside the median.
