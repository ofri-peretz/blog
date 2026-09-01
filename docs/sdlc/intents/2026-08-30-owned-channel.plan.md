---
kind: plan
slug: 2026-08-30-owned-channel
opened: 2026-08-30
---

# Plan: email capture

Intent: [`2026-08-30-owned-channel.intent.md`](./2026-08-30-owned-channel.intent.md)

## Ground truth

| Claim | Value | Source | Read on |
|---|---|---|---|
| Email capture on the property | none, anywhere | grep of the blog source | 2026-08-30 |
| Reader-only August reach | 168 pageviews, 145 readers | PostHog SQL with the population rule | 2026-08-30 |
| Pages per reader | 1.16 | derived from the two figures above | 2026-08-30 |
| Supabase already in the stack | yes, server-side reads live | `lib/supabase-data.ts` | 2026-08-30 |
| Dev.to corpus size | 36 articles | articles corpus inventory | 2026-05 |
| Top Dev.to article views | ~1,058 | same | 2026-05 |

## Approach

**Store in Supabase now; choose a sender later.** Supabase is already in the
stack with a server-side client, so capture needs one table, one server action,
and no new vendor. The list is the durable asset; the thing that eventually
mails it is a reversible choice, and making it now would be buying a pipeline
for water we do not have.

Rejected alternatives:

- **An ESP-hosted form (Buttondown, ConvertKit, Substack).** Fastest to stand
  up, and it puts the list back inside someone else's account — which is the
  exact problem this intent exists to solve. It also means a third-party script
  or iframe on a page whose header contract we deliberately keep tight.
- **A Vercel marketplace integration.** Worth revisiting when we actually send,
  since provisioning and env wiring come free; premature while the requirement
  is a table with two columns.

**Shape.** A `subscribers` table keyed by email, holding a status
(`pending` / `confirmed` / `unsubscribed`), a confirmation token, timestamps,
and the slug the person subscribed from — that last column is what later tells
us which articles actually earn subscriptions, and it costs nothing to record
now.

**Double opt-in**, because an address is a promise and because a list that
cannot prove consent is a liability rather than an asset. Submit writes
`pending` and mails a confirmation link; the link flips to `confirmed`.
Unsubscribe is a signed link that works without logging in.

Sending the confirmation mail is the one piece that needs an outbound service
even in phase one. Keep it to a transactional sender, not a marketing platform
— the distinction matters both for deliverability and for the vendor-lock
argument above.

**The offer.** "What the rules caught this month" — a short note tied to the
work we already do, rather than a generic subscribe box. It has to be worth an
address to a working engineer, and a benchmark corpus or a monthly findings
note is the only thing we have that qualifies.

**Placement.** End of article, after the playground, where a reader who
finished has already demonstrated interest. Explicitly not a popup: on a site
whose entire argument is that we do careful work, an interstitial contradicts
the pitch more than it converts.

## Sequence

1. DS: the capture form as an Interlace component — states for idle, pending,
   success, and error, since a form without a real error state is half a form.
2. Supabase migration for `subscribers`, with RLS that allows insert and
   nothing else from the anon key.
3. Server action: validate, insert `pending`, mail the confirmation.
4. Confirmation and unsubscribe routes.
5. Blog: consume the DS component at the end of the article.
6. Lock + a `newsletter:subscribe_submit` event, added to the frozen list.

## Gates

- Locks: the anon key cannot read the table, only insert; an unconfirmed
  address never counts as a subscriber; the unsubscribe link resolves without
  a session. Each must be seen failing first.
- The event name goes in the frozen analytics list, or it silently orphans its
  insight later.
- No third-party script added to the page; header contract unchanged.
- Copy states the cadence and what we send, before the input, not after.

## Risks

- **Nobody subscribes.** At 145 readers a month, even a good form might return
  single digits. That is information, not failure — but decide before shipping
  that a low number means "the offer is wrong", not "the mechanism is broken",
  and check the confirmation rate to tell those apart.
- Confirmation mail landing in spam would look identical to disinterest from
  the outside. The confirmation-rate metric exists specifically to separate
  them.
- Storing addresses raises the stakes on the Supabase keys. Service-role usage
  stays server-side only, and nothing here goes near a client bundle.
