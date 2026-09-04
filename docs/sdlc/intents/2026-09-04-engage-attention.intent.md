---
kind: intent
slug: 2026-09-04-engage-attention
opened: 2026-09-04
status: open
---

# Intent: know what the platform's founders are building and rewarding, and detect the moment someone promotes us — from public data, without joining their challenges

## What

Four collectors and one events table. **Staff feed**: what @ben, @jess,
@peter, @thepracticaldev and the Google AI org publish, daily, with tags and
reactions — the programs they are running (this month: AI Disclosure,
Community Gems, Hacktoberfest 2026, Preptember, the challenge changes).
**Features ledger**: the authors named in Top 7, Community Gems and digest
posts, so "what gets featured" becomes a measurable shape next to our levers.
**Staff attention map**: the comment trees of the month's top articles, kept
for staff usernames, so we know which authors and topics the founders engage
and whether we are among them. **Promotion events**: daily deltas of the
referrer domains that mean someone shared us (t.co, linkedin, forem.com,
echojs, tsecurity.de, chatgpt.com) plus GitHub star bursts with timestamps,
overlaid on followers and views as event markers.

## Why now

- Every large jump in followers and reactions so far coincided with a
  founder tag, a list, or an X post, and none of it is recorded; the
  warehouse can now show the effect but not the cause.
- The founders' feed today says what they are building: AI Disclosure tools
  (2026-08-26, 113 reactions), Community Gems (2026-09-02, a recognition
  program), Hacktoberfest 2026 (160 reactions), a challenge overhaul. Writing
  about, and early-adopting, what they build is the one promotion path that
  needs no challenge entry.
- Referrers already carry the signal: t.co 54, linkedin 36, forem.com 13,
  echojs 13, chatgpt.com 11 lifetime views, all unattributed to a date.
- GitHub returns star timestamps with the token the ingest already holds.

## Constraints

- Public data only, about public accounts acting in public: articles,
  comments, stars, referrer domains. No profile scraping, no private lists.
- One writer: the ingest. The control room reads views.
- Names of staff are the asserted list in `lib/people.ts`, never inferred.
- No action on the platform; this measures.

## How we will know it worked

| Signal | Now | Target |
| --- | --- | --- |
| Staff posts stored daily | 0 | every post from the asserted list |
| Feature lists parsed | 0 | Top 7 and Community Gems back to 2026-01 |
| Promotion events with a date and a source | 0 | every t.co / linkedin / forem / echojs delta above baseline |
| Founder-engaged authors, and whether we are one | unknown | measured monthly |

## Not doing

- Joining challenges or writing for a program's rubric.
- Any scraping of X; the effect is measured through t.co referrers and follows.
- Direct messages or outreach automation.
