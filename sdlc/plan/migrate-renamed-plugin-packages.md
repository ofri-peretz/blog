---
slug: migrate-renamed-plugin-packages
stage: plan
spec: sdlc/spec/migrate-renamed-plugin-packages.md
status: approved
---

## Files that change

- `apps/blog/content/articles/*.md` — the 29 articles carrying either old name
- No cover images, no new articles, no frontmatter identifiers

## Work order

1. Migrate with a guarded substitution: negative lookahead on `-security`,
   frozen frontmatter keys skipped by key.
2. Assert the residue: zero old names outside frozen fields, zero
   `-security-security`, zero changed identifiers.
3. Re-probe every previously-broken URL for 2xx.
4. Run the full gate.

## Risks

- **Double suffix** on a second pass — mitigated by the lookahead and asserted
  in step 2.
- **Frozen identifier drift** — mitigated by skipping those keys, asserted in
  step 2, and blocked by the hook regardless.
- **Blast radius**: 29 live articles. Merging republishes all of them to
  dev.to, so the merge is the publish and stays Ofri's call — which is the
  chain's stage-5 gate working as designed, not an exception to it.

## Proof of success

```bash
npm run test
npm run sdlc:links
npm run build
```
