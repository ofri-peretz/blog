---
devto_url: "https://dev.to/ofri-peretz/the-cwe-taxonomy-explained-a-name-is-not-a-verdict-bpl"
devto_id: 4182372
title: "The CWE Taxonomy, Explained: A Name Is Not a Verdict"
description: "CWE-89 means SQL injection. That's a name, not a verdict. What the Common Weakness Enumeration actually encodes — views, abstraction levels, the Top 25 formula — and why a CWE id can never carry a severity."
slug: "cwe-taxonomy-explained"
published: true
date: 2026-07-17
tags:
  - "security"
  - "devsecops"
  - "node"
  - "javascript"
canonical_url: https://ofriperetz.dev/articles/cwe-taxonomy-explained
reading_time_minutes: 7
tier: "T1"
series: "Foundations"
arc: 16
author:
  name: Ofri Peretz
  avatar: https://avatars.githubusercontent.com/u/46347627
  title: Security Engineering Leader
---

CWE-89 is SQL Injection. A name, not a verdict. Nothing in those six characters tells you to drop everything, and nothing tells you to relax.

Here's how easy that is to forget. Two vulnerabilities can carry the identical CWE id and land at opposite ends of the severity scale — a 9.8 for a SQL injection an unauthenticated attacker reaches over the network, a 5.4 for the same weakness behind three auth checks. Same six characters, two verdicts, and the taxonomy was right both times: it named the bug's shape precisely and consistently. It never promised to tell you how loudly to worry. That part is computed per instance, and it's on you.

## What Is a CWE? {#what-cwe-is}

CWE stands for Common Weakness Enumeration: a catalog of software and hardware weakness *types*, maintained by MITRE under CISA sponsorship. The operative word is *enumeration*. Steve Christey Coley — CVE's co-creator and CWE's technical lead — has been consistent: CWE enumerates kinds of mistakes; it does not rank them.

The distinction that makes everything else click is weakness versus vulnerability. A **weakness** is a category of mistake — concatenating untrusted input into a SQL string, evaluating a string as code, redirecting to a URL the user supplied. A **vulnerability** is one concrete occurrence of that weakness in a specific product and version — what CVE catalogs. CWE-89 is "SQL injection, as a concept"; a CVE record is "SQL injection, in this package, in these versions." Categories don't have patches; instances do.

The ids are accession numbers, assigned as entries were created — they carry no meaning. CWE-89 is not one notch worse than CWE-88, and CWE-918 is not ten times anything. Reading arithmetic into the ids is the first habit to drop.

## How Is the Taxonomy Structured? {#structure}

One catalog, several lenses. CWE ships **views** — reorganized slices of the same entries for different audiences. CWE-1000 (Research Concepts) organizes weaknesses by abstraction; CWE-699 (Software Development) groups them by development context; CWE-1003 is the pragmatic one — a deliberately small subset NVD analysts use when labeling CVE records. So any statistic aggregating NVD data "by CWE" is really looking through the CWE-1003 lens, not the full catalog.

Within the catalog, entries sit at four abstraction levels: **pillar → class → base → variant**. Walk one branch down: CWE-707 (Improper Neutralization — a pillar, the broadest statement), through CWE-74 (Injection — a class), to CWE-89 (SQL Injection — a base, the level most tools target), and on to variants like CWE-564 (SQL Injection: Hibernate).

Abstraction level is practical, not trivia. A finding labeled "CWE-707" is technically accurate about nearly everything and useful for nearly nothing; base and variant level is where a label is specific enough to fix, test, and count. Comparing tools by CWE claims, check the level: five base-level CWEs describe more coverage than one pillar.

## Which CWEs Show Up in Node.js Code? {#nodejs-cwes}

Most of what a JavaScript security linter meets concentrates in a short list. Here are the nine I see most in Node.js work, each with the *class* of detector that typically catches it.

