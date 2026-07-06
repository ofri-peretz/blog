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
  discovery & hook: 5
  discovery & hook_why: "**Bait-and-switch arc**: The opening paragraph delivers a genuinely threatening hook — 140 broken API calls in code claiming ESLint 10 support — but the body never resolves that story. Instead it pivots to benchmark m..."
  technical: 7.5
  technical_why: "The one code example breaks on the exact versions the article discusses. `npx eslint . --no-eslintrc` is a legacy-config flag that has no meaning under ESLint 9 flat config (the default) and would error on ESLint 10, ..."
  quality: 5.5
  quality_why: "The article has no transferable takeaway for readers outside the ILB/Interlace ecosystem. The core thesis (\"different package types need different benchmarks\") is correct but never resolves into something a reader can..."
  practitioner: 6
  practitioner_why: "None that kill credibility, but the article is a framework description that never shows what the framework found. The title promises a confession; the body delivers a methodology walkthrough. That mismatch will bleed ..."
  linkability: 6
  linkability_why: "`cover_image` and `social_image` are absent from frontmatter. No OG image = invisible in Twitter/LinkedIn cards and excluded from Google Discover. Fix before publishing.; \"I Sell What I Benchmark. Here's How I Try Not..."
  challenge: 5.9
  challenge_why: "The article has no standalone finding. A reader finishes knowing how the benchmark framework is *structured* but learns nothing they couldn't have guessed (\"security plugins need precision/recall, serverless plugins d..."
  voice & agenda: 7.5
  voice & agenda_why: "None that kill credibility or engagement outright. The title and opening are strong enough to earn the click; the piece won't embarrass Ofri."
  discovery & hook: 4.5
  discovery & hook_why: "**Bait-and-switch hook**: The opening delivers real tension — \"140 files across my rules still calling `context.getFilename()`, `getSourceCode()`, and `getCwd()`\" — but the article never resolves that story. A reader ..."
  technical: 6.5
  technical_why: "**`--no-eslintrc` flag is wrong for the versions being discussed.** The one actionable code example in the article (`npx eslint . --no-eslintrc`) is a legacy-config flag valid only for ESLint 8 and below. Under ESLint..."
  quality: 5.5
  quality_why: "`--no-eslintrc` in the smoke-test command is a legacy flat-config flag that errors under ESLint 9+ — the one actionable code block in the article is broken for the exact audience reading about ESLint 10 compatibility...."
  practitioner: 6.5
  practitioner_why: "The code snippet `npx eslint . --no-eslintrc` is a legacy-config flag. Under ESLint 9's flat config (the default since 9.0) it either silently does nothing or errors depending on the config resolution path. ESLint 10 ..."
  linkability: 5.5
  linkability_why: "`cover_image` and `social_image` are absent from frontmatter — no OG image means invisible Twitter/LinkedIn cards and excluded from Google Discover; non-negotiable fix before publishing; \"eslint-plugin-security, which..."
  challenge: 5.3
  challenge_why: "`npx eslint . --no-eslintrc` is a legacy-config flag — errors or no-ops under ESLint 9+ flat config (the current default). Fix or remove before publishing; leaving it in undermines every version-compatibility claim in..."
  voice & agenda: 7
  voice & agenda_why: "None that would kill engagement outright, but the piece front-loads its best material and then becomes a reference document. The 140-files opening earns the click; the middle sections on quality/accessibility/serverle..."
overall_score: 6.1
reviews:
  discovery & hook: 4.5
  discovery & hook_why: "**Bait-and-switch arc destroys the hook.** The opening sentence is genuinely strong — \"140 files across my rules still calling `context.getFilename()`, `getSourceCode()`, and `getCwd()` — three APIs ESLint 10 removes ..."
  technical: 7
  technical_why: "**`--no-eslintrc` behavior is described incorrectly.** The prose says it \"silently stops meaning anything under the exact ESLint 9/10 flat-config world.\" That's wrong — ESLint 9+ uses strict flag parsing and throws a ..."
  quality: 5.5
  quality_why: "The article's primary audience is effectively one person: the author. \"Here's how my 23 benchmark suites are structured\" is not a problem most DEV.to practitioners have, and the article never bridges to what they shou..."
  practitioner: 6.5
  practitioner_why: "None that would kill publication. The `--no-eslintrc` fix from prior reviews is correctly handled in the code block — that's no longer a credibility problem."
  linkability: 6.5
  linkability_why: "`cover_image` and `social_image` are absent from frontmatter — no OG image means the article is invisible on Twitter/LinkedIn cards and excluded from Google Discover. Non-negotiable fix before publishing.; The \"Access..."
  challenge: 5.2
  challenge_why: "No `cover_image`/`social_image` in frontmatter — invisible Twitter/LinkedIn cards, excluded from Google Discover; this is a non-negotiable fix before any publish; The serverless table (3 of 4 suites are skeletons) is ..."
  voice & agenda: 7.5
  voice & agenda_why: "None that would kill engagement or credibility."
