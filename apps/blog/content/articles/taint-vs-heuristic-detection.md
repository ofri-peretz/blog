---
devto_url: "https://dev.to/ofri-peretz/taint-vs-heuristic-detection-the-difference-between-a-proof-and-a-hunch-1b18"
devto_id: 4182384
title: "Taint vs. Heuristic Detection: The Difference Between a Proof and a Hunch"
description: "A linter flags fetch(userUrl) because of the variable's name — it has never seen the data. Taint analysis hands you a proven path; a heuristic hands you a resemblance. Confusing those two confidence levels is how a CVSS 9.1 ends up printed as LOW."
slug: "taint-vs-heuristic-detection"
published: true
date: 2026-07-17
tags:
  - "security"
  - "eslint"
  - "devsecops"
  - "javascript"
canonical_url: https://ofriperetz.dev/articles/taint-vs-heuristic-detection
reading_time_minutes: 6
tier: "T1"
series: "Foundations"
arc: 18
author:
  name: Ofri Peretz
  avatar: https://avatars.githubusercontent.com/u/46347627
  title: Security Engineering Leader
---

```js
await fetch(userUrl);
```

A linter flags this line in about a millisecond. Here is what it did *not* do in that millisecond: it did not trace where `userUrl` came from, and it did not prove that a request-forgery path exists. It flagged the line because a user-ish name reached a network sink. That is the entire analysis.

