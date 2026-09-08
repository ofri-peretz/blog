---
title: "My Benchmark Judged Five Models Against a Threshold Built for Three"
description: "Every degree of freedom the table did not know about borrowed the df=2 threshold. It fired once on a real run, got the right answer anyway, and that is exactly why nobody noticed for four months."
slug: "significance-from-a-lookup-table"
cover_image: "https://ofriperetz.dev/cdn/blog-cover-image/significance-from-a-lookup-table.jpg?v=b2"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/significance-from-a-lookup-table-og.jpg?v=b2"
reading_time_minutes: 6
published: false
date: 2026-09-07
tier: "T1"
tags:
  - "node"
  - "javascript"
  - "testing"
  - "benchmarking"
canonical_url: https://ofriperetz.dev/articles/significance-from-a-lookup-table
quality:
  panel_version: "1.0.0"
  reviewed: "2026-09-07"
  spec: sdlc/spec/significance-from-a-lookup-table.md
  lenses:
    growth_hook: 9.6
    security_correctness: 9.7
    structure_framing_voice: 9.5
    compatibility: 9.5
    reproducibility: 9.6
author:
  name: Ofri Peretz
  avatar: https://avatars.githubusercontent.com/u/46347627
  title: Security Engineering Leader
---

I went looking for a missing Bonferroni correction in my own benchmark. I found something worse on the way: the one significance test I *did* have was a dictionary.

```js
const criticalValues = { 1: 3.841, 2: 5.991, 3: 7.815 };
const significant = chiSq > (criticalValues[df] || 5.991);
```

Three degrees of freedom in the table. Anything else falls through the `||` and gets judged against 5.991 — the df=2 threshold. `df` here is `models.length - 1`, so the moment I compared five models, every verdict was measured against a bar meant for three.

I evaluated both predicates on six statistics that land in that gap:

| χ² | df | old verdict | true p |
|---|---|---|---|
| 7.0 | 4 | significant | 0.1359 |
| 8.0 | 4 | significant | 0.0916 |
| 9.0 | 4 | significant | 0.0611 |
| 7.0 | 5 | significant | 0.2206 |
| 10.0 | 5 | significant | 0.0752 |
| 12.0 | 6 | significant | 0.0620 |

Six for six — which is guaranteed, because I chose points inside the gap. That is the point of a probe: it shows the mechanism, not how often it fired. One of them has a true tail probability of **0.22** and the old predicate called it `p < 0.05`.

## It fired once, and got the right answer

Probes show the mechanism. For frequency you have to look at what the thing
actually printed, so I went through every stored result. Eleven run files, three
of them carrying a chi-squared verdict, and exactly one lands in the gap:

```json
{ "chiSquared": 18.43, "df": 4, "pValue": "< 0.05", "significant": true }
```

Judged against 5.991 instead of the 9.488 its four degrees of freedom called
for. And it was **right anyway** — the true p is 0.001017, comfortably
significant on any threshold you like.

That is the whole problem in one row. The instrument was broken, the answer was
correct, and nothing in the output could tell you which of those you were
looking at. A wrong method that returns the right answer is not a near miss; it
is a bug with no symptom, which is the kind that stays.

## The error had a direction

Note what the table cannot do: it cannot make a real result disappear. The fallback is *lower* than every threshold it stands in for, so the mistake only ever converts noise into a finding. It never withholds one.

That asymmetry is the tell. A bug that fails randomly is a bug. A bug that fails exclusively in the direction that flatters your results is a bug you were never going to notice, because every time it fired it told you what you hoped to hear.

## Why it survived review

Because it looks like rigor. A table of critical values is what a textbook prints on its inside cover, and the numbers are right — 3.841, 5.991 and 7.815 are correct for df 1, 2 and 3. Nothing in the diff is *wrong*. The defect is the `|| 5.991` — eight characters that turn "I don't know" into a confident answer.

