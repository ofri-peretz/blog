---
kind: intent
slug: 2026-09-02-diagnostics-link-home
opened: 2026-09-02
status: withdrawn
---

# Intent: the tool runs in thousands of repos and never points home

## What

Give every rule a permalink that opens a live, editable reproduction of exactly
that diagnostic, and put that URL in the rule's `meta.docs.url` so ESLint prints
it in the terminal, in editor tooltips, and in every CI log.

## Why now

Because the audience already exists and we never speak to it.

The plugins run in thousands of repositories. Every one of those runs prints
diagnostics to a terminal, and **not one of them carries a URL** — checked
today across the rule sources: zero `docs.url` values. Meanwhile the blog gets
323 pageviews a month and we write articles hoping people find them.

The distribution channel is not social media. It is the tool itself, already
installed, already speaking to developers at the exact moment they are thinking
about the rule. ESLint has a first-class field for this and we leave it empty.

The second half matters as much as the first. A docs URL that lands on prose is
a footnote; one that lands on a **running reproduction of the diagnostic you
just hit** is a different thing entirely — the reader arrives already holding
the question the page answers.

## Constraints

- `meta.docs.url` changes live in the plugin repo, not here. This intent owns
  the destination pages and the URL contract; the plugin side is a coordinated
  change with its own release.
- **URLs are permanent.** A rule permalink that 404s after a rename is worse
  than none, because it ships inside released packages and cannot be recalled.
  The URL shape and its redirect contract must be settled before anything is
  published.
- No tracking parameters in the URL the tool prints. A developer's CI log is
  not an advertising surface, and a `utm_` in a terminal is a good way to be
  removed from a codebase.
- The page must work with JavaScript disabled, degrading to the rule's
  description and a static example. A CI log opened on a locked-down machine is
  a realistic arrival.

## How we will know it worked

- **Binary:** a rule permalink exists, is stable, and renders a reproduction
  that reports that exact diagnostic — verified by running it, not by asserting
  the page contains the rule name.
- **Binary:** a lock fails when a rule exists without a permalink, or a
  permalink exists without a rule. Both directions, or the mapping rots.
- **Tier 3:** referral traffic arriving on rule pages with no referer and no
  campaign — the signature of a terminal or an editor. Currently zero, so the
  first one is unambiguous.

## Not doing

- Not changing diagnostic message text. Messages are load-bearing and some
  carry CWE and CVSS metadata that downstream tooling parses.
- Not building a rule explorer, catalogue, or search. One rule, one URL, one
  reproduction. A catalogue is a different intent and a much bigger one.
- Not shipping URLs before the redirect contract exists. Published packages
  cannot be edited after the fact, which makes this the one place where getting
  it right beats getting it soon.


---

## WITHDRAWN, 2026-09-02 — the premise was false

**All 503 of 503 rules already carry `meta.docs.url`.** Every diagnostic this
ecosystem prints already links to
`https://eslint.interlace.tools/docs/security/<plugin>/rules/<rule>`.

The intent claimed "zero of 102 rule sources set `meta.docs.url`". Both numbers
were wrong and for the same reason: I grepped rule **source files** for a
literal `docs.url`, and the URL is not written there. It is injected centrally
by `rule-creator.ts:280` — `docs: { ...meta.docs, url: urlCreator(name) }` —
so no rule file contains the string and every rule ends up with the field.

The `102` was a second error stacked on the first: it counted files matching
the flat glob `packages/*/src/rules/*.ts`, while 57 packages have a rules
directory and the runtime rule count is 503.

Review caught the "sampled" hedge in the plan and asked which packages it
covered. Answering that question is what exposed the whole thing.

### What survives, and it is small

The URLs land on prose. The residual idea — that a developer arriving from a
diagnostic should meet a **running reproduction** rather than a description —
is still interesting, but it is a change to the docs site, not this blog, and
it is a fraction of what this intent claimed. It gets its own intent, in the
right repo, if it earns one.

### The lesson, which is not new here

Grepping source for a value that a factory injects finds nothing and proves
nothing. That is the sixth measurement error in this directory and the same
shape as all five before it: **a proxy standing in for the thing itself.** The
runtime answer — `require` the package and read `meta.docs.url` — was three
lines away the whole time.
