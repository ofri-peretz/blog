---
kind: intent
slug: 2026-08-31-measured-claims
opened: 2026-08-31
status: open
---

# Intent: a number in our copy must be checked against the thing it measures

## What

Make any user-facing claim that quotes a measurement fail CI when it stops
matching the measurement. Nothing today connects the two, so copy and reality
drift apart silently and are only caught by someone happening to look.

## Why now

Because it happened twice in one day, and both were live on the public site:

- The node-security playground invited readers with **"Three of the 35 rules"**
  while the installed plugin shipped **42**. The copy had outlived two majors.
- The playground gate button said **"~400 KB"** — a pre-measurement estimate —
  while the article it is linked from published **362 KB**. A reader clicking
  through would have seen the published claim contradicted by the UI it points
  at.

Neither was caught by a test. Both were caught by a reviewer reading carefully,
which does not scale and did not catch them for weeks.

This is the same failure shape as the two worst bugs of the week: the demo that
advertised three rules and fired one, and `short_link_click` reporting healthy
while dropping every write. In all four cases **the system asserted something
about itself that nothing verified.**

## Constraints

- Must not require the generated worker artifact to be committed — it is
  gitignored, 1.7 MB, and rebuilt per deploy.
- Must not turn a plugin upgrade into a mysterious red build: the failure
  message has to name the copy, the measured value, and the file to edit.
- Numbers legitimately drift. The lock's job is to force copy to move WITH the
  measurement, never to freeze the measurement.
- Article bodies are content and out of scope here; they carry their own
  measurement date. This is about UI copy and embed definitions.

## How we will know it worked

- **Binary:** bumping a bundled plugin to a version with a different rule count,
  without touching the invite copy, turns the suite red. Verified by doing it,
  not by assuming.
- **Binary:** changing the gate label away from the measured size turns the
  suite red.

## Not doing

- Not auto-rewriting copy from measurements. A number in a sentence needs a
  human to keep the sentence true — the lock's job is to stop the sentence being
  quietly wrong, not to generate prose.
- Not extending this to the article corpus. Ninety articles quote hundreds of
  numbers with publication dates attached; that is a different problem.
