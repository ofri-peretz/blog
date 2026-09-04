---
kind: intent
slug: 2026-09-03-engage-reply-latency
opened: 2026-09-03
status: shipped
---

# Intent: every inbound comment is answered within 24 hours, measured on dev.to

## What

Reply latency becomes an observed number: the time from someone's comment to
our reply as dev.to records both, not the time to a local "sent" click. The
standing series reports that number, the inbox ranks by it, and the daily banner
fires on it. "Waiting" means what dev.to says is waiting.

## Why now

- On 2026-09-03 the inbox held 35 replies, the oldest 100 days, all drafted.
  Nothing in the loop knew, because nothing looked.
- The standing row written today reports `reply_latency_h = 2326` (97 days),
  a median over local `handledAt` marks — including a bulk mark-as-handled of
  28 records on 2026-08-10 that the inbox route itself calls a contradiction.
- The reconciler now verifies comments we opened, but not replies: a reply
  marked sent that never landed stays "sent" until the inbox crawl notices,
  and a reply that did land carries no observed timestamp anywhere.
- The inbox crawl already walks every comment tree on our articles and on
  articles we commented on (`lib/inbox.ts`); it discards the answered threads
  instead of recording when we answered. The data is fetched and thrown away.

## Constraints

- The app never posts. Latency is measured, never automated away.
- No new crawl: the inbox builder already reads every tree. Answered threads
  are kept, not re-fetched.
- Marks stay honest: a local `sent` with no observed reply is still shown as
  `sendFailed`; it never counts as answered.
- Pace budget unchanged. Faster replies, not more comments.

## How we will know it worked

| Signal                                                         | Now                          | Target               |
| -------------------------------------------------------------- | ---------------------------- | -------------------- |
| Median hours, their comment → our observed reply, last 30 days | unmeasured (marks say 2,326) | < 24                 |
| Replies waiting at the daily check                             | 23–35                        | ≤ 5 on 12 of 14 days |
| Threads older than 7 days with no reply                        | 6 older than 30 days         | 0                    |
| Answered threads with an observed reply timestamp              | 0                            | 100% of answered     |

## Not doing

- Drafting replies differently. The drafter is fine; the delay is human.
- Auto-posting replies.
- Notifying more than once a day.
