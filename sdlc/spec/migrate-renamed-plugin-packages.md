---
slug: migrate-renamed-plugin-packages
stage: spec
intent: sdlc/intent/migrate-renamed-plugin-packages.md
status: approved
gathered: 2026-08-30
---

## Thesis

Two packages were renamed on npm and the corpus never followed. The evidence
did not move the claim — it enlarged it: the first probe was 12 broken GitHub
links, and the same rename turns out to affect 287 mentions across 29
published articles, including 47 install commands.

## Ground truth

| Claim                                      | Value      | Command                                                                  | Version | Verified   |
| ------------------------------------------ | ---------- | ------------------------------------------------------------------------ | ------- | ---------- |
| eslint-plugin-pg is deprecated             | deprecated | `npm view eslint-plugin-pg deprecated`                                   | 1.4.14  | 2026-08-30 |
| eslint-plugin-jwt is deprecated            | deprecated | `npm view eslint-plugin-jwt deprecated`                                  | 2.2.14  | 2026-08-30 |
| successor postgresql-security version      | 2.2.1      | `npm view eslint-plugin-postgresql-security version`                     | 2.2.1   | 2026-08-30 |
| successor jwt-security version             | 3.0.3      | `npm view eslint-plugin-jwt-security version`                            | 3.0.3   | 2026-08-30 |
| rules in eslint-plugin-postgresql-security | 13         | `node scripts/sdlc/pkg-rule-count.mjs eslint-plugin-postgresql-security` | 2.2.1   | 2026-08-30 |
| rules in eslint-plugin-jwt-security        | 13         | `node scripts/sdlc/pkg-rule-count.mjs eslint-plugin-jwt-security`        | 3.0.3   | 2026-08-30 |

Rule counts are unchanged across both renames, so no "N rules" claim anywhere
in the corpus becomes wrong. That is the reason this migration is a rename and
not a rewrite.

## Known traps pre-empted

- [x] **Export shape** — not claimed here; no import shape changes.
- [x] **Rule counts** — counted from clean installs of the published successors.
- [x] **Config option names** — unchanged; rule IDs are stable across the rename.
- [x] **Detection logic** — no behavioural claim is made.
- [x] **Frozen identifiers** — `canonical_url` on several articles embeds the
      OLD package name. Those must not change: dev.to permalinks are immutable
      and a rewrite would 404 every inbound link. The freeze hook enforces this.

## Substitution

```
eslint-plugin-pg   ->  eslint-plugin-postgresql-security
eslint-plugin-jwt  ->  eslint-plugin-jwt-security
```

Applied to body text and to `title` / `description` only. Two guards are
required and both are load-bearing:

1. A negative lookahead, or `eslint-plugin-jwt-security` becomes
   `eslint-plugin-jwt-security-security` on any second pass.
2. Frozen frontmatter lines are skipped by key, not by position.

## Framing check

No comparison; landscape framing not engaged. No self-graded fixtures.