---

Five days earlier, an audit of my own ESLint plugins had found 140 files across my rules still calling `context.getFilename()`, `getSourceCode()`, and `getCwd()` — three APIs ESLint 10 removes outright, not merely deprecates. Every one of my packages claims "supports ESLint 8, 9, and 10." Nobody would have hit this on ESLint 9 — those calls still work there under compatibility shims — but the moment a user upgraded to 10, my own rules would have broken the exact claim printed in my own README. `eslint-plugin-security`, which [I disqualify elsewhere on this site](https://dev.to/ofri-peretz/eslint-plugin-security-is-unmaintained-heres-what-nobody-tells-you-96h), fails earlier and differently: it crashes outright on ESLint 9's flat config, a distinct failure mode from mine. Different bug, same root cause — a version-compatibility claim nobody had actually tested against the version in question.

A version-compatibility fixture caught mine before a user did. A blended "code quality score" never would have. A passing quality score and a runtime crash on `npm install` are two different failures, and no single number covers both — that's the whole argument this article makes, and every section below is a different version of it.

Here's the other half of that same honesty, and it's less flattering: `eslint-plugin-jwt` gets scored on precision and recall against a labeled vulnerability corpus, with real numbers behind every claim. My serverless caching plugin doesn't get that treatment yet. Here's the gap, plainly, before anything else:

| Suite | Question | Status |
| --- | --- | --- |
| api-gateway-caching | How does the caching plugin compare to the community alternative? | **4 of 7 dimensions real**, 3 null pending live-deploy harness |
| cold-start | Cold-start latency added by the plugin? | skeleton, no numbers |
| deploy-latency | How long does `serverless deploy` take vs. alternatives? | skeleton, no numbers |
| feature-coverage | Of the AWS features people actually use, what fraction does each plugin support? | skeleton, no numbers |

Three of four suites are skeletons. The one suite marked "implemented" is only 4-of-7 dimensions populated. If you've read "4 benchmark suites" anywhere and inferred four benchmarks' worth of proof, that inference was wrong, and I'd rather correct it here than let it stand. A version-compat fixture would never have caught that gap either, because "the benchmark doesn't exist yet" isn't a bug a test suite finds — it's a backlog item, and no metric of any kind reports it unless I say so directly. That's why this is paragraph two instead of the end of a methodology tour: the confession is the finding, and the rest of this article is why that gap is correctly sized instead of something to paper over.

If you maintain anything with a "supports version X, Y, Z" claim in its README, the fastest way to check whether that claim is still true is to actually run your test suite against each version in a matrix, not to read the changelog and assume. The command itself is a small version of the same lesson. `--no-eslintrc` is an ESLint 8 flag; ESLint 9+ throws a fatal `Unknown option: '--no-eslintrc'` — the flag you want there is `--no-config-lookup`. eslint-plugin-security has a 35.5% F1 score and it still crashes on ESLint 9 flat config. No precision metric reports that. Only running it does.

```bash
# ESLint 8 (legacy config)
npx eslint --version && npx eslint . --no-eslintrc

# ESLint 9+ (flat config, the current default)
npx eslint --version && npx eslint . --no-config-lookup
```

---

## ILB vs. @interlace/serverless-benchmarks: what each framework measures

I run two separate, public benchmark stacks — neither is a private doc I'm describing from memory:

- **ILB (Interlace Lint Bench)** — [`eslint/benchmarks/`](https://github.com/ofri-peretz/eslint/tree/main/benchmarks), 23 suites, covers all 20 ESLint plugins.
- **`@interlace/serverless-benchmarks`** — [`serverless/benchmarks/`](https://github.com/ofri-peretz/serverless/tree/main/benchmarks), 4 suites, covers the serverless plugins.

Neither one would have caught the 140-files bug from the opening — that was a version-compatibility fixture, a different check entirely. What follows is why each framework below measures what it measures, and, section by section, what it would and wouldn't have told me about that specific incident.

## Security plugins: precision and recall, weighted by where the false positive happens

Every finding in Interlace Lint Bench (ILB)'s security benches is a TP, FP, FN, or TN against a CWE-labeled corpus, collapsed into precision, recall, and F1 — the same numbers behind the [ESLint security benchmarks](https://ofriperetz.dev/articles/eslint-security-fn-fp-benchmark) already on this site (`eslint-plugin-security`: 35.5% F1, 0 of 4 SQL injection (CWE-89) fixtures caught).

What those articles don't spell out: **synthetic corpora prove the label is right; real-world code proves the rule survives contact with reality — and neither is sufficient alone.** I learned that the hard way once: an early rule scored a clean F1 on Arena and then false-positived on nearly every dynamic import in a real `lodash` build — the label was right, the rule just hadn't met reality yet. Arena and CWE-Corpus are the hand-built, CWE-mapped fixture sets. Wild and Edge run the same rules against real open-source repositories — Wild against 22 real OSS projects at 1.8M lines of code, Edge specifically against FP-prone repos like three.js, webpack, and lodash, where some over-firing is *expected* and the rule is judged on a false-positive ceiling, not on hitting zero.

A false positive doesn't cost the same everywhere, so ILB weights it by which bench it came from — call it **context-weighted FP scoring**, because a flat, unweighted false-positive rate produces a systematically misleading number for any tool maintainer, not just for Interlace: equal-weight Arena and Wild, and you either make the synthetic benchmark unpassable or the real-world one meaningless.

| Bench | FP weight | Why |
| --- | --- | --- |
| Arena | ×10 | Hand-built adversarial fixture — a false positive here is publication-grade embarrassment |
| CWE-Corpus | ×5 | Labeled ground truth, slightly less adversarial than Arena |
| Quality | ×3 | Judgment-call territory (see below) — still counted, weighted lower |
| Wild | ×1 | Real-world baseline |
| Edge | ×0.1 | FP-prone repos by design — over-firing here is close to expected |

A concrete version of that table: a rule that passes Wild clean (real-world FP rate near zero) can still fail Arena outright if its one adversarial fixture trips it, and under context-weighting that Arena miss dominates the blended score instead of getting diluted by 22 clean OSS repos. That asymmetry is the point — this is a precision/recall check, and it would have caught a rule that *detects the wrong thing*. It's the wrong tool for catching the 140-files bug, which wasn't a detection failure at all — the rules fired correctly, they just called APIs that no longer exist.

## Quality plugins: pairwise agreement instead of a single ground truth

`eslint-plugin-conventions`, `maintainability`, `reliability`, `modularity`, `operability`, `modernization`, and `import-next` don't get scored against the security Arena — they get their own suite, **Arena-Quality**, benchmarked against `eslint-plugin-n`, `import`, `jsdoc`, `promise`, `regexp`, `sonarjs`, and `unicorn`.

The reason isn't cosmetic. A SQL injection either exists in the fixture or it doesn't — that's a label you can defend. "This function is too complex" is closer to a judgment call, and a judgment call needs a different check: do two independent classifiers agree with each other, not just with the rule author. ILB computes **Cohen's κ pairwise** — Interlace's classification against sonarjs's, separately against `@microsoft/eslint-plugin-sdl`'s — as a check against one fixture set just encoding one person's opinion of what "too complex" means. Run Arena's binary pass/fail against `eslint-plugin-conventions` instead of κ, and the number would just encode whichever engineer wrote the fixture — precise-looking, and wrong in a way F1 can't expose.

This bench wouldn't have caught the 140-files bug either — κ measures whether two classifiers agree on a judgment call, and "does this API still exist in ESLint 10" isn't a judgment call, it's a fact a version matrix answers directly.

## Accessibility: the ground truth changes, the fixture discipline doesn't

`eslint-plugin-react-a11y` extends the same idea to a domain where the label isn't a CWE — it's a **WCAG success criterion** (`corpus/WCAG-1.1.1/`). Same structure: a fixture still needs an author, a reviewer, and an expected verdict. The open question I don't have a clean answer for yet: some accessibility failures (screen-reader behavior, focus order under real assistive tech) aren't statically detectable at all. I don't have a fix for that ceiling — I route around it by treating ILB's a11y score as a floor, not a certification, and telling readers explicitly that passing this suite means "the static subset of WCAG is covered," not "this component is accessible." That's a limit of the method, not something ILB solves, and it's the same shape of gap as the serverless suites below: honest about what the number does and doesn't cover.

## Serverless: no detection at all, and 3 of 4 suites still don't have numbers

`@interlace/serverless-benchmarks` isn't a detection benchmark — there's no vulnerable/safe fixture to label, because these plugins don't flag anything, they change runtime behavior. Even the one suite marked "implemented" — `api-gateway-caching` — only has real numbers for 4 of its 7 weighted dimensions right now: TypeScript coverage, bundle weight, maintenance signal, and documentation quality, all sourced statically from the npm registry. On those four, the plugin currently comes out ahead of the community alternative on TypeScript coverage and documentation quality, roughly even on bundle weight — the other 3 (lifecycle correctness, hook coverage, CLI surface) require an actual AWS deployment to measure and currently report `null`, pending a suite that doesn't exist yet.

| Suite | Question | Status |
| --- | --- | --- |
| api-gateway-caching | How does the caching plugin compare to the community alternative? | **4 of 7 dimensions real**, 3 null pending live-deploy harness |
| cold-start | Cold-start latency added by the plugin? | skeleton, no numbers |
| deploy-latency | How long does `serverless deploy` take vs. alternatives? | skeleton, no numbers |
| feature-coverage | Of the AWS features people actually use, what fraction does each plugin support? | skeleton, no numbers |

I'd rather say that plainly than let "4 suites" imply four benchmarks' worth of proof. It means one, partially populated, with three more built to the same discipline once there's a deploy harness to fill them. And this is the closest any suite here comes to what caught the 140-files bug: both are "the check doesn't exist yet, so the gap is invisible until someone states it out loud." A version matrix is cheap to build and I built it. A live-deploy harness for Lambda cold starts is not cheap, and three suites are still waiting on it — same honesty, different cost to close the gap.

---

*My 140-files bug shipped because a version-compatibility check didn't exist yet — not because any existing metric lied to me. What's the equivalent gap on your team: the check that would catch your next incident, that nobody's built because it doesn't map cleanly onto precision, recall, or any other number you already report? I'd rather hear that than a general opinion on measurement.*

---

*← [I Built What I Benchmark. Here's How I Try Not to Cheat.](https://ofriperetz.dev/articles/i-built-what-i-benchmark-heres-how-i-try-not-to-cheat) · this article · [Aggregate Benchmarks Lie →](https://dev.to/ofri-peretz/aggregate-benchmarks-lie-heres-what-700-ai-functions-look-like-by-security-domain-1hgj)*

## Related deep dives

- [I Built What I Benchmark. Here's How I Try Not to Cheat.](https://ofriperetz.dev/articles/i-built-what-i-benchmark-heres-how-i-try-not-to-cheat) — the self-validation process this framework is built to satisfy
- [I Benchmarked 17 ESLint Security Plugins](https://dev.to/ofri-peretz/i-benchmarked-17-eslint-security-plugins-only-one-found-every-vulnerability-c83) — the security precision/recall numbers referenced above
- [Aggregate Benchmarks Lie. Here's What 700 AI Functions Look Like by Security Domain.](https://dev.to/ofri-peretz/aggregate-benchmarks-lie-heres-what-700-ai-functions-look-like-by-security-domain-1hgj) — the same principle applied to AI-generated code instead of linter rules
- [ILB README on GitHub](https://github.com/ofri-peretz/eslint/tree/main/benchmarks) — the full 10-principle philosophy and all 23 suites
- [`@interlace/serverless-benchmarks` README on GitHub](https://github.com/ofri-peretz/serverless/tree/main/benchmarks) — the serverless suite registry, including what's still a skeleton

Next up: [Aggregate Benchmarks Lie](https://dev.to/ofri-peretz/aggregate-benchmarks-lie-heres-what-700-ai-functions-look-like-by-security-domain-1hgj) applies this same per-domain thinking to AI-generated code instead of linter rules.

{% cta https://github.com/ofri-peretz/eslint/tree/main/benchmarks %} View all 23 ILB benchmark suites on GitHub {% endcta %}

---

*Part of the [Interlace ESLint ecosystem](https://eslint.interlace.tools). Source on [GitHub](https://github.com/ofri-peretz/eslint) · npm: [@interlace](https://www.npmjs.com/~ofri-peretz) · Follow: [Dev.to/ofri-peretz](https://dev.to/ofri-peretz)*
