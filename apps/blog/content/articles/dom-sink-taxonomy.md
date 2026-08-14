---
devto_url: "https://dev.to/ofri-peretz/innerhtml-has-five-doors-most-reviews-only-watch-one-587c"
devto_id: 4347164
cover_image: "https://ofriperetz.dev/cdn/blog-cover-image/dom-sink-taxonomy.jpg"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/dom-sink-taxonomy-og.jpg"
title: "innerHTML Has Five Doors. Most Reviews Only Watch One."
description: "A DOM sink is easy to grep for. The hard part is that one sink has many sources, and the source is where the trust decision actually lives — not the assignment."
slug: "dom-sink-taxonomy"
published: true
date: 2026-08-01
tags:
  - "ai"
  - "webdev"
  - "security"
  - "eslint"
canonical_url: https://ofriperetz.dev/articles/dom-sink-taxonomy
reading_time_minutes: 6
tier: "T1"
series: "Foundations"
author:
  name: Ofri Peretz
  avatar: https://avatars.githubusercontent.com/u/46347627
  title: Security Engineering Leader
overall_score: 9.2
reviews:
  discovery & hook: 9.5
  discovery & hook_why: "The opening is the single thing between this and an unarguable 9.5+ ceiling: \"I have reviewed the same line of code, written five different ways, and caught it once.\" It's the sharpest sentence in the piece and the on..."
  technical: 9.5
  technical_why: "Name the CWE view when you state the hierarchy. \"CWE-345 under CWE-693\" and \"CWE-79 under CWE-74\" are correct in **CWE-1000 (Research Concepts)**, but CWE-345's parentage is organized differently in CWE-699 (Developme..."
  quality: 9
  quality_why: "**Ground the opening in one dated, real incident.** \"I have reviewed the same line of code, written five different ways, and caught it once\" is the sharpest line in the piece and its only unmoored one — it reads as a ..."
  practitioner: 9.2
  practitioner_why: "Ground the opening in one real, dated incident. \"I have reviewed the same line of code, written five different ways, and caught it once\" is the strongest sentence in the piece and the only unmoored one — it's a compos..."
  linkability: 8.8
  linkability_why: "**Add ecosystem URLs — the single largest gap on this axis.** The piece explicitly says \"what a linter *can* do is match source and sink inside one handler,\" yet never links the linter that does it. The relevant packa..."
  abstraction: 9.5
  abstraction_why: "**Close the upward half of the dependency contract.** The downward links are complete and correctly placed (taint tracking → `taint-vs-heuristic-detection`, the linting/SAST boundary → `static-analysis-vs-sast-vs-lint..."
  checklist: 10
  checklist_why: "This is a T1 article (security/static-analysis vocabulary, domain-general) — confirmed by both the `tier: \"T1\"` frontmatter and the content: it centers a repeatable DOM-XSS *source/sink taxonomy* (genre 2, methodology..."
  challenge: 8.3
  challenge_why: "**Axis 2 — add one ecosystem URL; this is the biggest real gap.** The article's own thesis line is \"what a linter *can* do is match source and sink inside one handler,\" yet it never links the linter. That's a self-inf..."
  voice & agenda: 9.2
  voice & agenda_why: "Ground the opening beat. \"I have reviewed the same line of code, written five different ways, and caught it once\" is the sharpest sentence in the piece and its only unmoored one — it reads as a composite memory, not a..."
---
I have reviewed the same line of code, written five different ways, and caught it once.

The line is `element.innerHTML = something`. I catch it when `something` is obviously a
URL parameter. I miss it when `something` arrived four frames ago through a `message`
event, got stored, and is written to the DOM by a function in a different file.

The sink was identical every time. My attention was not.

---

## Sinks are few. Sources are many. {#sinks-vs-sources}

A **sink** is where data becomes execution: `innerHTML`, `outerHTML`,
`insertAdjacentHTML`, `document.write`, `eval`. You can list them on one hand, which is
why they feel solved. Grep for `innerHTML`. Ban it in review. Done.

A **source** is where untrusted data enters. Sources are not listable — they are a
property of your architecture, and they multiply with every feature.

That asymmetry is the whole problem. The sink is a syntactic fact. The source is a
*trust* fact, and trust facts do not survive being passed as a function argument.

## The five doors {#the-five-doors}

The same sink, reached five ways. Every one is code I would call normal.

```javascript
// 1. Direct — the one everybody catches
element.innerHTML = new URLSearchParams(location.search).get("q");

// 2. postMessage — another frame speaks, event.data is a string like any other
window.addEventListener("message", (e) => { element.innerHTML = e.data; });

// 3. FileReader — the user picked the file, which feels like consent
reader.addEventListener("load", () => { preview.innerHTML = reader.result; });

// 4. WebSocket — the connection is authenticated, so the payload feels authenticated
socket.addEventListener("message", (e) => { feed.insertAdjacentHTML("beforeend", e.data); });

// 5. Worker — it is our own worker, running our own code
worker.addEventListener("message", (e) => { results.innerHTML = e.data.html; });
```

