---
id: I-1
slug: i1-quality-score-committed
stage: intent
status: approved
visibility: public
opened: 2026-08-30
opened_by: claude
approved_by: ofri
---

## Claim

An article's quality score becomes a fact in the repository rather than a
number in a chat log, and CI refuses to build a published article that lacks
one or falls below the 9.5 floor.

## Audience

Us. This is infrastructure, not content — but it is the intent every other
intent depends on.

## Why us

The 9.5 floor is real to Ofri and invisible to every machine in the pipeline.
It lives in a Claude memory file, is enforced by hand, in a _different private
repository_, against a scorecard dated 2026-05-29. Measured 2026-08-30:
90 articles, 83 published, **0 carrying a committed score**, 29 published
since the last measurement, corpus mean 5.7/10.

That is not a discipline problem. A standard that only exists in one person's
session context is not a standard, it is a habit — and habits do not survive
being handed to an agent.

## Evidence we believe exists

- [x] `apps/blog/content/articles/*.md` — 90 files, 0 with a `quality` block
- [x] `agents/footprint/metrics/article-review-scores.json` — the 5-lens shape already exists and can seed the schema
- [x] `apps/blog/src/__tests__/*-lock.test.ts` — 20+ established locks to follow as precedent

## Kill criterion

If frontmatter cannot carry the score without breaking the dev.to publish
transform, the score moves to a sidecar file and this intent narrows. It does
not die — but the mechanism changes.

## Title candidates

n/a — infrastructure intent, ships as a PR not an article.

## Tier

n/a
