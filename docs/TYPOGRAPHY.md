# Typography contract

This is a text site. Type is the product, and until 2026-09-02 not one of its
decisions was written down. Everything here describes what the site already
does, except where it says otherwise — the point is to make these reviewable,
not to redesign them.

Contract: [`sdlc/intents/2026-09-02-reading-contract.intent.md`](./sdlc/intents/2026-09-02-reading-contract.intent.md)

## The measure — the one rule with a gate

**Body text renders 45–75 characters per line. Target 66.**

This is the only rule here enforced by a test, because it is the single number
that most determines whether long-form text is comfortable, and because it was
**out of range when this document was written**: 85 characters at 1280px.

Enforced by `src/__tests__/reading-measure-lock.test.ts`, which counts
characters on real rendered lines.

### Count characters. Do not compute them.

`ch` is not a character. It is the advance width of the **zero glyph**, which in
Geist is `1.418×` the average glyph in English prose. A column set to `65ch`
renders about **85** characters, not 65.

Two earlier estimates in this repo (76, then 83.6) divided column width by an
"average glyph advance" and disagreed with each other, because that average
depends entirely on which sample string you measure. The number here is
**counted** — walk a text node with a `Range`, group by `getClientRects()` top,
count characters per line, take the median. When an estimator and a count
disagree, the count wins.

## Body

| | |
|---|---|
| Family | Geist |
| Size | 16px — never smaller for prose |
| Line height | 28px (1.75) |
| Measure | 45–75 characters, target 66 |

1.75 is deliberately generous. It suits a technical register where readers scan
back to re-read a definition, and it is the reason the mobile column at 47
characters reads comfortably rather than cramped.

## Scale

Tailwind's default steps, `text-xs` through `text-6xl`. Two documented escapes
exist — `text-[10px]` (×11) and `text-[11px]` (×1) — and both are **chrome**:
dense metadata rows in the terminal and scorecard surfaces, never prose.

**No new off-scale size without a line in this table.** Not gated: it is a
textual assertion about a visual property, and this repo has established that
such checks rot. A reviewer enforces it.

## Headings

Headings inherit the measure — they sit in the same column and break the same
way. `overflow-wrap: break-word` applies globally at `@layer base` so a long
heading word wraps rather than scrolling the page at 320px with text at 200%.
That is a WCAG 1.4.10 requirement, not a preference; see `globals.css`.

## Code

Inline code gets `overflow-wrap: anywhere`, because only `anywhere` reduces an
element's min-content contribution — which is what actually lets a flex or grid
ancestor shrink. Code **blocks** are excluded: they live in an `overflow-x:auto`
container, and breaking lines mid-token corrupts what a reader copies.

## What this document could not settle

**Whether the two smallest steps should carry 72% of the type.** 144 of ~199
size usages are `text-sm` or `text-xs`. A site whose default voice is small and
dense reads as a dashboard rather than as writing. But most of those usages are
in chrome — the terminal, the scorecard, metadata rows — where dense is
correct, and no measurement here separates "dense chrome" from "timid prose".
Naming it as unresolved rather than inventing a threshold.

**Whether 66 is right for this reader.** The 45–75 range is from print. Screen
reading at 16px with 1.75 leading may sit comfortably higher. The gate uses the
published range because inventing a bespoke one to match the current value is
how a contract becomes decoration.
