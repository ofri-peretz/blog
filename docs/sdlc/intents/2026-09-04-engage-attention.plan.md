---
kind: plan
slug: 2026-09-04-engage-attention
opened: 2026-09-04
---

# Plan: four collectors in the ingest, one events view, markers in the terminal

Intent: [`2026-09-04-engage-attention.intent.md`](./2026-09-04-engage-attention.intent.md)

## Ground truth

| Claim | Value | Source | Read on |
| --- | --- | --- | --- |
| Founder feed this month | ben: Community Gems (09-02, 91), AI Disclosure (08-26, 113), Meme Monday; jess: Preptember (09-01), Hacktoberfest 2026 (08-19, 160), weekly wins; thepracticaldev: General Challenge Updates (08-05) | `/api/articles?username=` | 2026-09-04 |
| Promotion-shaped referrers, lifetime | t.co 54, linkedin.com 26 + linkedin.android 10, forem.com 13, echojs.com 13, chatgpt.com 11, tsecurity.de 30 | `/api/analytics/referrers` | 2026-09-04 |
| Star timestamps | available with the token (`Accept: application/vnd.github.star+json`) | GitHub API | 2026-09-04 |
| Mention search | dev.to's search feed returns 0 for our handle, anonymous and authenticated | `/search/feed_content` | 2026-09-04 |
| Staff list | `lib/people.ts`, asserted with `verified` | control room | 2026-09-04 |

## Approach

Everything is a daily upsert into the warehouse by the ingest, keyed on
natural ids. Promotion events are derived, not fetched: a referrer domain's
daily delta above its 28-day mean plus 2σ is an event; a day with more than
three stars on a repo is an event. Both land in `devto_attention_events` and
surface as markers on the follower and views series, where the effect is.

**Rejected: scraping X.** No API within reach; t.co referrers and follows carry the effect.

## Sequence

1. Migration `devto_attention`: `devto_staff_posts(article_id pk, author, title, tags, published_at, reactions, comments, observed_on)`, `devto_features(program, article_id, featured_author, featured_article_id, published_at, pk (program, featured_article_id))`, `devto_staff_comments(comment_id pk, staff, article_id, article_author, created_at)`, `github_stargazers(repo, login, starred_at, pk (repo, login))`, `devto_attention_events(observed_on, kind, source, value, baseline, pk (observed_on, kind, source))`.
2. `impact-ingest/scripts/devto-attention.ts`: the four collectors and the event derivation; daily.
3. Control room: `/api/attention` (staff feed, features, events), markers on the
   terminal from `devto_attention_events`, a "What the founders are baking"
   section: the last 30 days of staff posts by program, and whether we have a
   post that matches each.
4. Levers: `featured` becomes a fourth outcome once `devto_features` has rows.

## Gates

- Ingest check script pins the feature-list parser on a saved Top 7 post and the event rule on a fixture.
- Human: confirm the staff list and the referrer domains that count as promotion.

## Risks

- Feature posts are prose; the parser reads `@username` links, which the Top 7 and Gems posts carry. A format change breaks it visibly, not silently: zero parsed authors on a feature post is reported.
