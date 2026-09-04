---
id: I-9
slug: eslint-in-the-browser-live-lint-playground
stage: intent
status: shipped
visibility: public
opened: 2026-09-03
opened_by: claude
approved_by: ofri
---

## Recorded after the fact, and that is the finding

This intent is a **backfill**. The article it describes went live on dev.to on
2026-09-02, one day after the artifact chain landed, carrying none of the four
artifacts the chain requires. `opened: 2026-09-03` is the date this file was
written, not the date the idea was had — dating it earlier would be the exact
class of tidy fiction the chain exists to prevent.

Ofri approved and dispatched the publish; `approved_by` records that decision,
which did happen. What did not happen is any of it being written down first.

The reason it slipped is mechanical, not human: `sdlc-quality-lock` defines
"published" as `Boolean(devto_id)`, and `devto_id` is only written back into
the repo _after_ dev.to has accepted the post. The gate could never have fired
in time. It fired the moment the truth was committed — which is how we are
here. The fix ships with this article: `publish-to-devto.mjs` now refuses an
unscored article before it calls the API.

## Claim

The reader can put their own code in front of a published security rule
without installing anything, because ESLint's linter is small enough to ship
inside the article that argues for it.

## Audience

Developers who have read a lint-rule article, believed the snippet, and still
did not know whether the rule would fire on their own code. Secondarily,
anyone who assumed a browser-hosted ESLint would cost megabytes.

## Why us

We publish the rules being demonstrated, so the artifact in the reader's tab is
the same tarball `npm install` hands them — not a reimplementation and not a
description. That is a claim only the package author can make honestly. The
placement is the specialisation: browser-hosted linting is well served already
by the ESLint and typescript-eslint playgrounds, both of which are excellent
and are credited in the article. What is ours is putting the rule inside the
paragraph arguing for it, at the moment the reader wonders.

## Evidence we believe exists

- [x] `eslint/universal` exposes `Linter` with no Node dependencies in its
      public surface.
- [x] The bundle, with two real security plugins inside it, compresses small
      enough that shipping it is unremarkable.
- [x] The published rules run unmodified in a worker.
- [x] The size a reader actually downloads is measurable from the live URL.

## Kill criterion

Abandon if the bundle exceeds **1 MB over the wire**, measured against the
deployed URL rather than a local compressor. Above that the thesis inverts:
the honest advice becomes "write about the rule", and the article should not
be published. Also abandon if the worker cannot run the published tarballs
unmodified — a demo of a fork proves nothing about what a reader installs.

Not a kill criterion, and worth naming because it nearly passed as one: the
local `brotli -q 11` figure. It is a compressibility ceiling, not a download.
The first publication of this article quoted it as the served size and was
wrong by 97 KB.

## Title candidates

1. ESLint Ships in 459 KB, So My Blog Posts Lint Your Code
2. Your Code, My Rule, Your Tab: ESLint in 459 KB
3. I Put a Real Linter Inside a Blog Post

## Tier

TOPIC
