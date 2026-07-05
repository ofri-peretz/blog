---
title: "I Maintain 23 Benchmark Suites Across My Own Packages. Only 1 of the Serverless Ones Has Real Numbers Yet."
description: "eslint-plugin-jwt gets scored on precision and recall against a labeled vulnerability corpus. My serverless caching plugin doesn't — and 3 of its 4 benchmark suites aren't built yet. Here's why that gap is honest, not an inconsistency."
slug: "different-metrics-for-different-package-types"
published: false
date: 2026-07-05
tags:
  - security
  - eslint
  - devsecops
  - node
canonical_url: https://ofriperetz.dev/articles/different-metrics-for-different-package-types
reading_time_minutes: 9
author:
  name: Ofri Peretz
  avatar: https://avatars.githubusercontent.com/u/46347627
  title: Security Engineering Leader
---

Five days earlier, an audit of my own ESLint plugins had found 140 files across my rules still calling `context.getFilename()`, `getSourceCode()`, and `getCwd()` — three APIs ESLint 10 removes outright, not merely deprecates. Every one of my packages claims "supports ESLint 8, 9, and 10." Nobody would have hit this on ESLint 9 — those calls still work there under compatibility shims — but the moment a user upgraded to 10, my own rules would have broken the exact claim printed in my own README. `eslint-plugin-security`, which I disqualify elsewhere on this site, fails earlier and differently: it crashes outright on ESLint 9's flat config, a distinct failure mode from mine. Different bug, same root cause — a version-compatibility claim nobody had actually tested against the version in question.

A version-compatibility fixture caught mine before a user did. A blended "code quality score" never would have — a passing quality score and a runtime crash on `npm install` are two different failures, and no single number covers both. That's the actual argument for what follows: `eslint-plugin-jwt` gets scored on precision and recall against a labeled vulnerability corpus. My serverless caching plugin doesn't — and right now, three of its four benchmark suites don't have real numbers in them at all. Here's why that's the correct amount of measurement for what each package actually is, not a gap to paper over.

If you maintain anything with a "supports version X, Y, Z" claim in its README, the fastest way to check whether that claim is still true is to actually run your test suite against each version in a matrix, not to read the changelog and assume:

```bash
npx eslint --version && npx eslint . --no-eslintrc  # smoke-test under the installed version first
```

---

## The two frameworks, named and linked

I run two separate, public benchmark stacks — neither is a private doc I'm describing from memory:

