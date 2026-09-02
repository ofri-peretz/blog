---
slug: example-pg-rule-inventory
stage: spec
intent: sdlc/intent/i2-ground-truth-becomes-spec.md
status: approved
gathered: 2026-08-30
---

## Thesis

The reference implementation of a stage-2 spec. It is a real spec with real
commands — the staleness detector runs these on every scheduled pass — and it
exists so the format is demonstrated rather than described.

It also documents a live instance of the problem it was built to solve: our
notes recorded `eslint-plugin-pg` at **1.4.3**, and on 2026-08-30 the published
version was **1.4.14**. Nothing in any article changed; the claim simply went
stale, and no review pass could have caught it because there was no diff to
review.

## Ground truth

| Claim                                | Value  | Command                                                 | Version | Verified   |
| ------------------------------------ | ------ | ------------------------------------------------------- | ------- | ---------- |
| rules registered in eslint-plugin-pg | 13     | `node scripts/sdlc/pkg-rule-count.mjs eslint-plugin-pg` | 1.4.14  | 2026-08-30 |
| latest published eslint-plugin-pg    | 1.4.14 | `npm view eslint-plugin-pg version`                     | 1.4.14  | 2026-08-30 |

## Known traps pre-empted

- [x] **Export shape** — verified: `Object.keys(require('eslint-plugin-pg'))`
      returns `rules, plugin, configs, default`. This package _does_ expose
      `configs` on the default export, but several siblings do not, so any
      article covering more than one plugin must check each.
- [x] **Rule counts** — counted from a clean install of the published package
      via the helper, not from `ls src/rules/` and not from `grep -v index`.
- [x] **Config option names** — n/a for this spec; no options are claimed.
- [x] **Detection logic** — n/a; no per-rule behaviour is claimed here.
- [x] **Frozen identifiers** — n/a; no article is published from this spec.

## Outline

n/a — this spec backs no article. It is the worked example the templates point
at and the fixture the staleness detector exercises.

## Framing check

No comparison is made, so no landscape framing is required. No fixtures are
self-graded.
