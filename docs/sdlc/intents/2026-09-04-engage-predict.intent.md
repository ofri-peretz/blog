---
kind: intent
slug: 2026-09-04-engage-predict
opened: 2026-09-04
status: open
---

# Intent: before you publish — the levers applied to the draft, with the two edits that would move it

## What

For every draft on disk that has no dev.to id, the app scores its shape
against the levers already measured over our own articles and says where
that shape would land among them, for first-14-day views and comments, and
which two edits to the draft would raise it most. A section on the home
page beside the levers: one row per draft, a percentile per outcome, two
edits with their gain.

## Why now

The levers panel has known since 2026-09-04 that code blocks, the ai tag,
a later weekday and no colon in the title travel with comments. It is a
table; nobody reads a table before pressing publish. Seven drafts sit on
disk without a dev.to id. The publisher's queue is empty, so the next thing
that ships is whichever of the seven is promoted, and nothing says which
one, or what to change in it first.

## Constraints

- The same levers, the same threshold. The predictor adds no new
  correlation; it applies the ones already shown, so a lever that fails the
  panel's threshold cannot steer a draft.
- Rank among our own articles, never a view count. A predicted number
  would be fiction from forty samples; a percentile is a comparison.
- Edits are to shape only: code blocks, images, title punctuation, tags,
  weekday. Nothing rewrites prose.
- Correlation is labelled on the section, as on the panel.

## How we will know it worked

| Signal                                                         | Now                          | Target                                                 |
| -------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------ |
| Drafts scored before publish                                   | 0 of 7                       | 7 of 7, refreshed hourly                               |
| Edits suggested per draft                                      | none                         | two, each with a stated gain                           |
| First-14-day comments on drafts shipped after a suggested edit | 0.2 mean for non-ai articles | above the 1.0 corpus mean over the next five publishes |

## Not doing

- Predicting counts.
- Editing the drafts; the section says what, the author decides.
