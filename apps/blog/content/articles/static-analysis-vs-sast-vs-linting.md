---
title: "Static Analysis vs. SAST vs. Linting: The Taxonomy That Matters for Security Teams"
description: "A linter runs at edit time. CodeQL runs on your PRs. SonarQube runs in CI. All three get called 'static analysis' — and vendors call the linter 'SAST.' The three are not the same thing, and the differences decide what each can and cannot catch."
slug: "static-analysis-vs-sast-vs-linting"
published: true
date: 2026-07-17
tags:
  - "security"
  - "devsecops"
  - "node"
  - "javascript"
canonical_url: https://ofriperetz.dev/articles/static-analysis-vs-sast-vs-linting
reading_time_minutes: 6
tier: "T1"
author:
  name: Ofri Peretz
  avatar: https://avatars.githubusercontent.com/u/46347627
  title: Security Engineering Leader
---

When a security dashboard files a single-file linter under "SAST tools," it's using "SAST" as a marketing umbrella for anything that inspects source code without running it — technically defensible, practically misleading.

A lint rule fires in your editor in under a second. CodeQL runs on a pull request in minutes and can trace a tainted value through a dozen function calls across as many files. SonarQube keeps a persistent model of your codebase and tracks how an issue count moves across releases. Different scopes, different failure modes, different jobs in the pipeline — squeezed into one word that tells you none of it.

---

## The taxonomy {#taxonomy}

Three levels, broadest to narrowest.

**Static analysis** is any examination of source code without executing it — abstract interpretation, control-flow analysis, taint analysis, and everything below all qualify. Every tool in this piece is static analysis; the word alone tells you nothing about what a given tool actually catches.

