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
for (const a of accrual[accrual.length - 2].articles) { /* … */ }

// after --fix
const latest = baseline.at(-1) ?? null;
for (const a of accrual.at(-2).articles) { /* … */ }
```

`prefer-template-literal` — 44 findings, the bulk of them:

```ts
// before
String(res.stderr || res.stdout || "claude exited " + res.status)

// after --fix
String(res.stderr || res.stdout || `claude exited ${res.status}`)
```

**Why this survives review forever:** there is no bug to find. A reviewer's job is to reject *broken* code, and none of this is broken. `arr[arr.length - 1]` is correct in every runtime that has ever existed. So the only thing that could flag it is a tool that knows what year it is.

## The two that found nothing {#the-silent-two}

`no-instanceof-array` and `prefer-event-target` returned **0 findings across all 389 files**.

I am reporting that because the number is the point. A rule that never fires on your codebase is not a broken rule and it is not a useless one — it is a rule for a pattern you do not have. `instanceof Array` breaks across realms (iframes, worker boundaries); if you have never hit it, you get silence, which is the correct output.

The failure mode to actually fear is the opposite: a rule that fires on everything. I have one in another plugin that flags every `.map()` in JSX — 476 findings, all noise. **Yield tells you nothing about quality on its own.** Zero can be right and 476 can be wrong.

## Lint as codemod, not as style {#codemod}

Most lint rules ask you to *decide* something. These ask you to *apply* something — the rewrite is mechanical, the semantics are identical, and the fixer is exact.

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
npm i -D eslint-plugin-modernization
npx eslint . --fix
```

All four at `error` from day one — unusually, that is safe here, because a rule whose findings are 100% auto-fixable cannot leave you with a backlog. [Rule docs](https://github.com/ofri-peretz/eslint/tree/main/packages/eslint-plugin-modernization/docs/rules) · [npm](https://www.npmjs.com/package/eslint-plugin-modernization).

---

Numbers measured 2026-08-12 against four repos I own — my own code, not a public corpus, so treat 55 as a shape rather than a rate. Re-run it on yours and the split between the two rules will be different.

_What's the oldest idiom still alive in your codebase — and is it there because it's correct, or because nothing ever flagged it?_
