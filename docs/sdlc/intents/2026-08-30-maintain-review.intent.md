---
kind: intent
slug: 2026-08-30-maintain-review
opened: 2026-08-30
status: open
---

# Intent: run the Maintain phase once, for real

## What

Execute the first Maintain review and leave behind a repeatable procedure: a
fixed set of queries, read in a fixed order, producing either the next
`intent.md` or an explicit decision to keep waiting.

## Why now

Because a phase that has never been executed is not adopted, it is documented.
We wrote Maintain into `docs/sdlc/README.md` today, and the evidence for why it
matters is that both defects found this week were found by someone happening to
look:

- a playground advertising three rules while only one could fire, wrong in
  production for three days;
- `short_link_click` silently dead for twenty days.

Neither was caught by a test, because neither was a Build failure. Only a
review that reads the numbers back catches that class.

Running it once now — while the numbers are thin and the answer will mostly be
"too early" — is the point. A ritual first performed when the stakes are high
gets improvised.

## Constraints

- **Trigger on data, not the calendar.** 1,000 reader sessions or 30 days,
  whichever comes first.
- Every figure computed over the written population rule, never raw. Half of
  August's raw traffic was us.
- Counts, not rates, at this volume.
- "Nothing learned yet, extend the window" is a valid and expected outcome. A
  review that manufactures a conclusion to justify itself is worse than one
  that says the window was too short.

## How we will know it worked

- The review produces a written output with three sections — what the numbers
  did, what that rules in or out, and the next intent (or an explicit decision
  to wait).
- A second person, or a future session with no memory of this one, could
  re-run it from the procedure alone and get the same numbers.

## Not doing

- Not building a dashboard. The tiles exist; the missing thing is the habit of
  reading them and writing down what they meant.
- Not automating it. A review whose conclusions are generated is not a review.
- Not reviewing weekly. At this volume that reads noise and trains us to
  over-interpret it.