**SAST** (Static Application Security Testing) narrows that to security vulnerabilities specifically, and adds three defining traits: it runs in CI/CD rather than at edit time, it traces values across function and file boundaries (interprocedural analysis), and it reports a finding with severity, [CWE classification](https://ofriperetz.dev/articles/cwe-taxonomy-explained), and the data-flow path that proves it. CodeQL, Semgrep, and SonarQube Security are the common names.

**Linting** narrows further, to syntactic and pattern-level checks meant to run while you're still writing the code. A lint rule works on a single file's [AST](https://humanwhocodes.com/blog/2013/07/16/introducing-eslint/) — the pluggable, per-file architecture Nicholas C. Zakas built ESLint around in 2013 — with no cross-file data flow, and it has to finish in milliseconds to be worth having in the editor. It reports patterns: style violations, correctness bugs, and the security mistakes that are visible from inside one file.

**Security linting** — the category a dedicated security linter belongs to — is linting aimed at security patterns specifically: same edit-time speed, same single-file scope, but pattern-matching for constructs like string concatenation at a SQL call site, `Math.random()` generating a token, or a missing JWT verify call. Security linting at edit time. Not a SAST replacement.

---

## What each level detects {#what-each-detects}

The differences get concrete on one vulnerability, shown two ways.

### The pattern a security linter catches

```js
// vulnerable.js
app.get('/users/:id', (req, res) => {
  const query = 'SELECT * FROM users WHERE id = ' + req.params.id;
  //                                                 ^^^^^^^^^^^^^^^^^^
  //            ESLint sees: string + user-controlled value at a db.query call
  pool.query(query).then(r => res.json(r.rows));
});
```

The linter sees the concatenation at the call site — source (`req.params.id`) and sink (`pool.query`) both visible in the same file, adjacent lines. A security rule fires on the string-built SQL and attaches CWE-89. The developer sees the warning before they commit.

### The multi-hop path that needs taint analysis

```js
// routes/users.js
import { buildQuery } from '../db/query-builder.js';

app.get('/users/:id', (req, res) => {
  const userId = req.params.id;                // source: user-controlled
  const sanitized = userId.trim();              // looks sanitized — only strips whitespace
  const query = buildQuery('users', sanitized); // tainted value crosses file boundary
  pool.query(query).then(r => res.json(r.rows));
});

// db/query-builder.js
export function buildQuery(table, id) {
  return `SELECT * FROM ${table} WHERE id = ${id}`;  // template injection
}
```

A lint rule scanning `routes/users.js` sees `userId.trim()` and a function call — the concatenation itself sits one file away, inside `buildQuery()`. The call site looks clean; the rule doesn't fire. (And it isn't safe: `.trim()` removes whitespace, not SQL — `1; DROP TABLE users--` passes through untouched and reaches the template intact. Had the code used `parseInt(userId, 10)` the payload really would have collapsed to the integer `1`; the trap is the sanitizer that only *looks* like one.) CodeQL traces `req.params.id` → `userId` → `sanitized` → `query` inside `buildQuery` → `pool.query`, and files a CWE-89 finding with the full path as evidence.

Same vulnerability, two different visibility ceilings — not a defect in either tool, just two levels of the taxonomy doing what they're built to do.

---

## Time-in-pipeline analysis {#pipeline-position}

Capability isn't the only axis that matters — timing is. Security linting fires at edit time, under a second. A light SAST pass on a PR takes one to five minutes. A deep nightly scan runs thirty minutes to hours. That gap changes what a developer actually does with a finding: a three-minute CI wait means they've already pushed the branch and moved on to reviewing someone else's PR by the time the result lands. A half-second lint warning arrives while their hands are still on the keyboard, in the same context as the line that triggered it.

Security linting and SAST aren't competing for the same job. They sit at different moments in the workflow, at different depth, for different cost — which is why a mature pipeline runs both instead of picking one.

---

## Why a security linter is not a SAST tool {#not-a-sast-tool}

A security linter carries the constraints of its category on purpose.

**Speed and scope.** Rules run in milliseconds, on one file's AST, because that's what edit-time feedback requires — any rule needing cross-file data flow would break the guarantee. A linter can't trace `userInput` through five function calls across three files; it pattern-matches on argument names, import shapes, and option keys instead of building a program-semantics model.

**Domain depth over breadth.** Where a security linter earns its keep is depth inside specific library surfaces: JWT verification via `jsonwebtoken`, parameterized queries via `pg`, SSRF sinks in `node-fetch` and `axios`, unsafe deserialization in `serialize-javascript`. The rule knows the library's dangerous shapes and pattern-matches them within a single call site — narrow, but precise where it looks. That's the honest claim: security linting at edit time, covering what linting can structurally detect — not a replacement for CodeQL, Semgrep, or SonarQube's interprocedural coverage.

A vendor's "SAST" label isn't false — at maximum breadth "SAST" does mean "any source-code security analysis." I've stopped being annoyed that it's technically defensible: a tide pool and the open ocean are both "water," and that stays true right up until you have to decide where it's safe to swim. What the label discards is the one distinction that tells you which tool to reach for — a pattern match at edit time, or a proven data-flow path at CI time.

The precise label is **security linter**: lint speed, lint scope, right for edit-time and CI, not a substitute for taint analysis. Where that structural ceiling comes from, and how precision and recall diverge under it, is the subject of [Taint vs. Heuristic Detection](https://ofriperetz.dev/articles/taint-vs-heuristic-detection) and [Precision, Recall, and F1 for Static Analysis](https://ofriperetz.dev/articles/precision-recall-f1-for-static-analysis).

---

## The recommended stack {#recommended-stack}

A complete Node.js security pipeline uses four positions — not redundant, each catches a different category at a different cost.

**1. Edit time — security linting (ESLint plus a security plugin).** Catches obvious single-file patterns at developer speed, zero CI wait.

**2. Pre-commit / pre-push — CI linting.** Same rules, enforced as a hard gate — catches what a skipped editor integration let through.

**3. PR check — SAST (CodeQL or Semgrep).** Taint analysis across the diff and its call graph; catches multi-hop injection that spans files and imports, before merge.

**4. Nightly / weekly — deep SAST or DAST** (SonarQube, Checkmarx, OWASP ZAP on staging). Full-codebase analysis, drift tracking across releases, and — for DAST — the runtime behaviors no source read can reach.

Teams that skip positions 1–2 pay for 3–4 to catch what the editor could have blocked for free. Teams that skip 3–4 leave every multi-hop taint path undetected. A complete pipeline runs all four.

**Named misconception:** "ESLint security plugins are SAST tools." They're security linters — the subset of static analysis that runs at lint speed and lint scope, without interprocedural data flow or taint tracking. The confusion comes from vendors using "SAST" as an umbrella term for any source-code security analysis, which is technically accurate and practically uninformative.

---

## Quick reference {#quick-reference}

| Category | Example tools | When runs | Cross-file | Taint tracking | Speed |
|----------|--------------|-----------|-----------|---------------|-------|
| Linting | ESLint, Pylint, RuboCop | Edit time | No | No | Under 1 sec |
| Security linting | eslint-plugin-security, Bandit | Edit time | No | No | Under 1 sec |
| SAST — light | Semgrep, CodeQL default | PR check | Yes | Partial | 1–5 min |
| SAST — deep | Checkmarx, Veracode, Snyk Code | Weekly | Yes | Yes | 30 min+ |
| DAST | OWASP ZAP, Burp Suite | QA / staging | N/A | N/A | Minutes–hours |

*DAST (Dynamic Application Security Testing) tests a running application, not source — out of scope here, but it catches categories, auth state, session management, server-side rendering injection, that no source-code read can reach.*

---

## References

1. Chess, B., & West, J. (2007). *[Secure Programming with Static Analysis](https://books.google.com/books/about/Secure_Programming_with_Static_Analysis.html?id=DnUbmQEACAAJ)*. Addison-Wesley. The foundational industrial treatment of static analysis for security — data-flow and taint techniques, rule design, and the false-positive economics that separate a linter from a SAST engine.

2. NIST IR 8397: *[Guidelines on Minimum Standards for Developer Verification of Software](https://nvlpubs.nist.gov/nistpubs/ir/2021/NIST.IR.8397.pdf)*. National Institute of Standards and Technology, 2021. nvlpubs.nist.gov/nistpubs/ir/2021/NIST.IR.8397.pdf. Note that NIST itself uses "static analysis" and "SAST" interchangeably here — even listing ESLint among its example SAST tools — which is itself a data point on how loosely the industry applies the label.

3. [OWASP Source Code Analysis Tools](https://owasp.org/www-community/Source_Code_Analysis_Tools). owasp.org/www-community/Source_Code_Analysis_Tools. OWASP's community-maintained list of source-code (SAST) analysis tools. For the automated-analysis-vs-manual-review distinction specifically, see OWASP's [Static Code Analysis](https://owasp.org/www-community/controls/Static_Code_Analysis) control page.

4. Livshits, B., & Lam, M. S. (2005). [Finding security vulnerabilities in Java applications with static analysis](https://www.usenix.org/conference/14th-usenix-security-symposium/finding-security-vulnerabilities-java-applications-static). *USENIX Security Symposium*, 14. The structural basis for what makes taint analysis different from pattern matching.

5. Zakas, N. C. (2013, July 16). Introducing ESLint. humanwhocodes.com. https://humanwhocodes.com/blog/2013/07/16/introducing-eslint/. The original announcement of ESLint's pluggable, per-file rule architecture — the design decision this whole taxonomy hangs on.

---

This is the reference for the next time a scan result gets called "SAST" and it's actually a lint rule — bookmark it, and [follow me on Dev.to](https://dev.to/ofri-peretz) for the rest of the Foundations series.

*Foundations series: ← [Taint vs. Heuristic Detection](https://ofriperetz.dev/articles/taint-vs-heuristic-detection) · [hub](https://ofriperetz.dev/foundations) · [start over: The Confusion Matrix](https://ofriperetz.dev/articles/confusion-matrix-tp-fp-fn-tn) →*

*Part of the [Interlace ESLint ecosystem](https://eslint.interlace.tools). Source on [GitHub](https://github.com/ofri-peretz/eslint) · npm: [@interlace](https://www.npmjs.com/~ofriperetz) · Follow: [Dev.to/ofri-peretz](https://dev.to/ofri-peretz) · [ofriperetz.dev](https://ofriperetz.dev)*
