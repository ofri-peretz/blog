---
name: write-an-article
description: Frontmatter, framing, title formula, number sourcing and article components for this blog. Use when writing, editing, retitling or reviewing an article under apps/blog.
---

# Writing an article

The lifecycle is [sdlc/README.md](../../../sdlc/README.md); read it first. This skill holds the
article-level rules that no lock checks yet. The ones that are locked (quality floor, frozen
identifiers, banned framing words, publish scope) fail with their own message.

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
[REVIEW.md](../../../REVIEW.md) pass 1 — read them before writing, not after.

Rule counts specifically: `node scripts/sdlc/pkg-rule-count.mjs <package>[@version]` counts
from a clean install of the published package. By hand:

```bash
node -p "Object.keys(require('eslint-plugin-<name>').rules).length"
```

Never `ls src/rules/` (counts helpers and `__tests__`), never `grep -v index`
(silently drops rules whose names contain "index", e.g.
`no-sensitive-indexeddb`).

## Components available in article markdown

`article-code-block` · `article-bench-receipt` · `article-playground` ·
`article-plugins` · `article-threads` · `article-weave` · `series-nav` ·
`floating-toc` · `reading-depth`. Prefer these over hand-rolled markup; they
carry the analytics and a11y contracts.
