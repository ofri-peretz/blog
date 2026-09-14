---
id: I-17
slug: ai-agent-unbounded-loop-audit
stage: intent
status: approved
visibility: public
opened: 2026-09-14
opened_by: claude
approved_by: ofri
---

## Why this one, and why now

It sat `blocked-no-corpus` from 2026-09-03. The block was specific rather than
vague — *"needs a targeted repo search (code search for ai-sdk imports) before
any rate can be quoted"* — and it was correct: the only corpus tool available
then was pinned to eight shallow clones, which almost certainly contained zero
AI SDK apps. The block is lifted because that search has now run, not because
the deadline moved.

## Claim

[`agent-resource-bounds`](../../apps/blog/content/articles/agent-resource-bounds.md)
argued that a missing config object is three resource defects. This is the field
study behind it: **12 of the 14 public repositories in the corpus that call the
AI SDK ship at least one generation call with no output cap.** A reader finishes
knowing the omission is the norm in the SDK's own ecosystem — including five of
the vendor's own repositories — and able to run the same check on their code.

## Audience

The same developers as the sibling piece, plus the ones who read it and asked
the fair question: *does anyone actually ship that?* This article exists because
that question deserved a number rather than an assertion.

## Why us

We publish the rules that detect this exact shape, so we can measure it at
population scale instead of arguing from examples. That is also the trap: a
vendor measuring with its own instrument will find what its instrument finds.
Three mitigations are load-bearing and are stated in the article, not buried —
the denominator is computed before any rule runs, the measurement uses the
**published** plugin rather than the working tree, and the fourth bound is
thrown out because our own rule fires on a safe SDK default.

## Evidence we believe exists

- [x] A corpus containing real public repositories that import the AI SDK, large
      enough to name a denominator. **14 projects, 474 SDK files, 116 call sites.**
- [x] Findings that survive being read against their source. **4 per rule
      checked; all true positives, including the indirect options-object case.**
- [x] A defensible denominator independent of the rules. **Call sites detected
      by source text before the linter runs.**
- [x] Honest attribution of the corpus. **2 duplicate clones found by content
      fingerprint and removed; `git remote` could not see them.**

## Kill criterion

The thesis fails if the omissions turn out to be concentrated in one project —
then it is a finding about that project, not the ecosystem. It nearly did:
`cloudflare_agents` contributes 52 of the 103 no-cap files. The thesis survives
because the **repo** count does not depend on it — 12 of 14 holds after deleting
any single project — which is why the article leads with that number and not
with 88.8%.

It also fails if a future SDK minor gives `maxOutputTokens` a non-infinite
default, which would make the most-cited of the three a non-defect.

## Known risk

**n = 14 is small, and the corpus is a convenience sample** from an adoption
scan, not a random draw from npm. The article says so in its own voice rather
than in a footnote. The claim is scoped to "what the SDK's own ecosystem looks
like" and must never be restated as a population rate.

Second risk: five of the fourteen are Vercel's own repositories, and naming them
could read as an attack on the vendor whose SDK we build for. The framing is
landscape — minimal example code is the *mechanism*, because the shape people
copy is the shape with no ceiling. Any edit that turns that into an indictment
should be reverted.
