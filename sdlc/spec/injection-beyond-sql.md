---
slug: injection-beyond-sql
stage: spec
status: approved
intent: sdlc/intent/injection-beyond-sql.md
gathered: 2026-09-04
---

## Thesis

Nine interpreters, one defect. SQL injection is the famous child of CWE-943,
and the same mistake aimed at an LDAP filter, an XPath expression or a template
compiler is the same mistake — it just never got the name.

The evidence sharpened the claim rather than moving it. The tidy version of
this article is "here are nine siblings under one parent". MITRE does not say
that: CWE-943 has exactly four children, all query languages, and the other
rows are commonly mapped rather than formally filed. The draft already drew
that line in its own prose before this spec went looking, which is the reason
it survives contact with the taxonomy. XXE, format string and prototype
pollution are separate defects that share a blind spot, not a family.

## Ground truth

Every CWE number in the article appears below, with its published title fetched
from MITRE on the `gathered` date. Titles are quoted exactly as MITRE spells
them, American `z` included.

| Claim                                       | Value                                                                          | Command                                                                                                                 | Version           | Verified   |
| ------------------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | ----------------- | ---------- |
| CWE-943 title (the parent)                  | Improper Neutralization of Special Elements in Data Query Logic                | `curl -s https://cwe.mitre.org/data/definitions/943.html` then read the heading                                         | CWE 4.20          | 2026-09-04 |
| children of CWE-943, Research Concepts view | exactly 4 — 89, 90, 643, 652                                                   | on that page, read every `ParentOf` row under "Relevant to the view Research Concepts (View-1000)"                      | CWE 4.20          | 2026-09-04 |
| CWE-89 title (SQL row)                      | Improper Neutralization of Special Elements used in an SQL Command             | `curl -s https://cwe.mitre.org/data/definitions/89.html`                                                                | CWE 4.20          | 2026-09-04 |
| CWE-90 title (LDAP row)                     | Improper Neutralization of Special Elements used in an LDAP Query              | `curl -s https://cwe.mitre.org/data/definitions/90.html`                                                                | CWE 4.20          | 2026-09-04 |
| CWE-643 title (XPath row)                   | Improper Neutralization of Data within XPath Expressions                       | `curl -s https://cwe.mitre.org/data/definitions/643.html`                                                               | CWE 4.20          | 2026-09-04 |
| CWE-652 title (XQuery, the fourth child)    | Improper Neutralization of Data within XQuery Expressions                      | `curl -s https://cwe.mitre.org/data/definitions/652.html`                                                               | CWE 4.20          | 2026-09-04 |
| CWE-611 title (XXE row)                     | Improper Restriction of XML External Entity Reference                          | `curl -s https://cwe.mitre.org/data/definitions/611.html`                                                               | CWE 4.20          | 2026-09-04 |
| CWE-94 title (Template row)                 | Improper Control of Generation of Code                                         | `curl -s https://cwe.mitre.org/data/definitions/94.html`                                                                | CWE 4.20          | 2026-09-04 |
| CWE-96 title (Directive row)                | Improper Neutralization of Directives in Statically Saved Code                 | `curl -s https://cwe.mitre.org/data/definitions/96.html`                                                                | CWE 4.20          | 2026-09-04 |
| CWE-134 title (Format string row)           | Use of Externally-Controlled Format String                                     | `curl -s https://cwe.mitre.org/data/definitions/134.html`                                                               | CWE 4.20          | 2026-09-04 |
| CWE-915 title (Object / prototype row)      | Improperly Controlled Modification of Dynamically-Determined Object Attributes | `curl -s https://cwe.mitre.org/data/definitions/915.html`                                                               | CWE 4.20          | 2026-09-04 |
| CWE-400 title (GraphQL cost claim)          | Uncontrolled Resource Consumption                                              | `curl -s https://cwe.mitre.org/data/definitions/400.html`                                                               | CWE 4.20          | 2026-09-04 |
| CWE entries whose title names GraphQL       | none                                                                           | search cwe.mitre.org for GraphQL; the results page does not contain the string                                          | CWE 4.20          | 2026-09-04 |
| OWASP category the family folds into        | A03:2021 Injection                                                             | `curl -s -o /dev/null -w '%{http_code}' https://owasp.org/Top10/A03_2021-Injection/` returns 200                        | Top 10 2021       | 2026-09-04 |
| PortSwigger SSTI research link              | reachable                                                                      | `curl -s -L -o /dev/null -w '%{http_code}' https://portswigger.net/research/server-side-template-injection` returns 200 | live              | 2026-09-04 |
| internal article links in the body          | all 5 resolve to files                                                         | check `apps/blog/content/articles/<slug>.md` exists for each `/articles/` link                                          | corpus at 2833399 | 2026-09-04 |

The "no dedicated CWE for GraphQL" row is **evidence of absence**, and weaker
than the rows above it. It is recorded that way on purpose: the method is
stated so a reader can judge it, rather than being presented as equivalent to a
fetched title.

## Known traps pre-empted

- [x] **Export shape** — no plugin is imported or configured in this article.
- [x] **Rule counts** — none claimed. The article argues the opposite, that a
      rule count is a poor proxy for coverage.
- [x] **Config option names** — none appear.
- [x] **Detection logic** — the only detection claim is about the limits of
      pattern matching, and it is stated as a limit rather than a capability.
- [x] **Frozen identifiers** — unpublished, so nothing is frozen yet. The slug
      contains no number that can go stale.

## Outline

1. The grep scene — no numeric claim; the premise.
2. **The shape, not the syntax** — the 8-row table (one CWE row each) plus the
   narrowing paragraph (the four-children row and the GraphQL row).
3. **Three that fail in ways SQL does not** — XXE (CWE-611), LDAP (CWE-90),
   template (CWE-94 plus the PortSwigger row); GraphQL cost is the CWE-400 row.
4. **Why grep finds SQL and misses the rest** — the OWASP A03 row.
5. **What to actually do** — no numeric claims; constructors to grep for.

## Framing check

Landscape. The article's sharpest criticism is aimed at its own class of tool:
pattern matching cannot prove reachability, goes quiet one helper away, and a
rule count does not measure coverage. No neighbour is named as inferior, and no
comparison table appears, so the self-graded-fixture disclosure does not apply.
