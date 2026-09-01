---
kind: intent
slug: 2026-08-31-browser-verification
opened: 2026-08-31
status: open
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

- **Binary:** a real browser fills the newsletter form, submits it, and a row
  appears in the table — the exact flow that has never been run.
- **Binary:** the same loop is repeatable locally on demand, not only in CI.

## Not doing

- Not adding end-to-end tests for every surface. The goal is the ability to
  check, not a second test suite.
- Not blocking merges on it yet. Establish that it works before making anything
  depend on it.
