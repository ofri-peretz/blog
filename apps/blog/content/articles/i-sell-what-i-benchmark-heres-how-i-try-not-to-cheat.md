---
title: "I Sell What I Benchmark. Here's How I Try Not to Cheat."
description: "Every benchmark on this site compares my own ESLint plugins to competitors — a real conflict of interest, not a disclaimer I can write my way out of. Here's the actual, checkable process I use instead of asking you to trust my verdict."
slug: "i-sell-what-i-benchmark-heres-how-i-try-not-to-cheat"
published: false
date: 2026-07-05
tags:
  - security
  - node
  - devsecops
  - eslint
canonical_url: https://ofriperetz.dev/articles/i-sell-what-i-benchmark-heres-how-i-try-not-to-cheat
reading_time_minutes: 9
author:
  name: Ofri Peretz
  avatar: https://avatars.githubusercontent.com/u/46347627
  title: Security Engineering Leader
---

`eslint-plugin-unicorn` just failed all 40 fixtures in a re-run I did before publishing another benchmark — a suspiciously clean zero. If I'd shipped that number, it would have read as proof that a well-regarded plugin was worthless. It wasn't. My test rig was silently crashing on a Node syntax feature the installed runtime didn't support, and swallowing the crash as zero detections instead of an error. Re-running under the correct Node version produced the real number: 22 of 40.

That's the kind of mistake a vendor benchmark doesn't usually surface, because vendors don't go looking for the ways their own test caught nothing. Every ESLint benchmark on this site compares my own plugins to competitors, and I'm the one who decides what counts as a bug — which means every benchmark you've read from a plugin author, including this one, has that exact problem. This article is the concrete process I use to make mine checkable anyway. Not a disclaimer paragraph — a process you can go verify yourself, with the two times it caught me being wrong.

---

## The problem, stated plainly

I'm a solo creator. There's no lab, no independent research team, no third party who benchmarks Interlace against competitors on my behalf. If "credible self-benchmark" requires a formal external audit, every benchmark I publish fails before I write the first fixture — not because the numbers are wrong, but because the category of evidence doesn't exist for someone working alone.

So the bar has to be something a solo creator can actually clear. Here's what I hold myself to.

---

## 1. The conflict of interest goes in the first 200 words, not the footer

