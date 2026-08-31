---
kind: intent
slug: 2026-08-30-distribution-article
opened: 2026-08-30
status: open
---

# Intent: publish the article about putting a real linter inside a blog post

## What

A build article about shipping ESLint into the browser and embedding it in
articles, aimed at anyone who maintains a linter, a plugin, or developer docs.
The recipe is ~60 lines and fully reproducible; the four traps that cost real
hours are the substance.

## Why now

Because it is the first thing we have built that is **showable rather than
describable**, and because the distribution problem is now measured rather than
suspected. Zero readers crossed from dev.to in sixty days, and the blog sees
145 readers a month. Writing another rule explainer optimises a room nobody
walks into; this piece is about the room itself.

It also has a third-party hook, which our own corpus says is what separates a
1,000-view article from a 47-view one. The generalisable claim is not "look
what I built" — it is that the linter is small enough to ship, so docs that
show screenshots of findings could show the finding instead.

## Constraints

- **9.5 from all five reviewers or it does not publish.** Growth/Hook,
  Security-Correctness, Structure/Framing/Voice, Compatibility, Reproducibility.
- Every number verified against the built artifact or the published packages at
  time of writing, with the command that produced it. This article is *about*
  precision; a wrong byte count in it would be self-refuting.
- Landscape framing. ESLint and typescript-eslint both ship playgrounds; they
  are destinations you navigate to. The claim is about the linter running
  inline on the rule the paragraph is arguing, not that nobody thought of this.
- The slug freezes at publish, so no number goes in it.
- Publishing is Ofri's call; merging is what pushes to Dev.to.

## How we will know it worked

- **Tier 3:** views on the piece, against the corpus baseline where the median
  article does far less than the 1,058-view top performer.
- **Tier 2:** `article:playground_open` above zero. The article's actual job is
  to send people to a playground, and that event is the only honest measure of
  whether it did.

## Not doing

- Not a tutorial for building an ESLint plugin. That article exists and that
  title pattern reliably flops.
- Not claiming novelty we cannot support. Browser-hosted linting is not new;
  what is unusual is the placement.
- Not shipping without a cover image. Dev.to posts without one underperform,
  and image generation is Ofri's step.
