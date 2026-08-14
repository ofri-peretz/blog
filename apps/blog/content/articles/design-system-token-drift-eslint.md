---
title: "I Linted My Own Design System. All 8 Breaks Were Pasted In."
description: "I ran four design-system rules over 401 of my own components. 144 violations — and every color break was in code I pasted in."
slug: "design-system-token-drift-eslint"
canonical_url: "https://ofriperetz.dev/articles/design-system-token-drift-eslint"
cover_image: "https://ofriperetz.dev/cdn/blog-cover-image/design-system-token-drift-eslint.jpg"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/design-system-token-drift-eslint-og.jpg"
tier: "T3"
reading_time_minutes: 4
tags:
  - "react"
  - "webdev"
  - "eslint"
  - "css"
series: null
author:
---

Your design system has tokens. Your linter does not know they exist.

`eslint-plugin-react` has 104 rules and not one of them can tell you that `#ffffff1f` should have been `var(--surface-highlight)`. That gap is invisible in review, because a hex value in a `className` looks exactly like every other string.

So I ran four rules over my own code: 401 `.tsx` files across a design system, a docs site, a blog, and a control-room app. **144 violations in 50 files.** The design system defines **192 tokens**. It also breaks them.

---

## Raw color literals: 30 findings, and they cluster {#raw-color}

The rule is [`no-raw-color-literal`](https://github.com/ofri-peretz/eslint/blob/main/packages/eslint-plugin-react-features/docs/rules/component-api/no-raw-color-literal.md) — any hex, `rgb()`, or `rgba()` in JSX source.

```tsx
// packages/ui/src/effects/shimmer-button.tsx:102
"rounded-2xl px-4 py-1.5 text-sm font-medium shadow-[inset_0_-8px_10px_#ffffff1f]"
```

```text
⚠️ Raw color literal in source — use a design token (R19) | MEDIUM
 Fix: Replace with a CSS custom property (var(--your-token)) or a Tailwind
      theme class wired to it.
```

**Why this survives review:** the hex is inside an arbitrary Tailwind value inside a class string. A reviewer scanning for color changes greps for `color` or `bg-`. Nobody greps for `#`.

Here is the part I did not expect. The design system package had **8** of these, and all 8 were in `ambient/`, `effects/`, and `patterns/` — components I pasted in from component galleries. The core primitives had **zero**.

The system didn't drift. It leaked at the seam where other people's code came in.

## `data-slot`: 67 findings, the biggest by far {#data-slot}

```text
⚠️ JSX element has data-testid but no data-slot (R6) | MEDIUM
```

[`require-data-slot`](https://github.com/ofri-peretz/eslint/blob/main/packages/eslint-plugin-react-features/docs/rules/component-api/require-data-slot.md) fires when an element carries a `data-testid` but no `data-slot`. Both are hooks; only one is a contract. A `data-testid` says "a test grabs this." A `data-slot` says "consumers may style this." Ship the first without the second and every consumer targets your test IDs, and your next refactor breaks their CSS.

67 of my 144 findings were this one rule. It is the least dramatic and the most expensive — a `data-testid` standing in for a styling contract is a [proxy metric](https://ofriperetz.dev/articles/proxy-metrics) with a refactor bill attached.

## The pattern {#pattern}

A design system fails at its boundaries, not its center. The primitives I wrote while thinking about tokens obey them. The components I imported while thinking about *shipping* do not — and they arrive pre-broken, which means no diff ever shows the moment the violation entered.

That is why this has to be a lint rule and not a review convention. Review catches what a diff shows. Pasted code shows up as one clean green addition.

## The config

```js
// eslint.config.mjs
import reactFeatures from "eslint-plugin-react-features";

export default [
  {
    files: ["**/*.tsx"],
    plugins: { "react-features": reactFeatures },
    rules: {
      "react-features/no-raw-color-literal": "error",
      "react-features/no-arbitrary-token-class": "error",
      "react-features/require-data-slot": "warn",
      "react-features/no-inline-style": "warn",
    },
  },
];
```

```bash
npm i -D eslint-plugin-react-features
```

[`eslint-plugin-react-features` on npm](https://www.npmjs.com/package/eslint-plugin-react-features) · [all four rule docs](https://github.com/ofri-peretz/eslint/tree/main/packages/eslint-plugin-react-features/docs/rules/component-api)

Start the last two at `warn`. On a codebase that has never had these rules, `require-data-slot` alone will be your largest number, and turning it red on day one just teaches people to disable it.

An honest caveat: 47 of this plugin's 61 rules overlap `eslint-plugin-react` by name. These four do not — nothing in the incumbent enforces a token system, because the incumbent cannot know what your tokens are.

---

Source at [github.com/ofri-peretz/eslint](https://github.com/ofri-peretz/eslint). Every number here came from a run on 2026-08-11 against the four repos named above — four repos I own, which is a sample of one opinion about components, not [a ground-truth corpus](https://ofriperetz.dev/articles/how-to-design-a-ground-truth-corpus). I ran my own rule over my own code and reported what it found, which is [the only version of benchmarking I trust myself to do](https://ofriperetz.dev/articles/i-built-what-i-benchmark-heres-how-i-try-not-to-cheat). Re-run it on yours and you will get different numbers.

_Run one of these on your own components — what's your `data-slot` number? Mine was 67, and I wrote the rule._
