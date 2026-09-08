---
slug: rule-that-reads-variable-names
stage: spec
status: approved
intent: sdlc/intent/rule-that-reads-variable-names.md
gathered: 2026-09-07
---

## Thesis

`secure-coding/no-xpath-injection` treats a value as attacker-controlled when
its identifier's lowercased name contains any of seven substrings. That single
heuristic is the cause of both a false positive and a false negative, and
renaming the identifier flips either verdict.

## Ground truth

Every row executed 2026-09-07 via `ESLint.lintText` against the rule as it
stands in the workspace, one rule enabled, `@typescript-eslint/parser`.

| Claim | Value | Command | Version | Verified |
| --- | --- | --- | --- | --- |
| the taint test is a name substring match | `['req','request','query','params','input','user','search'].some(k => varName.includes(k))` | read at `no-xpath-injection/index.ts:362-367` | secure-coding, workspace | 2026-09-07 |
| false positive on a Zod passthrough | `export const QueryValidateSchema = QueryInputSchema;` — **FIRES** | `lintText` with only `sc/no-xpath-injection` at error | secure-coding, workspace | 2026-09-07 |
| the same statement, renamed | `export const SchemaA = SchemaB;` — **silent** | same | secure-coding, workspace | 2026-09-07 |
| false negative on real injection | `xpath.select("//user[@id='" + id + "']", doc);` — **silent** | same | secure-coding, workspace | 2026-09-07 |
| the same injection, variable renamed | `... + userId + ...` — **FIRES** | same | secure-coding, workspace | 2026-09-07 |
| and again with an unrelated name | `... + queryX + ...` — **FIRES** | same | secure-coding, workspace | 2026-09-07 |
| `select` is a recognised sink | `xpathFunctions` default includes `evaluate, selectSingleNode, selectNodes, xpath, select` | `no-xpath-injection/index.ts:162` | secure-coding, workspace | 2026-09-07 |

## Why one heuristic causes both

`QueryInputSchema` lowercases to `queryinputschema`, which contains both
`query` and `input`. Tainted. There is no XPath call anywhere in the statement.

`id` contains none of the seven substrings. Not tainted — so a concatenation
flowing into `xpath.select`, a sink the rule already recognises, is not
reported. The string literal contains `user`, but the check runs on the
identifier, not the literal.

Same predicate, opposite errors. That is what makes this one defect rather than
two.

## Kill criterion, tested

- **Single cause:** both verdicts trace to lines 362-367. The FP is a name that
  matches; the FN is a name that does not. **Survives.**
- **Rename flips the verdict:** proven in both directions — `id` → `userId`
  turns silence into a report, and `QueryValidateSchema` → `SchemaA` turns a
  report into silence, with the code otherwise byte-identical. **Survives.**

## Context

This is the defect class the repo already tracks as name inference, with a
`lint:name-inference` check and a documented debt list. This rule is one of the
outstanding sites, so the article reports a known-class defect with a concrete
reproduction rather than announcing a surprise.

## Not verified

- Whether the other rules on that debt list fail the same way. The article
  makes no claim about them.
- Whether the published release behaves identically to the workspace build.
  Measured against the workspace; a reader on the registry version should
  re-run before assuming. Stated in the article.
