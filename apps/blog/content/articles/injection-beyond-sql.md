---
title: "I Grepped My Own Code for Injection and Forgot Seven Interpreters"
description: "SQL injection has a name everyone knows. GraphQL, LDAP, XPath, XXE, template and format-string injection are the same bug in parsers nobody counts."
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

I went looking for injection in my own code. I found the SQL, fixed it, and closed the file. Seven other interpreters were still sitting there.

An interpreter nobody remembers is still an interpreter. Build a string, hand it to something that parses it, and you have the same bug — whether or not that parser speaks SQL.

## Where the attention went {#attention}

`eslint-plugin-security` is the default answer for JavaScript security linting: **4,044,266 downloads last week**, 14 rules. Exactly 1 of the 8 injections below has a rule there — `detect-object-injection`. GraphQL, LDAP, XPath, XXE, template, directive and format-string injection have no rule there at all.

That is not a knock on the plugin. It is a map of which injections got a name people recognise. SQL got the name. The parser in your LDAP filter did not.

## The eight, and what actually parses the string {#eight}

| Rule | CWE | The interpreter you forgot |
|---|---|---|
| `no-graphql-injection` | CWE-89 | the query resolver |
| `no-ldap-injection` | CWE-90 | the directory filter |
| `no-xpath-injection` | CWE-643 | the XML path engine |
| `no-xxe-injection` | CWE-611 | the XML entity resolver |
| `no-template-injection` | CWE-94 | the template compiler |
| `no-directive-injection` | CWE-96 | the server-side include |
| `no-format-string-injection` | CWE-134 | the format specifier parser |
| `detect-object-injection` | CWE-915 | the JavaScript engine itself |

Eight CWEs, one shape. The taxonomy already knew: [CWE-943](/articles/cwe-taxonomy-explained) is "improper neutralisation of special elements in data query logic" — the parent class SQL injection is merely the famous child of. [OWASP](/articles/owasp-top-10-explained) collapses the whole family into A03, and PortSwigger's server-side template injection research showed a template engine will hand you RCE as readily as a database hands you rows.

XXE is the one I would put first. It needs no injected operator at all — parse attacker XML with entity resolution on and the parser fetches files for you. The payload is the document.

GraphQL is the one most likely to be live in your stack right now, and it is the odd entry in the table: its rule carries four CWEs, not one. Injection is only half of it. A query the client controls is also a depth and cost problem — CWE-400, resource exhaustion — because the caller, not you, decides how many nested resolvers run. That is the same unbounded-allocation shape that shows up in agent loops, and it is the reason a query-cost limit is a security control rather than a performance tweak.

LDAP deserves a mention for how quietly it fails. `(uid=` plus a string is a filter, and a `)` in the wrong place turns an authentication check into a wildcard that matches every entry in the directory. No error, no stack trace — just a login that succeeds.

## What these rules cannot do {#limits}

They are pattern detectors, not [taint analysis](/articles/taint-vs-heuristic-detection). They see a template literal or a `+` flowing into a sink. They do not prove the value reached it from a request, and they do not follow it through three helpers into another file.

So they over-report on code that concatenates a constant, and they go quiet when the concatenation happens one function away. Reach matters more than the rule count here, and I would rather say that than let eight look like coverage.

The honest one: `detect-object-injection` is the single rule I share with the incumbent, and it is the weakest of the eight. It flags `variable[key]` as either operand — which is ordinary JavaScript. Every safe lookup table trips it. I keep it because CWE-915 is real, not because the signal is good, and anyone enabling it should expect to triage.

## What I would actually do {#do}

Do not start with the rules. Grep your own code for the constructors: `XPathEvaluator`, `libxmljs`, an LDAP `filter:`, a template `compile(`, any `%s` you assemble. Then ask whether user input can reach the string.

If the answer is "probably not, but I would have to check" — that is the same answer I gave myself about SQL, right before I found seven more.

The eight rules ship in `eslint-plugin-secure-coding`:

```bash
npm i -D eslint-plugin-secure-coding
```

More of these at [dev.to/ofri-peretz](https://dev.to/ofri-peretz) — I publish what the measurements actually said, including when they said I was wrong.
