---
stage: incident
detected: 2026-08-30
detector: link-health
severity: 1sigma
articles: ["claude-wrote-nestjs-service-eslint-found-6-security-holes"]
intent:
status: triaged
---

## What the detector saw

Two links from one published article return 404 on our own documentation site:

```
404  /docs/security/plugin-nestjs-security/rules/require-class-validator
404  /docs/security/plugin-nestjs-security/rules/no-exposed-debug-endpoints
```

Both are the last remaining broken links in the corpus after the I-8 package
rename migration took it from 12 to 2.

## Class

**Not an article defect.** The links are correct and the pages exist in source:
`apps/docs/content/docs/security/plugin-nestjs-security/rules/` contains both
`require-class-validator.mdx` and `no-exposed-debug-endpoints.mdx`, and the
sibling `require-guards` resolves 200 on the live site. The section index
`/docs/security/plugin-nestjs-security/rules` also resolves 200.

So the article is ahead of the deployment: these two pages have been authored
and not shipped. In the `eslint` repo both files show as locally modified and
uncommitted, which is consistent with pages that were written but never merged
and therefore never deployed.

This is the failure mode that makes link-health advisory rather than blocking.
Had it been a gate, the correct response would have been to weaken a true link
to satisfy a check — which is worse than the 404.

## Triage

**Ignore for the blog; fix upstream.** No change to the article: rewriting a
correct link to point somewhere else would trade a temporary 404 for permanent
misinformation. The real work is in the `eslint` repo — commit and deploy the
two `.mdx` pages, after which this incident closes on the next detector pass
with no blog change at all.

Re-check: `npm run sdlc:links` should report 0 broken once the docs deploy lands.
