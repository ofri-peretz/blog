---
kind: plan
slug: 2026-09-02-articles-that-cannot-lie
opened: 2026-09-02
---

# Plan: annotate the claim, then let the linter settle it

Intent: [`2026-09-02-articles-that-cannot-lie.intent.md`](./2026-09-02-articles-that-cannot-lie.intent.md)

## Ground truth

| Claim | Value | Source | Read on |
|---|---|---|---|
| Fenced code blocks in the corpus | **655** | fence count ÷ 2 over `content/articles/*.md` | 2026-09-02 |
| Articles | 91 | same | 2026-09-02 |
| Blocks whose diagnostics are verified | **0** | nothing reads them | 2026-09-02 |
| Browser Linter bundle, already shipped | 362 KB brotli | `measured-claims-lock` | 2026-09-02 |
| Articles embedding a live Linter | 3 | `lint-embeds.ts` | 2026-09-02 |
| Known past claim errors | export shape, rule counts, "taint" | prior findings | 2026-09-02 |

655 checkable claims, zero checked, and a Linter already paid for.

## Approach

**Annotate the fence, not the prose.** A block becomes checkable by declaring
what it expects:

    ```ts lint:node-security/detect-child-process
    ```

The checker parses the info string, runs `Linter.verify()` with that plugin and
rule, and asserts the rule fires at least once. No annotation, no check — so
the 600-odd config, terminal and JSON blocks stay untouched and no author has
to learn anything to write an ordinary block.

**Assert firing, not exact positions.** Line numbers move when prose around
them is edited, and a checker that fails on unrelated edits gets disabled
within a month. What the reader relies on is *this code triggers that rule*.

**Also assert the negative where the article claims it.** `lint:!rule` for
"this is the fixed version and reports nothing" — the fixed snippets are where
a silent regression is most embarrassing, because the article is telling the
reader what to do.

Rejected: **checking all 655 by inference.** Guessing which rule a block is
about from surrounding prose is exactly the confident-wrong-list failure this
repo keeps producing. Annotation is explicit or it is nothing.

Rejected: **a separate fixtures directory.** The block and its claim must live
together or they drift, which is the same defect as an intent whose status
disagrees with its code.

## Sequence

1. Write the checker over one article, with one annotated block.
2. **Break it deliberately** — annotate a rule that does not fire — and watch
   the build fail. That failure is the deliverable, not the green.
3. Annotate the vulnerable/fixed pairs in the three articles that already embed
   the playground; they are the highest-traffic claims and the plugins are
   already installed for them.
4. Surface verification to the reader on those blocks. A checked claim nobody
   can see is worth strictly less than one they can.
5. Measure build-time cost and record it. If it is material, reuse one Linter
   per plugin set rather than per block.

## Gates

- Step 2 required. A checker first seen passing has proven nothing.
- No article's prose is rewritten to satisfy the checker without a human
  deciding the prose was wrong.
- Build time cost reported as a number, not "negligible".
- Type-aware rules are out of scope and must be rejected loudly by the
  annotation parser, not silently skipped — a skipped check that looks like a
  passed one is the failure mode this whole repo keeps relearning.

## Risks

- **Annotation rot**: a rule renamed upstream turns every annotation red at
  once. That is correct behaviour but arrives as a wall; the failure message
  must name the rename, not just the miss.
- **False confidence from partial coverage.** Three articles annotated does not
  mean the corpus is verified, and the reader-facing marker must be scoped to
  the block, never to the article.
- **The checker becomes a second, worse test suite.** It asserts one thing:
  does this rule fire on this code. Anything more belongs in the plugins' own
  tests.
