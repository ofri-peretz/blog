---
devto_url: "https://dev.to/ofri-peretz/i-maintain-23-benchmark-suites-across-my-own-packages-only-1-of-the-serverless-ones-has-real-54fp"
title: "I Maintain 23 Benchmark Suites Across My Own Packages. Only 1 of the Serverless Ones Has Real Numbers Yet."
description: "eslint-plugin-jwt gets scored on precision and recall against a labeled vulnerability corpus. My serverless caching plugin doesn't — and 3 of its 4 benchmark suites aren't built yet. Here's why that gap is honest, not an inconsistency."
slug: "different-metrics-for-different-package-types"
published: true
date: 2026-07-17
tags:
  - "security"
  - "devsecops"
  - "eslint"
  - "node"
devto_id: 4161076
canonical_url: https://ofriperetz.dev/articles/different-metrics-for-different-package-types
reading_time_minutes: 7
tier: "T2"
author:
  name: Ofri Peretz
  avatar: https://avatars.githubusercontent.com/u/46347627
  title: Security Engineering Leader
---

Five days earlier, an audit of my own ESLint plugins found 140 files still calling `context.getFilename()`, `getSourceCode()`, and `getCwd()` — three APIs ESLint 10 removes outright, not merely deprecates. Every one of my packages claims "supports ESLint 8, 9, and 10." Nobody hits this on ESLint 9, where the calls still work under compatibility shims — but on ESLint 10, my own rules would break the exact claim printed in my own README. `eslint-plugin-security` fails earlier and differently: it crashes outright on ESLint 9's flat config. Different bug, same root cause: an untested version-compatibility claim.

A version-compatibility fixture caught mine before a user did. A blended "code quality score" never would have. A passing quality score and a runtime crash on `npm install` are two different failures, and no single number covers both — that's the argument this article makes, section by section.

Here's the less flattering half of the same honesty: `eslint-plugin-jwt` gets scored on [precision, recall, and F1](https://ofriperetz.dev/articles/precision-recall-f1-for-static-analysis) against a labeled vulnerability corpus, with real numbers behind every claim. My serverless plugins run four benchmark suites; only one, `api-gateway-caching`, has real numbers behind it — the other three are still empty skeletons. Until an hour before this paragraph was finished, the draft claimed that one working suite was itself only 4-of-7 finished. It wasn't — the run had completed weeks earlier and the article hadn't caught up. Catching your own stale number inside an article about not publishing stale numbers is either a credibility problem or exactly what credibility is made of. I'm betting on the second one.

If your README claims "supports version X, Y, Z," run the test suite against each version in a matrix — don't read the changelog and assume. `--no-eslintrc` is an ESLint 8 flag; ESLint 9+ throws a fatal `Unknown option: '--no-eslintrc'` — the flag you want is `--no-config-lookup`. `eslint-plugin-security` has a 35.5% F1 score and still crashes on ESLint 9 flat config. No precision or recall number reports that. Only running it does.

```bash
# ESLint 8 (legacy config)
npx eslint --version && npx eslint . --no-eslintrc

# ESLint 9+ (flat config, the current default)
npx eslint --version && npx eslint . --no-config-lookup
```

---

## ILB vs. @interlace/serverless-benchmarks: what each framework measures

I run two separate, public benchmark stacks:

