---
kind: intent
slug: 2026-09-04-engage-downstream
opened: 2026-09-04
status: open
---

# Intent: downstream — does dev.to reach the work, measured rather than zero by absence

## What

The Downstream pillar of the impact score scores 0 of 20 today, and two of
its three metrics are zero because nothing measures them, not because nothing
happens. Three instruments, so the pillar reads the truth:

1. **Article → npm download lift.** For every article, the seven days of
   daily downloads after publish against the seven before, for the plugin the
   article names or, when it names none, the whole ecosystem. Written daily
   to the warehouse, backfilled for the last 120 days.
2. **Humans from dev.to.** Sessions on any of our properties in the last 30
   days that arrived tagged `utm_source=devto` or with a dev.to referrer, and
   short-link clicks classified with the visitor's real user agent so a
   browser stops counting as a scanner.
3. **Followers who commented.** Unchanged; it was already honest.

The impact panel gains a downstream block: lift per article with its scope,
clicks from dev.to split human and bot, and for each metric the gap to
target in its own unit.

## Why now

Measured 2026-09-04: the lift writer has never produced a row, because it
only matches an article to a plugin when a tag equals a plugin slug, and our
articles are tagged eslint, security, webdev, javascript and ai. The
dev.to session counter reads a seven-day window tallied from the sixty
deepest sessions. And every one of the 1,192 short-link clicks from dev.to
in the last 30 days is flagged as a bot, because the server-side event
carries no user agent for PostHog to classify. The pillar that answers the
only commercial question, does writing on dev.to move adoption, is
answering from instruments that cannot see.

## Constraints

- One writer to the warehouse: the lift is computed in impact-ingest, the
  app only reads it.
- No personal data: the user agent goes to PostHog as the client SDK already
  sends it for every pageview, under the same no-profile flag; the visitor id
  stays the daily-rotating hash.
- Unmeasured stays zero and says so. No metric is estimated to fill a gap.
- Lift is a before-and-after on the same series; it is a signal, not proof
  of cause. The panel prints the scope so nobody reads ecosystem lift as
  plugin lift.

## How we will know it worked

| Signal                                    | Now        | Target                                                                                      |
| ----------------------------------------- | ---------- | ------------------------------------------------------------------------------------------- |
| Downstream metrics measured               | 1 of 3     | 3 of 3                                                                                      |
| Lift rows in the warehouse                | 0          | one per article published in the last 120 days                                              |
| dev.to clicks classified human in 30 days | 0 of 1,192 | a non-zero human share, or a bot share we can defend                                        |
| Pillar points                             | 0 of 20    | follows the data; 20 needs 20% median lift, 50 sessions a month and 20 commenting followers |

## Not doing

- Editing published articles to add tracking; links already route through
  `/go/` with `utm_source=devto`.
- Attributing downloads to an article as cause.