Every benchmark article on this site opens with a disclosure before the results, not after. From the [false-positive/false-negative benchmark](https://ofriperetz.dev/articles/eslint-security-fn-fp-benchmark):

> "Full disclosure before the numbers: I'm the author of the Interlace ESLint ecosystem, and Interlace scores 100%/0 FP in this benchmark. The skeptic read — 'he built the test to fit his tool' — is the right instinct, so I'll give you the means to disprove it."

The test for whether a disclosure is real: does it appear before the reader has formed an opinion, or after — where it reads as a footnote covering the author rather than informing the reader? Mine goes first, every time, on purpose.

## 2. Reproducible methodology: something you can run, not something you have to believe

The fixture suite behind every ESLint benchmark on this site is public: [github.com/ofri-peretz/eslint-benchmark-suite](https://github.com/ofri-peretz/eslint-benchmark-suite). The fixtures were built against published OWASP Top 10 categories and CWE mappings **before** I wrote a single Interlace rule to cover them — documented in the [benchmark's own methodology section](https://ofriperetz.dev/articles/eslint-security-fn-fp-benchmark#on-benchmark-bias). I still wrote both the fixtures and the rules that get graded against them, and I won't pretend that predating the rules erases that — it bounds the bias, it doesn't remove it. Grounding every fixture in a published CWE or OWASP category, instead of a pattern I noticed Interlace happened to handle, is the mitigation, not a claim of neutrality.

Full-suite run:

```bash
git clone https://github.com/ofri-peretz/eslint-benchmark-suite
cd eslint-benchmark-suite && npm install
npm run benchmark:fn-fp
```

To check one plugin in isolation, the same suite exposes a single-plugin entry point:

```bash
node benchmarks/fn-fp-comparison/run.js --plugin=eslint-plugin-security
```

Competitor plugin versions are pinned in the suite's `package.json`, not pulled as `latest` — the SonarJS regression in the next section only means anything because the version that produced each number is fixed and recorded.

If a claim in one of my articles requires you to take my word for a number instead of running a command, that's a defect in the article, not an acceptable trade-off.

## 3. My own mistakes get shown, not quietly fixed

The `eslint-plugin-unicorn` false-zero from the opening — my own tooling bug, caught before publishing — is the first example: a mistake in *my* process, shown rather than quietly re-run until it looked clean. Here's the second, going the opposite direction — a competitor's number moving the *wrong* way for a clean narrative, published anyway:

Re-verifying `eslint-plugin-sonarjs` against its current pinned version surfaced a real regression: Command Injection detection went from 4/4 to 0/4 between the original run and the re-run. That's not a finding that makes Interlace look better by comparison — it's a data point about a real plugin's real behavior at a specific version, and it went into the [17-plugin benchmark](https://dev.to/ofri-peretz/i-benchmarked-17-eslint-security-plugins-only-one-found-every-vulnerability-c83) as reported, because the point of a benchmark is the data, not the storyline.

If a self-benchmark only ever shows the author's wins, that's the tell. Mine has to show what breaks — a competitor's regression I didn't cause, and a bug in my own test rig I did.

## 4. "Verify this yourself" instead of "trust my verdict"

An earlier draft of the 17-plugin benchmark said an independent audit was "on the list, not done yet." A reviewer flagged that correctly — it's a confession that a stronger validation bar exists and simply hasn't been met, dressed up as a plan. I rewrote it as the command in section 2 instead. "I'll get third-party validation eventually" asks you to wait on my credibility. "Here's the exact command, run it now" asks you to check my claim today, without me in the loop at all.

## 5. If you get a different number, say so

I read every comment on these articles, and I mean the specific ask: if you run a benchmark from this site and get a different result, that's not an inconvenience — it's the process working. Tell me in the comments, or open an issue on the [benchmark suite repo](https://github.com/ofri-peretz/eslint-benchmark-suite). No external correction has landed yet, which I'm noting explicitly because that's not the same claim as "no errors exist" — it just means the two errors caught so far were both mine, not a reader's. A benchmark that's only ever been run once, by the person who built the tool it favors, hasn't been tested. It's been asserted.

---

## Why n=40 fixtures can't support a p-value — and when they can

I want to be as careful about overclaiming rigor as I am about overclaiming results.

The ESLint fixture suites run 40 vulnerable patterns per benchmark. That's a real, useful count — enough to see a plugin miss entire categories, like `eslint-plugin-security` catching zero of four SQL injection fixtures (full precision/recall/F1 numbers are in the [linked benchmark](https://dev.to/ofri-peretz/i-benchmarked-17-eslint-security-plugins-only-one-found-every-vulnerability-c83), so the math is checkable against the actual TP/FP/FN counts, not just the headline ratio). It is not enough to support a confidence interval or a p-value, and I'm not going to attach one just because it would look more rigorous. A precision/recall/F1 table on n=40 is an honest description of what happened on this suite; it is not a population-level statistical claim.

There's one place in this corpus where the sample size actually justified a significance test: comparing vulnerability rates across [three AI models generating 80 functions each](https://dev.to/ofri-peretz/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities-414o), a chi-squared test on the model-vs-model difference came back χ² = 0.640, p > 0.05 — no statistically significant difference between models. That's the same discipline as point 3 above, running the other direction: the data said "no difference," and that's what got published, not a headline claim the sample couldn't support.

---

## The five controls that constitute achievable rigor for a solo creator

I'm not going to keep writing "a formal audit is still the real bar, I just haven't gotten there yet" into these articles. For a solo creator, the five things above are the actual, achievable version of rigor: upfront disclosure, methodology you can run yourself, failures shown next to wins, verify-it-yourself framing, and an open invitation to be checked. Claiming a stricter bar I can't clear wouldn't make the benchmarks more trustworthy — it would just move the dishonesty from the numbers into the methodology section.

What can improve from here is the evidence *under* this bar: more reproduction reports, more corrections logged in the open, more competitors' numbers re-verified as they ship new versions. That's a floor that accumulates, not a ceiling I'm still climbing toward.

---

*Has a vendor's own benchmark ever changed which tool your team shipped — and did you later find out the benchmark was wrong? I'd like to hear that story more than a general opinion on trust.*

---

## Related deep dives

- [1.5M Weekly Downloads, 1 False Alarm per Real Bug: the eslint-plugin-security False-Positive Tax](https://ofriperetz.dev/articles/eslint-security-fn-fp-benchmark) — the benchmark this process backs, including the fixture-bias methodology section
- [I Benchmarked 17 ESLint Security Plugins](https://dev.to/ofri-peretz/i-benchmarked-17-eslint-security-plugins-only-one-found-every-vulnerability-c83) — where the Node-version false-zero was caught and fixed before publishing
- [I Let Claude Write 80 Functions. 65-75% Had Security Vulnerabilities.](https://dev.to/ofri-peretz/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities-414o) — the source of the chi-squared result cited above
- [My Credential Rule Reported 842 Secrets in vercel/ai. The Real Count Was 0.](https://dev.to/ofri-peretz/my-credential-rule-reported-842-secrets-in-vercelai-the-real-count-was-0-249p) — another too-clean result that turned out to be wrong, same discipline of catching it
- [Interlace ESLint Ecosystem Docs](https://eslint.interlace.tools) — full rule documentation

---

*Part of the [Interlace ESLint ecosystem](https://eslint.interlace.tools). Source on [GitHub](https://github.com/ofri-peretz/eslint) · npm: [@interlace](https://www.npmjs.com/~ofri-peretz) · Follow: [Dev.to/ofri-peretz](https://dev.to/ofri-peretz) · [ofriperetz.dev](https://ofriperetz.dev)*
