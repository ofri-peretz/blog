---
kind: intent
slug: 2026-09-02-your-code-your-tab
opened: 2026-09-02
status: open
---

# Intent: a security scanner that never sees your code

## What

Let a reader paste their own source into the playground and run the full rule
set against it — in their tab, with no upload, no account, and no request that
carries their code anywhere.

Today the playground runs three curated samples. The editor is already
writable; what is missing is the invitation, the full rule set, and the promise.

## Why now

Because "we never see your code" is not a feature here, it is the **only**
honest position a static-analysis vendor can take, and almost nobody in this
space can say it. Every hosted scanner asks a developer to upload proprietary
source to a stranger's server. We ship a real ESLint that runs client-side; the
architecture already makes the promise, and we simply never made it out loud.

That is a differentiator no amount of writing can substitute for. An article
can argue that a rule is useful. A reader pasting their own handler and seeing
their own bug is a different category of evidence.

It is also the shortest path from "read an article" to "install the plugin",
which every measurement we have says is currently not happening.

## Constraints

- **The promise must be architecturally true, not a policy.** No telemetry that
  includes code, no error reporter that captures the buffer, no "anonymised"
  sample. If a single byte of reader source can leave the tab, this intent has
  failed regardless of intent.
- The claim must be checkable by a reader — a network tab that stays empty is
  the proof, and the page should say where to look.
- Bundle cost is already 459 KB as the CDN sends it, for three plugins. The full set is
  larger; loading must stay lazy and the number stays quoted honestly, as
  `measured-claims` enforces.
- No new backend. The moment there is a server, the promise gets complicated.

## How we will know it worked

- **Binary:** with the devtools network panel open, pasting code and running
  the full rule set issues zero requests carrying it. Demonstrated, recorded,
  and stated on the page.
- **Binary:** a lock asserts no analytics or error-reporting call can receive
  the editor buffer — verified by attempting it and watching the check fail.
- **Tier 2:** `article:playground_open` and a new paste-and-run event go above
  zero. Both are currently at zero and have never fired, so any signal is new
  information rather than a trend.

## Not doing

- Not a hosted scanner, not a GitHub App, not CI integration. Those are
  products, and each one breaks the promise that makes this interesting.
- Not persisting what anyone pastes, in any form, including localStorage —
  someone else may use that machine.
- Not promising completeness. Type-aware rules cannot run without a program;
  the page must say which rules are unavailable and why, or the demo overstates
  what the plugins do.
