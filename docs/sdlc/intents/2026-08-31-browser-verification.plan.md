---
kind: plan
slug: 2026-08-31-browser-verification
opened: 2026-08-31
---

# Plan: a working browser loop

Intent: [`2026-08-31-browser-verification.intent.md`](./2026-08-31-browser-verification.intent.md)

## Ground truth

| Claim | Value | Source | Read on |
|---|---|---|---|
| Preview pane viewport | 0 by 0 | `window.innerWidth` in the pane | 2026-08-31 |
| Form hydrated | no React props on the element | key inspection in the pane | 2026-08-31 |
| Form action attribute | React pre-hydration placeholder | same inspection | 2026-08-31 |
| Dev server itself | healthy, 200 on the article | preview logs | 2026-08-31 |
| Server-rendered markup | correct: one form, honeypot, consent | DOM query in the pane | 2026-08-31 |
| Browser submissions of the form | zero, ever | this plan | 2026-08-31 |
| CI browser job exists | yes, palette and copy journeys | `journey-audit.mjs` | 2026-08-31 |

The fourth and fifth rows are what make this a real diagnosis rather than a
complaint: the server was fine and the markup was correct. Whatever failed,
failed between "HTML arrived" and "React took over".

## Approach

**Diagnose before building.** Three candidates, cheapest first:

1. **The pane.** A 0×0 viewport is not a normal browser state, and React defers
   hydration work in some scheduling paths when a document appears non-visible.
   Test by driving the same URL through the CI path (`journey-audit.mjs` already
   launches a real headless Chrome and hydration demonstrably works there —
   its palette journeys require it). If Chrome hydrates and the pane does not,
   the pane is the fault and the fix is to stop relying on it.
2. **The app.** Something in the article route could throw during hydration and
   leave the tree inert. The console showed no errors, which argues against it,
   but "no console messages" from a pane that also reports 0×0 is weak evidence.
3. **The interaction method.** `form.requestSubmit()` on a React 19 action form
   goes through React's own submit path; driving a real click on the button is
   closer to what a user does and may simply work.

**Then build the smallest loop that proves the flow**: extend
`journey-audit.mjs` with a newsletter journey — fill the email, tick consent,
submit, assert the success state renders. It already has a launched browser, a
page, and a failure-reporting convention, so this is a new journey rather than
new infrastructure.

**Do not assert against the production database.** The journey runs against the
dev server; pointing it at real Supabase would write junk rows into the
subscriber table on every CI run. Either assert the rendered success state only,
or give the action a test-mode seam. The rendered state is the honest subject
here anyway — the write path already has direct coverage.

Rejected: a full Playwright suite. There is already a browser job with a working
convention; a second framework to answer one question is how a repo ends up with
two half-maintained e2e setups.

## Sequence

1. Reproduce in headless Chrome via the CI path. If it hydrates there, the pane
   is the fault — record that and move on rather than fixing the pane.
2. If it does not hydrate anywhere, that is a **production bug**, not a tooling
   one, and it becomes the priority: the live form would be inert for readers.
3. Add the newsletter journey to `journey-audit.mjs`.
4. Run it; watch it pass; then break the form deliberately and watch it fail.

## Gates

- Step 2 is a hard branch. A form that does not hydrate in *any* browser is
  shipped-broken and outranks everything else in the queue.
- The new journey must be seen failing on a deliberately broken form.
- No writes to the production subscriber table from CI.
- Suite stays one browser framework.

## Risks

- **The likeliest outcome is that everything is fine and the pane was the
  problem** — which still leaves the newsletter form unproven until step 3
  runs. Do not stop at step 1 feeling reassured; the point is the proof, not
  the diagnosis.
- The journey audit shares a job with a flaky navigation. That job runs
  `next start` (a production build), and its `code block` journey has timed out
  five times on `page.goto(..., { waitUntil: "load" })` — `load` waits for every
  subresource, so one hanging request sinks it. Fixed separately in PR #224 by
  waiting for `domcontentloaded` and letting the element wait be the real gate.
  A new journey should use the same pattern rather than `load`.
- A test-mode seam in the subscribe action is a new code path that production
  does not exercise. If it is added, it must be impossible to enable in a real
  deployment.