Whether that is scandalous or sensible depends on a distinction most tool marketing blurs: **impact-if-real** and **confidence-it's-real** are different axes. The impact axis is brutal — server-side request forgery is CWE-918, and a serious vector scores CVSS 9.1, a tenth of a point past the line where the scale turns Critical (push every judgment to its worst and it tops out at a perfect 10.0). The confidence axis, for a single name-match flag, is modest: a variable name is circumstantial evidence. Print one axis in the other's vocabulary and you get `9.1` and `LOW` four characters apart — and that drift is not hypothetical: a [rule-metadata audit](https://ofriperetz.dev/articles/i-audited-203-of-our-own-eslint-security-rules-16-mislabel-their-own-cvss-score) caught exactly that mislabel in the wild. [CVSS scores what a weakness could do](https://ofriperetz.dev/articles/cvss-scores-explained), never how sure a detector is that it found one — so this page explains the two detection families that sit on opposite ends of the confidence axis.

## What is taint analysis? {#taint-analysis}

Taint analysis answers one question with evidence: **can a value from an untrusted source reach a dangerous sink without passing through a sanitizer?**

The model has three parts. **Sources** produce attacker-influenced data: `req.query`, `req.body`, CLI arguments, file contents. **Sinks** are operations where untrusted data causes damage: `fetch`, `child_process.exec`, a SQL driver call. **Sanitizers** are the functions that clear the taint: parameterization, allowlist validation, encoding. The engine builds a data-flow graph of the whole program, propagates "tainted" labels from sources, and reports only when a complete source-to-sink path exists with no sanitizer on it. The lineage runs straight back to Dorothy Denning's 1976 lattice model of secure information flow; Livshits and Lam made it practical for real web vulnerabilities in 2005.

What makes this expensive is that real paths are indirect. A two-hop flow:

```js
const target = req.query.url;   // source
const opts = { url: target };   // taint flows into a property
await fetch(opts.url);          // sink — three statements, one path
```

Reporting this requires following the value through an assignment, a property write, and a property read — and production paths cross function and file boundaries, which demands a call graph. Aliasing is worse:

```js
const a = { url: DEFAULT };
const b = a;                    // two names, one object
b.url = req.query.url;          // tainting b.url taints a.url
await fetch(a.url);             // sink reached through the alias
```

Sound alias analysis is where most of the computational cost lives, and in JavaScript — `eval`, dynamic property access, framework glue — the graph is never complete. The payoff for all that machinery: when a taint engine reports, it hands you a **path** you can read as a demonstration.

## What is heuristic detection? {#heuristic-detection}

A heuristic rule answers a much cheaper question: **does this code's shape resemble a known-vulnerable pattern?** A non-literal argument reaching `fetch`. A template literal inside `exec()`. A computed property write. No data-flow proof — a resemblance, computed from a single file's AST in milliseconds.

The failure profile is the mirror image of taint analysis: strong catch-rate on patterns it matches, false positives wherever the pattern's premise fails. Picture the classic offender — a rule that flags every computed property access, `obj[key]`, as possible object injection. It fires because it cannot know whether `key` is attacker-controlled, so in a codebase where bracket access is mostly over trusted keys it drowns you: a rule like that can sink to 25% precision — three false alarms for every real finding — all on its own. It is not broken. It is a heuristic priced honestly, and the price is only visible once you [count TP and FP properly](https://ofriperetz.dev/articles/confusion-matrix-tp-fp-fn-tn).

## The false-positive asymmetry {#false-positive-asymmetry}

The two families fail in opposite directions, and the direction is the useful part.

**Taint engines make FN-shaped errors.** Wherever the model can't follow — dynamic dispatch, reflection, a framework's dependency injection — the path silently disappears, and with it the finding. What a taint engine says is trustworthy; what it doesn't say is unknown.

**Heuristic rules make FP-shaped errors.** They over-flag whenever a name or shape misleads, and they miss the flows that never look dangerous at the sink line. Look back at the two-hop example: a single-file heuristic staring at `fetch(opts.url)` sees a property read with nothing user-ish in the name. The flow is invisible without the graph.

Now put the two axes from the hook back together. A taint finding carries high *confidence* — a demonstrated path. A heuristic finding carries an invitation to look. The *impact* axis is untouched by any of this: SSRF is CWE-918 at CVSS 9.1 whether CodeQL proved it or a name-match suggested it. Severity belongs to the weakness; confidence belongs to the detection method. Print one axis in the other's vocabulary and you get `9.1` and `LOW` four characters apart.

## Complementary, not competing {#complementary}

Editor-grade security linters are heuristic **by design**, not by a limitation someone forgot to fix. The design constraints are a single file's AST and a millisecond budget, because the rule runs on every keystroke and every commit. Interprocedural taint tracking under those constraints is not difficult — it is excluded by the specification. Some rules track values within one file's scopes, which is useful, but it is not taint analysis, and the most common misreading in this vocabulary — **"ESLint security rules do taint tracking"** — is simply false. They pattern-match. Knowing this changes how you read a flag: it is a screen, not a verdict.

The right mental model comes from value investing: a stock screener filtering on price-to-earnings does not tell you a company is undervalued — it tells you which filings are worth reading. Heuristic lint is the screener: cheap, immediate, over-inclusive on purpose, run on everything. Taint analysis is the due diligence: expensive, slower, run where the stakes justify it. In a real pipeline that means heuristic rules in the editor and pre-commit, and an interprocedural engine — CodeQL, Semgrep in taint mode — on the pull-request gate or nightly. Where each tool class sits in the broader taxonomy is [its own article](https://ofriperetz.dev/articles/static-analysis-vs-sast-vs-linting); the short version is that they answer different questions, so replacing one with the other means a question goes unanswered.

## What this means for benchmarks {#benchmark-implications}

One honest disclosure follows. A single-file benchmark corpus can only encode *heuristically-detectable* patterns — single-file shapes a lint rule could conceivably match — because [someone had to decide what counts as vulnerable](https://ofriperetz.dev/articles/ground-truth-in-security-testing), and a corpus of one-file fixtures can only hold one-file bugs. So a linter that scores 100% on such a corpus has told you one specific thing: complete coverage of the pattern class the corpus was designed for. It has *not* told you a taint engine is unnecessary, because the multi-file flows a taint engine exists to find are exactly what a single-file corpus cannot encode.

A perfect score on a corpus you built yourself is a tautology wearing a medal — you wrote the test, you wrote the tool, and the number just confirms they agree. The honest reading is the scope statement hiding underneath it: complete coverage of the one pattern class you chose to encode, and silence about everything you left out.

So the one question to ask any static analysis tool — before the demo, before the leaderboard — is: **what evidence does a finding carry?** A path means taint. A resemblance means heuristic. Both are worth paying for; neither substitutes for the other; and a tool that names which one it is doing has already told you how to triage its output.

## Quick reference {#quick-reference}

| | Taint analysis | Heuristic detection |
|---|---|---|
| Core question | Does untrusted data reach a sink unsanitized? | Does this code shape resemble a vulnerable pattern? |
| Evidence per finding | A demonstrated source→sink path | A pattern match |
| Scope | Whole program, cross-file | Single file (one AST) |
| Cost | Minutes; call graph + alias analysis | Milliseconds per file |
| Characteristic error | False negatives (model gaps: `eval`, dynamic dispatch, framework glue) | False positives (premise fails: names and shapes mislead) |
| Where it belongs | PR gate, nightly runs | Editor, pre-commit, CI |
| Examples | CodeQL, Semgrep (taint mode) | ESLint security plugins, single-file lint rules |

## References

- Denning, D. E. (1976). [A lattice model of secure information flow](https://doi.org/10.1145/360051.360056). *Communications of the ACM*, 19(5). The founding citation — every source/sink/label system in use today descends from this model.
- Livshits, V. B., & Lam, M. S. (2005). [Finding security vulnerabilities in Java applications with static analysis](https://www.usenix.org/conference/14th-usenix-security-symposium/finding-security-vulnerabilities-java-applications-static). *USENIX Security Symposium*. The paper that made taint-based static analysis practical against real web-application vulnerability classes.
- Chess, B., & West, J. (2007). *[Secure Programming with Static Analysis](https://books.google.com/books/about/Secure_Programming_with_Static_Analysis.html?id=DnUbmQEACAAJ)*. Addison-Wesley. The standard industrial treatment of both detection families, including why commercial SAST engines mix them.
- OWASP Community: [Static Code Analysis](https://owasp.org/www-community/controls/Static_Code_Analysis). Practitioner-level survey of the technique, with an unusually honest limitations list.

---

This is a vocabulary page — bookmark it for the next time a vendor deck says "taint-aware linting," and [follow me on Dev.to](https://dev.to/ofri-peretz) for the rest of the foundations series.

*Foundations series: ← [OWASP Top 10, Explained](https://ofriperetz.dev/articles/owasp-top-10-explained) · [hub](https://ofriperetz.dev/foundations) · [Static Analysis vs. SAST vs. Linting](https://ofriperetz.dev/articles/static-analysis-vs-sast-vs-linting) →*

*Part of the [Interlace ESLint ecosystem](https://eslint.interlace.tools). Source on [GitHub](https://github.com/ofri-peretz/eslint) · npm: [@interlace](https://www.npmjs.com/~ofriperetz) · Follow: [Dev.to/ofri-peretz](https://dev.to/ofri-peretz) · [ofriperetz.dev](https://ofriperetz.dev)*
