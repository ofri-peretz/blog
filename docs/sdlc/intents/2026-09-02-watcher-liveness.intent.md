---
kind: intent
slug: 2026-09-02-watcher-liveness
opened: 2026-09-02
status: open
---

# Intent: find out whether the social watcher is alive

## What

Confirm that `com.ofri.social-watcher` still detects a Dev.to comment or
reaction — by checking it against a real one — and give it a signal that says
so, rather than inferring health from the absence of alerts.

## Why now

Because an article just published, which is the first genuine opportunity to
test it in weeks, and because **an unverified watcher is this week's exact
failure mode wearing a different hat.**

`short_link_click` was dead for twenty days and nothing said so: the redirect
kept returning 200, the dashboards kept rendering, and the only symptom was a
number that quietly stayed flat. A watcher whose job is to notice things has
the same shape — it fails by going quiet, and going quiet is also what success
looks like on a slow week.

Nobody has seen it fire recently. That is not evidence it works.

## Constraints

- Detection is not the problem to solve — the LaunchAgent exists and
  `sync-devto-articles.mjs` already reads the API. Do not rebuild either.
- A comment deserves a same-day human reply, so any signal has to reach Ofri
  rather than a log file he would have to remember to open.
- No polling loop that burns quota. The existing schedule is fine if it runs.

## How we will know it worked

- **Binary:** a known real event — a reaction or comment on any article — is
  observed by the watcher, and that observation is visible somewhere Ofri
  actually looks.
- **Binary:** the watcher reports a heartbeat, so "silent" and "dead" stop
  being the same observation. That distinction is the whole point.

## Not doing

- Not building a reply system. Answering a comment is a judgement call and
  belongs to a person.
- Not adding a second notification channel before establishing the first one
  works.
