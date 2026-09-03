---
kind: intent
slug: 2026-09-02-diagnostics-link-home
opened: 2026-09-02
status: open
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
