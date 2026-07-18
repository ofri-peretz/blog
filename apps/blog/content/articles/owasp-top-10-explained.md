---
title: "OWASP Top 10, Explained: An Address System, Not a Severity Scale"
description: "A03:2021 is Injection. That's an address, not a severity. What the OWASP Top 10 ordering actually encodes, why 'we cover the Top 10' is a breadth claim and not a depth claim, and how the 2021 categories map onto CWE classes and what a source linter can and cannot see."
slug: "owasp-top-10-explained"
published: true
date: 2026-07-17
tags:
  - "security"
  - "devsecops"
  - "node"
  - "javascript"
canonical_url: https://ofriperetz.dev/articles/owasp-top-10-explained
reading_time_minutes: 6
tier: "T1"
author:
  name: Ofri Peretz
  avatar: https://avatars.githubusercontent.com/u/46347627
  title: Security Engineering Leader
---

A03:2021 is Injection. Read that as an address, not a verdict: the third entry in the 2021 edition of a curated list. A01, Broken Access Control, is not "worse than" A10, Server-Side Request Forgery, the way a Critical CVSS score is worse than a Low one. The ordering compresses three different questions — how often a category showed up in contributed data, how easily it's exploited, and how much damage it does when it lands — into a single rank. Every attempt to read that rank as a severity scale produces a wrong decision somewhere downstream.

The wrong reading shows up constantly in enterprise security questionnaires: "How do you address the OWASP Top 10?" asked as if the list were a compliance standard with ten checkboxes, sorted by importance. It is neither a standard nor a severity scale. It is the most successful awareness document in software security — and "awareness document" is OWASP's own description, not my hedge.

---

## What is the OWASP Top 10 (2021)? {#the-2021-list}

