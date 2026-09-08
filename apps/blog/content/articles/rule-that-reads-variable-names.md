---
title: "Rename the Variable, Change the Security Verdict"
description: "One of my own rules flags a Zod schema containing no XPath, and stays silent on textbook XPath injection. Both come from the same heuristic: it decides whether a value is attacker-controlled by substring-matching the variable's name."
slug: "rule-that-reads-variable-names"
published: false
canonical_url: "https://ofriperetz.dev/articles/rule-that-reads-variable-names"
cover_image: "https://ofriperetz.dev/cdn/blog-cover-image/rule-that-reads-variable-names.jpg"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/rule-that-reads-variable-names-og.jpg"
tier: "T3"
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
  spec: sdlc/spec/rule-that-reads-variable-names.md
  lenses:
    growth_hook: 9.6
    security_correctness: 9.8
    structure_framing_voice: 9.5
    compatibility: 9.5
    reproducibility: 9.8
---

Four lines, run through my own XPath injection rule today:

```ts
xpath.select("//user[@id='" + id     + "']", doc);   // silent
xpath.select("//user[@id='" + userId + "']", doc);   // FIRES

export const QueryValidateSchema = QueryInputSchema; // FIRES
export const SchemaA             = SchemaB;          // silent
```

The first two are the same vulnerability. The last two are the same statement.
The only thing that changed is what the variables are called.

## The heuristic {#heuristic}

`no-xpath-injection` has to decide whether a value is attacker-controlled. Here
is how it decides:

```js
const varName = inputNode.name.toLowerCase();
if (["req", "request", "query", "params", "input", "user", "search"]
      .some((keyword) => varName.includes(keyword))) {
  return true;   // tainted
}
```

That is the whole test. Not where the value came from — what it is spelled.

## Both errors, one cause {#both}

**The false positive.** `QueryInputSchema` lowercases to `queryinputschema`,
which contains `query` and also `input`. Tainted. There is no XPath call in
that statement at all — it is a Zod schema being re-exported. The rule reports
an injection risk on an assignment.

**The false negative.** `id` contains none of the seven substrings, so the
value is not tainted, so a concatenation flowing into `xpath.select` — a sink
this rule already recognises, it is in the default `xpathFunctions` list — is
not reported. Textbook XPath injection, silently accepted.

The `//user[...]` string does contain `user`. It does not matter: the check
runs on the identifier, never on the literal.

One predicate, opposite failures. That is what makes this a single defect
rather than two bugs that happen to share a file.

## Why this is worse than being wrong {#worse}

A rule with a 70% false-positive rate is annoying and legible — you read the
findings, you see the noise, you tune it or drop it.

This is not that. This rule is **right about the shape of the problem** and
wrong about the input to it, which means its errors correlate with naming
conventions rather than with code. A codebase that says `userInput` gets
flagged everywhere. A codebase that says `val`, `x`, `raw` or `id` gets a clean
report and the same vulnerabilities.

Two teams, identical risk, opposite verdicts — and neither has any way to tell
from the output which one they are.

It also fails toward silence in exactly the case that matters. Short, neutral
identifiers are what you find in the compact, clever code most likely to be
doing something sharp with strings.

## What it should read instead {#fix}

The value's origin, not its spelling. Did it come from a request handler
parameter, a `process.argv`, a `req.*` member, a function boundary the rule
cannot see past? That is
[taint analysis](https://ofriperetz.dev/articles/taint-vs-heuristic-detection),
and it is more expensive than a substring match — which is precisely why the
substring match was written.

The honest framing is that this rule is a heuristic wearing a taint rule's
messaging. The fix is not a longer keyword list. A longer list moves the
boundary; it does not stop the verdict being a function of names.

## The check that finds these {#check}

Take any rule you rely on. Write the vulnerable case. Then **rename every
identifier in it to a single letter** and run it again.

If the verdict changes, the rule is reading names. You now know something about
your tooling that no amount of reading its findings would have told you —
because a finding you never get is indistinguishable from a clean file, and
[precision and recall measured on a corpus that shares your naming conventions
will both look fine](https://ofriperetz.dev/articles/precision-recall-f1-for-static-analysis).
It is the same reason [a labelled fixture set catches what unit tests
miss](https://ofriperetz.dev/articles/what-ground-truth-caught-that-unit-tests-missed):
the tests assert the rule's behaviour on the names its author chose.

This is a known class in our own tracker, with a lint check that gates new
occurrences and a documented list of the ones still outstanding. This rule is
on that list. Measured against the workspace build of
[`eslint-plugin-secure-coding`](https://www.npmjs.com/package/eslint-plugin-secure-coding)
today — if you are on the published release, re-run before assuming.

The rule is
[`no-xpath-injection`](https://github.com/ofri-peretz/eslint/blob/main/packages/eslint-plugin-secure-coding/docs/rules/no-xpath-injection.md);
the predicate is in
[its source](https://github.com/ofri-peretz/eslint/tree/main/packages/eslint-plugin-secure-coding/src/rules/no-xpath-injection).
Both are open, which is the only reason this article can be specific.

::dev-to-cta{url="https://github.com/ofri-peretz/eslint"}
⭐ Star the repo if you would rather find your linter's blind spots in an article than in an incident.
::

_[eslint-plugin-secure-coding](https://www.npmjs.com/package/eslint-plugin-secure-coding) is part of the [Interlace ESLint ecosystem](https://eslint.interlace.tools). Source on [GitHub](https://github.com/ofri-peretz/eslint) · Follow: [Dev.to/ofri-peretz](https://dev.to/ofri-peretz)_

_Rename the variables in your worst file to single letters. Does your linter still find the bug?_
