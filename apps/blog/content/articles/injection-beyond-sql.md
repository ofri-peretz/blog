---
title: "Everyone Greps for SQL Injection. Nobody Greps for the Other Eight."
description: "SQL injection has a name everyone knows. Eight more injections aim the same defect at parsers nobody audits: GraphQL, LDAP, XPath, XXE, template and more."
slug: "injection-beyond-sql"
published: false
canonical_url: "https://ofriperetz.dev/articles/injection-beyond-sql"
cover_image: "https://ofriperetz.dev/cdn/blog-cover-image/injection-beyond-sql.jpg"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/injection-beyond-sql-og.jpg"
tier: "T1"
reading_time_minutes: 4
tags:
  - "javascript"
  - "security"
  - "webdev"
  - "node"
series: null
author:
---

Ask a developer to find injection in a codebase and they grep for string concatenation near a database call. They will find the SQL. They will walk past eight other interpreters on the way.

An interpreter nobody remembers is still an interpreter. Build a string, hand it to something that parses it, and you have the same bug — whether or not that parser speaks SQL.

## The shape, not the syntax {#shape}

The taxonomy already knew this. [CWE-943](https://cwe.mitre.org/data/definitions/943.html) is "improper neutralisation of special elements in data query logic" — the parent class that SQL injection is merely the famous child of. Its siblings are the same defect aimed at different parsers.

| Injection | CWE | The interpreter you forgot |
|---|---|---|
| GraphQL | [CWE-943](https://cwe.mitre.org/data/definitions/943.html) | the query resolver |
| LDAP | [CWE-90](https://cwe.mitre.org/data/definitions/90.html) | the directory filter |
| XPath | [CWE-643](https://cwe.mitre.org/data/definitions/643.html) | the XML path engine |
| XXE | [CWE-611](https://cwe.mitre.org/data/definitions/611.html) | the XML entity resolver |
| Template | [CWE-94](https://cwe.mitre.org/data/definitions/94.html) | the template compiler |
| Directive | [CWE-96](https://cwe.mitre.org/data/definitions/96.html) | the server-side include |
| Format string | [CWE-134](https://cwe.mitre.org/data/definitions/134.html) | the format specifier parser |
| Object / prototype | [CWE-915](https://cwe.mitre.org/data/definitions/915.html) | the JavaScript engine itself |

Be precise about what that parent covers, because the honest version is narrower than the tidy one. MITRE lists exactly four children under CWE-943, all of them query languages: [SQL](/articles/sql-injection-node-postgres-pattern) (CWE-89), LDAP (CWE-90), XPath (CWE-643) and XQuery ([CWE-652](https://cwe.mitre.org/data/definitions/652.html)).

Everything else in the table is *commonly mapped* there rather than formally filed under it. GraphQL has no dedicated CWE at all; neither do the [NoSQL operator injections](/articles/getting-started-eslint-plugin-mongodb-security). And XXE, format string and prototype pollution are not siblings in any sense — they are separate defects that happen to share a blind spot, not a parent.

Eight interpreters plus SQL, and two distinct shapes between them. SQL got the name people recognise. The parser inside your LDAP filter did not, and that is the entire reason it goes unaudited.

## Three that fail in ways SQL does not {#three}

**XXE needs no injected operator at all.** Parse attacker-supplied XML with entity resolution enabled and the parser fetches local files on their behalf. There is no quote to escape, no operator to smuggle. The payload is the document.

**LDAP fails silently.** `(uid=` plus a string is a filter, and a stray `)` turns an authentication check into a wildcard matching every entry in the directory. No error, no stack trace — a login that simply succeeds.

**Template injection escalates further than SQL.** [PortSwigger's server-side template injection research](https://portswigger.net/research/server-side-template-injection) showed a template engine will hand over remote code execution as readily as a database hands over rows. A templating call is not a formatting convenience; it is an evaluator.

GraphQL is the odd one, because injection is only half of it. A query the client shapes is also a cost problem — the caller, not you, decides how many nested resolvers run. That is resource exhaustion ([CWE-400](https://cwe.mitre.org/data/definitions/400.html)) wearing a query's clothes, and it is why a depth or cost limit is a security control rather than a performance tweak.

## Why grep finds SQL and misses the rest {#why}

[OWASP](https://owasp.org/Top10/A03_2021-Injection/) folds this whole family into A03. Most tooling does not, because a pattern matcher looks for a *sink it has been taught* — a `query(`, an `execute(`. Nobody teaches it `XPathEvaluator`, `libxmljs`, an LDAP `filter:`, a `compile(`.

That is also the honest limit of pattern matching generally. Seeing a `+` flowing into a sink does not prove the value came from a request, and it goes quiet when the concatenation happens one helper away. That gap between "looks dangerous" and "is reachable" is the whole subject of [taint analysis](/articles/taint-vs-heuristic-detection), and it is why a rule count is a poor proxy for coverage.

## What to actually do {#do}

Do not start from a checklist. Grep your own code for the *constructors*: `XPathEvaluator`, `libxmljs`, an LDAP `filter:`, a template `compile(`, any `%s` you assemble by hand. For each, ask one question — can user input reach this string?

Grep is the triage list, not the verdict: it tells you *where to look*, taint tells you *whether it reaches*.

If the answer is "probably not, but I would have to check", that is exactly the answer most people give about SQL right before they find the other eight.

Which interpreter is live in your stack right now that you have never grepped for? My money is on GraphQL.

More on how these classes get named and ranked: [the CWE taxonomy](/articles/cwe-taxonomy-explained) and [the OWASP Top 10](/articles/owasp-top-10-explained). I write these at [dev.to/ofri-peretz](https://dev.to/ofri-peretz).
