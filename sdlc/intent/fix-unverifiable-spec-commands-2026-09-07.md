---
id: I-AUTO-20260907
slug: fix-unverifiable-spec-commands-2026-09-07
stage: intent
status: proposed
visibility: public
opened: 2026-09-07
opened_by: detector
approved_by:
---

## Claim

80 committed claims no longer match the command that produced them — but 71 of
those commands **did not run at all**, so the claims are unverifiable rather
than false. Roughly 4 are genuine drift. The split, and why it changes the
remediation, is in the incident's Class section.

The slug says `unverifiable-spec-commands`, not `stale-claim-agent-resource-bounds`,
because the first slug named one article out of nine and pointed triage at the
one whose findings are ALL command failures — there may be nothing wrong with
that article's prose at all.

## Audience

Readers of `agent-resource-bounds`, `ai-agents-rebranded-my-oss-ecosystem-two-pipelines-were-dead`, `eslint-in-the-browser-live-lint-playground`, `eslint-plugin-cold-start-optimization`, `eslint-plugin-dependency-weight`, `eslint-plugin-maintenance-signals`, `injection-beyond-sql`, `migrate-renamed-plugin-packages`, `modernization-lint-as-codemod`, and anyone who has linked to them.

## Why us

These are our published claims. A claim we made and no longer verify is worse
than one we never made — it is the corpus arguing against its own thesis, which
is that a checked fact outlives a remembered one.

## Evidence we believe exists

- [x] Detector output, attached in sdlc/incident/2026-09-07-stale-claim-agent-resource-bounds.md

## Kill criterion

If the drift is cosmetic — a version bump that does not change the number a
reader acts on — this is closed as `ignored` with that reasoning recorded,
not silently dropped.

## Title candidates

n/a — corrective work on published articles.

## Tier

n/a
