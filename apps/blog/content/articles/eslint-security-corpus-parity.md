---
title: "I Ran My Plugins Against a Competitor's Own Test Suite"
description: "eslint-plugin-security ships its tests. I ran 84 of its own vulnerable samples through my plugins: 51 caught, and 29 of the 33 misses are one obsolete rule."
slug: "eslint-security-corpus-parity"
published: false
canonical_url: "https://ofriperetz.dev/articles/eslint-security-corpus-parity"
cover_image: "https://ofriperetz.dev/cdn/blog-cover-image/eslint-security-corpus-parity.jpg"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/eslint-security-corpus-parity-og.jpg"
tier: "T3"
reading_time_minutes: 4
tags:
  - "security"
  - "javascript"
  - "webdev"
  - "eslint"
series: null
author:
---

Every "we replace X" claim in the linting space is unfalsifiable, including the ones I have made. The competitor's rules are a list on a README, so comparison collapses into counting rule names.

But [`eslint-plugin-security`](https://www.npmjs.com/package/eslint-plugin-security) ships its **test suite** inside the npm tarball. That is [a corpus](https://ofriperetz.dev/articles/how-to-design-a-ground-truth-corpus): 84 code samples its authors wrote specifically to be caught — and a corpus someone else wrote is the only kind that can embarrass you, which is [the whole problem with benchmarking your own tool](https://ofriperetz.dev/articles/i-built-what-i-benchmark-heres-how-i-try-not-to-cheat).

So I stopped counting rules and ran their tests against my plugins.

---

## The method {#method}

Their tests use ESLint's `RuleTester`. Rather than parse samples out of the source, intercept the runner and collect them:

```js
const { RuleTester } = require("eslint");
const captured = [];
RuleTester.prototype.run = (name, rule, tests) => {
  for (const t of tests.invalid ?? []) captured.push(t.code ?? t);
};
for (const f of fs.readdirSync("node_modules/eslint-plugin-security/test/rules"))
  require(`.../test/rules/${f}`);
```

84 samples. Then lint each one twice — once with their plugin, once with mine — and count which ones produce at least one finding.

## The result {#result}

| | flags |
|---|---|
| eslint-plugin-security (on its own tests) | **71 / 84** |
| my plugins | **51 / 84** |

They win, and the honest headline is that I cover 61% of their corpus. But the distribution matters more than the total, because **29 of my 33 misses are a single rule**:

```
 29  detect-buffer-noassert
  1  detect-disable-mustache-escape
  1  detect-no-csrf-before-method-override
  1  detect-pseudoRandomBytes
  1  detect-unsafe-regex
```

Excluding that one rule, it is **51 of 55 — 93%**.

## The obsolete rule {#noassert}

`detect-buffer-noassert` flags `buf.readUInt8(0, true)`. The `noAssert` argument told Node to skip offset validation, so a read could run past the end of the buffer.

It was removed in Node 10. On Node 24:

```js
const b = Buffer.alloc(4);
b.readUInt8(0, true);   // extra argument ignored
b.readUInt8(99);        // still throws ERR_OUT_OF_RANGE
```

The parameter has done nothing for about seven years. Their rule still ships in `recommended`, and their suite tests it across 29 variants — every `read*` method — which is why one dead rule dominates the gap.

I am not claiming that is wrong of them. Removing a rule breaks configs, and the cost of keeping it is nearly zero. But it is the difference between "61% coverage" and "93% coverage of everything that can still bite you," and no rule-name comparison would ever surface it.

## What I catch that they miss {#reverse}

The reverse direction is the part I did not expect. Running their corpus through their own plugin leaves 13 samples unflagged, and my rules catch all 13:

```
  9  detect-non-literal-fs-filename
  4  detect-child-process
```

Those are their test cases, written for their rules, that their current implementation does not fire on. Combined, the two plugins flag **84 of 84** — every sample is caught by someone.

## Where I lose {#honest}

Corpus coverage is one criterion and it is the flattering one, so here is the criterion that is not.

On their curated samples my precision looks excellent, because every sample is a real vulnerability. Pointed at ordinary code, it is a different story: I ran my Node rules over 61 files of my own automation scripts last week and got **279 findings**, and every one I inspected was a false positive — a timing-attack warning on `if (key === -1)`, a zip-slip warning on a string literal. I have open fixes for those. A corpus benchmark cannot see them, because a corpus contains no boring code.

**Coverage and precision are different measurements, and a test suite only measures the first.** Anyone quoting one number at you is quoting the one that flatters them — that is [measurement bias](https://ofriperetz.dev/articles/bias-in-measurement) with a marketing budget. I just did it too: 93% is the number I would put on a slide.

## Run it yourself {#reproduce}

The whole thing is about 40 lines and no AI, no benchmark harness, no service. Any plugin that ships its tests can be measured this way, in both directions, in a few minutes.

Point it at mine: [`eslint-plugin-node-security`](https://www.npmjs.com/package/eslint-plugin-node-security) ships its tests too, and I would rather read your numbers than my own.

---

Measured 2026-08-12 against eslint-plugin-security 4.0.1 on ESLint 9.39.2, with my plugins under `@typescript-eslint/parser` (they are TypeScript-native; the default parser under-reports them by 13 samples). Related: [what ground truth caught that unit tests missed](https://ofriperetz.dev/articles/what-ground-truth-caught-that-unit-tests-missed), and [the maintenance question about this same plugin](https://ofriperetz.dev/articles/eslint-plugin-security-is-unmaintained-heres-what-nobody-tells-you-96h).

Source at [github.com/ofri-peretz/eslint](https://github.com/ofri-peretz/eslint) · packages at [npmjs.com/~ofriperetz](https://www.npmjs.com/~ofriperetz) · more at [dev.to/ofri-peretz](https://dev.to/ofri-peretz).

_If someone ran your test suite against a competitor, what would it show?_
