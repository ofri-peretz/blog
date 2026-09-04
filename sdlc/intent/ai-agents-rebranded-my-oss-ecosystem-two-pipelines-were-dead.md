---
id: I-14
slug: ai-agents-rebranded-my-oss-ecosystem-two-pipelines-were-dead
stage: intent
status: approved
visibility: public
opened: 2026-09-04
opened_by: claude
approved_by: ofri
---

## Recorded after the draft, before the publish

Backfilled at scoring time, before publication. This one is an incident
write-up, so the intent is reconstructed from the incident rather than from a
plan — the work happened first by definition.

## Claim

Merged is not delivered. A reader finishes holding one portable check — a
request to production must return the thing you shipped — and knowing the three
failure modes it catches, because a green dashboard fails in the direction that
flatters you.

## Audience

Anyone whose delivery runs through CI they do not read every day, and
specifically anyone letting agents open pull requests at a rate no human
reviews carefully. The article assumes the reader trusts a green check more
than they should.

## Why us

The incident is ours and both failures are embarrassing: a deploy workflow that
had failed on every run for two weeks while production served a stale build,
and a repo whose PR checks had been manually disabled during a billing crunch,
so four PRs merged against an empty rollup. Nobody else can write this from the
inside, and the piece is worth much less written by someone it did not happen
to.

## Evidence we believe exists

- [x] An unpinned CLI invocation drifted across majors within the window.
- [x] The pinned version is in the workflow and every call consumes it.
- [x] Disabled workflows are distinguishable from passing ones by a single
      documented command.

## Kill criterion

Abandon if either failure turns out to have been visible as a red check that
was simply ignored. The whole thesis is that these fail _silently_ — if the
dashboard had shown red, the article is about not reading dashboards, which is
a much smaller and much less interesting claim.

It did not fire. One pipeline showed a stale green, the other showed nothing at
all, and an empty check rollup renders like a passing one.

## Title candidates

1. I Let AI Agents Rebrand My Entire OSS Ecosystem in One Night. Two Pipelines Were Silently Dead.
2. Merged Is a Feeling. Live Is a Measurement.
3. An Empty Check Rollup Looks Exactly Like a Green One

## Tier

T3
