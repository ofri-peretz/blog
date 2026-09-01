---
kind: plan
slug: 2026-08-30-reader-depth
opened: 2026-08-30
---

# Plan: diagnose reader depth

Intent: [`2026-08-30-reader-depth.intent.md`](./2026-08-30-reader-depth.intent.md)

## Ground truth

| Claim | Value | Source | Read on |
|---|---|---|---|
| Pages per reader | 1.16 | 168 reader pageviews over 145 readers | 2026-08-30 |
| Published articles | 90 | `ls content/articles/*.md` | 2026-08-30 |
| `corpus_map:dot_click`, 30d | 3 events, 1 person | PostHog SQL by event name | 2026-08-30 |
| `series:pager_click`, 30d | 0 | absent from the event list | 2026-08-30 |
| `article:thread_click`, 30d | 0 | absent from the event list | 2026-08-30 |
| `series:resume_click`, 30d | 0 | absent from the event list | 2026-08-30 |
| `quick_open:palette_view`, 30d | 5 events, 5 people | PostHog SQL by event name | 2026-08-30 |
| Referrer mix, 60d | 182 direct, 80 google, 4 github | `visitor_classified.referrer_domain` | 2026-08-30 |
| Reader profile mix, 30d | 93 unknown, 51 developer, 2 student | `visitor_classified.profile` | 2026-08-30 |

The search-traffic row is the one to sit with: 80 of ~270 people arrived from
Google. A search visitor landing on a specific answer has, by construction,
already got what they came for.

## Approach

Diagnosis first, and it is mostly arithmetic rather than instrumentation.

**Candidate 1 — volume.** Compute the expected click count if each affordance
converted at a plausible rate. At 145 readers, a 2% click rate on the series
pager predicts about three clicks a month, which is indistinguishable from the
zero we see. If the numbers cannot separate a good affordance from a broken
one, that is the finding, and the correct response is to stop looking here
until traffic grows. **Do this calculation before any other work** — it may end
the intent in ten minutes, which would be the best possible outcome.

**Candidate 2 — arriving intent.** Split pages-per-reader by
`first_referrer_domain`. If Google arrivals read 1.0 and direct arrivals read
2.5, then depth is a function of who is arriving, not of what the page offers,
and the lever is acquisition rather than navigation.

**Candidate 3 — the affordances themselves.** Only if the first two fail to
explain it. Check that each is actually rendered on the pages readers land on:
the series pager needs the article to be in a series, Threads needs related
articles, resume needs a return visit. An affordance that does not render
cannot be clicked, and zero clicks would then mean zero opportunities rather
than zero interest.

Rejected approach: session replay. We have it enabled, and with three clicks a
month there is nothing to watch. It becomes useful at an order of magnitude
more traffic.

## Sequence

1. The volume arithmetic. Stop here if it is inconclusive by construction.
2. Depth split by referrer.
3. Render-coverage check: on how many of the 90 articles does each affordance
   actually appear?
4. Write the finding, with the decision it licenses.

## Gates

- The finding must name what it could not determine. With these counts, "we
  cannot tell" is the most likely honest answer for at least one candidate.
- No new component ships from this intent. A follow-up intent may propose one,
  and it will have to cite this finding.
- Numbers computed with the population rule, never raw — our own browsing is
  precisely the traffic that reads many pages, and leaving it in would make
  depth look far healthier than it is.

## Risks

- **Concluding too much from single-digit counts.** The main risk, and step 1
  exists to catch it before the rest of the analysis lends it false weight.
- The tempting response to "readers don't go deeper" is to build something.
  The intent forbids it on purpose; if the finding says build, it will still be
  a separate decision.
- Removal has a cost we cannot see here: an affordance nobody clicks may still
  signal care to a reader who notices it. Weigh that before deleting anything.
