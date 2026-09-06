---
id: I-16
slug: agent-resource-bounds
stage: intent
status: approved
visibility: public
opened: 2026-09-06
opened_by: claude
approved_by: ofri
---

## Recorded after the draft, before the publish

Backfilled. The draft and both covers sat uncommitted in the blog working tree
while the publisher was stalled, so this intent is late relative to the prose
but still ahead of the publish, which is the point that matters.

## Claim

An AI SDK call with no token cap, no timeout and no abort signal is not three
oversights. It is one shape — an allocation with no ceiling — wearing three CWE
numbers. A reader finishes able to look at their own `generateText` call and
name which of the three ceilings they left off.

## Audience

Developers shipping LLM calls in TypeScript who already treat SQL injection as
a real category and do not yet treat an unbounded token budget as one. The
article assumes they can read a `generateText` call and have never asked what
bounds it.

## Why us

We publish the rules that fire on exactly this call shape, so we have to reason
about the boundary per-parameter rather than in the abstract. The honest part —
and most of the article's value — is the step-count aside: the bound a reader
expects to be missing is the one the SDK already sets for them. Saying so costs
us a fourth rule to sell and is the reason the other three are credible.

## Evidence we believe exists

- [x] The three parameters are genuinely unbounded by default in the shipped
      SDK, and `stopWhen` genuinely is not.
- [x] The three rules exist under the names the article prints.
- [x] The plugin's peer range actually covers the ESLint versions the config
      section claims.
- [x] `maxTokens` → `maxOutputTokens` is a real rename with a real version
      boundary, not a docs drift.

All four were checked against installed artefacts rather than documentation.
See [the spec](../spec/agent-resource-bounds.md) for the commands.

## Kill criterion

A future SDK minor that gives `stopWhen` a different default, or that restores
`maxTokens` as an alias, breaks a specific sentence rather than the thesis. The
thesis fails only if one of the three parameters turns out to be bounded by
default — in which case that section is wrong and should be cut, not softened.

## Known risk

The article asserts an SDK *default*, which is the most perishable kind of
claim a piece like this can make. It is pinned to `ai@7.0.31` in the spec so a
reader can tell whether it has since drifted.
