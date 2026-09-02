---
kind: intent
slug: 2026-09-02-launch-window
opened: 2026-09-02
status: open
---

# Intent: read the launch while it is still happening

## What

A single, scheduled read of the crossing at **+48 hours** from the Dev.to
publish (2026-09-02 13:07Z), answering one question: did anyone cross from
Dev.to to the blog, and did any of them touch the playground.

## Why now

Because the answer window closes. A Dev.to post takes most of its traffic in
the first two days and then decays; the Maintain review on 2026-09-29 will be
reading a flat tail and cannot distinguish "the crossing does not work" from
"there was no traffic to cross".

This is also the first real test of work that has never been exercised. Until
today, `short_link_click` had been dead for twenty days, the `::playground-cta`
links had never been clicked by anyone, and `article:playground_open` had never
fired once. All three now have their first genuine opportunity at the same
moment.

## Constraints

- Read over the population rule, never raw. Crawler volume on `/go/` runs
  1k–3.3k a day against roughly eleven human pageviews.
- One read, not a vigil. Checking hourly would turn noise into a narrative.
- A zero is a result. If nobody crosses, that is the finding, and it points at
  the crossing rather than at the playground.

## How we will know it worked

Three counts, each of which has been zero for the life of the property:

- `short_link_click` on the two `/go/` article keys, from a dev.to referer
- `article:playground_open`
- reader pageviews on the new article, over the population rule

## Not doing

- Not optimising anything during the window. Changing the page mid-read
  destroys the only clean measurement we will get.
- Not replacing the Maintain review. This answers a launch question; that one
  answers a trend question.
