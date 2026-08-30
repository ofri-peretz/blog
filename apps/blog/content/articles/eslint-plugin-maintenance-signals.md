---
title: "The 3 Most-Installed ESLint Plugins Went Quiet in 2025"
description: "I measured days-since-release for 18 ESLint plugins. import, react and jsx-a11y have shipped nothing in over a year — and dormant is not the same as dead."
slug: "eslint-plugin-maintenance-signals"
published: false
canonical_url: "https://ofriperetz.dev/articles/eslint-plugin-maintenance-signals"
cover_image: "https://ofriperetz.dev/cdn/blog-cover-image/eslint-plugin-maintenance-signals.jpg"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/eslint-plugin-maintenance-signals-og.jpg"
tier: "T3"
reading_time_minutes: 4
tags:
  - "javascript"
  - "webdev"
  - "eslint"
  - "opensource"
series: null
author:
---

Pick the maintenance signal you can get in one second: **days since the last release.**

I pulled it from the npm registry for 18 ESLint plugins on 2026-08-12. The three with the deepest install base are the three that have gone quietest.

| plugin                 | days since release | releases in 12mo |
| ---------------------- | ------------------ | ---------------- |
| eslint-plugin-jsx-a11y | **655**            | 0                |
| eslint-plugin-react    | **495**            | 0                |
| eslint-plugin-import   | **417**            | 0                |
| eslint-plugin-promise  | 107                | 1                |
| eslint-plugin-security | 61                 | 2                |
| eslint-plugin-sonarjs  | 28                 | 9                |
| eslint-plugin-unicorn  | 8                  | 17               |
| eslint-plugin-n        | 3                  | 12               |
| eslint-plugin-jest     | 0                  | 35               |

Nine of the eighteen I measured shipped nothing at all in the last twelve months. Nearly two years of silence on the plugin that half the accessibility tooling in React depends on.

---

## Dormant is not dead {#dormant-vs-dead}

Before drawing the obvious conclusion, the honest caveat: **a plugin that stops releasing may simply be finished.** `jsx-a11y` encodes WAI-ARIA rules. ARIA does not change every quarter. A stable spec produces a stable plugin, and "no releases" is the correct output for a package with nothing left to do.

So days-since-release is a _prompt_, not a verdict. Three signals actually separate finished from abandoned, and all three are free:

**1. The npm deprecation flag.** `eslint-plugin-standard` carries one. That is the maintainer telling you directly, and it is machine-readable — no interpretation required.

**2. Supersession.** `eslint-plugin-node` last shipped 2,328 days ago — over six years — because it was replaced by `eslint-plugin-n`, which shipped 3 days ago. One of those numbers is alarming and the other explains it. A rename is invisible to anyone reading only the old package's page.

**3. Whether it still works on your ESLint.** This is the one that matters and the one nobody checks until it breaks. A plugin frozen before flat config became the default is not "stable," it is on a countdown.

## The genuinely dead tier {#dead}

Sorted by silence, these are the ones where no reading rescues the number:

```
eslint-plugin-scanjs-rules      3,296 days   (9 years)
eslint-plugin-node              2,328 days   superseded by eslint-plugin-n
eslint-plugin-standard          2,088 days   npm-deprecated
eslint-plugin-flowtype          1,748 days   Flow itself receded
eslint-plugin-xss               1,507 days
eslint-plugin-security-node       951 days
```

Every one of these still installs cleanly today. npm will not warn you, your lockfile will not warn you, and a config that references them keeps passing — because a plugin whose rules never fire looks exactly like a codebase with no problems. That is the same failure shape as [a CI check that was disabled rather than failing](https://ofriperetz.dev/articles/proxy-metrics): silence reads as success.

## The one that came back {#came-back}

`eslint-plugin-security` is the interesting row. It went **3.0.1 in June 2024 → nothing for 20 months → 4.0.0 in February 2026**, and shipped again in June. If you had measured it in January you would have called it abandoned, correctly, and been wrong by March.

That is why [a claim needs an expiry date rather than a verdict](https://ofriperetz.dev/articles/claims-registry-evidence-framework). "Unmaintained" is not a property of a package. It is a measurement with a date on it, and this one moved.

## Measure your own config

```bash
npm view <plugin> time.modified   # last publish, one line
```

Or resolve the whole set at once:

```bash
node -e "for (const p of require('./package.json').devDependencies ? Object.keys(require('./package.json').devDependencies) : []) \
  fetch('https://registry.npmjs.org/'+p).then(r=>r.json()).then(j=>console.log(p, j.time.modified.slice(0,10)))"
```

Then apply the three checks above to anything past a year. Most will be fine. The point is knowing which ones you are betting on — [`eslint-plugin-import` at 417 days is a dependency worth having an opinion about](https://ofriperetz.dev/articles/eslint-plugin-import-38m-downloads-heres-what-it-still-gets-wrong), given what it does on every lint run.

---

All figures resolved from the npm registry on 2026-08-12 and already drifting — `eslint-plugin-jest` was at 0 days when I measured it. Re-run the one-liner rather than citing mine.

_What's the oldest plugin in your lockfile — and did you know it before you looked?_
