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

**Why this survives review forever:** there is no bug to find. A reviewer's job is to reject _broken_ code, and none of this is broken. `arr[arr.length - 1]` is correct in every runtime that ever existed. The only thing that can flag it is a tool that knows what year it is.

## The two that found nothing {#the-silent-two}

`no-instanceof-array` and `prefer-event-target` returned **0 findings across all 389 files**.

I report that because the number is the point. A rule that never fires is not broken and not useless — it is a rule for a pattern you do not have. `instanceof Array` breaks across realms; if you have never hit it, silence is the correct output. The failure mode to fear is the opposite, a rule that fires on everything: I have one elsewhere that flags every `.map()` in JSX, 476 findings of noise. **Yield tells you nothing about quality on its own** — which is the same trap as [counting rules instead of measuring them](https://ofriperetz.dev/articles/precision-recall-f1-for-static-analysis).

## Lint as codemod, not as style {#codemod}

Most lint rules ask you to _decide_ something. These ask you to _apply_ something — the rewrite is mechanical, the semantics are identical, and the fixer is exact.

That changes the adoption path. You do not triage 55 findings — you run the fixer once, read the diff as a single commit, and the rule then holds the line so the old idiom cannot come back. A one-time migration plus a ratchet, the same shape as [an autofix turning a hardcoded secret into a one-command repair](https://ofriperetz.dev/articles/hardcoded-secrets-ai-agents-autofix).

Check the diff, though. "Auto-fixable" means exact, not invisible: `.at(-1)` is ES2022, so it needs a runtime that has it. Node 18+ and any 2023+ browser are fine; on an older target, check your polyfill first.

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

Measured against **3.1.2**, peer range `^8.40.0 || ^9.0.0 || ^10.0.0`, Node 18+. `prefer-template-literal` does not exist before 3.x, so an older install rejects the config rather than silently skipping the rule. ESLint only; no Oxlint port.

All four at `error` is safe _for these findings_, but be precise about why: in 3.1.2 only `prefer-at` and `prefer-template-literal` carry a fixer. All 55 of my findings came from those two, which is why `--fix` emptied the list — not because the plugin is 100% auto-fixable. Check it yourself:

```bash
npx eslint --print-config path/to/file.ts    # or read meta.fixable on the rule
```

[Rule docs](https://github.com/ofri-peretz/eslint/tree/main/packages/eslint-plugin-modernization/docs/rules) · [npm](https://www.npmjs.com/package/eslint-plugin-modernization).

---

Numbers measured 2026-08-12 against four repos I own — my code, not a public corpus, so treat 55 as a shape, not a rate.

Re-run 2026-09-04 over the 189 `.ts`/`.tsx` files in this blog's public `apps/blog/src`, plugin at 3.1.2: **8 findings in 6 files** — six `prefer-at`, two `prefer-template-literal`, the other two rules still silent. Three weeks after the codemod, the old idiom had crept back eight times. That is the argument for leaving the rules at `error` instead of treating this as a one-time migration.

Two guards on that number. The harness reports `unmatched: 0`, so all 189 files were actually configured — an earlier run returned a confident **0** that was 189 files silently matching no config. And on the same tree that day, the noisy rule above returns **110**. Eight versus 110 on identical input: yield is not quality.

_What's the oldest idiom still alive in your codebase — and is it there because it's correct, or because nothing ever flagged it?_