- **ILB (Interlace Lint Bench)** — [`eslint/benchmarks/`](https://github.com/ofri-peretz/eslint/tree/main/benchmarks), 23 suites, all 20 ESLint plugins.
- **`@interlace/serverless-benchmarks`** — [`serverless/benchmarks/`](https://github.com/ofri-peretz/serverless/tree/main/benchmarks), 4 suites, the 3 serverless plugins.

Neither would have caught the 140-files bug — that's a version-compatibility fixture, a different check entirely.

## Security plugins: precision and recall, weighted by where the false positive happens

Every finding in ILB's security benches is a [TP, FP, FN, or TN](https://ofriperetz.dev/articles/confusion-matrix-tp-fp-fn-tn) against a CWE-labeled corpus, collapsed into precision, recall, and F1 — the same numbers behind the [ESLint security benchmarks](https://ofriperetz.dev/articles/eslint-security-fn-fp-benchmark) already on this site (`eslint-plugin-security`: 35.5% F1, 0 of 4 SQL injection fixtures caught).

What those articles don't spell out: synthetic corpora prove the label is right; real-world code proves the rule survives contact with reality — neither is sufficient alone. Arena and CWE-Corpus are the hand-built, CWE-mapped fixture sets. Wild and Edge run the same rules against real repositories — Wild against 22 OSS projects at 1.8M lines, Edge against FP-prone repos like three.js and lodash.

A false positive doesn't cost the same everywhere, so ILB weights it by which bench it came from — call it context-weighted FP scoring, because a flat FP rate is systematically misleading: equal-weight Arena and Wild, and you either make the synthetic benchmark unpassable or the real-world one meaningless.

| Bench | FP weight | Why |
| --- | --- | --- |
| Arena | ×10 | Hand-built adversarial fixture — a false positive here is publication-grade embarrassment |
| CWE-Corpus | ×5 | Labeled ground truth, slightly less adversarial than Arena |
| Quality | ×3 | Judgment-call territory (see below) — still counted, weighted lower |
| Wild | ×1 | Real-world baseline |
| Edge | ×0.1 | FP-prone repos by design — over-firing here is close to expected |

That asymmetry is the point — and still the wrong tool for the 140-files bug: the rules fired correctly, they just called APIs that no longer exist.

## Quality plugins: pairwise agreement instead of a single ground truth

`eslint-plugin-conventions`, `maintainability`, `reliability`, `modularity`, `operability`, `modernization`, and `import-next` get their own suite, Arena-Quality, benchmarked against `eslint-plugin-n`, `import`, `jsdoc`, `promise`, `regexp`, `sonarjs`, and `unicorn`.

The reason isn't cosmetic. A SQL injection either exists in the fixture or it doesn't — a label you can defend. "This function is too complex" has no [single ground truth](https://ofriperetz.dev/articles/ground-truth-in-security-testing) to grade against: it's a judgment call, and a judgment call needs a different check — do two independent classifiers agree with each other, not just with the rule author. ILB computes [Cohen's κ pairwise](https://ofriperetz.dev/articles/inter-rater-agreement-cohens-kappa) — Interlace's classification against sonarjs's, separately against Microsoft SDL's — as a check against one fixture set encoding one person's opinion of what "too complex" means. Run Arena's binary pass/fail against `eslint-plugin-conventions` instead, and the number would encode whichever engineer wrote the fixture — precise-looking, and wrong in a way F1 can't expose.

This bench wouldn't have caught the 140-files bug either — κ measures agreement on a judgment call, and "does this API still exist in ESLint 10" isn't one; it's a fact a version matrix answers directly.

## Accessibility: the label changes, the fixture discipline doesn't

`eslint-plugin-react-a11y` extends the same idea to a domain where the label is a WCAG success criterion, not a CWE — a fixture still needs an author, a reviewer, and an expected verdict. The open question I don't have a clean answer for: some accessibility failures — screen-reader behavior, focus order under real assistive tech — aren't statically detectable at all. I treat ILB's a11y score as a floor, not a certification: passing means "the static subset of WCAG is covered," not "this component is accessible." Same shape of gap as the serverless suites below — honest about what the number does and doesn't cover.

## Serverless: the caching composite is done; the gap moved to three empty suites

`@interlace/serverless-benchmarks` isn't a detection benchmark — there's no vulnerable/safe fixture to label, because these plugins change runtime behavior instead of flagging it. As of **2026-05-04 (v1.0)**, `api-gateway-caching` moved from partially populated to fully measured: all 7 weighted dimensions now have real numbers, sourced from the npm registry, local source, and a live AWS deploy through the E2E harness at [`packages/serverless-api-gateway-caching/scripts/e2e/run.ts`](https://github.com/ofri-peretz/serverless/tree/main/packages/serverless-api-gateway-caching/scripts/e2e). Composite: Interlace **0.88**, the community plugin **0.3025**.

| Dimension | Weight | Interlace | Community |
| --- | --- | --- | --- |
| Lifecycle Correctness | 25% | 1.0 | 0.5 |
| CLI Surface | 15% | 1.0 | 0 |
| TypeScript Coverage | 15% | 1.0 | 0 |
| Maintenance Signal | 15% | 1.0 | 0 |
| Bundle Weight | 10% | 0 | 1.0 |
| Hook Coverage | 10% | 1.0 | 0.375 |
| Documentation | 10% | 0.8 | 0.4 |

The weights are an editorial call, not a law of nature, and I'm not pretending otherwise — the [composite-scores-and-weighting](https://ofriperetz.dev/articles/composite-scores-and-weighting) canonical covers how to audit a weighting scheme like this one, OECD-methodology style, and why publishing the weights matters more than publishing the score. Six of seven dimensions favor Interlace outright; lifecycle correctness came from the live-deploy run rather than a guess, because the community package ships no remove-phase hook and no safe-offboarding command. The seventh, bundle weight, doesn't: 78KB unpacked against the community package's 47KB. I ship the bigger bundle and still win the composite, and I'd rather print that than round it off.

The honest gap moved. It used to sit inside this composite — three of seven dimensions null. Now it sits outside it: cold-start, deploy-latency, and feature-coverage are still skeleton suites, a `methodology.md` and a `run.ts` each, zero executions. The E2E harness they'd build on already exists and already runs; what's missing is roughly 14 hours of runner work per suite, per the internal evidence plan. Same honesty as the 140-files bug, priced differently: a version matrix is cheap, and I built it the same day I found the bug. A live-deploy cold-start harness is not cheap, and three suites are still waiting on one.

| Suite | Question | Status |
| --- | --- | --- |
| api-gateway-caching | Interlace vs. community, 7 weighted dimensions | **real — 0.88 vs 0.3025** (measured 2026-05-04, v1.0) |
| cold-start | Cold-start latency added by the plugin? | skeleton, no numbers |
| deploy-latency | How long does `serverless deploy` take vs. alternatives? | skeleton, no numbers |
| feature-coverage | Of the AWS features people actually use, what fraction does each plugin support? | skeleton, no numbers |

---

*My 140-files bug shipped because a version-compatibility check didn't exist yet — not because any existing metric lied to me. The stale "4-of-7" line earlier in this draft shipped for the same reason any wrong composite ever ships: nobody re-ran the check before publishing. What's the equivalent gap on your team — the check that would catch your next incident, that nobody's built because it doesn't map cleanly onto precision, recall, or any other number you already report? I'd rather hear that than a general opinion on measurement.*

---

*← [I Built What I Benchmark. Here's How I Try Not to Cheat.](https://ofriperetz.dev/articles/i-built-what-i-benchmark-heres-how-i-try-not-to-cheat) · this article · [Aggregate Benchmarks Lie →](https://dev.to/ofri-peretz/aggregate-benchmarks-lie-heres-what-700-ai-functions-look-like-by-security-domain-1hgj)*

## Related deep dives

- [I Built What I Benchmark. Here's How I Try Not to Cheat.](https://ofriperetz.dev/articles/i-built-what-i-benchmark-heres-how-i-try-not-to-cheat) — the self-validation process this framework is built to satisfy
- [Confusion Matrix: TP, FP, FN, TN](https://ofriperetz.dev/articles/confusion-matrix-tp-fp-fn-tn) — what the four counts behind every precision/recall number mean
- [Precision, Recall, and F1 for Static Analysis](https://ofriperetz.dev/articles/precision-recall-f1-for-static-analysis) — the worked numbers behind the security-plugin scores above
- [Ground Truth in Security Testing](https://ofriperetz.dev/articles/ground-truth-in-security-testing) — who decides the label when there's no CWE to point to
- [Cohen's κ / Inter-Rater Agreement](https://ofriperetz.dev/articles/inter-rater-agreement-cohens-kappa) — the full math behind the Arena-Quality pairwise check
- [Composite Scores & Weighting](https://ofriperetz.dev/articles/composite-scores-and-weighting) — how to audit any weighted score, including the two above
- [I Benchmarked 17 ESLint Security Plugins](https://dev.to/ofri-peretz/i-benchmarked-17-eslint-security-plugins-only-one-found-every-vulnerability-c83) — the security precision/recall numbers referenced above
- [Aggregate Benchmarks Lie. Here's What 700 AI Functions Look Like by Security Domain.](https://dev.to/ofri-peretz/aggregate-benchmarks-lie-heres-what-700-ai-functions-look-like-by-security-domain-1hgj) — the same principle applied to AI-generated code instead of linter rules
- [ILB README on GitHub](https://github.com/ofri-peretz/eslint/tree/main/benchmarks) — the full 10-principle philosophy and all 23 suites
- [`@interlace/serverless-benchmarks` README on GitHub](https://github.com/ofri-peretz/serverless/tree/main/benchmarks) — the serverless suite registry, including what's still a skeleton

Next up: [Aggregate Benchmarks Lie](https://dev.to/ofri-peretz/aggregate-benchmarks-lie-heres-what-700-ai-functions-look-like-by-security-domain-1hgj) applies this same per-domain thinking to AI-generated code instead of linter rules.

{% cta https://github.com/ofri-peretz/eslint/tree/main/benchmarks %} View all 23 ILB benchmark suites on GitHub {% endcta %}

---

*Part of the [Interlace ESLint ecosystem](https://eslint.interlace.tools). Source on [GitHub](https://github.com/ofri-peretz/eslint) · npm: [@interlace](https://www.npmjs.com/~ofriperetz) · Follow: [Dev.to/ofri-peretz](https://dev.to/ofri-peretz)*
