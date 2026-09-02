---
kind: intent
slug: 2026-09-02-third-playground
opened: 2026-09-02
status: open
---

# Intent: put a playground where the readers already are

## What

Add a live-lint playground to **The 30-Minute Security Audit** — the corpus's
highest-traffic article at ~1,058 views, roughly 23% of all views the blog has
ever received — using rules from a plugin the worker already bundles.

## Why now

Because the two existing playgrounds sit on articles with a fraction of that
reach, and the marginal cost here is close to zero.

The article names `eslint-plugin-node-security` five times, and that plugin is
**already in the worker**. So this adds a definition and a sample, not a
dependency: the 362 KB bundle does not grow, the lazy gate is unchanged, and
nothing about the loading story changes for any other page.

It is also the strongest available test of the playground thesis. The article
is a 30-minute *protocol* — install these, run this, read the output — and a
reader following it can now see a finding before installing anything. If the
playground converts anywhere, it converts there.

## Constraints

- **Zero new bundle weight.** Rules must come from `jwt` or `node-security`.
  A third plugin would grow every article's gate for one page's benefit.
- Every rule the definition enables must actually fire on its own sample. That
  is enforced by the existing lock, which caught the three-rules-one-fires bug.
- The article's slug is frozen and its Dev.to copy is live; body edits only.
- Rules must be ones the article actually discusses. A playground demonstrating
  rules the surrounding prose never mentions is a non sequitur.

## How we will know it worked

- **Tier 2:** `article:playground_open` carrying this slug. The event has never
  fired for any article; the highest-traffic page is where it is most likely to.
- **Comparative:** open-rate on this article against the JWT and node-security
  pages. Three data points on very different traffic is the first thing
  resembling a signal about whether placement or subject matters more.

## Not doing

- Not adding a fourth or fifth. If this one draws nothing on the biggest
  article in the corpus, more playgrounds is the wrong answer and the finding
  should say so.
- Not rewriting the article. One section, placed where the protocol tells the
  reader to run a scan.
