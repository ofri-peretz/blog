---
kind: plan
slug: 2026-08-30-devto-crossing
opened: 2026-08-30
---

# Plan: the dev.to → playground crossing

Intent: [`2026-08-30-devto-crossing.intent.md`](./2026-08-30-devto-crossing.intent.md)

## Ground truth

| Claim | Value | Source | Read on |
|---|---|---|---|
| Referrals from dev.to, 60d | 0 | PostHog SQL on `visitor_classified.referrer_domain` | 2026-08-30 |
| Referrer mix, 60d | 182 direct / 80 google / 4 github | same | 2026-08-30 |
| Reader-only August reach | 168 pageviews, 145 readers | PostHog SQL with the population rule | 2026-08-30 |
| Pages per reader | 1.16 | derived from the two figures above | 2026-08-30 |
| `article:playground_open` | 0, ever | PostHog SQL by event name | 2026-08-30 |
| `/go/<slug>` resolves | HTTP 302 to the article | `curl` against production | 2026-08-30 |
| Articles with a playground | 2 | `LINT_EMBEDS` length | 2026-08-30 |

## Approach

A new `::playground-cta{slug="…"}` directive — the only one in the corpus that
renders per-surface, and deliberately so. `lib/markdown.ts` strips it for the
blog; `scripts/publish-to-devto.mjs` expands it for Dev.to.

It emits an **already-`/go/`** link, which is the whole subtlety.
`classifyDevtoLink` matches `/articles/<slug>` and rebuilds the stored
destination as `origin + pathname` — which silently drops a `#playground`
fragment and lands the reader at the top of a long article instead of on the
playground. A `/go/` path is treated as an idempotent fixed point and passes
through untouched, the `/go/<slug>` row already exists from that article's own
publish, and fragments survive a 302 client-side.

Rejected: reusing `::dev-to-cta`. It renders identically on both surfaces, so
the blog copy would tell readers to go and see the component sitting directly
beneath the sentence.

## Sequence

Independent of the analytics repair, except for reading the result.

1. `id="playground"` anchor + `scroll-mt-24` on the playground section, so the
   deep link lands on it and not under the sticky header. *(done)*
2. Directive: strip on blog, expand on Dev.to. *(done)*
3. One directive in each of the two articles. *(done)*
4. Locks. *(done)*

## Gates

- Lock: every `LINT_EMBEDS` slug's article carries a directive **keyed to its
  own slug** — a copy-pasted wrong slug would send readers to another
  article's playground.
- Lock: `preprocessMarkdown` removes the directive *and* its label, verified
  behaviourally rather than by grep.
- The Dev.to half is asserted textually: `publish-to-devto.mjs` runs `main()`
  at import, so importing it in a test would attempt a real publish.
- Merging is Ofri's call. Merging does not touch dev.to; updating the live
  Dev.to copies is a separate manual `publish-devto.yml` dispatch.

## Risks

- Measuring this depends on the `short_link_click` outage being fixed. Until
  then the crossing can happen and stay invisible — `article:playground_open`
  is the fallback signal, and it is on the blog side so it survives the outage.
- Dev.to renders the expansion as a bold link. Link text is kept to one short
  sentence; a paragraph-length hyperlink reads badly and was the first draft.
