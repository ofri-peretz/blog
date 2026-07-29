---
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/cvss-scores-explained-og.jpg"
cover_image: "https://ofriperetz.dev/cdn/blog-cover-image/cvss-scores-explained.jpg"
devto_url: "https://dev.to/ofri-peretz/cvss-scores-explained-the-number-measures-severity-not-risk-4k6i"
devto_id: 4182369
title: "CVSS Scores Explained: The Number Measures Severity, Not Risk"
description: "A scanner can print CVSS 9.1 and the word LOW on the same line. What the score actually measures, what it doesn't, and why you should gate on the number — never the word."
slug: "cvss-scores-explained"
published: true
date: 2026-07-17
tags:
  - "security"
  - "devsecops"
  - "node"
  - "javascript"
canonical_url: https://ofriperetz.dev/articles/cvss-scores-explained
reading_time_minutes: 7
tier: "T1"
series: "Foundations"
arc: 15
author:
  name: Ofri Peretz
  avatar: https://avatars.githubusercontent.com/u/46347627
  title: Security Engineering Leader
---

CVSS 9.1 and the word `LOW`, four characters apart, printed on the same line by a scanner. 9.1 sits a tenth of a point past the boundary where CVSS v3.1 starts saying *Critical*; `LOW` is the bottom band of the same scale. Both can describe one finding — a Server-Side Request Forgery, CWE-918 — and nothing in the pipeline that printed them is obliged to notice they disagree. Store a severity word as its own field instead of deriving it from the number, and the two are free to drift; across a large enough rule set, they reliably do.

The mislabels survive because "CVSS score", "severity label", and "risk" get treated as one interchangeable thing. They are three different things — and two of them are not even CVSS's job.

## What Does CVSS Actually Measure? {#what-cvss-measures}

