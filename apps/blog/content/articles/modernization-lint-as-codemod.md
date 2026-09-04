---
title: "55 Places My Code Predates the Language. All Auto-Fixed."
description: "Four rules over 389 of my own files found 55 spots written the pre-2022 way. Every one carried a fixer, so the whole thing was one command."
slug: "modernization-lint-as-codemod"
published: false
canonical_url: "https://ofriperetz.dev/articles/modernization-lint-as-codemod"
cover_image: "https://ofriperetz.dev/cdn/blog-cover-image/modernization-lint-as-codemod.jpg"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/modernization-lint-as-codemod-og.jpg"
tier: "T3"
reading_time_minutes: 4
tags:
  - "javascript"
  - "webdev"
  - "typescript"
  - "eslint"
series: null
author:
quality:
  panel_version: "1.0.0"
  reviewed: "2026-09-04"
  spec: sdlc/spec/modernization-lint-as-codemod.md
  lenses:
    growth_hook: 9.6
    security_correctness: 9.6
    structure_framing_voice: 9.7
    compatibility: 9.6
    reproducibility: 9.6
---

```ts
const latest = baseline[baseline.length - 1] ?? null;
```

Nothing is wrong with that line. It passes review, ships, and works. It is also how you wrote JavaScript before 2022, and I have written it a thousand times since.

I ran four modernization rules over **389 `.ts`/`.tsx` files** across four of my own repos. **55 findings in 36 files** — and every single one carried an autofix. After `--fix`, the remaining count was **zero**.

---

## The two that fired {#the-two}

`prefer-at` — 11 findings. The end-of-array idiom, mechanically rewritten:

```ts
// before
const latest = baseline[baseline.length - 1] ?? null;
for (const a of accrual[accrual.length - 2].articles) {
  /* … */
}

// after --fix
const latest = baseline.at(-1) ?? null;
for (const a of accrual.at(-2).articles) {
  /* … */
}
```

`prefer-template-literal` — 44 findings, the bulk of them:

```ts
// before
String(res.stderr || res.stdout || "claude exited " + res.status);

// after --fix
String(res.stderr || res.stdout || `claude exited ${res.status}`);
```

**Why this survives review forever:** there is no bug to find. A reviewer's job is to reject _broken_ code, and none of this is broken. `arr[arr.length - 1]` is correct in every runtime that has ever existed. So the only thing that could flag it is a tool that knows what year it is.

## The two that found nothing {#the-silent-two}

`no-instanceof-array` and `prefer-event-target` returned **0 findings across all 389 files**.

I am reporting that because the number is the point. A rule that never fires on your codebase is not a broken rule and it is not a useless one — it is a rule for a pattern you do not have. `instanceof Array` breaks across realms (iframes, worker boundaries); if you have never hit it, you get silence, which is the correct output.

The failure mode to actually fear is the opposite: a rule that fires on everything. I have one in another plugin — `react-features/react-no-inline-functions` — that flags every `.map()` in JSX, because an arrow inside JSX is an inline function whether or not it is a render-perf problem. 476 findings, all noise. **Yield tells you nothing about quality on its own.** Zero can be right and 476 can be wrong.

## Lint as codemod, not as style {#codemod}

Most lint rules ask you to _decide_ something. These ask you to _apply_ something — the rewrite is mechanical, the semantics are identical, and the fixer is exact.

That makes the adoption path different from a normal rule. You do not triage 55 findings. You run the fixer once, read the diff as a single commit, and from then on the rule holds the line so the old idiom cannot come back. It is a one-time migration plus a ratchet, in the same way [an autofix turns a hardcoded secret into a one-command repair](https://ofriperetz.dev/articles/hardcoded-secrets-ai-agents-autofix) rather than a ticket.

Check the diff, though. "Auto-fixable" means the fixer is exact, not that the change is invisible: `.at(-1)` returns `undefined` on an empty array exactly like `arr[arr.length - 1]` does, but it is an ES2022 method, so it needs a runtime that has it. On Node 18+ or any 2023+ browser you are fine. On a build targeting older environments, check your polyfill before you commit the diff.

## The config

```js
// eslint.config.mjs
import modernization from "eslint-plugin-modernization";

export default [
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: { modernization },
    rules: {
      "modernization/prefer-at": "error",
      "modernization/prefer-template-literal": "error",
      "modernization/no-instanceof-array": "error",
      "modernization/prefer-event-target": "error",
    },
  },
];
```

```bash
npm  install --save-dev eslint-plugin-modernization   # npm
yarn add     --dev      eslint-plugin-modernization   # yarn
pnpm add     --save-dev eslint-plugin-modernization   # pnpm
bun  add     --dev      eslint-plugin-modernization   # bun

npx eslint . --fix
```

Measured against **3.1.2**, whose peer range is `^8.40.0 || ^9.0.0 || ^10.0.0` — ESLint 8 (eslintrc), 9 and 10 (flat) all work, on Node 18 or newer. Version matters more than usual here: `prefer-template-literal` does not exist before 3.x, so an older install will reject the config above rather than silently skip the rule. There is no Oxlint port of this plugin; it runs on ESLint only.

All four at `error` from day one is safe _for these findings_, but be precise about why. In 3.1.2 only `prefer-at` and `prefer-template-literal` carry a fixer; `no-instanceof-array` and `prefer-event-target` report without one. Every one of my 55 findings came from the two fixable rules, which is why `--fix` emptied the list — not because the plugin is 100% auto-fixable. If the other two ever fire on your code, they are ordinary findings and you will triage them by hand. Check it yourself:

```bash
npx eslint --print-config path/to/file.ts    # or read meta.fixable on the rule
```

[Rule docs](https://github.com/ofri-peretz/eslint/tree/main/packages/eslint-plugin-modernization/docs/rules) · [npm](https://www.npmjs.com/package/eslint-plugin-modernization).

---

Numbers measured 2026-08-12 against four repos I own — my own code, not a public corpus, so treat 55 as a shape rather than a rate. Re-run it on yours and the split between the two rules will be different.

Re-run on 2026-09-04 over the 189 `.ts`/`.tsx` files in this blog's `apps/blog/src` — the one of those repos that is public — with the plugin at 3.1.2: **8 findings in 6 files**, six `prefer-at` and two `prefer-template-literal`, with the other two rules still silent. Three weeks after the codemod ran, the old idiom had crept back eight times. That is the argument for leaving the rules on at `error` rather than treating this as a one-time migration, and it is a better result than the clean zero I expected.

Two guards on that number, because a count means nothing without them. The harness reports `unmatched: 0`, so every one of the 189 files was actually configured — an earlier run of mine returned a confident **0** that turned out to be 189 files silently matching no config at all. And on the same tree the same day, `react-features/react-no-inline-functions` — the rule I called noise above — returns **110**. Eight versus 110 on identical input is the whole point: yield is not quality.

_What's the oldest idiom still alive in your codebase — and is it there because it's correct, or because nothing ever flagged it?_
