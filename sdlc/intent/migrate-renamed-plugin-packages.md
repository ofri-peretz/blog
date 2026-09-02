---
id: I-8
slug: migrate-renamed-plugin-packages
stage: intent
status: approved
visibility: public
opened: 2026-08-30
opened_by: detector
approved_by: ofri
---

## Claim

Twenty-nine published articles instruct readers to install two npm packages
that are deprecated and renamed. Every install command, import, and link in the
corpus points at the package a reader should actually install.

## Audience

Every reader who follows an install command in one of these 29 articles — and,
more sharply, everyone who has followed one since 2026-08-09, when both
packages were deprecated.

## Why us

These are our own packages, our own rename, and our own articles. A corpus
whose thesis is _"static analysis catches what memory misses"_ cannot itself
be running on stale memory. This is the single largest correctness defect in
the corpus and it was invisible to every review pass, because nothing in the
articles changed — npm did.

Found by the stage-6 staleness signal on its first live run:

```
eslint-plugin-pg   v1.4.14  DEPRECATED -> eslint-plugin-postgresql-security  (now v2.2.1)
eslint-plugin-jwt  v2.2.14  DEPRECATED -> eslint-plugin-jwt-security         (now v3.0.3)
```

## Evidence we believe exists

- [x] Both old names return a `deprecated` field from `npm view` naming the successor
- [x] 29 published articles, 287 mentions: 47 install commands, 41 imports, 37 npm links, 10 GitHub links
- [x] Rule counts are unchanged across the rename (13 and 13), so no rule-count claim in the corpus becomes wrong
- [x] The renamed GitHub paths resolve 200

## Kill criterion

If the old names were still maintained aliases rather than deprecations, this
would be cosmetic and closed as `ignored`. They are not: `npm view` returns an
explicit deprecation naming the successor, and the successors are two major
versions ahead.

## Constraint

`slug`, `devto_id`, `devto_url` and `canonical_url` are frozen on all 29 —
several canonical URLs contain the old package name and **must not change**.
Body, title and description are in scope; identifiers are not.

## Title candidates

n/a — corrective work on published articles.

## Tier

n/a
