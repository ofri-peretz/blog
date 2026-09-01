---
title: "Your ESLint Plugin Installs 205 Packages. 69 Are ESLint."
description: "I measured the install tree of 11 ESLint plugins. Direct dependency counts predict almost nothing, and every raw number hides the same 69-package baseline."
slug: "eslint-plugin-dependency-weight"
published: false
canonical_url: "https://ofriperetz.dev/articles/eslint-plugin-dependency-weight"
cover_image: "https://ofriperetz.dev/cdn/blog-cover-image/eslint-plugin-dependency-weight.jpg"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/eslint-plugin-dependency-weight-og.jpg"
tier: "T3"
reading_time_minutes: 4
tags:
  - "javascript"
  - "webdev"
  - "eslint"
  - "node"
series: null
author:
---

`npm i -D eslint-plugin-import` installs **205 packages**.

That number is true and almost useless, which is the problem with every dependency-weight argument I have read. **69 of those packages are ESLint itself.** Since npm 7, peer dependencies install automatically, so any plugin declaring `eslint` as a peer drags the entire linter into the count — and every plugin should declare it that way.

So I measured the baseline first, then subtracted it.

---

## What each plugin actually adds {#the-numbers}

Resolved with `npm install --package-lock-only` into an empty project, one plugin at a time, on 2026-08-12. Bare `eslint` alone resolves to **69 packages** — that is the zero point.

| plugin | tree | adds | direct deps |
|---|---|---|---|
| eslint-plugin-import | 205 | **136** | 19 |
| eslint-plugin-react | 204 | **135** | 18 |
| eslint-plugin-jsx-a11y | 194 | **125** | 15 |
| eslint-plugin-unicorn | 110 | 41 | 20 |
| eslint-plugin-sonarjs | 83 | 14 | 13 |
| eslint-plugin-n | 80 | 11 | 8 |
| eslint-plugin-promise | 70 | **1** | 1 |

Now look at the two columns on the right together, because they do not agree.

`eslint-plugin-promise` declares **one** direct dependency and adds **one** package. `eslint-plugin-unicorn` declares **twenty** and adds 41. `eslint-plugin-sonarjs` declares 13 and adds 14. But `eslint-plugin-import` declares 19 and adds **136** — seven per declared dependency, because its dependencies have dependencies.

**Direct dependency count does not predict install weight.** It is the number people quote, including me before I measured it, because it is the one visible on the npm page without resolving anything.

## The number you actually install {#combined}

Nobody installs one plugin. A conventional React setup:

```bash
npm i -D eslint eslint-plugin-react eslint-plugin-jsx-a11y eslint-plugin-import
```

**228 packages.** Not 69 + 135 + 125 + 136 — the trees overlap heavily and npm dedupes them, so the sum is far less than the parts. That is the other half of why per-plugin numbers mislead: they are neither additive nor independent.

## Where mine land {#ours}

I maintain a plugin suite, so here is my own row, measured identically:

| plugin | tree | adds | direct deps |
|---|---|---|---|
| eslint-plugin-react-features | 71 | **2** | 1 |
| eslint-plugin-modernization | 71 | **2** | 1 |
| eslint-plugin-browser-security | 71 | **2** | 1 |
| eslint-plugin-import-next | 97 | 28 | 2 |

Two packages: one shared internal toolkit, which itself has zero dependencies, plus the plugin. `import-next` adds 28 because it carries a real resolver — [that is the trade it makes for being much faster](https://ofriperetz.dev/articles/eslint-plugin-import-vs-eslint-plugin-import-next-up-to-100x-faster).

I am not the leanest here and I want to be precise about that: **`eslint-plugin-promise` adds one package and I add two.** If dependency weight is your only axis, promise wins.

One more honest reading of the table. `eslint-plugin-security` resolves to **3 packages total** — the smallest number on this page by a wide margin. It does not declare `eslint` as a peer dependency at all, which is why the 69-package baseline never appears, and it is [the plugin I have argued elsewhere is unmaintained](https://ofriperetz.dev/articles/eslint-plugin-security-is-unmaintained-heres-what-nobody-tells-you-96h). A small tree is not a proxy for a healthy package. It can just mean the package stopped changing.

## How to check yours {#method}

```bash
mkdir /tmp/w && cd /tmp/w && npm init -y >/dev/null
npm i --package-lock-only <plugin>
node -e "console.log(Object.keys(require('./package-lock.json').packages).filter(k=>k.startsWith('node_modules/')).length)"
```

`--package-lock-only` resolves the graph without downloading anything, so it runs in about a second. Measure bare `eslint` first, subtract, and compare like with like. Then measure the union you actually install, because that is the only number that reaches your `node_modules`.

---

Every figure above was resolved on 2026-08-12 and will drift as these packages release. Re-run the four lines above rather than citing mine.

_Run it on your config — what's the gap between the packages you asked for and the packages you got?_
