---
kind: plan
slug: 2026-09-02-your-code-your-tab
opened: 2026-09-02
---

# Plan: make the promise architectural, then say it out loud

Intent: [`2026-09-02-your-code-your-tab.intent.md`](./2026-09-02-your-code-your-tab.intent.md)

## Ground truth

| Claim | Value | Source | Read on |
|---|---|---|---|
| Playground editor is writable | yes — `useState(initialCode)` | the `LintPlayground` component in `components/ui/lint-playground.tsx` | 2026-09-02 |
| Samples offered | 3, curated | `lint-embeds.ts` | 2026-09-02 |
| Bundle | 362 KB brotli, 3 plugins | `measured-claims-lock` | 2026-09-02 |
| `article:playground_open` events, ever | **0** | PostHog | 2026-09-02 |
| Backend involved in linting | none | it runs in the tab | 2026-09-02 |
| Rules across all plugins | **503** | `require()` each package, count `Object.keys(rules)` | 2026-09-02 |
| ~~Rule count~~ | ~~397~~ STALE | a remembered figure; the runtime count is 503 | 2026-09-02 |

The capability exists. The invitation and the promise do not.

## Approach

**Prove the promise before advertising it.** The order matters: a page that
says "we never see your code" while an error reporter captures the buffer is
worse than saying nothing. So the sequence is guarantee, then test, then claim.

The guarantee is architectural, and there are exactly three ways a buffer
escapes a tab: an analytics call, an error reporter, and a persistence layer.
Each gets closed explicitly rather than by convention — the editor buffer never
enters a tracked event's properties, the error boundary reports the rule
crashed without the input that crashed it, and nothing writes to storage.

**Then make the proof the reader's, not ours.** Telling someone their code
stays local is a claim. Telling them to open the network panel and watch it
stay empty hands them the check. That sentence is the feature.

Rejected: **a privacy policy paragraph.** Policies are promises about the
future; an empty network tab is an observation about the present.

Rejected: **loading all 503 rules eagerly** to make the demo impressive. The
size claim is already gated by `measured-claims`, and a page that takes four
seconds to become useful has lost the reader it was built for.

## Sequence

1. Close the three escape routes; add a lock that fails if the editor buffer
   reaches an analytics or reporting call.
2. **Verify by attempting it** — wire the buffer into a tracked event on a
   scratch branch, watch the lock go red, revert.
3. Add "paste your own" as the explicit primary action, with the network-panel
   invitation next to it.
4. Load the remaining plugins lazily on first paste; quote the new size and let
   `measured-claims` gate it.
5. State which rules cannot run without type information, and why. A demo that
   silently omits half the rule set misrepresents the product.

## Gates

- Step 2 required — the lock must be seen failing on a real leak.
- Zero network requests carrying editor content, demonstrated with the panel
  open and recorded in the finding.
- Nothing written to `localStorage`, `sessionStorage`, or IndexedDB. Someone
  else may use that machine.
- The unavailable-rules note ships in the same change as the paste affordance,
  not after.

## Risks

- **The promise is one careless PR from being false**, and it will be published
  prose by then. The lock is the only durable defence; it must test the
  behaviour, not grep for a string, or it rots the way four checks in this repo
  already have.
- **Bundle growth is the honest cost.** Lazy loading moves it rather than
  removing it, and the number must stay quoted.
- **Zero is still the likeliest outcome.** `playground_open` has never fired.
  This intent is a bet that the invitation was the missing part; if it stays at
  zero afterwards, that is evidence about the audience, not a reason to build a
  third variant.
