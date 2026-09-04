---
id: I-12
slug: eslint-plugin-cold-start-optimization
stage: intent
status: approved
visibility: public
opened: 2026-09-04
opened_by: claude
approved_by: ofri
---

## Recorded after the draft, before the publish

Backfilled at scoring time, before publication.

## Claim

A linter plugin can force a 24MB TypeScript compiler into every consumer's
`node_modules` without anyone choosing it, through two independent doors that
each look like someone else's problem. A reader finishes able to run one
command against their own tree and see whether it happened to them.

## Audience

Anyone who publishes an npm package with peer dependencies, and anyone who has
wondered why installing a linter costs tens of megabytes. Not a general
performance audience — the mechanism is specifically npm 7+ peer auto-install.

## Why us

We publish 19 plugins on one devkit, so the same manifest mistake is multiplied
19 times and the fix is measurable at both ends. The article is also an
admission: the compiler was there because of our own manifest, we marked two
peers optional in the same object and missed the two that mattered, and the
first fix did not work. That is only worth reading from the person who made it.

## Evidence we believe exists

- [x] npm 7+ auto-installs non-optional peers, with an upstream issue to cite.
- [x] `@typescript-eslint/utils` acquired a non-optional `typescript` peer
      partway through its 8.x line, which is the second door.
- [x] The three removed packages have measurable install-tree sizes.
- [x] The devkit's published manifest now declares zero runtime dependencies.

## Kill criterion

Abandon if the compiler turns out to be genuinely required at runtime rather
than for a handful of integer constants — then the 24MB is the price of the
feature and there is no article, only a complaint.

It did not fire. But a second criterion nearly did, from an unexpected
direction: the article leaned on TypeScript 7's Go port being far smaller,
which would have made the whole size argument a temporary one. Measured, TS 7
is _larger_ than TS 6, so the argument holds for a different reason than the
draft gave.

## Title candidates

1. A Peer I Forgot to Mark Optional Put 24MB of tsc Under Every Plugin I Publish
2. Two Doors to the Same 24MB
3. Your Linter Installed a Compiler You Never Asked For

## Tier

T3
