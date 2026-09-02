---
slug: the-article-slug
stage: spec
intent: sdlc/intent/the-article-slug.md
status: draft # draft | approved | superseded
gathered: 2026-01-01
---

## Thesis

The claim from the intent, now that the evidence is in. If the evidence moved
the claim, say so here — that is the interesting part, and reviewers should
see it.

## Ground truth

**Every number in the finished article must appear in this table.** A number
here without a command is not ground truth, it is a memory, and the evidence
lock will reject it.

| Claim                                | Value | Command                                                           | Version | Verified   |
| ------------------------------------ | ----- | ----------------------------------------------------------------- | ------- | ---------- |
| rules registered in eslint-plugin-pg | 13    | `node -p "Object.keys(require('eslint-plugin-pg').rules).length"` | 1.4.3   | 2026-01-01 |

## Known traps pre-empted

Check each before writing. Each has shipped as a published error at least once.

- [ ] **Export shape** — default export is the plugin object only; `configs`
      is a _named_ export. `import plugin from '...'; plugin.configs` is
      `undefined` and crashes.
- [ ] **Rule counts** — counted from the built dist via `node -p`, never from
      `ls src/rules/` (overcounts helpers) or `grep -v index` (silently drops
      rules whose names contain "index").
- [ ] **Config option names** — copied from the rule's `schema[0].properties`,
      not guessed from the description. Schemas are
      `additionalProperties: false`, so a wrong key crashes at load.
- [ ] **Detection logic** — the rule's skip branches were read, not assumed.
- [ ] **Frozen identifiers** — if this article is already published, `slug`,
      `devto_id`, `devto_url` and `canonical_url` are immutable.

## Outline

Section by section, and for each: which ground-truth row proves it.

1. ...

## Framing check

Landscape, never competitive. Coverage scope and specialisation, never
"beat", "win", "moat", "crush", or "destroy". Self-graded fixtures are
disclosed in the article, not just here.
