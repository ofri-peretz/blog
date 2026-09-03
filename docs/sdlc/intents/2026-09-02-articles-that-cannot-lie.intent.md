---
kind: intent
slug: 2026-09-02-articles-that-cannot-lie
opened: 2026-09-02
status: open
---

# Intent: 655 code blocks claim what our rules do; none is checked

## What

Run every fenced code block in the corpus through the plugins it describes, at
build time, and fail the build when a block's claimed diagnostics do not match
what the linter actually reports.

An article about static analysis should be an **instance** of static analysis,
not a description of one.

## Why now

Because the corpus makes 655 checkable claims and checks none of them, and
because we already know this class of error ships: the memory of past work
records articles asserting rule counts that were wrong, an export shape that
did not exist, and "taint" analysis the code does not perform. Every one was
caught by a human re-reading, which is the least reliable checking mechanism available.

The blog's whole argument is that machines should check what humans assert.
Applying that to prose about linting — using the linter — is not a clever trick;
it is the minimum consistency the site owes its own thesis.

The capability is already paid for. `eslint-in-the-browser` bundles a real
Linter with the published plugins at 362 KB brotli, and three articles embed
it. Nothing new has to be invented: the same `Linter.verify()` that powers the
playground can run over the corpus in CI.

## Constraints

- **No new claim syntax that authors must remember.** A block that says nothing
  about diagnostics stays unchecked. Opt-in by annotation, not by default, or
  the migration cost lands on 91 articles at once.
- Frozen slugs and published prose are not rewritten to satisfy a checker. If a
  block is wrong, the block is fixed — deliberately, as an edit.
- Build time must stay sane. 655 blocks × a Linter instance is the naive shape
  and would be too slow; the plugin set per block is knowable from the fence.
- No network. The check runs against the published packages already installed.

## How we will know it worked

- **Binary:** an annotated block whose claimed rule does NOT fire fails the
  build, demonstrated by breaking one deliberately.
- **Binary:** at least one existing article carries a verified annotation, and
  the verification is visible to a reader — a claim the reader can trust is
  worth more than one only CI sees.
- **Directional:** the count of verified blocks rises over time without anyone
  scheduling it, because annotating is easier than arguing.

## Not doing

- Not annotating all 655. Most are configuration, terminal output, or JSON and
  have nothing to assert. The subset worth checking is "this code triggers this
  rule", which is the claim readers actually rely on.
- Not executing reader-supplied code. This lints, it does not run.
- Not gating on style or formatting of examples. The claim under test is which
  diagnostics fire, nothing else.
