---
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/how-to-design-a-ground-truth-corpus-og.jpg?v=b2"
cover_image: "https://ofriperetz.dev/cdn/blog-cover-image/how-to-design-a-ground-truth-corpus.jpg?v=b2"
devto_url: "https://dev.to/ofri-peretz/fixtures-first-rules-second-how-to-design-a-ground-truth-corpus-1g05"
devto_id: 4183784
title: "Fixtures First, Rules Second: How to Design a Ground-Truth Corpus"
description: "Building the 40-fixture corpus behind the Interlace security benchmarks meant making 40 judgment calls. The full design discipline: category selection, edge-case labeling, version pinning, corpus lifecycle, robustness checks — and Fixture Cards, a per-fixture documentation standard."
slug: "how-to-design-a-ground-truth-corpus"
published: true
date: 2026-07-19
published_at: "2026-07-20T04:43:02.552Z"
tags:
  - "security"
  - "devsecops"
  - "eslint"
  - "javascript"
canonical_url: https://ofriperetz.dev/articles/how-to-design-a-ground-truth-corpus
tier: "T2"
reading_time_minutes: 8
author:
  name: Ofri Peretz
  avatar: https://avatars.githubusercontent.com/u/46347627
  title: Security Engineering Leader
---

`'SELECT * FROM users WHERE id = ' + userId` is a vulnerable fixture — no debate. Wrap the input in `parseInt(userId)` — vulnerable or safe? The label depends entirely on your threat model, and whichever way the author calls it, [that call _is_ the ground truth](https://ofriperetz.dev/articles/ground-truth-in-security-testing#hard-decisions). The corpus behind the Interlace security benchmarks took 40 calls like that one; `parseInt` is the call I've gone back and forth on longest — it's still not in the corpus, which is itself a judgment call. And the cost of getting the discipline wrong isn't hypothetical: this corpus scores its own author's tool at a perfect 100% — a number that reads as evidence only because the fixtures demonstrably came first, and as a mirror otherwise. That discipline — categories, borderline labels, and the sequencing rule — is the rest of this article.

---

## Why do fixtures have to come before rules? {#fixtures-before-rules}

Write the corpus _after_ the tool, with one eye on what it already detects, and the fixtures inherit its blind spots — the benchmark stops measuring and starts reflecting. That's [Goodhart's Law](https://ofriperetz.dev/articles/goodharts-law-explained) operating at design time.

The defense is sequencing: this corpus was designed against published OWASP categories and CWE mappings before any Interlace rule existed to cover it, and its 38 safe patterns represent realistic validated code, not Interlace's allow-listing logic. Sequencing bounds the [bias](https://ofriperetz.dev/articles/bias-in-measurement), not removes it — the same person still wrote both sides of the test.

## How do you choose categories — and how many of each? {#category-selection}

Anchor categories to a public taxonomy, not instinct. The vulnerable corpus is 40 exported fixture functions across 14 categories, each mapped to a [CWE ID](https://ofriperetz.dev/articles/cwe-taxonomy-explained) — from four SQL-injection fixtures (CWE-89) down to a single open redirect (CWE-601), 17 distinct CWE IDs in total. Paired with those are 38 safe fixtures — 78 in all ("the 40-fixture corpus" names the vulnerable half; [precision](https://ofriperetz.dev/articles/precision-recall-f1-for-static-analysis) is computed against the safe half).

Prior art: NIST's SARD is the canonical labeled vulnerable-code corpus family — the Juliet suites cover C/C++ and Java, with PHP and C# suites alongside; OWASP's Benchmark Project is the closest scored SAST analog; and SecBench.js (ICSE 2023) labels ~600 real-world server-side JavaScript vulnerabilities with executable exploits. What none of them offered Node.js-native is an OWASP-Benchmark-style scored SAST leaderboard — this corpus is that analog, smaller.

One distortion to own out loud: the corpus is roughly balanced across categories and production code is not — real vulnerabilities are rare, so a balanced corpus says nothing about the false-alarm rate at [production base rates](https://ofriperetz.dev/articles/base-rate-problem-explained). It measures detection per pattern; prevalence needs different evidence.

## How do you label the edge cases? {#labeling-edge-cases}

The `parseInt` label is an author judgment inside the CWE-89 definition, and it earns an annotation carrying its reasoning: _borderline; would be vulnerable if the query used string interpolation instead of the typed value_. The generalizable rule: record the reasoning, not just the verdict. Six months later, a label without reasoning is an opinion with tenure.

This corpus has one rater, and [inter-rater agreement](https://ofriperetz.dev/articles/inter-rater-agreement-cohens-kappa) needs at least two — there is no kappa to report, only me agreeing with myself. That's the weakest joint in the design, and why the reasoning must be public: so a second rater can show up later and disagree precisely.

Labels live _with_ the code: a manifest at the fixture file's bottom (`EXPECTED_DETECTIONS`: function → `{cwe, severity}`; `EXPECTED_NO_DETECTIONS`: the safe list) is what the runner imports to score [TP/FP/FN/TN](https://ofriperetz.dev/articles/confusion-matrix-tp-fp-fn-tn) — no spreadsheet drifting out of sync.

## How do you make a corpus result reproducible? {#pinning-and-publishing}

A corpus result is a claim about specific tool versions — the [unicorn false-zero](https://ofriperetz.dev/articles/bias-in-measurement#the-unicorn-incident) in my own benchmark came from a stale Node version in the shell, not from the plugin. [Reproducibility](https://ofriperetz.dev/articles/reproducibility-vs-replicability) rests on three mechanisms, none of them "trust the manifest": a lockfile pins the install; the runner resolves each plugin's actually-installed version at run time and writes it into the results JSON; and the environment ships with the numbers — per run, inside each results file, because runs happen on different days on different Nodes. The Interlace 3.0.2 run behind the 40 TP / 0 FP / 0 FN line records Node v24.12.0, ESLint 9.39.2, measured 2026-05-30; the sonarjs 3.0.6 run (14/40) records the same environment a day earlier, 2026-05-29. One plugin (`eslint-plugin-security` 2.1.1) crashes on ESLint 9 and runs in a separate compat package — it declares `eslint ^8.57.0` and lets its lockfile hold the exact version — recorded, not smoothed over.

The other half is publishing: corpus public, divergence channel public, and reproduction that needs zero help from me:

```bash
git clone https://github.com/ofri-peretz/eslint-benchmark-suite.git
cd eslint-benchmark-suite && npm install
npm run benchmark:fn-fp   # → node benchmarks/fn-fp-comparison/run.js
```

Run it, get a different number, open an issue — your results JSON carries its own environment block, so the disagreement starts from evidence, not recollection. A corpus nobody can re-run is a claim, not a benchmark.

## What can 40 fixtures actually prove? {#what-n-supports}

The 78 fixtures are a constructed set, not a random draw, so results are descriptions, not inferences — no p-value is meaningful at any corpus size, because [statistical power](https://ofriperetz.dev/articles/sample-size-and-statistical-power) assumes a sampling process this design doesn't have. What n=40 is good at is category-level findings: a plugin catching 14 of 40 while missing whole categories is a real, checkable statement about that plugin at that version. Don't decorate results with statistics the design can't carry.

## What is the corpus lifecycle? {#corpus-lifecycle}

The lifecycle: design → publish → saturate → refresh.

Saturation is where mine is now: Interlace v3.0.2 scores 40 TP, 0 FP, 0 FN — 100/100/100 precision/recall/F1. The tempting read is "the tool is finished." The correct read: the _corpus_ is finished, for that tool — a saturated corpus can't measure the improvement of the tool that saturates it. Publishing that line felt less like winning and more like watching the instrument go quiet. The corpus still measures competitors (next best: 14 of 40, eslint-plugin-sonarjs 3.0.6), but for Interlace it's now a regression test, not a benchmark.

Then contamination: public fixtures can be tuned against — by any tool, mine included. Public corpora decay the way public trading signals do: once everyone sees the signal, trading on it erases the information it carried. The answer is versioning, not secrecy (secrecy kills reproducibility): treat the published corpus as v1 and plan a harder v2 held to the same fixtures-before-rules discipline — anchored to the taxonomy, not to any tool's known behavior, Interlace's misses included.

## Which findings survive a robustness check? {#robustness-checks}

Before publishing, run leave-one-category-out: re-score the leaderboard 14 times, once per removed CWE category, and check whether the ordering survives every drop. A 40/40-versus-14/40 gap survives any single removal by construction; two mid-table plugins a fixture apart may swap the moment a category disappears — that's the ranking to report as fragile, or not as a ranking at all. Cheap, mechanical, and almost nobody does it.

## What are Fixture Cards? {#fixture-cards}

The last discipline is documentation, and it deserves a name: **Fixture Cards** — per-fixture documentation modeled on Datasheets for Datasets (Gebru et al.) and Model Cards (Mitchell et al.), scaled down to the single labeled example. Six fields:

| Field         | The `parseInt` fixture's card would read                                                                                      |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **CWE**       | CWE-89                                                                                                                        |
| **Label**     | threat-model-conditional: vulnerable under "any non-parameterized query is unsafe"; safe under "direct injection vector only" |
| **Reasoning** | borderline; would be vulnerable if the query used string interpolation instead of the typed value                             |
| **Author**    | Ofri Peretz                                                                                                                   |
| **Date**      | the day the call is made, pinned to the corpus version it enters                                                              |
| **Disputed?** | open — threat-model-dependent                                                                                                 |

Four of the six fields already exist in the suite: CWE and label live in the manifest the runner imports, author and date in the fixture file's git history. The Card names that standard and adds the two fields no runner ever checks — reasoning and dispute status. Packaging all six as a JSON schema is the remaining step, and it doubles as the contribution unit: to submit a fixture is to submit its Card. Labeling debt stops accumulating silently, and the single-rater problem gets its structural fix — every `disputed?` field is an open seat for a second rater.

The `parseInt` Card above is the first open seat, and it's yours if you want it: comment with your label — vulnerable or safe — and the threat model that produces it. That's the second rating this corpus doesn't yet have.

---

## Quick reference {#quick-reference}

| Design decision         | The rule                                               | If you skip it                                 |
| ----------------------- | ------------------------------------------------------ | ---------------------------------------------- |
| Sequencing              | Fixtures before rules                                  | The benchmark becomes a mirror                 |
| Category selection      | Anchor to CWE/OWASP (here: 14 categories, 17 CWE IDs)  | Blind spots inherited from instinct            |
| Balance                 | Balanced corpus — and say what it can't estimate       | Base-rate overclaims about production FP rates |
| Edge-case labels        | Record reasoning with the label; mark borderline calls | Labels become opinions with tenure             |
| Machine-readable labels | Manifest lives in the fixture file; runner imports it  | Spreadsheet drift                              |
| Versions                | Lockfile + per-run resolved versions in the results    | Irreproducible numbers                         |
| Publishing              | Public corpus + a divergence channel                   | A claim, not a benchmark                       |
| Sample claims           | n=40 describes; it does not infer                      | Fake statistical rigor                         |
| Lifecycle               | Version the corpus; plan v2 at saturation              | 100% scores misread as "done"                  |
| Robustness              | Leave-one-category-out before publishing               | Fragile rankings published as real             |
| Fixture Cards           | CWE · label · reasoning · author · date · disputed?    | Labeling debt accumulates silently             |

---

Corpus design is the unglamorous half of benchmarking — nobody stars a repo for a well-reasoned borderline label. But every downstream precision and recall number is only as honest as these decisions. Next in this arc the corpus does its job: the [false-positive/false-negative benchmark](https://ofriperetz.dev/articles/eslint-security-fn-fp-benchmark) scores six plugins against these 78 fixtures, wins and losses included.

If this is the discipline you'd want behind a benchmark you trust, the corpus — fixtures, manifests, runner, results — is public:

{% cta https://github.com/ofri-peretz/eslint-benchmark-suite %} ⭐ Star the benchmark suite — every fixture and label in this article is in it {% endcta %}

---

## References

- [NIST SARD — Software Assurance Reference Dataset](https://samate.nist.gov/SARD/) (incl. the Juliet Test Suite) — the canonical labeled vulnerable-code corpora for C/C++/Java; this corpus is the Node.js-native analog, at a fraction of the scale.
- [OWASP Benchmark Project](https://owasp.org/www-project-benchmark/) — the closest prior art overall: a public, scored SAST benchmark on the same TP/FP mechanics.
- Gebru et al., ["Datasheets for Datasets"](https://arxiv.org/abs/1803.09010) (CACM 2021) — the dataset-documentation standard Fixture Cards are modeled on.
- Mitchell et al., ["Model Cards for Model Reporting"](https://arxiv.org/abs/1810.03993) (FAT\* 2019) — the same documentation move at model level; Fixture Cards scale it down to the single labeled example.

## Related deep dives

- [Ground Truth in Security Testing: Who Decides What's Vulnerable?](https://ofriperetz.dev/articles/ground-truth-in-security-testing) — the T1 vocabulary this article builds on, including the full `parseInt` labeling story
- [I Built What I Benchmark. Here's How I Try Not to Cheat.](https://ofriperetz.dev/articles/i-built-what-i-benchmark-heres-how-i-try-not-to-cheat) — the conflict-of-interest process this corpus discipline lives inside
- [1.5M Weekly Downloads, 1 False Alarm per Real Bug](https://ofriperetz.dev/articles/eslint-security-fn-fp-benchmark) — the evidence article produced by this corpus

---

_Part of the [Interlace ESLint ecosystem](https://eslint.interlace.tools). Source on [GitHub](https://github.com/ofri-peretz/eslint) · npm: [@interlace](https://www.npmjs.com/~ofriperetz) · Follow: [Dev.to/ofri-peretz](https://dev.to/ofri-peretz) · [ofriperetz.dev](https://ofriperetz.dev)_
