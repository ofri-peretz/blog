---
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/ground-truth-in-security-testing-og.jpg?v=b2"
cover_image: "https://ofriperetz.dev/cdn/blog-cover-image/ground-truth-in-security-testing.jpg?v=b2"
devto_url: "https://dev.to/ofri-peretz/ground-truth-in-security-testing-who-decides-whats-vulnerable-3oek"
devto_id: 4182373
title: "Ground Truth in Security Testing: Who Decides What's Vulnerable?"
description: "To benchmark a security linter or SAST tool, you need labeled examples: 'this code is vulnerable,' 'this code is safe.' That labeling decision IS the ground truth. It's made by a human, not an algorithm — and the benchmark inherits every assumption that human brought."
slug: "ground-truth-in-security-testing"
published: true
date: 2026-07-17
published_at: "2026-07-19T23:40:10.308Z"
tags:
  - "security"
  - "devsecops"
  - "node"
  - "javascript"
canonical_url: https://ofriperetz.dev/articles/ground-truth-in-security-testing
reading_time_minutes: 6
tier: "T1"
series: "Foundations"
arc: 14
author:
  name: Ofri Peretz
  avatar: https://avatars.githubusercontent.com/u/46347627
  title: Security Engineering Leader
---

Every security benchmark begins with a spreadsheet of code patterns and one column left blank: vulnerable, or safe? Build a corpus of 40 patterns and you fill that column 40 times. Most calls are easy. A handful decide what the whole benchmark actually measures.

Take `SELECT * FROM users WHERE id = ` + userId — direct string concatenation with unsanitized input, the textbook SQL injection shape. Label it **vulnerable** and move on.

Now `SELECT * FROM users WHERE id = ` + parseInt(userId). Is `parseInt()` sufficient sanitization? It depends entirely on what "vulnerable" means to your threat model. If your concern is direct string injection: no — `parseInt()` coerces to an integer (or `NaN`), and there's no injection vector with a valid integer in that position. If your concern is that _any_ non-parameterized query is unsafe regardless of the sanitizing layer: yes. Same line of code, opposite labels.

Whichever way you call it, that call _is_ the ground truth. Label it safe, and a linter that flags `parseInt(userId)` scores a false positive. Label it vulnerable, and the same linter firing scores a true positive. Neither benchmark is wrong — they measure against different ground truths, and every F1 score downstream inherits the choice.

---

## What Ground Truth Is {#what-ground-truth-is}

In machine learning and empirical testing, **ground truth** is the set of human-assigned correct labels a tool is evaluated against — in security testing, "vulnerable" or "safe" for a given code pattern. Every F1, precision, and recall number is computed against this labeled set, which makes each number only as meaningful as the labels behind it.