| CWE | Name | Typical Node.js shape | Example detector class |
|---|---|---|---|
| CWE-89 | SQL Injection | String-built queries passed to a DB driver | Taint-tracking SAST or a query-builder lint rule |
| CWE-94 | Code Injection | Generating code from user input (`new Function`) | AST rule banning dynamic code construction |
| CWE-95 | Eval Injection | `eval()` over tainted strings | `no-eval`-style lint rule |
| CWE-287 | Improper Authentication | JWT verified without audience/issuer checks | Auth-configuration linter |
| CWE-326 | Inadequate Encryption Strength | Short keys, legacy algorithms | Crypto-configuration checker |
| CWE-400 | Uncontrolled Resource Consumption | ReDoS-vulnerable regexes | Static ReDoS analyzer |
| CWE-426 | Untrusted Search Path | Unpinned `search_path` in PostgreSQL | Configuration lint rule |
| CWE-601 | Open Redirect | `res.redirect(req.query.url)` | Taint-based redirect check |
| CWE-918 | Server-Side Request Forgery | `fetch()` on a user-supplied URL | Taint or heuristic URL-sink rule |

Notice what the id buys you: a CWE-89 rule for `pg` and one for `mysql2` look nothing alike in code, yet the shared id says they hunt the same weakness — cross-tool, cross-stack vocabulary. (Swap MongoDB in and the id changes with it: NoSQL injection is its own weakness, CWE-943, with CWE-89 as a SQL-specific child — the taxonomy tracks the mechanism, not the syntax.)

## CWE vs CVE vs CVSS — Which Is Which? {#cwe-vs-cve-vs-cvss}

Three identifiers, routinely confused, answering three different questions:

| Identifier | What it names | The question it answers |
|---|---|---|
| **CWE** | A weakness type (a category) | "What kind of mistake is this?" |
| **CVE** | A vulnerability instance in a specific product | "Which concrete bug are we talking about?" |
| **CVSS** | A score computed for an instance | "How bad is the worst case if this is exploited?" |

They chain: a CVE record is labeled with a CWE (through the CWE-1003 view) and scored with CVSS. The direction is the whole point — severity flows from the *instance*, never from the category. The two CWE-89 records from the opening prove it: same category, opposite scores, set by where the injection sits and what an attacker gains. The scoring half — bands, vectors, what CVSS deliberately doesn't measure — is covered in [CVSS scores, explained](https://ofriperetz.dev/articles/cvss-scores-explained).

## The CWE Top 25: When a Taxonomy Meets a Metric {#cwe-top-25}

