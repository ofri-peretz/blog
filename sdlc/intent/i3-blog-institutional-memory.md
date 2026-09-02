---
id: I-3
slug: i3-blog-institutional-memory
stage: intent
status: approved
visibility: public
opened: 2026-08-30
opened_by: claude
approved_by: ofri
---

## Claim

An agent opened directly in `blog-public` knows the conventions, and the
frozen-identifier rule becomes a deterministic block rather than a hope.

## Audience

Any agent — or contributor — working in this repo without Ofri's Claude memory
loaded.

## Why us

`blog-public` has no `CLAUDE.md`. Frontmatter shape, series conventions,
landscape framing, slug immutability, the publish flow, the DS components
available in MDX — all of it exists only in the memory files of one project's
sessions. The repo is public; the knowledge required to contribute to it
correctly is not.

Slug immutability is the sharpest case. dev.to permalinks cannot be renamed,
so editing a published `slug` 404s every inbound link. Today that is caught by
a reviewer noticing. A hook makes it impossible.

## Evidence we believe exists

- [x] No `CLAUDE.md` at the repo root
- [x] Slug/`devto_id`/`devto_url`/`canonical_url` immutability documented in memory, enforced nowhere
- [x] `.claude/` exists in the repo (worktrees only) so hook wiring has a home

## Kill criterion

None credible. A repo without institutional memory is a repo that regresses.

## Title candidates

n/a

## Tier

n/a