It reads as harmless. I know, because I found the same function in a second runner where someone had already met this problem and fixed it:

```js
const criticalValues = { 1: 3.841, 2: 5.991, 3: 7.815, 4: 9.488, 5: 11.07 };
const significant = chiSq > (criticalValues[df] || 5.991);
```

Two more rows. The cliff moved from df≥4 to df≥6. It did not go away, and now it was harder to see, because the table looked more complete. Extending a lookup table is not fixing a lookup table.

## The field that was not a number

The same function returned this:

```js
pValue: significant ? "< 0.05" : "> 0.05",
```

A field named `pValue`, holding a string, derived from the boolean it was meant to justify — carrying nothing the boolean did not already say. Anything downstream reading it for evidence read its own conclusion echoed back. On another branch of the same function that field held the number `1`: same name, two types.

## And the correction I came for

Absence, verified: a case-insensitive search of every `.ts` and `.js` file in the benchmark packages for `bonferroni`, `holm`, `benjamini`, `hochberg`, `fdr` and `family-wise` returns zero. (Run it unscoped and you get three hits, all of them base64 fragments inside `package-lock.json` integrity hashes — a reminder that an absence is only as good as the set you searched.) Comparing plugins across many rules is a multiple-comparisons problem by construction — run enough comparisons and something ranks first on noise alone — and I correct for none of it.

I had already published the article telling readers to [count how many cells were computed before believing any one of them](https://ofriperetz.dev/articles/ranking-vs-measuring). The advice was fine. I just had not run it against my own instrument.

## The fix is arithmetic, not a bigger dictionary

The tail of a chi-squared distribution is a function. Compute it:

```js
export function chiSquaredPValue(chiSq, df) {
  if (!(chiSq >= 0) || !(df >= 1)) return 1;
  return upperGamma(df / 2, chiSq / 2); // regularized incomplete gamma
}
```

Those three lines are the interface, not the implementation: `chiSquaredPValue` delegates to a regularized incomplete gamma (`upperGamma`) and a Lanczos log-gamma (`gammaLn`), neither of which is exported, so the snippet above is for reading rather than pasting. All of it is in `benchmarks/lib/stats.ts`, and `npm --prefix benchmarks run stats:check` runs the whole thing in about a second. Both live on the branch carrying this fix — [ofri-peretz/eslint#952](https://github.com/ofri-peretz/eslint/pull/952) — until it merges. It reproduces 3.841, 5.991 and 7.815 to three decimals — and 9.488 and 11.07, which the table never had.

Then the check, which matters more than the fix. It asserts the *rule*, not the absence of one bad number: for a fixed statistic, more degrees of freedom must yield a **larger** p-value. That is precisely the relationship the fallback inverted, so it fails loudly on the old code and passes on the new. A fix without a check that would have caught it is a fix you get to make twice.

The uncomfortable part is not that my benchmark had a bug. It is that the bug sat in the code for four months, printing a field named after a statistic it was not computing, and the one time it mattered it agreed with me.

---

Related foundations: [statistical significance and what a p-value actually claims](https://ofriperetz.dev/articles/statistical-significance-p-value), [sample size and statistical power](https://ofriperetz.dev/articles/sample-size-and-statistical-power), and [composite scores and weighting](https://ofriperetz.dev/articles/composite-scores-and-weighting).

If your own harness prints a significance verdict, the five-second version of
this audit is one command:

```bash
grep -rniE "bonferroni|holm|benjamini|hochberg|fdr|family-?wise" --include=*.ts --include=*.js .
```

Zero hits and more than a handful of comparisons means the same thing it meant
here. Run it scoped, though. Point it at your own source, not the repo root: unscoped
it walks `node_modules` and matches base64 inside `package-lock.json` integrity
hashes. Scoped to the benchmark packages here, dropping only the extension
filters gives three such phantoms; widen it further and you get more.

_What did yours return — and if it printed a p-value, did you check it was computed rather than looked up?_
