---
id: I-25
slug: numbers-in-prose-rot
stage: intent
status: approved
visibility: public
opened: 2026-09-07
opened_by: claude
approved_by: ofri
---

## Claim

I checked twelve of my own planned articles against the benchmark data they
cite. Three rest on numbers that appear in no result file anywhere, and a
fourth attaches a real number to the wrong set — because the numbers were
copied into prose, and prose has no way to fail.

## Audience

Anyone who maintains a document containing figures: a README with benchmark
results, a metrics page, an internal summary, a pitch deck that outlived its
spreadsheet. The failure is not specific to benchmarks.

## Why us

Because the document that drifted is ours, the drift was found by checking
rather than by being caught, and the correction costs us three planned articles.
A piece about other people's stale numbers would be worth nothing.

## Evidence we believe exists

- [x] Specific figures in a derived document that exist in no source artifact.
- [x] At least one real number attached to the wrong subject.
- [x] A structural reason the drift was undetectable — the document is prose,
      and nothing recomputes it.

## Kill criterion

Abandon if the missing numbers turn out to live somewhere I did not look. A
figure I failed to find is not a figure that does not exist, and the article
dies the moment one of them is located in a result file.

Abandon also if the drift is explainable as versioning — if the document
plainly cites an earlier run and the numbers are correct for that run, this is
a stale citation rather than a fabrication, which is a much weaker claim and
not worth publishing.

## Title candidates

Under the validated formula: named target + concrete number + provocative claim.

1. Three of My Twelve Planned Articles Cited Numbers That Do Not Exist
2. I Audited My Own Benchmark Write-Up Against Its Own JSON
3. A Number in Prose Cannot Fail

## Tier

T2
