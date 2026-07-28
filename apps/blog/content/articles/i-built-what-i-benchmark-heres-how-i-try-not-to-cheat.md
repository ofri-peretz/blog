---
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/i-built-what-i-benchmark-heres-how-i-try-not-to-cheat.jpg"
cover_image: "https://ofriperetz.dev/cdn/blog-cover-image/i-built-what-i-benchmark-heres-how-i-try-not-to-cheat.jpg"
devto_url: "https://dev.to/ofri-peretz/i-built-what-i-benchmark-heres-how-i-try-not-to-cheat-3k3n"
title: "I Built What I Benchmark. Here's How I Try Not to Cheat."
description: "Every benchmark on this site compares my own ESLint plugins to competitors — a real conflict of interest, not a disclaimer I can write my way out of. Here's the actual, checkable process I use instead of asking you to trust my verdict."
slug: "i-built-what-i-benchmark-heres-how-i-try-not-to-cheat"
published: true
date: 2026-07-17
tags:
  - "security"
  - "eslint"
  - "devsecops"
  - "javascript"
devto_id: 4161077
canonical_url: https://ofriperetz.dev/articles/i-built-what-i-benchmark-heres-how-i-try-not-to-cheat
tier: "T2"
reading_time_minutes: 9
author:
  name: Ofri Peretz
  avatar: https://avatars.githubusercontent.com/u/46347627
  title: Security Engineering Leader
---

On 2026-07-05, re-verifying the numbers before publishing the 17-plugin benchmark, `eslint-plugin-unicorn` came back 0 of 40 — a suspiciously clean zero that would have read as proof a well-regarded plugin was worthless. It wasn't: a stale Node version in my shell had silently swallowed the run, and the real number was 22 of 40, F1 51.8% (the full forensic walkthrough lives in [Bias in Measurement](https://ofriperetz.dev/articles/bias-in-measurement#the-unicorn-incident); this article is about the process that made me go looking for it).

That's the kind of mistake a vendor benchmark doesn't usually surface — vendors don't go looking for ways their own test caught nothing. Every ESLint benchmark on this site compares my own plugins to competitors, and I'm the one who decides what counts as a bug — which means every benchmark from a plugin author, including this one, has that exact problem. **A benchmark that's only ever been run once, by the person who built the tool it favors, hasn't been tested. It's been asserted.** This article is the concrete process that keeps mine from being just that — not a disclaimer, a process you can go verify yourself, with the two times it caught something wrong.

---

## The problem, stated plainly

I'm a solo creator. There's no lab, no independent research team, no third party benchmarking Interlace on my behalf. If "credible self-benchmark" requires a formal external audit, every benchmark I publish fails before I write the first fixture — not because the numbers are wrong, but because that category of evidence doesn't exist for someone working alone.

So the bar has to be something a solo creator can clear — and I'm not the first to try. The closest public prior art is the [OWASP Benchmark Project](https://owasp.org/www-project-benchmark/): a scored, open SAST corpus on the same TP/FP mechanics used here, run by a nonprofit rather than a vendor with a stake in the outcome — the real standard here, not an imaginary lab. The self-audit itself has an older prior art: Warren Buffett's Berkshire Hathaway letters, which have opened with his own worst calls for decades. That's the model this article borrows — the blunder-check, a chess player's habit of re-verifying the position before moving, done in public first.

---

## The disclosure goes in the first 200 words, not the footer

