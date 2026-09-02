---
id: I-5
slug: i5-review-passes
stage: intent
status: approved
visibility: public
opened: 2026-08-30
opened_by: claude
approved_by: ofri
---

## Claim

`REVIEW.md` defines what the PR review agent looks for, so the already-merged
review action reviews _our_ concerns instead of generic prose quality.

## Audience

Us, and the review agent.

## Why us

`.github/workflows/claude-code-review.yml` is merged and no-ops until
`CLAUDE_CODE_OAUTH_TOKEN` exists. When the token lands, an undefined rubric
means a generic review — and generic review is exactly what already lets our
five failure classes through.

## Evidence we believe exists

- [x] The workflow is merged, gated on the secret, `track_progress: true`
- [x] Five passes are already known from the failure classes and the framing rules

## Kill criterion

None. The rubric is worth writing whether or not the token ever lands.

## Blocked on

`CLAUDE_CODE_OAUTH_TOKEN` — Ofri's to generate via `claude setup-token`. The
rubric ships regardless; the pass only becomes live when the secret exists.

## Title candidates

n/a

## Tier

n/a
