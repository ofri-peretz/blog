---
title: "Three of My Planned Articles Cited Numbers That Do Not Exist"
description: "I audited twelve planned pieces against the benchmark JSON they cite. Two figures appear in no result file anywhere, one contradicts the source it names, and one real number is attached to the wrong set. Nothing caught it, because nothing recomputes prose."
slug: "numbers-in-prose-rot"
published: false
canonical_url: "https://ofriperetz.dev/articles/numbers-in-prose-rot"
cover_image: "https://ofriperetz.dev/cdn/blog-cover-image/numbers-in-prose-rot.jpg"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/numbers-in-prose-rot-og.jpg"
tier: "T2"
reading_time_minutes: 4
tags:
  - "webdev"
  - "testing"
  - "javascript"
  - "eslint"
series: null
author:
quality:
  panel_version: "1.0.0"
  reviewed: "2026-09-07"
  spec: sdlc/spec/numbers-in-prose-rot.md
  lenses:
    growth_hook: 9.5
    security_correctness: 9.7
    structure_framing_voice: 9.5
    compatibility: 9.5
    reproducibility: 9.7
---

I keep a document listing twelve articles I intend to write, each with a
measured number behind it. Before writing any of them I checked the numbers
against the benchmark JSON the document names as its source.

**Two of them appear in no result file anywhere.** A third contradicts the
file it cites. A fourth is a real number attached to the wrong subject.

Nothing had flagged this, because nothing recomputes prose.

## What the audit found {#found}

The document says one plugin produced **981** findings against another's
**21,557**. The JSON it cites says **1,375** and **23,325**.

`grep -rlF 21557` across every result file returns nothing. So does `4311`, the
other figure in that row. Not "in a different run" — in no run.

Then the subtler one. The document says a dominant rule accounts for 87% of a
plugin's output and that **"every other rule combined accounts for 0.6%."** The
87% is exactly right: 20,334 of 23,325. The 0.6% is a real number too — it is
the sum of the **bottom five** rules, 142 findings. Every *other* rule is 2,991,
which is **12.8%**.

Nothing was invented. A correct figure drifted one clause away from the set it
describes, and in that position it is twenty times wrong.

## Four ways a number goes bad in prose {#modes}

| mode | example |
| --- | --- |
| no source at all | `21,557` — in no result file |
| contradicts its own cited source | `981` where the JSON says `1,375` |
| real number, wrong subject | `0.6%` = bottom five rules, not "every other rule" |
| contradicted by a later run | "297 files" where the result data records 1 |

Only the third is catchable by careful reading. The rest require the source
open next to the prose, which is exactly the thing nobody does when the
document reads fluently.

## Why the document could not fail {#cannot-fail}

The JSON is generated. Re-run the benchmark and every number in it is replaced.
If a figure is wrong, the next run makes it right, and if the harness breaks the
run fails.

The document is written. It has no relationship to the data except that a person
once read one and typed into the other. It cannot be re-run. It has no failing
state. A number in it is not a measurement — it is [a memory of a
measurement](https://ofriperetz.dev/articles/reproducibility-vs-replicability),
and memories are not version-controlled against the thing they remember.

This is the same shape as [a metric standing in for the thing it
measures](https://ofriperetz.dev/articles/proxy-metrics): the document was
treated as the source because it was the artifact people actually read.

## What it cost {#cost}

Three of the twelve are dropped for the drift above. Not rewritten — dropped,
because their central claims rest on figures nobody can re-derive, and an
article whose number cannot be reproduced is worth less than no article.

Six more went for other reasons once I started checking: defects already fixed
since the document was written, a claim I could not test with the data on hand,
one topic already covered better elsewhere. **Three of twelve survived**, and
those three are written.

I would have written most of the other nine without checking.

## The habit {#habit}

Two rules, both cheap.

**Never let a number live only in prose.** If it matters, it belongs in a
generated artifact the prose points at. A README that states a benchmark result
should render it from the result file, or link to it, or both.

**Before you cite your own document, grep the number.** Not the claim — the
digits. `grep -rlF 21557 results/` takes a second and is the entire audit. It
found two figures that had been sitting in a planning document for weeks,
waiting to be published as fact.

The reason this is worth your attention is that the drift is invisible from the
inside. The document read perfectly well. It was internally consistent, it cited
its source by filename, and every number in it looked like the kind of number
that comes out of a benchmark. It just did not.

_Take the last number you published about your own work. Can you point at the file it came from?_
