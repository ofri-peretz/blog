---
id: I-10
slug: injection-beyond-sql
stage: intent
status: approved
visibility: public
opened: 2026-09-04
opened_by: claude
approved_by: ofri
---

## Recorded after the draft, before the publish

Backfilled. The draft was written 2026-08-26 and rewritten as a T1 on
2026-09-02, both before this chain covered drafts. It is not yet published, so
unlike I-9 this intent is being written at the right point in the lifecycle
even though it is late relative to the prose.

## Claim

Injection is a shape, not a syntax: build a string, hand it to any interpreter,
and the defect is the same one everybody already knows by its SQL name. A
reader finishes able to name eight other interpreters in their own stack and
say which of them they have never audited.

## Audience

Developers who would confidently pass a SQL-injection code review and have
never once grepped for `XPathEvaluator`, an LDAP `filter:`, or a template
`compile(`. Not beginners — the article assumes the reader already knows what
SQL injection is and finds the SQL.

## Why us

We publish rules across several of these interpreters, so the blind spot is one
we have to reason about per-parser rather than in the abstract. The claim is
also one we can make against ourselves honestly, which is most of its value:
the article states outright that pattern matching cannot prove reachability and
that a rule count is a poor proxy for coverage. That is a limit of our own
approach, said plainly, in an article that could have oversold instead.

## Evidence we believe exists

- [x] CWE-943 is a real parent class with a small, exactly enumerable set of
      children.
- [x] Each interpreter in the table has a CWE whose published title matches the
      row it is put in.
- [x] The commonly-mapped rows can be distinguished from the formally-filed
      ones, so the table can be narrowed in the text rather than overstated.
- [x] GraphQL has no CWE of its own.

## Kill criterion

Abandon if CWE-943's children turn out to be a long or open-ended list, because
then the parent/child framing carries no information and the article is just a
table of CWE numbers anyone can look up. Also abandon if the non-943 rows
cannot be honestly separated from the formally-filed ones — a table that
implies a taxonomy MITRE does not assert would be exactly the tidy fiction this
piece is arguing against.

Neither fired. MITRE lists precisely four children, and the draft already drew
the distinction in its own text before this spec went looking for it.

## Title candidates

1. Everyone Greps for SQL Injection. Nobody Greps for the Other Eight.
2. Nine Interpreters, One Defect, One Name Everybody Knows
3. Your Codebase Has Eight Parsers You Have Never Audited

## Tier

T1