Ground truth is not a fact about the world; it's a judgment, made by a person, a committee, or a standards body, and it's only as good as the expertise, consistency, and threat-model assumptions behind it. Sources rank from weakest to strongest: solo author judgment, published standards like OWASP or CWE, expert-committee consensus, confirmed CVEs, and curated external datasets like NIST SARD (full ranking in the [quick-reference table](#quick-reference) below).

A corpus that maps every pattern to a specific CWE sits well above pure author judgment — the categories are community-reviewed — but it still leaves edge cases for the author to resolve inside each definition. The `parseInt(userId)` call is exactly that: an author judgment made inside the CWE-89 (SQL Injection) definition.

For [how these labels translate into TP/FP/FN/TN counts](https://ofriperetz.dev/articles/confusion-matrix-tp-fp-fn-tn), the confusion matrix article covers the underlying math.

---

## The Two Hard Decisions {#hard-decisions}

Ground truth gets complicated at two recurring boundaries in security testing. These aren't obscure edge cases — they're the places where every benchmark author makes an unspoken assumption that shapes every number in the results table.

**1. Context-dependent vulnerability**

`exec(cmd)` where `cmd` comes from an environment variable — is that vulnerable? If the variable is set by a deploy script on a hardened CI runner, the practical risk is low. If it can be influenced by a downstream system or a config file an attacker can modify, it's command injection waiting to happen.

A static analyzer sees that `cmd` flows from `process.env.SOME_VAR`. It cannot see your deployment model. The label depends on context the code itself doesn't contain — which is exactly why taint-flow rules and heuristic pattern-matching rules disagree on identical code: they encode different assumptions about what context is available. See [Taint vs. Heuristic Detection](https://ofriperetz.dev/articles/taint-vs-heuristic-detection) for the mechanics.

An author who models a threat actor controlling user input — not one who can rewrite environment variables — labels the `process.env` pattern **safe** for command injection. A red team assessing a Kubernetes deployment where env vars come from ConfigMaps labels it vulnerable. Different context, different ground truth, different numbers.

**2. Defense-in-depth patterns**

Input validated and sanitized at one layer, then passed through several intermediate functions to what looks like a dangerous call site. Is the call site vulnerable?

If the validation is correct and nothing re-introduces taint downstream, the call site is technically safe — but "the validation is correct" is a runtime guarantee static analysis usually can't verify without full cross-function data-flow tracking. A common convention is to label by whether the call site itself sanitizes, and to note in the fixture reasoning when a defense-in-depth setup would flip the label.

That's a systematic bias, and an honest corpus names it: labeling by call-site pattern undercounts tools that do full data-flow analysis and overcounts tools that miss the taint source entirely. The [CWE taxonomy](https://ofriperetz.dev/articles/cwe-taxonomy-explained) covers how CWE definitions handle this — they define the weakness at the point of introduction, not the point of impact.

---

## How a Ground Truth Corpus Gets Built {#building-a-corpus}

Selecting and labeling patterns well takes a documented process, not a hunch. Each candidate should clear three bars:

- **It appears in real code** — npm packages, GitHub repos, CVE-linked commits — not a synthetic construction invented to flatter one rule.
- **It's verifiable by reading the code** without full data-flow analysis, since that's what most linters do; testing beyond that unfairly penalizes tools without taint tracking.
- **It represents the CWE definition's central case**, not a corner case chosen to trip up one implementation.

Every vulnerable fixture should carry its specific CWE and OWASP Top 10 category in a header comment, and the borderline calls should carry their reasoning inline. The `parseInt(userId)` fixture earns an annotation like "borderline; would be vulnerable if the query used string interpolation instead of the typed value" — naming the exact condition under which a different threat model flips the label. The annotation is part of the ground truth, not an afterthought.

> **Cited by:** a worked 40-fixture corpus built to this discipline — every label with a published CWE and its reasoning — backs the [FP-tax benchmark](https://ofriperetz.dev/articles/eslint-security-fn-fp-benchmark) and is documented in full in the [benchmark suite](https://github.com/ofri-peretz/eslint-benchmark-suite).

---

## NIST SARD and External Ground Truth {#nist-sard}

The closest thing to an authoritative external ground truth for static analysis is [NIST's Software Assurance Reference Dataset (SARD)](https://samate.nist.gov/SARD/) — curated, peer-reviewed, the "level 5" entry in the ranking above. It's built for C, C++, Java, PHP, and C#, with little meaningful Node.js coverage (JWT validation, ORM query-builder injection, fetch-based SSRF), which is why Node.js security corpora are usually built from scratch rather than adapted from it.

---

## The Ground Truth Review Problem {#review-problem}

A corpus built by a single author has a structural limitation: the author's blind spots encode into the labels. Miss that `pg-promise`'s named-parameter syntax provides parameterization, and you might label `db.any('SELECT * FROM users WHERE id = ${userId}', { userId })` vulnerable when it's actually safe — the `${}` there is pg-promise's own placeholder syntax, parsed by the library at runtime, not string concatenation (and it's a plain quoted string, not a JS tagged template — the two look alike and behave nothing alike). That's a ground-truth error, and it would register every tool that correctly calls the pattern safe as a false negative.

The mitigation is transparency and external review: publish the corpus, attach every label's reasoning, and make an issue tracker the explicit channel for challenging a call — cite the CWE definition, argue the case. But no challenge arriving is not the same as the labels being correct; it may just mean no one with the domain knowledge has looked hard enough yet. Silence is not validation.

The formal version of that review measures whether independent reviewers agree at all. If two security engineers label the same 40 patterns and split on 5 of them, you have two ground truths, and the same tool scores two different F1s depending on which one it ran against. [Cohen's kappa](https://ofriperetz.dev/articles/inter-rater-agreement-cohens-kappa) is the metric for exactly that disagreement, corrected for the agreement chance alone would produce.

A value investor will tell you the price is a fact and the value is an argument you have to defend. Ground truth is the same trade: the label looks like a fact printed beside the code, but it's an argument you made and might lose. Publish it like an argument — reasoning attached — not like a verdict.

> **Named misconception:** "Ground truth is objective." It's the set of labels someone chose. The label is a decision, not a discovery.

---

## Quick Reference {#quick-reference}

| Source | Strength | Weakness |
|--------|----------|----------|
| Author judgment | Fast, domain-specific, matches the actual codebase context | Inherits author's assumptions and blind spots; not independently reviewed |
| Published standards (OWASP/CWE) | Community-validated categories; labels are anchored to documented definitions | Doesn't resolve edge cases within categories; ambiguities still require author calls |
| Expert committee | Reduces individual bias; disagreements surface ambiguous cases explicitly | Expensive, slow, still subjective on edge cases; rarely done for open-source tooling |
| CVE database | Real-world exploits; "vulnerable" confirmed by actual impact | Doesn't cover patterns that are exploitable but haven't been exploited yet |
| NIST SARD | Authoritative, curated, peer-reviewed by a standards body | Built for C/C++/Java/PHP/C#; very few Node.js patterns; doesn't cover modern framework patterns |

---

## References

NIST SAMATE. (2024). *Software Assurance Reference Dataset (SARD)*. National Institute of Standards and Technology. https://samate.nist.gov/SARD/ — The primary public repository of labeled vulnerable software; the closest thing to an authoritative external ground truth for static analysis tools.

Jacobs, A. Z., & Wallach, H. (2021). Measurement and fairness. *Proceedings of the 2021 ACM Conference on Fairness, Accountability, and Transparency (FAccT)*. https://doi.org/10.1145/3442188.3445901 — On measurement validity in machine learning systems; the concept of construct validity (are you measuring what you think you're measuring?) applies directly to security ground truth.

Krippendorff, K. (2004). *[Content Analysis: An Introduction to Its Methodology](https://books.google.com/books/about/Content_Analysis.html?id=q657o3M3C8cC)* (2nd ed.). SAGE Publications. — The standard reference for inter-rater reliability; the quantitative method for measuring how much two human labelers agree, which is what you'd need to formally validate a security ground truth corpus.

MITRE. (2024). *Common Weakness Enumeration (CWE)*. https://cwe.mitre.org — The community-maintained taxonomy of software weaknesses; using CWE IDs anchors ground truth labels to a community-reviewed definition rather than to individual author judgment alone.

---

*Foundations series: ← [Composite scores & weighting](https://ofriperetz.dev/articles/composite-scores-and-weighting) · [hub](https://ofriperetz.dev/foundations) · [CVSS scores](https://ofriperetz.dev/articles/cvss-scores-explained) →*

*Part of the Interlace ESLint ecosystem. [Source on GitHub](https://github.com/ofri-peretz/eslint-benchmark-suite) · [npm](https://www.npmjs.com/search?q=%40interlace) · Follow: [Dev.to/ofri-peretz](https://dev.to/ofri-peretz) · [ofriperetz.dev](https://ofriperetz.dev)*
