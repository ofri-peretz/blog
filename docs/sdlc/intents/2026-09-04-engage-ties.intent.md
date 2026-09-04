---
kind: intent
slug: 2026-09-04-engage-ties
opened: 2026-09-04
status: open
---

# Intent: ties — who is going cold, who came to us and never heard back, and how many followers are people

## What

A panel on the home page built from the comment warehouse: every person
we have exchanged comments with, the days since the last exchange in
either direction, whether the tie is mutual, and a state of warm, cooling
or cold. Two lists on top: mutual ties going cold, oldest first; and people
who commented on us that we never commented back on, newest first. Under
them, the follower count split into accounts that existed before they
followed, accounts that followed on their first day, and accounts not yet
resolved.

## Why now

Standing has one mutual tie against a target of fifteen, and the number
has not moved since the intent opened. The warehouse holds 38 inbound and
84 outbound comments with names and dates, and nothing reads them as
relationships: a tie that goes quiet for six weeks is gone, and the app
does not say which ones are about to. Of 1,924 followers, 4 are resolved as
accounts that existed before they followed and 1,394 are unresolved; the
headline number is onboarding.

## Constraints

- Public names from public comments; nothing beyond what the thread shows.
- The panel proposes a name; the anti-bot rules and the curator decide. It
  does not draft or post.
- Thresholds are stated in code: warm within 14 days, cooling within 45,
  cold after.
- Follower resolution runs at 150 accounts a day under the throttle; the
  panel prints the unresolved count rather than guessing.

## How we will know it worked

| Signal                                    | Now          | Target                          |
| ----------------------------------------- | ------------ | ------------------------------- |
| Mutual ties                               | 1            | 15 (the standing intent)        |
| Mutual ties cold for more than 45 days    | not measured | 0                               |
| Inbound commenters never answered in kind | not measured | 0 older than 14 days            |
| Followers resolved                        | 530 of 1,924 | all, by 2026-09-14 at 150 a day |

## Not doing

- Automating replies or follows.
- Reading reactions; the API does not expose who reacted.