Every benchmark article on this site opens with a disclosure before the results, not after. From the [false-positive/false-negative benchmark](https://ofriperetz.dev/articles/eslint-security-fn-fp-benchmark):

> "Full disclosure before the numbers: I'm the author of the Interlace ESLint ecosystem, and Interlace scores 100%/0 FP in this benchmark. The skeptic read — 'he built the test to fit his tool' — is the right instinct, so I'll give you the means to disprove it."

The test: does the disclosure appear before the reader forms an opinion, or after — where it reads as a footnote covering the author, not informing the reader? Mine goes first, every time.

## The methodology has to be something you can run, not something you have to believe

The fixture suite behind every ESLint benchmark on this site is public: [github.com/ofri-peretz/eslint-benchmark-suite](https://github.com/ofri-peretz/eslint-benchmark-suite). The fixtures were built against published OWASP Top 10 categories and CWE mappings before I wrote a single Interlace rule to cover them — documented in the [benchmark's own methodology section](https://ofriperetz.dev/articles/eslint-security-fn-fp-benchmark#on-benchmark-bias). I still wrote both the fixtures and the rules graded against them, and predating the rules bounds the bias — it doesn't remove it. It's [Goodhart's Law](https://ofriperetz.dev/articles/goodharts-law-explained) applied to my own incentives: when the person who defines the target also grades against it, sequencing is a control, not a cure. The full fixtures-before-rules discipline — category selection, edge-case labeling, the corpus lifecycle — is written up in [How to Design a Ground-Truth Corpus](https://ofriperetz.dev/articles/how-to-design-a-ground-truth-corpus).

Full-suite run:

```bash
git clone https://github.com/ofri-peretz/eslint-benchmark-suite
cd eslint-benchmark-suite && npm install
npm run benchmark:fn-fp
```

To check one plugin in isolation:

```bash
node benchmarks/fn-fp-comparison/run.js --plugin=sonarjs
```

I picked sonarjs for that example deliberately — I re-ran it myself before writing this sentence, on the default Node install, no caveats, and it reproduced exactly: 14/40, F1 47.5%, matching the published number. That's [reproducibility](https://ofriperetz.dev/articles/reproducibility-vs-replicability) — same code, same fixtures, same number — the checkable bar a solo creator can actually offer. (`eslint-plugin-security` needs ESLint 8.57.0 to avoid a different silent-crash-to-zero, documented in the [17-plugin benchmark](https://dev.to/ofri-peretz/i-benchmarked-17-eslint-security-plugins-only-one-found-every-vulnerability-c83) — which is why it's not the reproduction example here.)

Competitor plugin versions are pinned in the suite's `package.json`, not pulled as `latest` — the regression below only means anything because the version is fixed.

If a claim requires you to take my word for a number instead of running a command, that's a defect in the article, not an acceptable trade-off.

## My own mistakes get shown, not quietly fixed

The unicorn false-zero above is the first example of the blunder-check in practice — a bug in my own test rig, shown here rather than quietly re-run until it looked clean. The second goes the opposite direction: a real regression I didn't cause, reported anyway because it was true.

Re-verifying `eslint-plugin-sonarjs` on 2026-07-05 for the same 17-plugin benchmark, its current release (4.1.0, up from the 3.0.6 originally tested) had lost Command Injection detection entirely — 4/4 down to 0/4, part of an overall drop from 14/40 to 10/40. That's not a finding that flatters Interlace; it's a data point about a real plugin at a specific version, published as reported, because the point of a benchmark is the data, not the storyline.

If a self-benchmark only ever shows the author's wins, that's the tell. Mine has to show what breaks — a competitor's regression I didn't cause, and a bug in my own test rig I did.

## "Verify this yourself" instead of "trust my verdict"

This is the spine of the process above. An earlier draft of the 17-plugin benchmark called an independent audit "on the list, not done yet" — a confession that a stronger bar exists and hasn't been met, dressed up as a plan. I rewrote it as the command two sections up instead. "I'll get third-party validation eventually" asks you to wait on my credibility. "Here's the exact command, run it now" asks you to check my claim today, without me in the loop at all.

## If you get a different number, say so

I read every comment on these articles: if you run a benchmark here and get a different result, that's the process working, not an inconvenience. Tell me in the comments, or open an issue on the [benchmark suite repo](https://github.com/ofri-peretz/eslint-benchmark-suite). No external correction has landed yet — not the same claim as "no errors exist," just that the two caught so far were both mine.

---

## Why n=40 fixtures can't support a p-value — and when they can

I want to be as careful about overclaiming rigor as I am about overclaiming results.

The ESLint fixture suites run 40 vulnerable patterns per benchmark. That's a real, useful count — enough to see a plugin miss entire categories, like `eslint-plugin-security` catching zero of four SQL injection fixtures (full numbers are in the [linked benchmark](https://dev.to/ofri-peretz/i-benchmarked-17-eslint-security-plugins-only-one-found-every-vulnerability-c83)). It's not just that n=40 is small — these fixtures are a deliberately constructed set, not a random draw from any population, so a confidence interval or p-value wouldn't be meaningful here at any sample size. A precision/recall/F1 table on this suite is an honest description of what happened; it's not a population-level statistical claim, and I'm not going to attach one just because it would look more rigorous.

There's one place in this corpus where the sample genuinely was large enough, and drawn the right way, for a [significance test](https://ofriperetz.dev/articles/statistical-significance-p-value): comparing vulnerability rates across [four AI models generating 80 functions total](https://dev.to/ofri-peretz/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities-414o), a chi-squared test on the model-vs-model difference came back χ² = 0.640, p > 0.05 — no statistically significant difference between models. That's the same discipline as the section above, running the other direction: the data said "no difference," and that's what got published, not a headline claim the sample couldn't support.

---

## The five controls — and the same five questions for any benchmark you read

I'm not going to keep writing "a formal audit is still the real bar, I just haven't gotten there yet." For a solo creator, disclosure before the opinion forms, methodology you can run yourself, failures shown next to wins, verify-it-yourself framing, and an open invitation to be checked are the achievable version of rigor. Claiming a stricter bar I can't clear wouldn't make the benchmarks more trustworthy — it would just move the dishonesty into the methodology section.

The same five questions apply to any vendor's benchmark, not just mine: Does the disclosure come before the results or after? Can you run the methodology yourself, or does it ask you to trust a number? Does it show a result that went against the vendor, or only wins? Is the validation framed as "verify this" or "trust my process"? Is there a real channel to report a different result, and any evidence it's been used?

What can improve from here is the evidence *under* this bar — more reproduction reports, more open corrections, more competitors re-verified as they ship. That's a floor that accumulates, not a ceiling I'm still climbing toward.

---

*Has a vendor's own benchmark ever changed which tool your team shipped — and did you later find out the benchmark was wrong? I'd like to hear that story more than a general opinion on trust.*

---

## Related deep dives

- [1.5M Weekly Downloads, 1 False Alarm per Real Bug: the eslint-plugin-security False-Positive Tax](https://ofriperetz.dev/articles/eslint-security-fn-fp-benchmark) — the benchmark this process backs, including the fixture-bias methodology section
- [I Benchmarked 17 ESLint Security Plugins](https://dev.to/ofri-peretz/i-benchmarked-17-eslint-security-plugins-only-one-found-every-vulnerability-c83) — where the unicorn false-zero and SonarJS regression above were both caught, dated and versioned, before publishing
- [SonarJS Has 269 Rules. On 40 Vulnerabilities It Caught 14.](https://dev.to/ofri-peretz/sonarjs-has-269-rules-it-still-misses-65-of-security-vulnerabilities-3jh) — the dedicated deep dive on the plugin behind the regression above
- [I Let Claude Write 80 Functions. 65-75% Had Security Vulnerabilities.](https://dev.to/ofri-peretz/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities-414o) — the source of the chi-squared result cited above (its URL slug still says 60, frozen for link stability after the study expanded and the title was updated)
- [My Credential Rule Reported 842 Secrets in vercel/ai. The Real Count Was 0.](https://dev.to/ofri-peretz/my-credential-rule-reported-842-secrets-in-vercelai-the-real-count-was-0-249p) — another too-clean result that turned out to be wrong, same discipline of catching it

{% cta https://github.com/ofri-peretz/eslint-benchmark-suite %} Clone the benchmark suite and run it yourself {% endcta %}

---

*Part of the [Interlace ESLint ecosystem](https://eslint.interlace.tools). Source on [GitHub](https://github.com/ofri-peretz/eslint) · npm: [@interlace](https://www.npmjs.com/~ofriperetz) · Follow: [Dev.to/ofri-peretz](https://dev.to/ofri-peretz) · [ofriperetz.dev](https://ofriperetz.dev)*