Five doors, one room. On the first, a reviewer says "that's user input." On the other
four, they say some version of *"but that's ours."*

## The word "ours" is doing all the damage {#provenance-assumed-from-proximity}

Each of those four defences is a claim about **provenance**, and each is wrong the same way.

A `message` event fires for any frame with a handle on your window unless you check
`event.origin` — the listener does not filter by default. An authenticated WebSocket says
the *connection* is trusted, not what the other end sent, which may have been stored by a
different user hours earlier. A worker is your code, but the data it posts back is
whatever it was given. And a file the user chose is untrusted precisely *because* they
chose it.

The failure is not that developers think `innerHTML` is safe. Everyone knows. The failure
is that danger gets assessed at the *sink*, where the only visible fact is a string — and
the string looks the same whoever wrote it.

## Why generated code lands here {#why-generated-code-lands-here}

Ask a model to render a preview and it reaches for `innerHTML`, because that is the
shortest correct-looking answer to "put this markup on the page" and the training corpus
is fifteen years of tutorials using it.

More to the point: a model completing a `message` handler has the reviewer's problem,
worse. It sees a local scope. It cannot know whether that listener lives in an app that
checks `event.origin` elsewhere. The sink is local; the trust decision is not.

Which is the interesting part — the information needed to get it right is *not present at
the point of writing*. A property of the problem, not of the author.

## The taxonomy is the useful artifact {#source-sink-taxonomy}

| Source | Trust claim that fails |
| --- | --- |
| URL / query params | none — everyone catches this |
| `postMessage` | "another frame of ours" |
| WebSocket message | "the connection is authenticated" |
| `FileReader` result | "the user chose the file" |
| Worker message | "it is our own worker" |

Read the right column. That is not five vulnerabilities. It is one — *provenance assumed
from proximity* — wearing five costumes. Sinks tell you where to look; pairs tell you what
to **ask**.

## What it means for detection {#what-it-means-for-detection}

Grepping a sink is a heuristic. Following a source to a sink is taint tracking —
[the thing that decides your false-positive rate](https://ofriperetz.dev/articles/taint-vs-heuristic-detection).
Full taint tracking across frames and sockets is not something a linter does; those
boundaries are
[the line between linting and SAST](https://ofriperetz.dev/articles/static-analysis-vs-sast-vs-linting).
What a linter *can* do is match source and sink inside one handler — which covers all four
cases, because the risky pattern is nearly always written in a single function.

### Two branches, not one chain {#cwe-two-branches}

The XSS *outcome* is [CWE-79](https://cwe.mitre.org/data/definitions/79.html), under
[CWE-74](https://cwe.mitre.org/data/definitions/74.html) Injection. The *trust failure* is
[CWE-345](https://cwe.mitre.org/data/definitions/345.html) under
[CWE-693](https://cwe.mitre.org/data/definitions/693.html) — with its child
[CWE-346](https://cwe.mitre.org/data/definitions/346.html) applying to `postMessage`
alone, the only case with a page-side origin check. A WebSocket's `Origin` is validated
server-side at the handshake; FileReader and workers have no origin at all.

Different branches, not one chain. Filing all of it as "XSS" is how the actual defect goes
unrecorded. [The taxonomy piece](https://ofriperetz.dev/articles/cwe-taxonomy-explained)
has the map.

Worth reading in full:
[OWASP's DOM-based XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/DOM_based_XSS_Prevention_Cheat_Sheet.html)
and [PortSwigger on sources and sinks](https://portswigger.net/web-security/cross-site-scripting/dom-based).
To stop it being a review question at all,
[Trusted Types](https://developer.mozilla.org/en-US/docs/Web/API/Trusted_Types_API) moves
it to the browser — the only place that sees every assignment.

## The fix is boring, which is the point {#the-fix}

```javascript
window.addEventListener("message", (event) => {
  if (event.origin !== "https://trusted.example") return;
  element.textContent = event.data;
});
```

Check the origin. Use `textContent` for text. Sanitize when you genuinely need markup.
None of that is the hard part.

The hard part is noticing you are in one of the five doorways — because four of them do
not look like doorways. They look like your own code talking to itself.

---

_Which door caught you? I am most interested in `postMessage` — the origin check is one
line, documented everywhere, and I still find handlers without it in code I wrote myself._

---

I write about measurement and static analysis at
[dev.to/ofri-peretz](https://dev.to/ofri-peretz).
