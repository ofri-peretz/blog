---
title: "My Harness Reported 0 Findings on 100 Files. All 100 Were Ignored."
description: "Three separate mechanisms make an ESLint run report zero while reading nothing — and every one of them exits 0 with an empty stderr. A clean bill of health and a file nobody opened are the same output."
slug: "lint-harness-measured-nothing"
published: false
canonical_url: "https://ofriperetz.dev/articles/lint-harness-measured-nothing"
cover_image: "https://ofriperetz.dev/cdn/blog-cover-image/lint-harness-measured-nothing.jpg"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/lint-harness-measured-nothing-og.jpg"
tier: "T2"
reading_time_minutes: 4
tags:
  - "javascript"
  - "eslint"
  - "testing"
  - "webdev"
series: null
author:
quality:
  panel_version: "1.0.0"
  reviewed: "2026-09-07"
  spec: sdlc/spec/lint-harness-measured-nothing.md
  lenses:
    growth_hook: 9.6
    security_correctness: 9.7
    structure_framing_voice: 9.5
    compatibility: 9.5
    reproducibility: 9.8
---

I ran fourteen lint rules over 100 files and got back zero findings. Every
rule silent, clean sweep, nothing to fix.

The correct answer was 308 findings in 54 of those files. The harness had read
none of them, exited 0, and printed nothing to stderr.

Here are the three ways that happens, all of them measured this week, all of
them silent.

## 1. The files were outside the base path {#base-path}

`ESLint` resolves what it is allowed to lint relative to `cwd`. Point it at a
directory that is not under the `cwd` of the process, and every file comes back
ignored:

```
File ignored because outside of base path.
```

That string arrives as a **message with a null `ruleId`** — the same shape as a
parse error. If your loop counts `messages.filter(m => m.ruleId)`, or skips
files whose messages look unfamiliar, you have just discarded the only
explanation you were given.

On the CLI it is quieter still. Exit code 0. Empty stderr.

Fix: set `cwd` to the tree you are measuring.

## 2. The `.ts` files were never eligible {#flat-config}

Flat config (ESLint 9.39.2 here) matches files by pattern. Omit `files`, and
the default covers `.js` and friends — **not** `.ts`, in an ecosystem that is
mostly TypeScript.

```js
// eslint.config.mjs
export default [{ rules: { "no-eval": "error" } }];
```

```
src/a.ts   ← contains eval()
src/b.js   ← clean
```

```console
$ eslint .
$ echo $?
0
```

No output. Exit 0. The `.ts` file contains `eval()` and was never opened.

This one is worse than the first, because a partial corpus still produces
plausible numbers. A repository that is 80% TypeScript reports on the other
20% and calls it a result.

Fix: `files: ['**/*.ts', '**/*.tsx']`, explicitly, and check the count of files
actually linted against a count you obtained some other way.

## 3. The build under test was not the build you ship {#stale}

In a monorepo, `node_modules/<your-package>` is usually a symlink into the
workspace. Anything you measure through it is unreleased source.

I asked a plugin which of its rules carry a fixer. From the workspace:

```
prefer-event-target: code
```

From the published package, same command, clean directory:

```
prefer-event-target: no fixer
```

Both true. Different questions. I nearly published a correction to a correct
article on the strength of the first one.

Fix: measure in a scratch directory with an `npm i <pkg>@<exact-version>`, and
say which tree the number came from.

## Why all three survive review {#silent}

Nothing throws. Nothing warns. The exit code is 0 in every case — and the one
time I saw a `1`, it came from a real finding in a file that *was* linted, not
from the file that was skipped. "It exited non-zero, so it noticed" is the
wrong conclusion and I drew it once.

They also fail at three different layers — which files are eligible, which
eligible files are covered, and which build is under test — so fixing one
leaves the others exactly as they were.

And they all fail toward good news. There is no version of these bugs that
invents findings. That asymmetry is what makes them survive: a number that is
too high gets investigated, and a number that is too low gets celebrated.

## The check {#canary}

One rule, before you believe any of it: **write the code the tool must flag,
and make sure it flags it.**

```tsx
export function C({ items }: { items: string[] }) {
  return <ul style={{ color: "red" }}>
    {items.map((i) => <li key={i} onClick={() => log(i)}>{i}</li>)}
  </ul>;
}
```

Four lines, tripping at least two of the rules under test. If the canary is
silent, the corpus number is not a number.

That is what caught mine. The hundred-file zero was completely believable —
it was the four-line file reporting zero that was not.

A count from an instrument you have never seen fail is not a measurement, it is
a hope.

This is the cheap half of [what ground truth catches that unit tests
miss](https://ofriperetz.dev/articles/what-ground-truth-caught-that-unit-tests-missed):
the tests all passed, because the harness they exercised was working — it was
the corpus it pointed at that was empty. It is also why a result you cannot
re-run is not yet a result, which is the whole distinction between
[reproducibility and replicability](https://ofriperetz.dev/articles/reproducibility-vs-replicability).
And a zero that means "read nothing" corrupts the one cell every other metric
is derived from — the true-negative box of [the confusion
matrix](https://ofriperetz.dev/articles/confusion-matrix-tp-fp-fn-tn).

_What's the last clean report you got — and would you know if the tool had read nothing?_
