---
id: I-19
slug: lint-harness-measured-nothing
stage: intent
status: approved
visibility: public
opened: 2026-09-07
opened_by: claude
approved_by: ofri
---

## Claim

A lint harness reports zero findings in three distinct ways that look exactly
like a clean codebase, and none of them raises an error — so a number from a
harness you have not tried to break is not evidence.

## Audience

Anyone who has written a script around `ESLint` — a benchmark, a CI gate, a
migration counter, a "how bad is it" audit — and quoted the number it produced.
Not a security audience; this is a measurement audience.

## Why us

Because we hit all three inside one week, on our own instrument, and the
flattering direction is the one they all fail in. A vendor writing this from
theory would pick better examples. We have the wrong answers we actually
believed.

## Evidence we believe exists

- [x] A file-ignored-outside-base-path zero, reproduced from a real run.
- [x] A flat-config zero where TypeScript files are silently skipped.
- [x] A stale-artifact answer, where the tree measured is not the tree shipped.
- [x] A cheap general remedy that catches all three.

## Kill criterion

Abandon if any of the three turns out to raise an error, a warning, or a
non-zero exit somewhere a normal caller would see it. The article's entire
claim is that they are silent; one loud failure among them and the piece is
about carelessness rather than about instruments.

Also abandon if they collapse into one defect wearing three hats. Three names
for "you configured it wrong" is not a taxonomy.

## Title candidates

Under the validated formula: named target + concrete number + provocative claim.

1. Three Ways ESLint Told Me a Codebase Was Clean When It Had Measured Nothing
2. My Harness Reported 0 Findings on 100 Files. All 100 Were Ignored.
3. A Zero From an Instrument You Haven't Tried to Break Is Not a Measurement

## Tier

T2
