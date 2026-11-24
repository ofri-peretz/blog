# CLAUDE.md — agent context for ofri-peretz/blog

This repo is the **canonical, public** home of the blog. `agents/apps/blog/` and the archived
`ofriperetz-dev` repo hold legacy copies (agents' `legacy-blog-articles` pre-commit hook
refuses edits there). The lifecycle is
[sdlc/README.md](./sdlc/README.md); writing or editing an article loads the `write-an-article`
skill (frontmatter, framing, titles, numbers, components).

Everything else is a check whose message names the fix: the quality ratchet
(`sdlc-quality-lock.test.ts`), banned framing words (`sdlc-chain-lock.test.ts`), publish scope
(`devto-publish-scope-lock.test.ts`), skipped hooks and CI polling (`.claude/hooks/guard-bash.mjs`).
Commands: `npm run build|test|lint|format`; stage detectors: `npm run sdlc:detect`.

## The rule that matters most

**Nothing publishes below 9.5 on all five review lenses.** If a draft cannot reach the floor,
rewrite it or pick a different article. Do not ship it and do not argue the score down.
(judgment: the lock checks the block exists, not that the scores are honest)

## Frozen identifiers

Once an article has a `devto_id`, `slug · devto_id · devto_url · canonical_url · cover_image ·
social_image` never change. dev.to permalinks cannot be renamed; retitling changes `title` and
the body only. `.claude/hooks/freeze-identifiers.mjs` blocks these edits.

## Shipping

Branch → PR → green (`build-test`, `eslint`, `oxlint`) → squash-merge. **Merging publishes
nothing.** dev.to publishing is a manual `publish-devto.yml` dispatch, `dry_run` true by default,
one article at a time. When you fix a bug a lock could have caught, add the lock in the same PR.
