---
id: I-27
slug: burgee-zero-dependency-cli-stack
stage: intent
status: proposed
visibility: public
opened: 2026-09-22
opened_by: claude
approved_by:
---

> Drafted by an agent from the burgee repository's own files. Every path below
> is relative to `github.com/ofri-peretz/burgee` (local checkout
> `ofriperetz.dev/burgee`), read at commit `2d78af239e`. Nothing here is
> approved; stage 2 may not begin until `approved_by` is filled by a human.

## Claim

This is part 2 of the install-tree method from
`eslint-plugin-dependency-weight`, applied to a whole CLI rather than one
plugin: a CLI assembled from commander or yargs plus the usual output packages
(ora, chalk, inquirer) resolves to a countable tree of packages from many
publishers, while burgee's nine packages resolve to themselves and nothing
else — and the reader leaves with the same four-line method, able to count
their own CLI's tree instead of trusting either side's number.

## Audience

Maintainers of Node CLIs who audit what `npm install` pulls in — for supply
chain review, for install time in CI, or because a transitive package broke a
release — and who have read part 1. Not people choosing a colour library on
aesthetics.

## Why us

Part 1 already published the method and conceded rows against our own
plugins; this is the same method pointed at a stack we maintain, so it has to
concede the same way. We can state the burgee side exactly because the
manifests are ours, and we are obliged to print the rows where the neighbour
is smaller: commander is zero-dependency on its own, and it installs smaller
than burgee (`README.md` "Measured": installed size, where burgee's is the
largest number on the page and the project says so). The article's claim is
about the _assembled_ stack and the number of parties a user trusts, not
about any single package being heavier.

## Evidence we believe exists

- [ ] Nine published packages, each with no dependency outside the family:
      `packages/{burgee,roundel,flagstaff,caique,linegauge,seniority,bellpull,closeout,paratext}/package.json`
      — six declare no `dependencies` at all; `burgee`, `flagstaff` and
      `caique` depend only on family packages. The README states the same
      ("Six take nothing at all; the other three take only each other"). Stage
      2 must confirm from the registry (`npm view <pkg> dependencies`), not
      from the working tree.
- [ ] A graded drop-in exists for each incumbent the comparison names, so the
      stacks are like for like: `apps/docs/content/docs/compatibility.mdx`
      rows for commander, yargs, chalk (`roundel/chalk`), ora
      (`flagstaff/ora`) and inquirer (`caique/inquirer`, graded against
      `@inquirer/core`'s suite — stage 2 must say that it is the core package,
      not `inquirer` itself).
- [ ] The incumbent trees are resolvable without downloading, by part 1's
      method (`npm i --package-lock-only`, count `node_modules/` keys). None of
      those counts exists yet; every one is a stage-2 measurement.
- [ ] burgee's own weight axis already publishes the byte view, including the
      rows that go against it: `benchmarks/README.md` (B4) and
      `benchmarks/results/cli-benchmarks/`. The article counts packages;
      bytes are cited, not re-derived, and the unfavourable rows are printed.

**Known trap for stage 2:** the README's family table still labels the four
foundation packages "planned" `0.0.1` stubs, while the registry serves
`linegauge@0.4.0`, `seniority@0.4.0`, `bellpull@0.2.0`, `closeout@0.3.0`. The
article must cite the registry, and the spec must record which versions were
resolved.

## Kill criterion

Abandon if stage 2 finds any of:

1. Any of the nine packages, as published on the registry, resolves a
   dependency from outside the family. The whole claim is "resolves to
   itself"; one external package makes it false.
2. The like-for-like comparison cannot be built — a stack package named in
   the article (commander, yargs, ora, chalk, inquirer) has no graded burgee
   row, so the comparison would set a feature-complete stack against a
   partial one. Drop that package from the comparison; if fewer than three
   remain, the article is not worth writing.
3. After subtracting what both sides share, the incumbent stack's tree is
   within a handful of packages of burgee's nine. Part 1's lesson is that raw
   counts mislead; if the honest difference is small, the article says so in
   a paragraph of part 1's follow-up, not in its own post.

## Title candidates

Named target + concrete number + claim; the numbers are placeholders until the
spec supplies them from a command.

1. A commander + ora + chalk + inquirer CLI Installs N Packages. burgee's Nine
   Install Nine.
2. Count Your CLI's Install Tree: Part 2 of the Dependency-Weight Method
3. N Publishers to Trust for One CLI, Counted With Four Lines of npm

## Tier

T3