The OWASP Top 10 is a list of ten web application security risk categories, published by OWASP since 2003. Jeff Williams co-created the original edition; the 2021 edition was led by Andrew van der Stock, Brian Glas, Neil Smithline, and Torsten Gigler. Each category is a family of weaknesses, not a single bug: every A-code maps to a list of CWEs, the taxonomy that names the actual weakness shape ([CWE, explained](https://ofriperetz.dev/articles/cwe-taxonomy-explained)).

Two version facts before the table. First, the year is part of the address. Categories merge, split, and renumber between editions — Injection was A1 in the 2017 edition (which used a single-digit `A1` format; the zero-padded `A0X` style arrived with the 2021 edition) and A03 in 2021 — so an A-code without a year is ambiguous by construction. Second, a 2025 edition now exists; this article cites the 2021 edition throughout, because it is the edition still referenced by most tooling and contracts in the field today.

Here is the 2021 list, with a representative CWE class for each category and whether a source-level linter can see it. Each A-code is a family that expands to many CWEs; the column shows one anchor CWE per row, not the full set.

| # | Category (2021) | Representative CWE | Source-visible to a linter? |
|---|---|---|---|
| A01 | Broken Access Control | CWE-284, CWE-639 | Partial — explicit checks visible |
| A02 | Cryptographic Failures | CWE-327, CWE-326 | Yes |
| A03 | Injection | CWE-89, CWE-79, CWE-78 | Yes |
| A04 | Insecure Design | CWE-501, CWE-657 | No — architectural |
| A05 | Security Misconfiguration | CWE-16, CWE-611 | Yes — config in code |
| A06 | Vulnerable and Outdated Components | CWE-1104, CWE-1035 | No — dependency graph |
| A07 | Identification and Authentication Failures | CWE-287, CWE-384 | Yes |
| A08 | Software and Data Integrity Failures | CWE-502, CWE-829 | Yes |
| A09 | Security Logging and Monitoring Failures | CWE-778, CWE-532 | Yes |
| A10 | Server-Side Request Forgery (SSRF) | CWE-918 | Yes |

Two rows carry a No — A04 and A06 — and those two are where most vendor coverage decks quietly stop being honest. The coverage section below is about them.

## What does the numbering mean? {#what-numbering-means}

The 2021 methodology, documented on owasp.org, selected eight of the ten categories from contributed application-testing data and two from a community survey of practitioners; Brian Glas built the CWE-incidence methodology behind the data half. The ordering reflects incidence in that contributed data, blended with estimates of exploitability and impact. It is an editorial compression, and OWASP is open about that.

A stock index orders its members by market cap, not by how good each one is to own — nobody buys the top holding *because* it sits at the top. The OWASP rank works the same way: it weights categories by how often they appeared in the data, not by how much any single finding should scare you. Reading the rank as a severity order is the same mistake as reading index weight as a buy signal.

What the ordering is not: a per-instance severity scale. Category and severity are different measurements with different owners. A category names the family; severity scores one concrete finding. A SQL injection in an internal admin script and one in your public login endpoint are both A03:2021 — same address, and their CVSS scores can sit at opposite ends of the 0.0–10.0 range. When you need to decide how loudly to worry about one finding, that is [CVSS's job](https://ofriperetz.dev/articles/cvss-scores-explained). When you need the precise weakness name, that is CWE's. The Top 10 answers a third question: which families of weaknesses deserve your organization's attention this cycle.

## Is the Top 10 complete coverage? {#not-complete-coverage}

No — and OWASP says so itself. The misconception worth naming here is **"OWASP Top 10 compliance = secure."** It fails twice.

First, "compliance" is the wrong noun. Jeff Williams, who co-created the original 2003 list, has spent two decades repeating the distinction: the Top 10 is an awareness document, not a compliance checklist. OWASP's own answer for teams that want something testable is ASVS — the Application Security Verification Standard — which decomposes "secure" into leveled, verifiable requirements, with the Cheat Sheet Series covering how to fix and the Web Security Testing Guide covering how to verify. If a contract says "OWASP compliance," ASVS is the document that can carry that weight; the Top 10 cannot, and was never designed to.

Second, ten categories is a curated slice, not a taxonomy. CWE enumerates hundreds of weakness types; a codebase can be clean across all ten 2021 families and still ship an exploitable bug that simply lives at a less famous address.

Here is the load-bearing sentence, and you should check it rather than take it: no static-analysis tool can give you "Top 10 compliance" — not one, from any vendor — because two of the ten categories are not visible in source code at all.

## Which categories map to Node.js code? {#nodejs-categories}

Map the ten categories against what a source-level linter can actually see, and eight are genuinely visible in a Node.js codebase: string-built queries (A03), weak hash algorithms (A02), missing security headers (A05), `alg: none` token handling (A07), unsafe deserialization (A08), secrets leaking into logs (A09), user-controlled request URLs (A10), and missing authorization checks on handlers (A01). These are patterns an AST-level rule can match — seven rows carry a Yes, and A01 a Partial (authorization checks are visible where they're written, invisible where they're missing).

The other two are the No rows. A04, Insecure Design, is a design problem: a missing rate limit on a money-moving endpoint does not exist anywhere in the AST — you cannot lint the absence of an architectural decision. A06, Vulnerable and Outdated Components, lives in your dependency graph and a CVE feed; that is `npm audit` and OSV territory, not a linter's. The honest claim for lint tooling is eight categories with real depth and two handed off to other controls. Any vendor claiming all ten should be asked which rule catches a missing rate limit.

## How should you read OWASP tags in tool output? {#reading-owasp-from-tools}

A well-formed security finding carries three tags side by side: a CWE (the weakness name), an OWASP category (the reporting address), and a CVSS-derived severity (how loudly to worry). Three tags because three measurements — collapsing them into one is how a dashboard ends up sorting a low-risk internal finding above a critical public one.

Two reading rules follow. One: "covers the OWASP Top 10" is a breadth claim, never a depth claim. Ask for per-category rule counts and, more importantly, for the named gaps — a vendor who volunteers "A04 and A06 are only partially ours" has read their own coverage honestly. Two: gate your pipeline on severity, never on category. The `OWASP:A03` tag in a finding is a grouping key — count findings per category and you have audit evidence for the questionnaire — but the block-or-allow decision belongs to the per-instance severity score.

For depth, the prior art is OWASP's own: ASVS is the closest existing framework to "verified secure," and any per-rule tool mapping is only the breadth half of a story whose depth half must come from verification, not from a list of ten.

Used this way, the list earns its reputation: Top 10 for shared vocabulary and reporting, CWE for names, CVSS for gates, ASVS when someone says compliance. Four instruments, four jobs — and the Top 10 does its own job better than any document in the field.

---

## Quick Reference {#quick-reference}

| You want | Instrument | What it gives you |
|---|---|---|
| Shared vocabulary for risk families | OWASP Top 10 (2021) | Ten named categories, awareness-ordered |
| The precise weakness name | [CWE](https://ofriperetz.dev/articles/cwe-taxonomy-explained) | A taxonomy node (e.g. CWE-89), no severity |
| Severity of one finding | [CVSS](https://ofriperetz.dev/articles/cvss-scores-explained) | A 0.0–10.0 score per instance |
| A testable security standard | OWASP ASVS | Leveled, verifiable requirements |
| How to fix a weakness class | OWASP Cheat Sheet Series | Per-topic defensive guidance |
| How to verify by testing | OWASP Web Security Testing Guide | Concrete test procedures |

---

## References

OWASP Top 10:2021 (owasp.org/Top10/2021/). The edition cited throughout this article. The per-category pages list every mapped CWE, and the "Methodology" section documents the eight-from-data, two-from-survey selection — worth reading before quoting the list in any policy document.

OWASP Application Security Verification Standard (owasp.org/www-project-application-security-verification-standard/). The document OWASP points to when teams ask for a standard. If "OWASP compliance" appears in a contract you sign, this is what it should mean.

OWASP Cheat Sheet Series (cheatsheetseries.owasp.org). The fix-side companion: concise, maintained, per-topic defensive guidance mapped to Top 10 categories.

OWASP Web Security Testing Guide (owasp.org/www-project-web-security-testing-guide/). The verify-side companion — how to actually test for the weaknesses the Top 10 names.

*Cited by: [Mapping a codebase to the OWASP Top 10 with 247 lint rules](https://ofriperetz.dev/articles/mapping-your-codebase-to-owasp-top-10-with-247-eslint-rules) — a worked example applying this address system to one ecosystem's rule coverage.*

---

If this kind of vocabulary reference earns a place in your review threads, [follow me on Dev.to](https://dev.to/ofri-peretz) and bookmark this one — it is written to be cited, not re-read.

*Foundations series: ← [CWE Taxonomy, Explained](https://ofriperetz.dev/articles/cwe-taxonomy-explained) · [hub](https://ofriperetz.dev/foundations) · [Taint vs. Heuristic Detection](https://ofriperetz.dev/articles/taint-vs-heuristic-detection) →*

*Part of the [Interlace ESLint ecosystem](https://eslint.interlace.tools). Source on [GitHub](https://github.com/ofri-peretz/eslint) · npm: [@interlace](https://www.npmjs.com/~ofriperetz) · Follow: [Dev.to/ofri-peretz](https://dev.to/ofri-peretz) · [ofriperetz.dev](https://ofriperetz.dev)*