MITRE periodically publishes the **CWE Top 25 Most Dangerous Software Weaknesses** (compiled annually by MITRE's CWE program under CISA sponsorship) — worth studying for what it demonstrates about measurement. Unlike the OWASP Top 10 — an awareness document whose ordering mixes incidence, detectability, and impact ([separate article](https://ofriperetz.dev/articles/owasp-top-10-explained)) — the Top 25 *is* rank-ordered, by a published formula: how frequently each CWE appears on recent NVD CVE records, weighted by the average CVSS of those records (2024 edition methodology).

That makes it a clean equation: a taxonomy (CWE) plus a metric (the formula) equals a ranking. Because the formula and the NVD data are public, the ranking is *checkable* — you can disagree with the weighting, but you can re-run it yourself. Most rankings you'll meet in security marketing fail that test. The deeper distinction — what a rank can and cannot tell you that a measurement can — gets its own treatment in [Ranking vs measuring](https://ofriperetz.dev/articles/ranking-vs-measuring).

Two caveats travel with the Top 25: it inherits NVD's labeling (the CWE-1003 lens again), and frequency-in-reported-CVEs is not frequency-in-your-codebase. It ranks the ecosystem's reported past, not your repository's present.

## What Does a CWE Number Tell You? {#what-cwe-tells-you}

Three things, all valuable. It gives tools a shared vocabulary — findings from different linters tagged CWE-89 are claims about the same weakness, whatever the rule internals. It gives benchmarks honest labels — NIST's SARD suites and the OWASP Benchmark Project key every test case to a CWE id, naming which weakness each fixture exercises. And it keeps coverage claims checkable — "covers CWE-89, -601, -918" is a *breadth* statement you can verify, saying nothing about detection quality.

The one reading to unlearn, and the misconception this whole article exists to kill: **a CWE number implies a severity.** It cannot. CWE is categorical — it has no scale, no ordering, no bands. Severity is computed per instance, by CVSS, from a vector describing that instance. Any pipeline that derives `CRITICAL` or `LOW` from a CWE label alone has manufactured a measurement out of a category.

The most common way this breaks is the same confusion in reverse: a tool stores a hand-set severity word beside each CWE, forwards it downstream with the CVSS vector, and never cross-checks the two. The label drifts; the category stays honest. It's not hypothetical — audit any tool that stores a hand-typed severity beside a computed CVSS score and you find the two drifting apart, in both directions. And I still catch myself doing the forward version: I see CWE-918 in a report and my pulse moves before I've read a line of the code. The id is a noun; the urgency is an adjective nobody attached to it.

Used for what it is, CWE is quietly one of the best-run standards in security: name the bug's shape with a base-level CWE, score each instance with CVSS, and read every vendor's CWE list as a table of contents, not a report card. Next in the Foundations arc: the [OWASP Top 10](https://ofriperetz.dev/articles/owasp-top-10-explained) — what its famous ordering actually encodes, and what "covering" it means.

---

## Quick Reference {#quick-reference}

| Question | Answer |
|---|---|
| What is a CWE? | A named category of software weakness — the bug's shape, not an incident |
| What does the number mean? | Nothing — accession id, no ordering, no arithmetic |
| CWE vs CVE | CWE = a weakness type; CVE = one vulnerability instance in a specific product |
| CWE vs CVSS | CWE names the category; CVSS scores an instance — severity never flows from the CWE |
| Who runs it? | MITRE, sponsored by CISA |
| Structure | Views (Research CWE-1000, Development CWE-699, NVD's CWE-1003) over a pillar → class → base → variant hierarchy |
| Which level should tools map to? | Base or variant — pillar-level labels carry almost no information |
| Is the CWE Top 25 a severity scale? | No — a ranking by a published formula (NVD frequency × average CVSS), checkable but NVD-lensed |
| What does "covers N CWEs" mean? | Breadth of categories claimed — nothing about precision or recall |

---

## References

- [CWE — Common Weakness Enumeration](https://cwe.mitre.org/) (MITRE). The canonical catalog: every entry, view, and relationship referenced here. Steve Christey Coley's framing of CWE as an enumeration — not a severity ranking — is the position this article applies.
- [CWE-1003: Weaknesses for Simplified Mapping of Published Vulnerabilities](https://cwe.mitre.org/data/definitions/1003.html) (MITRE). The view NVD analysts use to label CVEs — read it to know which lens sits under every "CVEs by CWE" statistic you'll ever see.
- [CWE Top 25 Most Dangerous Software Weaknesses](https://cwe.mitre.org/top25/) (MITRE/CISA, 2024 edition). The rank-ordered list plus its published scoring methodology — the checkable-ranking exemplar discussed above; a MITRE/CISA CWE-program project.
- [NVD CWE statistics](https://nvd.nist.gov/vuln/categories) (NIST). Where CWE labeling meets CVE volume — the raw material of the Top 25 formula.

---

If this is the kind of reference you'll want open mid-code-review, bookmark it — and [follow me on Dev.to](https://dev.to/ofri-peretz) for the rest of the Foundations series.

*Foundations series: ← [CVSS scores](https://ofriperetz.dev/articles/cvss-scores-explained) · [hub](https://ofriperetz.dev/foundations) · [OWASP Top 10](https://ofriperetz.dev/articles/owasp-top-10-explained) →*

*Part of the [Interlace ESLint ecosystem](https://eslint.interlace.tools). Source on [GitHub](https://github.com/ofri-peretz/eslint) · npm: [@interlace](https://www.npmjs.com/~ofriperetz) · Follow: [Dev.to/ofri-peretz](https://dev.to/ofri-peretz) · [ofriperetz.dev](https://ofriperetz.dev)*
