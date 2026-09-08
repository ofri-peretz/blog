---
title: "The Most Precise Plugin in My Benchmark Scored 10.8%"
description: "Six ESLint security plugins, one labelled corpus, same harness, same day — F1 from 10.5% to 100%. I wrote the corpus, which is the most important sentence in the article and changes how every row should be read."
slug: "labelled-corpus-f1-leaderboard"
published: false
canonical_url: "https://ofriperetz.dev/articles/labelled-corpus-f1-leaderboard"
cover_image: "https://ofriperetz.dev/cdn/blog-cover-image/labelled-corpus-f1-leaderboard.jpg"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/labelled-corpus-f1-leaderboard-og.jpg"
tier: "T2"
reading_time_minutes: 4
tags:
  - "security"
  - "eslint"
  - "webdev"
  - "javascript"
series: null
author:
quality:
  panel_version: "1.0.0"
  reviewed: "2026-09-07"
  spec: sdlc/spec/labelled-corpus-f1-leaderboard.md
  lenses:
    growth_hook: 9.5
    security_correctness: 9.7
    structure_framing_voice: 9.6
    compatibility: 9.5
    reproducibility: 9.6
---

Six ESLint security plugins, one labelled corpus of 69 vulnerable fixtures,
same harness, same day — `eslint-plugin-security@4.0.1`,
`@microsoft/eslint-plugin-sdl@1.1.0`, ESLint 10.8.1, Node 24.

**I wrote the fixtures.** That sentence has to come before the table, because
it changes what every row below is worth.

[TP, FP and FN](https://ofriperetz.dev/articles/confusion-matrix-tp-fp-fn-tn) are
the four boxes everything below is derived from.

| Plugin | TP | FP | FN | F1 |
| --- | ---: | ---: | ---: | ---: |
| Interlace | 69 | 0 | 0 | **100%** |
| [eslint-plugin-sonarjs](https://ofriperetz.dev/articles/benchmark-sonarjs-vs-interlace) | 27 | 9 | 42 | 51.4% |
| [eslint-plugin-security](https://ofriperetz.dev/articles/eslint-plugin-security-is-unmaintained-heres-what-nobody-tells-you-96h) | 10 | 7 | 59 | 23.3% |
| [@microsoft/eslint-plugin-sdl](https://ofriperetz.dev/articles/benchmark-microsoft-sdl-vs-interlace) | 6 | 2 | 63 | 15.6% |
| eslint-plugin-no-unsanitized | 4 | 1 | 65 | 10.8% |
| eslint-plugin-security-node | 4 | 3 | 65 | 10.5% |

Three rows have a piece of their own, linked above — one tool read closely
rather than ranked. This is [seventeen plugins](https://ofriperetz.dev/articles/benchmark-17-eslint-security-plugins-compared)
compressed into one table, and compression is the subject.

## Read the column the ranking hides {#precision}

F1 blends precision and recall, which is how a table like this stops being
informative. Split them and a different tool leads.

`eslint-plugin-no-unsanitized` sits second from the bottom at 10.8% F1. Its
**precision is 80%** — 4 true positives against 1 false positive, the highest
of any community plugin here. It detects four things. It is right about
substantially all of them.

That is not a consolation prize. A tool with 80% precision and a narrow scope
is one you leave switched on. A tool that finds more and is wrong more often is
one somebody disables in month three — and a rule nobody runs has a recall of
zero regardless of what the table says.

## Why my row says 100%, and why you should discount it {#corpus}

A 100% row against fixtures written by the people who wrote the rules is the
expected outcome of grading your own homework. It is not evidence of
superiority and I will not present it as any.

What it is: **a regression gate we happen to publish.** It says our rules still
detect what we built them to detect. On the day it stops saying 100%, something
broke.

Three limits follow:

- The fixtures encode **our** threat model. A plugin scoped to a different
  surface — browser DOM, Angular, Electron — scores low here for reasons that
  say nothing about its quality on that surface.
- F1 on a self-authored corpus measures agreement with our idea of the problem,
  not correctness in the world.
- Recall against 69 of my fixtures is not recall against the field.

`@microsoft/eslint-plugin-sdl` is the clean example: 15.6% here, and it is a
well-made tool aimed at frontend and Microsoft-stack hardening. Pointing a
Node-backend corpus at it measures the mismatch, not the plugin.

## The check I ran before publishing any of it {#recompute}

I did not take the F1 column on trust — including my own row.

Every value was recomputed from its own TP/FP/FN with `2·P·R/(P+R)`. All six
matched the published figure to within a tenth of a point. Then the check that
actually matters: **TP + FN = 69 on every row.** If those totals disagreed, the
rows would be describing six differently-scoped runs and the table would not be
a comparison at all.

A minute's work, and the difference between a table you can defend and one you
copied. [A number without its measurement is a
memory](https://ofriperetz.dev/articles/precision-recall-f1-for-static-analysis),
and [a rank throws away the distribution behind
it](https://ofriperetz.dev/articles/ranking-vs-measuring) — a leaderboard is
the least recoverable form a measurement can take.

## What the table is for {#use}

Not for picking a plugin. For two narrower things.

**A scope map.** The recall column tells you what each tool was built to see.
Four of 69 is not failure; it is a statement of scope, useful when you are
deciding what to run alongside what.

**A regression gate.** Which is what it is to me, and the only claim here I
would defend without qualification.

If you want the version of this you can trust without knowing me, run it
yourself. The corpus and the harness are in
[the plugins repo](https://github.com/ofri-peretz/eslint) under
`benchmarks/`, and the suite that produced this table is one command:

```bash
npx tsx benchmarks/suites/ilb-juliet/run.ts
```

Pin the versions above or your numbers will not match mine — `eslint-plugin-security`'s
recall moves between releases, which is exactly why an unpinned comparison
table is worth nothing. Then add fixtures for the threats *you* care about. The
result will disagree with mine, and yours will be the one worth having.

_Whose fixtures is your security tooling being graded on — and have you ever read them?_
