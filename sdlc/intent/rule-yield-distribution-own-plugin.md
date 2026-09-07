---
id: I-17
slug: rule-yield-distribution-own-plugin
stage: intent
status: approved
visibility: public
opened: 2026-09-07
opened_by: claude
approved_by: ofri
---

## Claim

Rule yield in a real plugin is not distributed — it is concentrated, and the
shape of that concentration tells you more about the plugin than the rule count
does: on a real corpus, two of fourteen rules produce sixty per cent of all
findings and six produce nothing at all.

## Audience

Engineers who have just installed a lint plugin, seen a four-figure finding
count, and have to decide what to do on Monday morning. Also the smaller group
who maintain a plugin and quote its rule count in a README.

## Why us

Because the honest version of this article requires pointing the measurement at
your own plugin and publishing the unflattering half. Anyone can measure a
someone else's distribution; almost nobody publishes their own, because the
result is that most of your rules did nothing. We have the plugin, the corpus,
and an existing published position that rule counts are a poor proxy — this is
that argument with the receipts attached.

## Evidence we believe exists

- [x] A steep, quantifiable concentration: a small number of rules carrying the
      overwhelming majority of findings on a real, public corpus.
- [x] A non-trivial tail of rules producing exactly zero.
- [x] A public corpus a reader can re-run against, so the numbers are not
      ours to be trusted on.

## Kill criterion

Abandon if the distribution turns out to be roughly flat — if no rule exceeds
about twice the mean, there is no story, only a rule list. Also abandon if the
concentration is an artifact of the harness rather than the code: if the top
rule's findings collapse under inspection into one repeated pattern in one
file, the "distribution" is a single defect counted many times and the article
would be measuring its own fixture.

## Title candidates

Under the validated formula: named target + concrete number + provocative claim.

1. My Plugin Has 14 Rules. Two of Them Found 60% of Everything.
2. 308 Findings, 14 Rules, and Six That Never Fired
3. I Measured My Own Plugin's Rule Yield. Six Rules Did Nothing.

## Tier

T3
