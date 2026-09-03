---
kind: intent
slug: 2026-09-02-reading-contract
opened: 2026-09-02
status: closed
---

# Intent: the blog is accidentally good, and nothing holds it there

## What

Give the reading experience a written contract and one enforced gate — starting
with typography, because this is a text site and type is the whole product.

Not twenty-five documents. One, plus a lock that fails when the contract is
broken.

## Why now

Because every quality mechanism this repo has measures a **floor**, and none
measures a **ceiling**.

| What we check | What it asks |
|---|---|
| 288 route×viewport combinations | is anything overflowing, overlapping, unreadable? |
| 713 unit and lock tests | did anything regress? |
| LCP 448ms, CLS 0 | is anything slow or jumping? |

Every one of those asks *is anything broken*. Not one asks *is this good*. The
blog passes all of them and has **zero** written design contracts, while the
eslint docs site — the same author, the same standards — has **25**
(`TYPOGRAPHY_PHILOSOPHY.md`, `COLOR_PHILOSOPHY.md`, `MOTION_PHILOSOPHY.md`, and
so on).

So the blog is good by accident: held up by careful individual decisions and a
rigorous defect floor, with nothing that says what good means here and nothing
that stops the next drift. Sixteen intents exist and **not one has a reader's
experience as its subject** — they are measurement, distribution, or test
hygiene. That absence is the finding.

The gap is already visible in the type, measured on production today:

- The article measure runs **85 characters** at 1280px — median of 11 counted
  lines, range 82–91. The classic comfortable range is 45–75 and Bringhurst's
  ideal is 66, so this is **ten over the upper bound**, not one.

  The first draft of this intent said 76, and a second estimate said 83.6. Both
  were wrong, and wrong in the same way: they divided the column width by an
  *average glyph advance*, which depends entirely on the sample string you
  measure. Counting characters on real rendered lines gives 85. Two estimators
  disagreeing was the signal to stop estimating — recorded because it is the
  fifth measurement error in this SDLC directory and every one has been a proxy
  standing in for the thing itself.

  Mobile, correspondingly, is **fine**: 47 characters at 390px, inside the
  range. The earlier claim that it sat below at 43 was the same estimator
  error.
- **144 of ~199** type-size usages are the two smallest steps (`text-sm`,
  `text-xs`), and `text-[10px]` appears 11 times outside the scale entirely.
  A site whose default voice is "small and dense" reads as a dashboard, not as
  writing worth remembering.

## Constraints

- **One contract, one lock, this pass.** Porting 25 documents from another repo
  is cargo cult; each one has to earn its place by naming a decision this blog
  actually faces.
- The lock must fail on the current state or on a deliberate break — a contract
  whose gate is green on day one has proven nothing, which this repo has now
  learned four separate times.
- Nothing here may regress the floor: 288 combinations stay clean, CLS stays 0.
- No redesign. This is about naming and holding what exists, not replacing it.

## How we will know it worked

- **Binary:** a written typography contract exists that a stranger could apply
  to a new component without asking anyone.
- **Binary:** a lock enforces at least one of its rules, and is **seen failing**
  — either on today's state, or on a deliberate violation, with the failure
  recorded.
- **Binary:** the measure on an article page lands inside the range the
  contract states, at both 390px and 1280px, measured rather than asserted.
- **Directional, honest:** "unforgettable" is not measurable and this intent
  does not pretend otherwise. What it can do is stop the site drifting away
  from considered, and make the next UX decision reviewable instead of taste.

## Not doing

- Not writing the other 24 philosophies on spec. If a second one is needed, it
  gets its own intent and its own reason.
- Not touching brand or layout language. `One thread, every scale` shipped and
  is the site's signature; this is about the reading surface underneath it.
- Not building new reader features. Six intents already wait on signals that
  have never fired; adding a seventh would repeat the mistake `reader-depth`
  was closed to avoid.


---

## Outcome (2026-09-02)

| | Before | After |
|---|---|---|
| Measure @1280px | **85 chars** ✗ | **65** ✓ |
| Measure @390px | 47 ✓ | 47 ✓ (untouched) |
| Layout floor | 288/288 | **288/288** |
| Unit suite | 713 | **719** |

**The cause was a unit, not a value.** `ch` is the advance of the ZERO glyph —
1.418x the average glyph in Geist — so a container set to `65ch` rendered ~85
characters. It went unnoticed because the number *looked* right: 65ch, 65
characters, near the ideal of 66. It was off by twenty.

`52ch` was measured, not derived: counted at 65/52/50/48/46/44ch and took the
value landing nearest 66. Mobile held at 47 for every value, because below the
breakpoint the viewport binds before the max-width does — so the change is
desktop-only without a media query.

**The gate was seen failing first** (`✗ 85 chars`), which was the whole
experiment, and the vitest lock fails in both directions: reverting to `65ch`,
and desyncing `globals.css` from `container.tsx`.

**Carried forward, not resolved:** the two questions `docs/TYPOGRAPHY.md` names
as unsettled — whether the two smallest steps should carry 72% of the type, and
whether 66 is right for a screen at 1.75 leading. Both need evidence this intent
did not have.