CVSS — the Common Vulnerability Scoring System, maintained by [FIRST.org](https://www.first.org/cvss/) — is a formula that turns structured judgments about a vulnerability into a number from 0.0 to 10.0. The version you will meet almost everywhere is v3.1; v4.0 was published in 2023, but as of 2026 most scanners and most NVD data still speak v3.1, so it is worth checking which version a given score came from.

The base score combines two groups of metrics. First, how reachable the flaw is:

| Metric | Question it answers | Values |
|---|---|---|
| Attack Vector (AV) | From where can it be exploited? | Network, Adjacent, Local, Physical |
| Attack Complexity (AC) | Does it need conditions the attacker can't control? | Low, High |
| Privileges Required (PR) | What access must the attacker already have? | None, Low, High |
| User Interaction (UI) | Must a victim do something? | None, Required |

Second, what a successful attacker gets:

| Metric | Question it answers | Values |
|---|---|---|
| Confidentiality (C) | Can data be read? | None, Low, High |
| Integrity (I) | Can data or behavior be changed? | None, Low, High |
| Availability (A) | Can service be denied? | None, Low, High |
| Scope (S) | Does impact escape the vulnerable component? | Unchanged, Changed |

Each answer becomes a letter in a vector string, and the vector is the part worth reading. Here is a vector behind that SSRF score: `AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N` → **9.1**. Read aloud: exploitable from the network, no special conditions, no privileges, no user participation; high impact on confidentiality and integrity — an SSRF reads internal services and forges requests against them — with no direct availability impact. Flip two of those judgments — Scope to Changed (the damage escapes the vulnerable component) and Availability to High — and the same flaw computes to a perfect `10.0`: that is the exact vector behind Log4Shell. The vector is an argument; the score is its summary, and moving one letter moves the number almost a full point. When someone hands you a bare score, ask for the vector — it is the difference between a conclusion and a reason.

## The Severity Bands {#bands}

The words — Low, Medium, High, Critical — are lookups of the number, defined in the v3.1 specification:

| Score (CVSS v3.1) | Band |
|---|---|
| 0.0 | None |
| 0.1–3.9 | Low |
| 4.0–6.9 | Medium |
| 7.0–8.9 | High |
| 9.0–10.0 | Critical |

A band is a *view* of the score, nothing more. The moment a label is stored as its own field instead of derived from the number, the two can drift — and they drift in both directions. A 9.8 authentication bypass (CWE-287) printed as `MEDIUM` under-labels: it quietly ships risk. A 7.5 finding printed as `CRITICAL` over-labels: it burns triage credibility, because the first time an engineer investigates a "critical" that isn't, they discount the next one.

In chess the move you check twice is the one in the winning position — the comfortable evaluation is exactly where the overlooked tactic hides. A severity label reading `LOW` over a 9.1 is that comfortable evaluation: the calm word is the one worth distrusting. Store the number. Derive the word at display time.

## What Doesn't CVSS Measure? {#what-cvss-doesnt-measure}

The most common misreading of CVSS — the named misconception of this article — is: **"the score tells you how likely exploitation is."** It does not. CVSS scores the *worst-case impact assuming exploitation happens*. The CVSS Special Interest Group's own position, stated plainly by v4.0-era co-chairs Dave Dugal and Dale Rich, is that CVSS measures severity, not risk. Risk needs at least two more inputs that CVSS deliberately does not carry, and each has its own standard and its own owner.

### Severity, Probability, Actuality {#cvss-epss-kev}

- **Probability** — will this actually get exploited? That is [EPSS](https://www.first.org/epss/), FIRST's Exploit Prediction Scoring System, created by Jay Jacobs and Sasha Romanosky: a daily-updated model estimating the probability a vulnerability is exploited in the wild within the next 30 days.
- **Actuality** — is it being exploited *right now*? That is [CISA KEV](https://www.cisa.gov/known-exploited-vulnerabilities-catalog), the Known Exploited Vulnerabilities catalog: not a prediction, a confirmed sighting list.
- **Your context** — does it matter *here*? CVSS knows nothing about your attack surface, your compensating controls, or what data sits behind the vulnerable path. [SSVC](https://www.cisa.gov/ssvc) replaces the scalar entirely with a decision tree that ends in an action, not a number.

Severity, probability, actuality: three different measurements, three different owners. They compose instead of competing — a Critical that nobody exploits can rationally wait behind a Medium that just landed in KEV. Knowing how much you could lose without knowing the odds is half a risk model, and CVSS alone is exactly that half.

One more gap that matters for static analysis specifically: CVSS assumes the vulnerability is real. A static-analysis finding carries *detection confidence* — heuristic rules produce maybes, deterministic checks produce certainties — and that is an entirely separate axis from impact. I unpack that axis in [taint vs heuristic detection](https://ofriperetz.dev/articles/taint-vs-heuristic-detection).

## CWE vs CVE vs CVSS {#cwe-vs-cve-vs-cvss}

Three acronyms, routinely swapped for each other, answering three different questions:

| System | What it is | Question it answers | Owner | Example |
|---|---|---|---|---|
| CWE | Taxonomy of weakness *types* | What kind of flaw is this? | MITRE | CWE-918 (SSRF) |
| CVE | Registry of vulnerability *instances* | Which specific bug in which product? | MITRE / CVE Program | CVE-2021-44228 (Log4Shell) |
| CVSS | Severity scoring *formula* | How bad is the worst case? | FIRST | 9.1 |

A CVE gets a CVSS score; a CWE does not — a weakness type only has *typical* scores for the pattern, which is what a scanner's or a linter's rule metadata encodes. The type system is its own subject, covered in [the CWE taxonomy](https://ofriperetz.dev/articles/cwe-taxonomy-explained). And the [OWASP Top 10](https://ofriperetz.dev/articles/owasp-top-10-explained) is a fourth, different thing again: an awareness ranking built on CWE incidence data, not a scoring system at all.

## How to Use CVSS in a Pipeline {#how-to-use}

Three rules, whatever tool prints your findings:

**Gate on the number, never the word.** A CI severity gate should read `cvss >= 7.0`, not `severity !== 'CRITICAL'`. String labels are display data: they drift, they get renamed, and they can silently disagree with the score sitting next to them. The number survives pipelines; the adjective does not.

**Find where your labels actually come from.** A common root cause of drift is a single enrichment step that forwards the score, the CWE, and the compliance fields — but leaves the severity word to an older naming heuristic. One documented audit traced exactly this pattern across a whole rule set; the full case is in [the CVSS-labeling audit](https://ofriperetz.dev/articles/i-audited-203-of-our-own-eslint-security-rules-16-mislabel-their-own-cvss-score). If your tooling prints a severity word, it is worth one hour to learn which field it reads.

**Prioritize with all three measurements.** KEV membership first (confirmed exploitation outranks everything), EPSS to order the rest by probability, CVSS as the impact bound and tiebreak. A queue sorted by CVSS alone is sorted by worst case, not by expected loss.

CVSS is a good instrument being asked to be three instruments. Used for the one thing it measures — worst-case severity, stated as a vector you can argue with — it holds up. The failures come from making the number carry probability, context, and a hand-stored adjective it never promised to carry.

## Quick Reference {#quick-reference}

| You want to know | Measurement | Owner | Where |
|---|---|---|---|
| How bad is the worst case? | CVSS base score + vector | FIRST | [NVD calculator](https://nvd.nist.gov/vuln-metrics/cvss/v3-calculator) |
| Which severity word applies? | Band lookup of the score | FIRST (v3.1 spec) | 7.0+ High, 9.0+ Critical |
| How likely is exploitation soon? | EPSS probability (30-day) | FIRST | [first.org/epss](https://www.first.org/epss/) |
| Is it exploited right now? | KEV listing | CISA | [KEV catalog](https://www.cisa.gov/known-exploited-vulnerabilities-catalog) |
| What kind of flaw is it? | CWE | MITRE | [cwe.mitre.org](https://cwe.mitre.org) |
| Which specific bug? | CVE | MITRE / CVE Program | [cve.org](https://www.cve.org) |
| What should *we* do about it? | SSVC decision tree | You + CISA | [cisa.gov/ssvc](https://www.cisa.gov/ssvc) |

---

## External References

- FIRST.org, [CVSS v3.1 Specification Document](https://www.first.org/cvss/v3.1/specification-document) — the metric definitions, the formula, and the official band table this article uses.
- FIRST.org, [CVSS v3.1 User Guide](https://www.first.org/cvss/v3.1/user-guide) — scoring guidance and the SIG's own framing of severity vs. risk.
- FIRST.org, [CVSS v4.0 Specification](https://www.first.org/cvss/v4.0/specification-document) — the successor spec (2023); v3.1 remains dominant in tooling and NVD data as of 2026.
- Jacobs, Romanosky et al., [Exploit Prediction Scoring System (EPSS)](https://arxiv.org/abs/1908.04856) — the paper behind FIRST's probability model; the canonical severity-vs-probability citation.
- CISA, [Known Exploited Vulnerabilities Catalog](https://www.cisa.gov/known-exploited-vulnerabilities-catalog) — the actuality list; also the source of federal patching deadlines under BOD 22-01.
- CISA, [Stakeholder-Specific Vulnerability Categorization (SSVC)](https://www.cisa.gov/ssvc) — decision-tree triage; originated at Carnegie Mellon's SEI.

If a scanner ever prints you a scary number and a calm word in the same line, this is the page to have bookmarked — I write one of these references regularly; [follow along on Dev.to](https://dev.to/ofri-peretz).

*Foundations series: ← [Ground Truth in Security Testing](https://ofriperetz.dev/articles/ground-truth-in-security-testing) · [hub](https://ofriperetz.dev/foundations) · [The CWE Taxonomy](https://ofriperetz.dev/articles/cwe-taxonomy-explained) →*

*Part of the [Interlace ESLint ecosystem](https://eslint.interlace.tools). Source on [GitHub](https://github.com/ofri-peretz/eslint) · npm: [@interlace](https://www.npmjs.com/~ofriperetz) · Follow: [Dev.to/ofri-peretz](https://dev.to/ofri-peretz) · [ofriperetz.dev](https://ofriperetz.dev)*
