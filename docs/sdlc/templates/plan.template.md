---
kind: plan
slug: <matches its intent's slug>
opened: YYYY-MM-DD
---

# Plan: <same subject as the intent>

Intent: [`<slug>.intent.md`](./<slug>.intent.md)

## Ground truth

Every factual claim this work depends on, with the command or query that
produced it and the date it was read. Numbers written from memory are
defects with a long fuse.

| Claim | Value | Source | Read on |
|---|---|---|---|
| e.g. node-security rule count | 42 | `node -p` against the published package | 2026-08-30 |

## Approach

How it will be built, and why this way rather than the obvious alternative.
Name the alternative that was rejected — a plan that considered nothing is
indistinguishable from a plan that considered everything.

## Sequence

Ordered only where order is forced by a real dependency. Independent work
should be marked as such — inventing a sequence for parallel work is how a
day becomes a quarter.

1. …

## Gates

- Which lock(s) prove this, and what state must they fail on. A lock that has
  not been seen red does not count.
- For articles: the five-reviewer panel, ≥9.5 on every lens.
- Anything requiring a human decision before it can ship.

## Risks

What could make this wrong rather than merely late. Especially: claims that
would embarrass us if a reader checked them.
