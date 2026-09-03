---
kind: intent
slug: 2026-08-31-vendor-provenance
opened: 2026-08-31
status: closed
---

# Intent: no vendored file is silently unwatched

## What

Change the vendor provenance block to a delimiter the drift check can bound, so
every vendored DS file can be watched — including the one that currently cannot
be, and any future file whose canonical header happens to be `//` comments.

## Why now

Because I knowingly left a hole yesterday and wrote the reason into the map
rather than fixing it.

`components/ui/typography.tsx` is vendored from the DS but **excluded from the
drift check**. The reverse recipe strips the provenance by skipping every
contiguous `//` line after the marker — and typography's canonical file *opens*
with a run of `//` header comments, so reversing would eat the canonical header
and report permanent false drift.

The hole is not that one file. It is that **the recipe silently cannot express
"provenance ends here"**, so the failure mode for any such file is either false
drift or a quiet exclusion. Right now a DS change to typography reaches the blog
copy with nothing noticing, which is exactly what the drift check exists to
prevent.

Fixing it during the newsletter PR would have meant touching all 24 vendored
files inside a feature change, so it was deferred on purpose. It should not stay
deferred — an exclusion with a good comment is still an exclusion.

## Constraints

- The vendored copies must stay valid TypeScript and keep compiling.
- The change touches every vendored file at once; it must land as its own PR so
  a real drift is never hidden inside a large diff.
- After the change, the drift check must report **in sync** for all of them —
  including typography, which is the whole point.
- Must not require editing the canonical DS files. The blog is the consumer; the
  recipe is the consumer's problem.

## How we will know it worked

- **Binary:** `check-vendored-drift.mjs` watches every file in
  `components/ui/` that carries a provenance block, with **no exclusions**, and
  reports in sync.
- **Binary:** hand-editing a vendored file makes it report drift; reverting
  clears it. Verified per-file for at least typography, whose round-trip is the
  one that currently fails.

## Not doing

- Not moving to a real registry install path. That is the eventual answer and
  this is a stopgap on the copy-with-provenance approach — but the stopgap is
  what we have, and it should not have a hole in it.


---

## Outcome (verified 2026-09-02)

Closed. `scripts/check-vendored-drift.mjs` exists, is wired to
`.github/workflows/vendored-drift.yml` on a Monday 09:00 UTC cron, and last ran
green on 2026-08-31.

The binary criterion — "hand-editing a vendored file makes it report drift" —
was proven **live and by accident**: #234 added `max-w-full` to the vendored
`components/ui/skeleton.tsx`, and running the checker now exits 1 naming
exactly that file. The check was not written for that edit and caught it
anyway, which is the strongest evidence available that it is not vacuous.

Consequence carried forward: that Skeleton delta is real drift and the fix
belongs upstream in the interlace repo. The Monday run will report it until
then — which is the designed behaviour, not a failure.
