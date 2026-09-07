---
title: "Six Rules Found Nothing. Only Five of Them Were Waiting."
description: "A lint rule sitting at zero is one of three different things, and reading the rule list will not tell you which. Asking each rule to fire on its own test fixture takes ten seconds — and on six silent rules it found one that could never have fired at all."
slug: "zero-yield-rules-dead-or-waiting"
published: false
canonical_url: "https://ofriperetz.dev/articles/zero-yield-rules-dead-or-waiting"
cover_image: "https://ofriperetz.dev/cdn/blog-cover-image/zero-yield-rules-dead-or-waiting.jpg"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/zero-yield-rules-dead-or-waiting-og.jpg"
tier: "T3"
reading_time_minutes: 4
tags:
  - "javascript"
  - "eslint"
  - "webdev"
  - "testing"
series: null
author:
quality:
  panel_version: "1.0.0"
  reviewed: "2026-09-07"
  spec: sdlc/spec/zero-yield-rules-dead-or-waiting.md
  lenses:
    growth_hook: 9.5
    security_correctness: 9.7
    structure_framing_voice: 9.5
    compatibility: 9.6
    reproducibility: 9.7
---

I measured fourteen lint rules against a real codebase. Six found nothing.

The tempting move is to switch those six off. The report says zero, zero looks
like dead weight, and a shorter config is easier to defend. That instinct is
wrong at least five times out of six, and here is the ten-second check that
tells you which.

## A zero is three different facts {#three}

**Dead.** The rule cannot fire. A regression, a bad selector, an AST assumption
that stopped being true. It will report zero on every codebase forever and
nobody will notice, because zero is what a working rule looks like too.

**Waiting.** The rule can fire; your code does not contain the pattern. This is
the correct output and the rule is earning its keep as a ratchet — silent now,
loud the day someone writes the thing.

**Unconfigured.** The rule can fire, but not until you give it options. Silent
on every codebase, including the ones full of exactly what it was built to
catch.

The report renders all three as `0`. The rule list does not distinguish them
either.

## Ask the rule to fire {#ask}

You do not have to reason about which case you are in. Every rule worth using
ships `invalid` test fixtures — the smallest piece of code its author swears it
must flag. Take one and lint it:

```js
const eslint = new ESLint({
  overrideConfigFile: true,
  cwd: '/tmp',                                   // else: "outside of base path"
  overrideConfig: [{ files: ['**/*.tsx'],
    languageOptions: { parser: tsParser },       // @typescript-eslint/parser
    plugins: { 'react-features': plugin },
    rules: { 'react-features/no-is-prefix-prop': 'error' } }],
});
const [res] = await eslint.lintText(
  'interface Props { isLooped: boolean; }',
  { filePath: '/tmp/t.tsx' },
);
console.log(res.messages);
```

The parser line is not optional. Most of the fixtures below are `interface`
declarations, and the default parser cannot read them — you get a fatal parse
error where you expected the rule's verdict, and a message whose `ruleId` is
`null`. Print those; never skip them.

Fires: the rule works, your code is clean, keep it. Silent: you have learned
something the report could not tell you.

## What it found {#found}

Five of the six fired immediately:

| rule | fixture |
| --- | --- |
| `react-class-to-hooks` | `class MyComponent extends Component { }` |
| `no-default-test-id` | `function Card({ "data-testid": d = "card" })` |
| `no-is-prefix-prop` | `interface Props { isLooped: boolean; }` |
| `no-kind-prop-discriminator` | `interface Props { type: "checkbox" \| "radio" }` |
| `no-wrapper-sub-component` | `function MyButton(props) { <Button {...props} /> }` |

Waiting, all five. The codebase genuinely has none of it.

The sixth did not. `required-attributes` stayed silent on `<Button />` — its
own fixture, at `error`, with nothing else enabled.

## The one that could not fire {#unconfigured}

Reading its test file explains it:

```js
{
  code: '<Button />',
  options: [{ attributes: [{ attribute: 'type' }] }],   // ← the part that matters
}
```

The rule takes its attribute list from configuration. Without options there is
nothing it has been asked to require, so it correctly does nothing. Supply the
options and the same fixture reports one error.

That is not a bug. It is worse than a bug in one specific way: **a bug gets
noticed.** This rule sits in a config, at `error`, looking enabled, and reports
zero on every codebase in the world — including one that violates it on every
line. The report cannot distinguish that from success.

Five waiting, one unconfigured, none dead. I would have guessed a different
split, and switching off "the six that found nothing" would have thrown away
five working ratchets and left the one real problem in place.

## The habit {#habit}

Before you delete a rule for being quiet, make it speak. If it will not, you
have found something more interesting than a finding.

The same instinct applies one level up: a lint run that reports zero is not
evidence that a tool ran. A harness of mine once reported 0 findings across 100
files because every file was silently ignored — a perfectly believable number,
and completely false. Zero is the one output that looks identical whether
everything worked or nothing did, which is why
[a count means nothing without the measurement behind it](https://ofriperetz.dev/articles/precision-recall-f1-for-static-analysis)
and why [an aggregate hides the distribution that produced it](https://ofriperetz.dev/articles/aggregate-benchmarks-lie-heres-what-700-ai-functions-look-like-by-security-domain).

::install-command{package="eslint-plugin-react-features" dev}
::

_[eslint-plugin-react-features](https://www.npmjs.com/package/eslint-plugin-react-features) is part of the [Interlace ESLint ecosystem](https://eslint.interlace.tools). Source on [GitHub](https://github.com/ofri-peretz/eslint) · Follow: [Dev.to/ofri-peretz](https://dev.to/ofri-peretz)_

_Which rule in your config has never once fired — and have you ever asked it to?_
