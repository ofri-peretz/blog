---
kind: plan
slug: 2026-08-31-vendor-provenance
opened: 2026-08-31
---

# Plan: a provenance block the reverse recipe can bound

Intent: [`2026-08-31-vendor-provenance.intent.md`](./2026-08-31-vendor-provenance.intent.md)

## Ground truth

| Claim | Value | Source | Read on |
|---|---|---|---|
| Vendored files tracked | 24 | the VENDORED map | 2026-08-31 |
| Vendored but excluded | 1, typography.tsx | the same map's comment | 2026-08-31 |
| Why it cannot round-trip | canonical opens with comment lines | the canonical file | 2026-08-31 |
| How the stripper ends a block | first non-comment line | `normalizeVendored` | 2026-08-31 |
| Drift check schedule | weekly cron, files an issue | the workflow | 2026-08-31 |
| Drift check in PR CI | no, deliberately | the same workflow | 2026-08-31 |

That last row matters for sequencing: the check does not gate merges, so a hole
in it produces no red build anywhere. It fails open, quietly, which is why an
exclusion is worse here than it would be in a blocking check.

## Approach

**Give the block an explicit end marker.** The stripper currently guesses where
provenance stops ("first line that isn't a comment"), and that guess is wrong
for any canonical whose own header is comments. Replace the guess with a
sentinel the recipe writes and the reverse consumes:

```
// ⟨vendored⟩ …provenance lines…
// ⟨/vendored⟩
```

Reverse becomes: drop everything from the open marker through the close marker
inclusive, plus the blank line the recipe inserted. No content-shape guessing,
so a canonical file can start with anything.

Rejected: keeping the guess and special-casing typography. That is the shape of
the bug — a rule that works except where it doesn't, with the exceptions
recorded in prose. The next such file would need another exception.

Rejected: a blank-line delimiter. Cheaper to implement, but blank lines already
appear inside provenance blocks in some vendored files, so it trades one
ambiguity for another.

**Migration is mechanical:** rewrite the block in all 24 files, then extend the
`VENDORED` map with typography and drop the exclusion comment. The drift check
itself is the verification — if every file reports in sync afterwards, the
rewrite preserved content exactly.

## Sequence

1. Update the forward recipe (the vendoring script) to emit the markers.
2. Update `normalizeVendored` to strip between them.
3. Re-vendor all 24 **plus typography** from DS `main`, so all 25 files get the
   new block. Review caught this: typography is currently excluded from the map,
   so a re-vendor driven off the map alone would skip it, and it would still
   carry the old marker-less block when step 5 checked it — reporting drift
   immediately and for a reason that has nothing to do with the DS.
4. Add typography to the map; delete the exclusion note.
5. Run the drift check: expect **in sync** for 25 of 25.
6. Prove it still detects: edit a vendored file, confirm drift, revert.

## Gates

- 25 of 25 in sync, zero exclusions.
- The detection proof in step 6 is required — a check that reports "in sync"
  because it compares nothing would pass step 5 perfectly.
- Its own PR. A 24-file mechanical rewrite must not share a diff with a
  behaviour change, or a genuine drift hides in the noise.

## Risks

- **The rewrite could silently alter content.** The drift check is the guard:
  any accidental edit shows up as drift in step 5 rather than shipping.
- Re-vendoring pulls whatever is on DS `main` today, so a file may legitimately
  change if the DS moved since it was vendored. Read those diffs rather than
  waving them through — that is real upstream drift finally becoming visible,
  which is the feature working, not a problem with the migration.
- The DS repo's git was unreachable at times yesterday; the recipe fetches from
  `raw.githubusercontent.com`, so a network failure surfaces as exit 2 (fetch
  failed) rather than as false drift. Treat exit 2 as "try again", never as
  "in sync".
