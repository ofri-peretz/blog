# CLAUDE.md — agent context for ofri-peretz/blog

This repo is the **canonical, public** home of the blog. Articles here are the
source of truth for the dev.to copies, which are published by manual dispatch
(see [Shipping](#shipping)). Two other checkouts contain article-shaped files and
are **legacy — never edit articles there**: `agents/apps/blog/` (private
monorepo, publish workflows disabled) and the archived `ofriperetz-dev` repo.

The lifecycle this repo runs is documented in [sdlc/README.md](./sdlc/README.md).
Read it before writing an article. The short version: an article is the
fourth of six committed artifacts, and the three before it are not optional.

---

## The rule that matters most

**Nothing publishes below 9.5 on all five review lenses.** Not 9.3. If a draft
cannot reach the floor, rewrite it or pick a different article — do not ship it
and do not argue the score down.

The floor is enforced by `apps/blog/src/__tests__/sdlc-quality-lock.test.ts`,
which is a **ratchet**: articles predating the chain are grandfathered in
`sdlc/baseline/unscored.json`, that file may only shrink, and any newly
published article must carry a `quality` block. Adding a slug to the baseline
fails CI. That is deliberate.

## Frozen identifiers

Once an article has a `devto_id`, these are immutable forever:

```
slug · devto_id · devto_url · canonical_url · cover_image · social_image
```

`cover_image` and `social_image` are in that list because they are asset
filenames derived from the slug — their stem is always the slug (or
`<slug>-og`). A corpus-wide rename once rewrote two of them and 404'd both
covers with no visible symptom in the build.

dev.to permalinks cannot be renamed; changing one 404s every inbound link.
Retitling means changing `title` and the body only. A slug containing a stale
number is accepted debt. A `PreToolUse` hook blocks these edits outright.

## Article frontmatter

Required: `title`, `description`, `slug`, `canonical_url`, `tier`,
`cover_image`, `social_image`, `reading_time_minutes`, `tags`, `author`.
Published articles also carry `devto_url`, `devto_id`, `published_at`.

New articles additionally carry the stage-4 artifact:

```yaml
quality:
  panel_version: "1.0.0"
  reviewed: "2026-08-30"
  spec: sdlc/spec/<slug>.md
  lenses:
    growth_hook: 9.6
    security_correctness: 9.8
    structure_framing_voice: 9.5
    compatibility: 9.7
    reproducibility: 9.6
```

`tier` is one of `T0 T1 T2 T3 TOPIC TUTORIAL`. `series` is optional; when
present the article opens with the series-nav block.

## Framing

Landscape, never competitive. Never _beat / win / winner / crush / destroy /
moat / competitor / threat_. Use coverage scope, specialisation, "best paired
with". Comparison articles disclose that fixtures span our own design surface
and show a case the neighbour handles well.

Titles follow the validated formula — named target + concrete number +
provocative claim. "Getting Started with X" and "The X Standard" are
measured flops: nine getting-started guides, zero engagement between them.

## Never invent a number

Every numeric claim comes from `sdlc/spec/<slug>.md`, with the command that
produced it. The five recurring fabrication classes are listed in
[REVIEW.md](./REVIEW.md) pass 1 — read them before writing, not after.

Rule counts specifically:

```bash
node -p "Object.keys(require('eslint-plugin-<name>').rules).length"
```

Never `ls src/rules/` (counts helpers and `__tests__`), never `grep -v index`
(silently drops rules whose names contain "index", e.g.
`no-sensitive-indexeddb`).

## Commands

```bash
npm run build          # turbo: next build
npm run test           # turbo: vitest run  (the locks live here)
npm run lint           # eslint + oxlint
npm run format         # prettier --check
npm run sdlc:detect    # the three stage-6 detectors
```

`apps/blog/src/__tests__/*-lock.test.ts` are structural locks. When you fix a
bug that a lock could have caught, add the lock in the same PR — a fix without
one is half-done.

## Shipping

`main` is protected; required checks are `build-test`, `eslint` and `oxlint`.
Branch → commit → push → PR → wait for green → squash-merge.
**Merging publishes nothing.**

Dev.to publishing is a manual `workflow_dispatch` on `publish-devto.yml`,
which PUTs to dev.to using each article's `devto_id`. Two inputs: `dry_run`
defaults to **true** (preview without calling the Dev.to API), and the
optional `article` slug scopes the run to one article — leaving it empty
targets the whole corpus.

The push trigger was removed 2026-07-19 after the Capsule-0 incident: merging
PR #62 auto-fired a live bulk publish of the whole corpus, cancelled at 6
articles (see `agents/footprint/incident-ledger.md`). Publishing follows the
controlled-capsule model — fire the workflow by hand, one capsule at a time.

Commit subject is `<type>(<scope>): <subject>`. Never `--no-verify`.

## Components available in article markdown

`article-code-block` · `article-bench-receipt` · `article-playground` ·
`article-plugins` · `article-threads` · `article-weave` · `series-nav` ·
`floating-toc` · `reading-depth`. Prefer these over hand-rolled markup; they
carry the analytics and a11y contracts.
