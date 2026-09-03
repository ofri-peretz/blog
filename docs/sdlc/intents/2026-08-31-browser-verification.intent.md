---
kind: intent
slug: 2026-08-31-browser-verification
opened: 2026-08-31
status: closed
---

# Intent: be able to prove a UI change works in a real browser

## What

Restore the ability to load a page, interact with it, and confirm the result —
locally, before merge. Right now nothing in the loop does that, and several
things shipped this week on inference.

## Why now

Because the newsletter form has **never been submitted by a browser**, and it is
live in production.

The preview pane reported a 0×0 viewport all session and never hydrated: the
form element carried React's pre-hydration placeholder
(`javascript:throw new Error('React form unexpectedly submitted.')`) and no
React props, so a submit could not reach the action. Verification fell back to
calling the server action directly with a hand-built `FormData`, which proved
the write path and proved nothing about the page.

That gap matters most for exactly this feature. `useActionState` + a server
action + a Base UI checkbox is a stack where the failure lives in hydration and
event wiring — the half that was not exercised. A form that renders correctly
and never submits looks identical to a working one in every check we ran.

The same session also shipped the Dev.to CTA, the gate label, and the playground
anchor on `curl` plus unit tests. Those are weaker evidence than they sound: a
page can serve correct HTML and be inert.

## Constraints

- Must not become a browser in the unit suite. This is a pre-merge capability,
  not a per-test dependency.
- Must work against the local dev server, since the point is catching a problem
  before it reaches production.
- The existing `browser-audit` CI job already drives a real browser for the
  palette and copy journeys — whatever is built here should extend that path
  rather than invent a second one.
- Diagnosis first. A fix that assumes the pane is at fault, when the cause might
  be the app's hydration, would be a guess dressed as a repair.

## How we will know it worked

Two different proofs, because they are not the same claim — review caught the
intent and the plan disagreeing here, and the distinction is the whole point of
this week:

- **One-time, end-to-end:** a real browser fills the form, submits it, and a
  **row appears in the table**. This proves the write path *through the UI*.
- **Repeatable, in CI:** the journey asserts the **rendered success state**.
  This proves the page responded, and it is deliberately weaker — the write
  could fail and this would still pass. It is paired with the direct coverage
  the action already has, and it does not write to the production table.

Stating only the second would be the exact failure this week keeps producing: a
check that reports healthy about something it never verified.

**RESOLVED 2026-08-31.** The one-time proof is done, against production: a real
Chrome filled the live form, submitted it, rendered "Thanks — you're on the
list.", and the row landed with consent and the correct source article. Probe
row deleted. **The form works** — the intent's hard branch (a form that
hydrates nowhere would be a production bug outranking everything) does not
apply.

One correction that came with it: the pane reported `hydrated: false` *and the
submit still worked*, because React hydrates asynchronously and the snapshot
was taken too early. The earlier "it never hydrates" conclusion was partly a
measurement-timing error of mine, not purely a broken pane.

## Not doing

- Not adding end-to-end tests for every surface. The goal is the ability to
  check, not a second test suite.
- Not blocking merges on it yet. Establish that it works before making anything
  depend on it.


---

## Outcome (verified 2026-09-02)

Closed. The newsletter journey is in `journey-audit.mjs` (step 4) and passes in
CI — observed green on this session's runs:

    ✓ newsletter: filling and submitting the form reaches a terminal state

The diagnosis the plan called for also resolved: the form was never broken. The
0×0 preview pane was, and the hydration failure was a measurement artifact of
snapshotting before React finished. Recorded because the plan's step 2 made
"it does not hydrate anywhere" a hard branch that would have outranked
everything else — it was correctly not taken.

Per the plan's constraint, the journey asserts the **rendered success state**
and does not write to the production subscriber table.
