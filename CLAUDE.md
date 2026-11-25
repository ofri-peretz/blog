# CLAUDE.md — agent context for ofri-peretz/blog

This repo is the **canonical, public** home of the blog; `agents/apps/blog/` and the archived
`ofriperetz-dev` repo are legacy copies. The lifecycle is [sdlc/README.md](./sdlc/README.md);
stage detectors: `npm run sdlc:detect`. Everything else is a check whose message names the fix.

## The rule that matters most

**Nothing publishes below 9.5 on all five review lenses.** If a draft cannot reach the floor,
rewrite it or pick a different article. Do not ship it and do not argue the score down.
(judgment: the lock checks the block exists, not that the scores are honest)

## Shipping

Squash-merge a green PR. **Merging publishes nothing.** dev.to publishing is a manual
`publish-devto.yml` dispatch, `dry_run` true by default, one article at a time. When you fix a
bug a lock could have caught, add the lock in the same PR.
