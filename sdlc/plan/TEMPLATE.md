---
slug: the-article-slug
stage: plan
spec: sdlc/spec/the-article-slug.md
status: draft # draft | approved | built
---

## Files that change

- `apps/blog/content/articles/<slug>.md` — new | edit
- `apps/blog/public/cdn/blog-cover-image/<slug>.jpg` — cover
- `sdlc/review/<slug>.json` — written by the panel

## Work order

1. ...

## Risks

What could make this draft wrong or unshippable, and the mitigation.

## Proof of success

The commands that must pass before this leaves the branch.

```bash
npm run test -- sdlc-quality-lock
npm run sdlc:verify
npm run build
```
