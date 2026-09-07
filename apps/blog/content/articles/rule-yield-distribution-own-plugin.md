---
title: "My Plugin Has 14 Rules. Two of Them Found 60% of Everything."
description: "I pointed my own React plugin at a public codebase and counted per rule. 308 findings, and two rules produced 184 of them. Six rules produced nothing at all — and the reason that is not a bug is the whole article."
slug: "rule-yield-distribution-own-plugin"
published: false
canonical_url: "https://ofriperetz.dev/articles/rule-yield-distribution-own-plugin"
cover_image: "https://ofriperetz.dev/cdn/blog-cover-image/rule-yield-distribution-own-plugin.jpg"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/rule-yield-distribution-own-plugin-og.jpg"
tier: "T3"
reading_time_minutes: 4
tags:
  - "javascript"
  - "react"
  - "eslint"
  - "webdev"
series: null
author:
quality:
  panel_version: "1.0.0"
  reviewed: "2026-09-07"
  spec: sdlc/spec/rule-yield-distribution-own-plugin.md
  lenses:
    growth_hook: 9.6
    security_correctness: 9.6
    structure_framing_voice: 9.5
    compatibility: 9.5
    reproducibility: 9.8
---

A plugin's README tells you it has fourteen rules. It does not tell you that on
your codebase, two of them will do almost all of the work and six will never
speak at all.

I measured mine. Fourteen rules in `eslint-plugin-react-features` that have no
counterpart in `eslint-plugin-react`, pointed at the 100 `.tsx` files of this
blog — a public tree, so the numbers below are yours to check rather than mine
to be believed on.

**308 findings across 54 files.**

## The shape {#shape}

| rule | findings | files |
| --- | ---: | ---: |
| `react-no-inline-functions` | **113** | 38 |
| `react-render-optimization` | **71** | 27 |
| `hooks-exhaustive-deps` | 42 | 15 |
| `require-data-slot` | 35 | 14 |
| `no-unnecessary-rerenders` | 32 | 12 |
| `no-inline-style` | 9 | 1 |
| `no-raw-color-literal` | 4 | 2 |
| `no-arbitrary-token-class` | 2 | 2 |
| _six rules_ | **0** | 0 |

Two rules are 59.7% of the total. Four are 84.7%. The mean is 22 findings per
rule, and the top rule is five times it.

That is not a rule list. That is a power curve with a rule list printed over it.

## Why the total is the wrong number {#total}

"308 findings" is the number that reaches a standup, and it is the least useful
one available. It is a sum over a distribution nobody looked at, and it invites
exactly the wrong Monday morning — a team triaging 308 things.

Read the table instead and the work is two decisions, not 308. Decide once
about inline functions in JSX. Decide once about render optimisation. You have
now addressed 184 findings without opening 184 files, and what remains is small
enough to be honest about.

This is the same failure as [an aggregate benchmark score](https://ofriperetz.dev/articles/aggregate-benchmarks-lie-heres-what-700-ai-functions-look-like-by-security-domain),
one level down: a total computed over a distribution nobody inspected, which is
also [what a leaderboard throws away](https://ofriperetz.dev/articles/ranking-vs-measuring)
when it collapses a measurement into a rank.

The [same trap runs the other way for rule counts](https://ofriperetz.dev/articles/precision-recall-f1-for-static-analysis):
fourteen rules sounds like fourteen kinds of coverage. On this corpus it was
eight, and effectively two.

## The check that stops this being a lie {#artifact}

A concentration this steep has an obvious failure mode: one file with a
repeated pattern, counted 113 times, dressed up as a finding.

So the file column exists to kill that reading. `react-no-inline-functions`
fires across **38 distinct files**, `react-render-optimization` across 27. This
is a habit spread through a codebase, not one defect multiplied.

The opposite check matters too. `no-inline-style` fires 9 times in **one** file
— that row _is_ a single site, and reading it as a codebase-wide problem would
be the same error in miniature. The column tells you which is which.

## Six rules said nothing {#silence}

Six of fourteen produced zero: `required-attributes`, `react-class-to-hooks`,
`no-default-test-id`, `no-is-prefix-prop`, `no-kind-prop-discriminator`,
`no-wrapper-sub-component`.

A zero is not a verdict on the rule. It is a statement about your code — and
distinguishing "this rule is dead" from "this rule is waiting" takes seconds,
because every one of them ships invalid-case fixtures that prove it can fire.
All six have them. They are waiting.

## Run it on yours {#method}

The measurement is one `ESLint` instance and a counter, and two things about it
are load-bearing:

```js
const eslint = new ESLint({
  overrideConfigFile: true,
  overrideConfig: [{ files: ['**/*.tsx'], plugins: { 'react-features': plugin }, rules }],
  cwd: targetDir,          // else every file is "outside of base path"
});
const files = execSync(`find ${targetDir} -name '*.tsx'`, { encoding: 'utf8' })
  .split('\n').filter(Boolean);   // a glob returned zero here
for (const r of await eslint.lintFiles(files)) {
  const fatal = r.messages.filter((m) => !m.ruleId);
  if (fatal.length) console.log('FATAL', r.filePath, fatal[0].message); // never skip these
}
```

My first run reported **0 findings on 100 files** and all fourteen rules
zero-yield. It was wrong in the most comfortable direction. `cwd` defaulted to
the plugin repo, so ESLint ignored every file as outside its base path — and
the loop discarded any message with a null `ruleId`, which is exactly where
that explanation was written.

What caught it was a canary: a four-line component with an inline arrow and an
inline style, which _must_ trip at least two rules. It reported zero. Nothing
from that harness was believed until the canary reported six.

Before you trust a lint number, make the tool fail on purpose.

::install-command{package="eslint-plugin-react-features" dev}
::

_[eslint-plugin-react-features](https://www.npmjs.com/package/eslint-plugin-react-features) is part of the [Interlace ESLint ecosystem](https://eslint.interlace.tools). Source on [GitHub](https://github.com/ofri-peretz/eslint) · Follow: [Dev.to/ofri-peretz](https://dev.to/ofri-peretz)_

_What does your top rule's file count look like — one habit, or one file?_