- **ILB (Interlace Lint Bench)** — [`eslint/benchmarks/`](https://github.com/ofri-peretz/eslint/tree/main/benchmarks), 23 suites, covers all 20 ESLint plugins.
- **`@interlace/serverless-benchmarks`** — [`serverless/benchmarks/`](https://github.com/ofri-peretz/serverless/tree/main/benchmarks), 4 suites, covers the serverless plugins.

## Security plugins: precision and recall, weighted by where the false positive happens

Every finding in ILB's security benches is a TP, FP, FN, or TN against a CWE-labeled corpus, collapsed into precision, recall, and F1 — the same numbers behind the [ESLint security benchmarks](https://ofriperetz.dev/articles/eslint-security-fn-fp-benchmark) already on this site (`eslint-plugin-security`: 35.5% F1, 0 of 4 SQL injection fixtures caught).

What those articles don't spell out: **synthetic corpora prove the label is right; real-world code proves the rule survives contact with reality — and neither is sufficient alone.** Arena and CWE-Corpus are the hand-built, CWE-mapped fixture sets. Wild and Edge run the same rules against real open-source repositories — Wild against 22 real OSS projects at 1.8M lines of code, Edge specifically against FP-prone repos like three.js, webpack, and lodash, where some over-firing is *expected* and the rule is judged on a false-positive ceiling, not on hitting zero.

A false positive doesn't cost the same everywhere, so ILB weights it by which bench it came from:

| Bench | FP weight | Why |
| --- | --- | --- |
| Arena | ×10 | Hand-built adversarial fixture — a false positive here is publication-grade embarrassment |
| CWE-Corpus | ×5 | Labeled ground truth, slightly less adversarial than Arena |
| Quality | ×3 | Judgment-call territory (see below) — still counted, weighted lower |
| Wild | ×1 | Real-world baseline |
| Edge | ×0.1 | FP-prone repos by design — over-firing here is close to expected |

Treat them as equal and you either make the synthetic benchmark unpassable or the real-world one meaningless.

## Quality plugins: pairwise agreement instead of a single ground truth

`eslint-plugin-conventions`, `maintainability`, `reliability`, `modularity`, `operability`, `modernization`, and `import-next` don't get scored against the security Arena — they get their own suite, **Arena-Quality**, benchmarked against `eslint-plugin-n`, `import`, `jsdoc`, `promise`, `regexp`, `sonarjs`, and `unicorn`.

The reason isn't cosmetic. A SQL injection either exists in the fixture or it doesn't — that's a label you can defend. "This function is too complex" is closer to a judgment call, and a judgment call needs a different check: do two independent classifiers agree with each other, not just with the rule author. ILB computes **Cohen's κ pairwise** — Interlace's classification against sonarjs's, separately against `@microsoft/eslint-plugin-sdl`'s — as a check against one fixture set just encoding one person's opinion of what "too complex" means.

## Accessibility: the ground truth changes, the fixture discipline doesn't

`eslint-plugin-react-a11y` extends the same idea to a domain where the label isn't a CWE — it's a **WCAG success criterion** (`corpus/WCAG-1.1.1/`). Same structure: a fixture still needs an author, a reviewer, and an expected verdict. The open question I don't have a clean answer for yet: some accessibility failures (screen-reader behavior, focus order under real assistive tech) aren't statically detectable at all, which means a static-analysis benchmark can honestly measure only a subset of what "accessible" means — that's a limit of the method, not something ILB solves.

## Serverless: no detection at all, and 3 of 4 suites still don't have numbers

`@interlace/serverless-benchmarks` isn't a detection benchmark — there's no vulnerable/safe fixture to label, because these plugins don't flag anything, they change runtime behavior. Even the one suite marked "implemented" — `api-gateway-caching` — only has real numbers for 4 of its 7 weighted dimensions right now (TypeScript coverage, bundle weight, maintenance signal, documentation quality — all sourced statically from the npm registry). The other 3 (lifecycle correctness, hook coverage, CLI surface) require an actual AWS deployment to measure and currently report `null`, pending a suite that doesn't exist yet.

| Suite | Question | Status |
| --- | --- | --- |
| api-gateway-caching | How does the caching plugin compare to the community alternative? | **4 of 7 dimensions real**, 3 null pending live-deploy harness |
| cold-start | Cold-start latency added by the plugin? | skeleton, no numbers |
| deploy-latency | How long does `serverless deploy` take vs. alternatives? | skeleton, no numbers |
| feature-coverage | Of the AWS features people actually use, what fraction does each plugin support? | skeleton, no numbers |

I'd rather say that plainly than let "4 suites" imply four benchmarks' worth of proof. It means one, partially populated, with three more built to the same discipline once there's a deploy harness to fill them.

---

*What's the metric your team reports every sprint that everyone nods at and nobody actually trusts — the one where you all know it's measuring the wrong thing, but nobody wants to be the one who says so? I'd rather hear that than a general opinion on measurement.*

---

## Related deep dives

- [I Sell What I Benchmark. Here's How I Try Not to Cheat.](https://ofriperetz.dev/articles/i-sell-what-i-benchmark-heres-how-i-try-not-to-cheat) — the self-validation process this framework is built to satisfy
- [I Benchmarked 17 ESLint Security Plugins](https://dev.to/ofri-peretz/i-benchmarked-17-eslint-security-plugins-only-one-found-every-vulnerability-c83) — the security precision/recall numbers referenced above
- [Aggregate Benchmarks Lie. Here's What 700 AI Functions Look Like by Security Domain.](https://dev.to/ofri-peretz/aggregate-benchmarks-lie-heres-what-700-ai-functions-look-like-by-security-domain-1hgj) — the same principle applied to AI-generated code instead of linter rules
- [ILB README on GitHub](https://github.com/ofri-peretz/eslint/tree/main/benchmarks) — the full 10-principle philosophy and all 23 suites
- [`@interlace/serverless-benchmarks` README on GitHub](https://github.com/ofri-peretz/serverless/tree/main/benchmarks) — the serverless suite registry, including what's still a skeleton

{% cta https://github.com/ofri-peretz/eslint/tree/main/benchmarks %} View all 23 ILB benchmark suites on GitHub {% endcta %}

---

*Part of the [Interlace ESLint ecosystem](https://eslint.interlace.tools). Source on [GitHub](https://github.com/ofri-peretz/eslint) · npm: [@interlace](https://www.npmjs.com/~ofri-peretz) · Follow: [Dev.to/ofri-peretz](https://dev.to/ofri-peretz)*
