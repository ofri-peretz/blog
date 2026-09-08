---
id: I-24
slug: concatenation-defeats-the-rule
stage: intent
status: killed
visibility: public
opened: 2026-09-07
opened_by: claude
approved_by: ofri
killed: 2026-09-07
---

## Claim

A static-analysis rule can be correct about a pattern and blind to the syntax
people write it in: ours reports `new RegExp(userInput)` and says nothing about
`new RegExp("^" + userInput + "$")` — the same defect, in the shape almost
everyone actually uses.

## Audience

Anyone relying on a lint rule as a control. The lesson is not about regex: it
is that a rule's coverage is bounded by the AST shapes its author enumerated,
and that boundary is invisible from the findings list.

## Why us

It is our rule and the gap is ours to publish. It also pairs with a false
positive in the same rule that pushes the other way, which is the part that
makes it more than a bug report — the noise arrives first and trains people to
switch the rule off before the silence is ever noticed.

## Evidence we believe exists

- [x] A bare identifier that reports.
- [x] The same identifier inside a concatenation that does not.
- [x] A correctly-escaped template literal that reports anyway.
- [x] The rule's own documented escape allowlist, honoured in one syntax and
      ignored in another.

## Kill criterion

Abandon if the concatenation cases are silent for a defensible reason — if the
rule documents that it only handles direct arguments, or if another rule in the
same preset covers the concatenated shape, then this is a scope boundary rather
than a gap and the article is wrong.

Abandon also if the escape allowlist turns out not to be honoured anywhere, in
which case the false positive is simply an unimplemented option rather than an
inconsistency between syntaxes, and the piece loses its spine.

## Title candidates

Under the validated formula: named target + concrete number + provocative claim.

1. My Rule Catches `new RegExp(input)` and Misses `new RegExp("^" + input + "$")`
2. One Plus Sign Turns the Security Rule Off
3. The Shape of Your Code Decides Whether the Linter Can See It

## Tier

T3

## Killed — 2026-09-07

The kill criterion fired on its own terms, and the article was wrong.

It said: abandon if another rule in the same preset covers the concatenated
shape, because then this is a scope boundary rather than a gap. Running the
whole plugin instead of the one rule settles it:

    new RegExp("^" + userInput + "$")  ->  detect-non-literal-regexp
    new RegExp(userInput)              ->  detect-non-literal-regexp,
                                           no-unsafe-regex-construction

`secure-coding/detect-non-literal-regexp` catches the concatenated form, and
both rules ship in the same recommended config. The plugin is not blind to
`"^" + input + "$"`. The premise — that a rule people rely on goes silent on
the commonest unsafe shape — is false at the level a user actually experiences,
which is the preset rather than the individual rule.

This nearly shipped, and it nearly shipped as the strongest piece of the batch.
The single-rule harness that produced the finding is the same instrument defect
described in `lint-harness-measured-nothing`, arriving from the other
direction: measuring one rule in isolation and reporting the result as though
it described the tool. A silence from a config narrower than anyone runs is not
a gap.

What survives is smaller and real, and is filed separately: the rule honours
its `escapeFunctions` allowlist for bare and concatenated arguments and ignores
it inside template literals, so `new RegExp(`${escapeRegex(dep)}x`)` is
reported while `new RegExp(escapeRegex(dep) + "x")` is not. Also, the inline
list and the schema default disagree, and lodash's `escapeRegExp` is in
neither.

Do not reopen this intent. If the false positive is worth an article after it
is fixed, that is a different and much narrower claim.
