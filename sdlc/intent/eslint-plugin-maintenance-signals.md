---
id: I-13
slug: eslint-plugin-maintenance-signals
stage: intent
status: approved
visibility: public
opened: 2026-09-04
opened_by: claude
approved_by: ofri
---

## Recorded after the draft, before the publish

Backfilled at scoring time, before publication.

## Claim

Days-since-release is a one-second signal and a bad verdict. A reader finishes
able to get the number for their own lockfile, and — more importantly — knowing
the three follow-up checks that separate a package that is finished from one
that is abandoned.

## Audience

Anyone picking or auditing lint plugins who has wondered whether a quiet
package is a problem. The article assumes no tooling and asks for one shell
command.

## Why us

We publish into this ecosystem, so a piece about which neighbouring packages
have gone quiet is written from a position where getting it wrong is costly and
noticed. That is also why the framing has to be careful and why the article
argues _against_ the reading that would flatter us: "dormant is not dead", a
stable spec produces a stable plugin, and the package we have elsewhere called
unmaintained is shown coming back to life.

## Evidence we believe exists

- [x] The npm registry exposes per-version publish dates, so days-since-release
      is computable for any package.
- [x] The three most-installed plugins have gone a year or more without a
      release.
- [x] At least one package carries a real npm deprecation flag.
- [x] At least one long-silent package was superseded under a new name.
- [x] At least one package that looked abandoned has since shipped.

## Kill criterion

Abandon if the quiet packages turn out to be quiet for uninteresting reasons —
if every long gap resolves to "finished, spec is stable", then the article has
no advice in it, only a table. It half-fired, and the draft handles it: the
`jsx-a11y` row genuinely is the "finished" case, so the article makes that the
turn rather than burying it.

Also abandon if the numbers cannot be computed the same way twice. This one
nearly fired for real, from an angle the draft did not see — see the spec.

## Title candidates

1. The 3 Most-Installed ESLint Plugins Went Quiet in 2025
2. Dormant Is Not Dead: Reading npm Silence
3. Nine of Eighteen Shipped Nothing All Year

## Tier

T3
