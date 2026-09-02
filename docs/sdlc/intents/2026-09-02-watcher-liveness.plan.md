---
kind: plan
slug: 2026-09-02-watcher-liveness
opened: 2026-09-02
---

# Plan: prove the watcher, then make silence legible

Intent: [`2026-09-02-watcher-liveness.intent.md`](./2026-09-02-watcher-liveness.intent.md)

## Ground truth

| Claim | Value | Source | Read on |
|---|---|---|---|
| LaunchAgent installed | com.ofri.social-watcher.plist | ~/Library/LaunchAgents | 2026-09-02 |
| Dev.to API reader exists | yes | apps/blog/scripts/sync-devto-articles.mjs | 2026-09-02 |
| Last confirmed firing | unknown | nothing records one | 2026-09-02 |
| Corpus articles with comments | 7 of 36 drew any engagement | articles corpus | 2026-05 |
| New article published | 2026-09-02 13:07Z | publish workflow | 2026-09-02 |

The third row is the intent. Nobody can say when it last worked, which is the
same position `short_link_click` was in on 2026-08-29.

## Approach

**Diagnose first, and cheaply.** Check whether the agent is loaded and whether
its log shows recent activity. That is minutes of work and may end the intent —
if it is running and has recent entries, the remaining question is only
visibility.

**Then close the silence gap.** The failure this guards against is a watcher
that stopped and looked identical to a quiet week. The fix is a heartbeat: a
periodic "checked, found nothing" that makes absence of the heartbeat — not
absence of alerts — the alarm. Same shape as the
`short_link_capture_failed` event added to the `/go/` route: report a PRESENT
signal, because an absence is what nobody notices.

Rejected: rewriting the watcher. It exists, and this week has produced two
examples of proposing to build something that was already there.

Rejected: alerting on every reaction. The corpus says 7 of 36 articles ever
drew engagement; at that rate a per-event alert is not noisy, but it is also
not the gap. The gap is not knowing whether the thing runs.

## Sequence

1. `launchctl list | grep social-watcher` and read its log tail.
2. If it is dead: restart, and record why it died — that reason is the finding.
3. If it is alive: confirm it saw something real (the new article's first
   reaction or comment) rather than trusting the process being up.
4. Add the heartbeat, wherever Ofri already looks.

## Gates

- Step 3 is required. A running process is not a working watcher — this whole
  week has been about that distinction.
- No rebuild of detection.
- The heartbeat must be visible without opening a log file deliberately.

## Risks

- **The new article may draw no comments at all**, in which case step 3 has
  nothing to observe and the intent stalls honestly rather than concluding
  falsely. Fall back to a reaction on any older article, or to a deliberate
  self-generated event, and say which was used.
- A heartbeat that nobody reads is another silent thing. Put it where an
  existing habit already goes.
