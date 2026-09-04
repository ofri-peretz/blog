---
kind: plan
slug: 2026-09-04-engage-predict
opened: 2026-09-04
---

# Plan: score a draft's shape with the levers, rank it among our articles, try each edit

Intent: [`2026-09-04-engage-predict.intent.md`](./2026-09-04-engage-predict.intent.md)

## Ground truth

| Claim                              | Value                                                                                                                                                                    | Source                          | Read on    |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------- | ---------- |
| Visible levers                     | code_blocks r 0.55 and tag_ai 0.48 and publish_weekday 0.47 on comments14; title_has_colon −0.35 on reactions per 100 views; n 40 with 14-day windows, 69 with reactions | `/api/levers`                   | 2026-09-04 |
| Drafts on disk without a dev.to id | 7 in `apps/blog/content/articles`                                                                                                                                        | `grep -L devto_id`              | 2026-09-04 |
| Publisher queue                    | 0 ready nodes; next fire 2026-09-05 08:15 UTC; 7 nodes have a dev.to id the graph does not record                                                                        | `publish-next.ts --status`      | 2026-09-04 |
| Feature extractor                  | `features()` in `lib/levers.ts` over title, tags, body, publish time                                                                                                     | `apps/engage/src/lib/levers.ts` | 2026-09-04 |

## Approach

`lib/predict.ts`. For one outcome, a model is the visible levers for it, each
with the corpus mean and standard deviation of its feature. A draft's score
is the sum of r times the z-score of each feature; its percentile is the
share of corpus articles whose score is lower. Edits are tried one at a
time on the feature vector — one more code block, one more image, the title
punctuation toggled, a tag toggled, publish a day later — and the two with
the largest positive gain on the comments score are reported with the gain.

**Rejected: a regression.** Forty rows with seventeen features would fit
noise and print coefficients that look like knowledge. Summing the levers
that already pass the panel's threshold uses exactly what the panel shows.

## Sequence

1. `lib/predict.ts`: `model`, `score`, `percentile`, `suggest`; selfcheck
   with a synthetic corpus where comments rise with code blocks.
2. `/api/predict`: drafts from the blog's article directory without a
   dev.to id, frontmatter parsed for title, tags and reading time; the
   corpus and snapshots as `/api/levers` reads them; cached one hour.
3. Home page: "Before you publish" beside the levers.

## Gates

- Selfcheck red before step 1, green after.
- `tsc`, hygiene lock, `npm run selfcheck` green.
- Human: none.

## Risks

- A draft's weekday is the publisher's next fire, not a decision; the
  section prints the assumed date.
- The corpus is our own forty windows; the percentile says "among ours".
