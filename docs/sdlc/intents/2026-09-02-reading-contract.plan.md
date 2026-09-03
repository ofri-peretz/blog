---
kind: plan
slug: 2026-09-02-reading-contract
opened: 2026-09-02
---

# Plan: name the reading contract, then gate one rule of it

Intent: [`2026-09-02-reading-contract.intent.md`](./2026-09-02-reading-contract.intent.md)

## Ground truth

| Claim | Value | Source | Read on |
|---|---|---|---|
| Design philosophy docs, eslint repo | 25 | `ls *PHILOSOPHY*.md` | 2026-09-02 |
| Design philosophy docs, blog repo | **0** | same | 2026-09-02 |
| Intents whose subject is the reader's experience | **0 of 16** | read each `## What` | 2026-09-02 |
| Article body type | 16px / 28px line-height (1.75) | computed style, production | 2026-09-02 |
| Article measure at 1280px | **76 characters** | rendered width ÷ measured glyph width | 2026-09-02 |
| Article measure at 390px | 43 characters | same | 2026-09-02 |
| Type-size usages that are the two smallest steps | 144 of ~199 | class scan of `src/**.tsx` | 2026-09-02 |
| Off-scale type sizes | `text-[10px]` ×11, `text-[11px]` ×1 | same | 2026-09-02 |
| Production LCP / CLS | 448ms / **0** | PerformanceObserver, production | 2026-09-02 |
| Layout audit | 288/288 clean | `layout-audit.mjs` | 2026-09-02 |

The last two rows are why this intent is about a ceiling and not a floor: the
floor is genuinely met, and the site still has nothing that says what good is.

**76 is the number to hold onto.** It is not a defect, no audit will ever flag
it, and it is one character outside the range every typographer since Bringhurst
has published. That is the exact shape of what a contract catches.

## Approach

**Write the contract from what the site already does, not from a textbook.**
Most of the decisions are already made and merely unwritten — 16px body, 1.75
line-height, `--container-prose` at 65ch, a Tailwind scale with two documented
escapes. Writing them down costs little and makes them reviewable. The parts
that are genuinely unresolved (the measure being 76, the two smallest steps
carrying 72% of the type) get named as open questions, not silently blessed.

**Then gate exactly one rule.** The measure is the right one: it is the single
number that most determines whether long-form text is comfortable, it is
measurable in a browser we already drive, and it is currently out of range —
so the gate fails on today's state, which is the only way to know it works.

Rejected: **gating the type scale** (no `text-[Npx]` outside a documented list).
Tempting because it is a cheap grep, but it is a *textual* assertion about a
*visual* property, and `behavioural-claims` already established that this is
the shape that rots. The two off-scale sizes are also, on inspection, in
chrome rather than prose — worth a note in the contract, not a gate.

Rejected: **porting `TYPOGRAPHY_PHILOSOPHY.md` from the eslint repo.** Different
product, different reader, different constraints. A contract that arrives
pre-agreed is one nobody has actually agreed to.

Rejected: **a "reading experience score".** Composite scores are how a site
stops noticing individual regressions.

## Sequence

1. Measure the current state precisely — done, in the table above.
2. Write `docs/TYPOGRAPHY.md`: body, headings, code, measure, scale, and the
   two decisions currently unresolved, each with the reason.
3. Add a lock that asserts the article measure sits inside the contract's
   range at 390px and 1280px, driven through the existing browser tooling
   rather than a new framework.
4. **Run it and watch it fail on 76.** That failure is the experiment.
5. Bring the measure into range — narrowing `--container-prose`, not adding a
   wrapper — and re-run until green.
6. Re-run the layout audit: 288/288 must still hold, and CLS must still be 0.

## Gates

- Step 4 is required. A contract whose gate passes on day one has established
  nothing; four separate checks in this repo have now been caught doing exactly
  that.
- The contract names at least one decision it could NOT settle. A document that
  resolves everything cleanly has stopped looking.
- No regression to the 288-combination floor, and CLS stays 0.
- The lock drives the browser we already use. A second e2e framework for one
  measurement is how a repo ends up with two half-maintained ones.

## Risks

- **Changing the measure changes every article page.** It is the most visible
  single change this repo could make to reading, which is why step 6 re-runs
  the full audit rather than trusting the unit lock.
- **Narrowing the column trades line length against page length.** 66 characters
  is more comfortable per line and makes every article scroll longer; that is a
  real trade and the contract should say which side it chose and why.
- **A contract nobody reads is worse than none**, because it implies agreement
  that does not exist. Mitigated by gating one rule — the gate is what makes
  the document load-bearing rather than decorative.
- **Mobile is already at 43 characters**, below the comfortable range and not
  fixable by narrowing anything. The contract has to state the floor honestly
  rather than pretend 390px can hit 66.
