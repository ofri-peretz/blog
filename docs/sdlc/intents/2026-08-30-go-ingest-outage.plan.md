---
kind: plan
slug: 2026-08-30-go-ingest-outage
opened: 2026-08-30
---

# Plan: repair the `/go/` capture

Intent: [`2026-08-30-go-ingest-outage.intent.md`](./2026-08-30-go-ingest-outage.intent.md)

## Ground truth

Every row below was produced on 2026-08-30 while narrowing this, and together
they eliminate the endpoint, the key, and the payload as causes.

| Claim | Value | Source | Read on |
|---|---|---|---|
| `short_link_click` lifetime | 2026-07-26 → 08-10, then silent | PostHog SQL grouped by day | 2026-08-30 |
| Peak volume before it stopped | 3,332 in one day | same | 2026-08-30 |
| Distinct ids, every single day | 1 | same | 2026-08-30 |
| Live `/go/` redirect | HTTP 302, correct Location | `curl` against production | 2026-08-30 |
| Live `/go/` capture | 3 hits produced 0 events | `curl` ×3, then PostHog SQL | 2026-08-30 |
| Direct POST to `/i/v0/e/` | 200, and the event LANDED | `curl` with the project key | 2026-08-30 |
| Direct POST to `/capture/` | 200, and the event LANDED | `curl` with the project key | 2026-08-30 |
| Same-origin proxy in prod | HTTP 200 | `curl` to `/ingest/i/v0/e/` | 2026-08-30 |
| Per-visitor id fix merged | 2026-08-22, PR #160 | `git log` | 2026-08-30 |
| Same-origin ingest shipped | 2026-08-09, PR #141 | `git log` on origin/main | 2026-08-30 |
| Client events still arriving | yes, `$pageview` same day | PostHog SQL | 2026-08-30 |

Two of those rows do the work. The endpoint accepts **and ingests** a
hand-rolled POST carrying the same key and the same payload shape the route
builds — so the failure is inside the Vercel function, not in PostHog. And the
outage begins the day PR #141 introduced same-origin ingest, twelve days
*before* the id fix that was the first suspect.

## Approach

**Primary hypothesis: the route builds a relative URL.** It reads

```js
const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";
await fetch(`${host}/i/v0/e/`, …);
```

`NEXT_PUBLIC_POSTHOG_HOST` is a *client* variable whose whole purpose after
#141 is to point the browser at the same-origin `/ingest` proxy. If it is set
to `/ingest` in Vercel — which is exactly what activating that proxy looks
like — then the server evaluates `fetch("/ingest/i/v0/e/")`, and Node's fetch
cannot parse a relative URL. It throws, the `catch` writes a `console.warn`,
and the redirect returns 302 as if nothing happened. That matches every
observation: correct redirects, zero events, silent for twenty days, client
capture unaffected.

**The repair does not depend on confirming it.** A server route must use an
absolute origin, so treat any non-absolute value as unset:

```js
const configured = process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim();
// A relative value (e.g. "/ingest") is correct for the BROWSER and unusable
// from a server route — Node fetch cannot parse it. Fall back rather than throw.
const host = configured?.startsWith("http") ? configured : "https://us.i.posthog.com";
```

Rejected alternative: pointing the server at the same-origin proxy by
absolutising it to `https://ofriperetz.dev/ingest`. That makes the function
call back through its own deployment for every redirect — an extra hop, a
self-dependency during deploys, and no benefit, since ad-blocker evasion is
the proxy's only purpose and no ad blocker is running server-side.

**Detection.** The failure must stop being silent. Emit a counter-style event
on the failure path (`short_link_capture_failed`, with the error name only) so
a dead pipeline shows up as a *present* signal rather than an absent one — an
absence is precisely what nobody noticed. It costs one extra fetch on a path
that is already failing, and never runs when things work.

## Sequence

Steps 1 and 2 are independent of confirming the hypothesis.

1. Absolute-host guard, as `resolveIngestHost` in `resolver.ts`. *(done —
   commit 81b6871; verified failing first, 2 of 5 cases red without it)*
2. Failure event on the `catch` path, posted to the hardcoded fallback rather
   than the configured host. *(done — same commit)*
3. Deploy, then `curl` a `/go/` link and confirm a row appears. *(blocked on
   the merge — this is the step that actually closes the intent, and a green
   test is not a substitute for it)*
4. If it still produces nothing, read the Vercel runtime logs for
   `[go] posthog capture failed` — the remaining candidate is `after()` not
   completing on this route, which needs a different repair.

## Gates

- A unit test on the host resolution: relative in → absolute fallback out;
  absolute in → passed through. This is the whole fix, so it is the whole test.
- Verified failing before the fix: the current expression returns `/ingest`
  unchanged.
- Production `curl` → matching row, before this is called done. The event has
  lied about being healthy once already.
- Merging and deploying is Ofri's call.

## Risks

- The hypothesis may be wrong and the true cause `after()`. The guard is still
  correct and harmless, but step 3 is what decides, so do not close this out on
  a green test alone.
- Ingestion lags by minutes. A probe that shows nothing immediately is not a
  failure — this cost a wrong conclusion once already today.
- Restoring the event will restore crawler volume too (1k–3.3k/day against ~11
  human pageviews). Read it with the population rule, never raw.
