---
kind: intent
slug: 2026-08-30-devto-crossing
opened: 2026-08-30
status: open
---

# Intent: give Dev.to readers a reason to cross to the blog

## What

Put an explicit invitation to the live playground into the Dev.to copies of
the two articles that have one, so the audience that actually exists learns
that the interactive thing exists.

## Why now

Because the measurement work finished and said this, unambiguously. In sixty
days to 2026-08-30, **zero** readers reached the blog from dev.to — 182 came
direct, 80 from Google, 4 from GitHub. Meanwhile single Dev.to articles have
drawn a thousand views, and the reader-only blog baseline is 168 pageviews
from 145 people who average 1.16 pages each.

The playground has zero opens. That is not disinterest: the people who would
want it are on a platform that cannot host it, and nothing tells them it is
one click away. The canonical "originally published at" link is not an
invitation, and the numbers show nobody treats it as one.

It is also the *only* honest reason to cross. The blog's prose is the same
prose; the playground is the one thing Dev.to structurally cannot render.

## Constraints

- The privacy promise comes with it. A reader is being asked to paste
  authentication code into a stranger's site — the invitation must repeat
  "nothing you paste leaves the page", not bury it.
- Must render on Dev.to and **not** on the blog, where `<ArticlePlayground>`
  is already on the page. Inviting someone to visit what they are looking at
  is noise.
- Article slugs are frozen post-publish; this changes bodies only.
- Publishing is Ofri's call. This ships the source change; the Dev.to copy
  updates when the PR merges.

## How we will know it worked

- **Tier 3:** `short_link_click` on the two `/go/<slug>` keys goes above zero
  from a dev.to referer. Blocked on the ingest outage — that repair is a
  prerequisite for reading this at all.
- **Tier 2:** `article:playground_open` goes above zero. It has never fired.

Both are counts crossing zero, which is the only threshold that means anything
at this volume. First read at the next Maintain review, not before.

## Not doing

- Not touching the other 88 articles. Two articles have playgrounds; an
  invitation on an article without one would be a lie.
- Not adding email capture in this change, though it remains the larger
  structural gap.
- Not rewriting the articles. One directive each, nothing else.
