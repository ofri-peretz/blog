---
kind: finding
intent: 2026-09-02-unguarded-generated-surface
date: 2026-09-02
status: complete
---

# Finding: two of twelve locks were pointed at the wrong tree

Intent: [`../intents/2026-09-02-unguarded-generated-surface.intent.md`](../intents/2026-09-02-unguarded-generated-surface.intent.md)

Step 4 of the plan: a written verdict for every directory-walking lock, so that
"we extended the ones that mattered" is a claim with evidence behind it rather
than a feeling.

## Verdicts, all twelve

| Lock | Walks | Verdict |
|---|---|---|
| `responsive-lock` | `src/**.tsx` | **EXTENDED** — red on 8 unscoped, 4 scoped; the four broke `/scorecard` |
| `interlace-floor-lock` | Tier A dirs in `src/` | **EXTENDED** — no raw colour literal, now over reachable generated components |
| `contrast-lock` | theme blocks in `globals.css` | correctly scoped — its subject is CSS token definitions, which do not live in `.interlace/**.tsx` |
| `loom-lock` | loom modules | correctly scoped — server-only/client-bundle boundary for the loom corpus; no loom code is generated |
| `title-template-lock` | `app/**` pages | correctly scoped — asserts pages do not hard-code the title suffix; the generated tree contains no route or metadata |
| `rss-and-draft-exposure-lock` | `content/articles` | correctly scoped — article corpus, not components |
| `sdlc-chain-lock` | `docs/sdlc/intents` | correctly scoped — SDLC artifacts |
| `sdlc-quality-lock` | `content/articles` | correctly scoped — the quality ratchet over prose |
| `analytics-hygiene-lock` | `docs/sdlc/intents` | correctly scoped — population definitions in intents |
| `markdown-heading-anchors` | markdown | correctly scoped — content, not components. Also not a `*-lock` by naming convention |
| `devto-publish-scope-lock` | `.github/workflows` | correctly scoped — already covers EVERY workflow, which is why it caught the CWE-78 in #210 |
| `refresh-delivery-lock` | `.github/workflows` | correctly scoped — written today; its own coverage guard was a tautology and was rewritten to read the directory |

**Two extended, ten correctly scoped.** The plan's expectation — that most
would be correct and the exercise was about finding the few that were not —
held.

## The interesting one is the green

`interlace-floor-lock` forbids raw hex / rgb / oklch in source. It is **named
after the design system** and had never read `.interlace/`.

Extending it produced a **green** assertion, and green is exactly the result
this intent says to distrust. So the numbers were taken first:

| Measure | Value |
|---|---|
| Raw colour literals across the whole generated tree | 112 |
| …in the **reachable** set | **0** |

Green because the reachable code is clean, not because the glob is blind — but
that distinction cannot be asserted, only demonstrated. Two things carry it:

1. A companion test asserts the reachable set is non-empty, so the file count
   silently dropping to zero fails rather than passes.
2. Injecting `const INJECTED_TEST_COLOUR = "#ff0000"` into
   `ratchet-card.tsx` — a reachable generated component — turns it red with
   the upstream fix instructions attached. Reverting turns it green.

`rgba(var(--token))` is stripped before matching. It reads like a raw literal
and is the opposite: a token used correctly. A naive regex would have produced
114 false positives and taught everyone to ignore the lock.

## What this could not determine

Whether the ten "correctly scoped" verdicts stay correct. They are judgements
about what each lock is *for*, and a lock's subject can drift — `title-template`
would need revisiting the day a generated component starts exporting metadata.
The verdicts are dated for that reason.

Also unresolved, and not this finding's to fix: **112 raw colour literals sit
in unreachable generated files.** They are real violations of the DS's own
token floor, in the design system's own tree, and nothing renders them today.
That belongs upstream in the agents repo, and it is a larger question than this
intent — whether the generated baseline should obey the floor it publishes.
