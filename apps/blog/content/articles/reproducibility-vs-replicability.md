---
devto_url: "https://dev.to/ofri-peretz/reproducibility-vs-replicability-why-benchmark-numbers-need-both-26jh"
devto_id: 4182379
title: "Reproducibility vs Replicability: Why Benchmark Numbers Need Both"
description: "A result is reproducible when the same team runs it twice and gets the same number. It is replicable when an independent team runs it and gets the same number. Most published results clear the first bar; far fewer clear the second — and that gap is where trustworthy numbers quietly break."
slug: "reproducibility-vs-replicability"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/reproducibility-vs-replicability-og.jpg?v=b2"
cover_image: "https://ofriperetz.dev/cdn/blog-cover-image/reproducibility-vs-replicability.jpg?v=b2"
published: true
date: 2026-07-17
tags:
  - "security"
  - "devsecops"
  - "node"
  - "javascript"
canonical_url: https://ofriperetz.dev/articles/reproducibility-vs-replicability
reading_time_minutes: 6
tier: "T0"
series: "Foundations"
arc: 6
author:
  name: Ofri Peretz
  avatar: https://avatars.githubusercontent.com/u/46347627
  title: Security Engineering Leader
---

Running the same measurement twice and getting the same number proves less than most results imply. It proves your own instrument is consistent. It says nothing about whether anyone else, starting cold, would land on the same result.

In 2015, a team of 270 researchers re-ran 100 published psychology experiments. The originals looked internally clean: 97 of them reported a statistically significant effect, and each lab could re-run its own analysis and get its own number back. When independent teams repeated the work from scratch, only 36 of those effects reappeared.

The original findings were **reproducible** — same team, same data, same result on re-run. Most were not **replicable** — an independent team, starting over, landed somewhere else.

Confusing those two properties is exactly how a number that "can't be wrong" turns out wrong.

---

## The Definitions {#definitions}

The 2019 National Academies of Sciences, Engineering, and Medicine report drew the line the field now treats as consensus. **Reproducibility** is the ability of the **same team** to get consistent results from the same data, methods, and conditions — close the notebook, re-run the exact procedure in the exact setup, get the same number. **Replicability** is the ability of an **independent team** to get consistent results applying the same method on their own — a different group reruns your published protocol from scratch and lands on the same answer.

Before that report, many fields used the two words interchangeably, and some had them reversed. It took a decade-long replication crisis in psychology and biomedicine — landmark audits found large bodies of published, internally consistent findings that no independent team had ever confirmed — to force a vocabulary that separates "we checked our own work" from "someone else checked it too."

"Same conditions" is never a footnote. In a clinical assay it means the reagent lot and the incubation temperature; in a market backtest it means the exact data vintage — before anyone quietly dropped the companies that went bankrupt and inflated the return. Those hidden conditions are usually the ones nobody writes down, and the gap between what you controlled and what you documented is where replicability quietly dies.

---

## Where Most Benchmarks Actually Stand {#current-state}

Be honest about which bar a number has actually cleared, because most stop at the first one.

**Reproducible is common.** Run the analysis twice on a pinned dataset and get the same result — most careful teams clear this. **Publicly runnable is rarer.** When Collberg and Proebsting went looking for the code behind 601 computer-science papers, they could obtain and build it for well under half — and that is only the precondition for anyone else to try.

**Independently replicated is the exception.** In cancer biology, one industrial lab set out to reproduce 53 landmark studies and confirmed 6. Roughly half of drug candidates that look decisive in a single-site Phase II trial fail to hold up in a multi-site Phase III run by independent teams. The pattern repeats across fields: a result that is airtight inside the team that produced it is a different, weaker claim than one an outsider has reproduced.

Value investors live this distinction. A track record you cannot reproduce is a story, not a strategy — an edge only counts if someone else can run it and get the same result. That is not an indictment of any one number; it is the honest baseline for the whole space, and naming where a result sits is what separates a claim from evidence.

---

## What Makes a Result Reproducible {#making-it-reproducible}

Checkable, not aspirational — verify these before a number goes out:

1. **Pin every input in a manifest.** The frozen dataset, the tool versions, the reference values — recorded, not inferred from whatever the reader happens to have on hand. The pin decides which version ran, not the local machine.
2. **State the environment in the method, not a footnote.** Versions, hardware, operating conditions. "It ran on my setup" is an anecdote, not a reproducibility claim.
3. **Document every failure that stays silent.** The dangerous errors don't announce themselves: a degraded reagent that returns clean nulls, a data feed that drops delisted names and quietly lifts the return. A silent zero looks exactly like a real zero until someone documents why it happened.
4. **Run it twice before publishing.** The minimum bar, and most work clears it. If you can't, you have a single data point, not a result.

---

## What Makes a Result Replicable {#making-it-replicable}

Harder, and the bar most numbers — even careful ones — haven't cleared:

1. **A complete, public method and dataset.** The actual inputs, labeled, where anyone can get them. Without them, a replication attempt is reconstructing your inputs by guesswork, which makes it a different study, not a check on yours.
2. **One runnable procedure, no manual assembly.** A single documented path reproduces the published table — not "run six steps by hand and combine the results yourself." Every manual step is a place two people diverge.
3. **No private data, no author-as-prerequisite.** If any part of replication requires emailing you for a file, the result is contingent on your cooperation, not replicable.
4. **A standing invitation to report divergent results.** A number that invites challenge is more credible than one that doesn't — precisely because the invitation turns a challenge into survivable evidence instead of an ambush.

Most real-world numbers satisfy the first three and treat the fourth as an open door rather than a completed replication. That door is the honest edge of the claim.

---

## The Spectrum Between Them {#spectrum}

Not everything needs independent replication before it's worth publishing. There's a spectrum, and naming your place on it honestly matters more than claiming a bar you haven't cleared.

**Self-checking** — run twice, same result — is the floor; an unchecked single run is an assertion, not a measurement. **Reproducible with documentation** — anyone following your stated conditions gets your number — is where most careful work honestly sits. **Publicly runnable** means an independent person *can* run it, which is not the same as *has*. **Independently replicated** — a group with no stake in the outcome ran it and published their own numbers — is the scientific gold standard, and far less common than the word "open" implies. **Peer-reviewed** stacks independent expert scrutiny on top of that.

A reproducible number is the price you paid to check your own arithmetic; a replicated one is the value an independent party assigns it — and the two aren't the same figure until someone else does the pricing. The gap is a to-do, not a verdict: the next honest move is someone else's run, not another self-check.

---

## Quick Reference {#quick-reference}

### The Two Properties

| Property | Who runs it | Same data? | Produces |
|----------|-------------|------------|---------|
| Reproducible | Same team | Yes (same dataset) | Same numbers under the same conditions |
| Replicable | Different team | Same method, their own run | Same numbers under their conditions |
| Neither | Different team, wrong conditions | No | Different numbers — a discrepancy to document |

### Common Mistakes

| Mistake | What you said | What you actually showed |
|---------|--------------|---------|
| "We independently verified our results" | We ran it twice | That's reproducibility, not replication |
| "Our method is open" | The code and data are public | Public ≠ replicable without pinned versions and documented conditions |
| "No one has disputed our numbers" | No one has tried | Absence of challenge is not replication |
| "We ran it on multiple machines" | Internal cross-check | Still the same team — still reproducibility |

### Named Misconception

**"Reproducible and replicable mean the same thing."** Before the 2019 National Academies report many fields used them interchangeably; some had them reversed. The consensus: same team, same data = reproducibility; independent team, same method = replicability. The distinction bites hardest when the thing being measured is also the thing you built.

### Cited by

This distinction is applied to a live benchmark — including a documented silent failure that left a published number reproducible but not replicable — in the [FN/FP security benchmark](https://ofriperetz.dev/articles/eslint-security-fn-fp-benchmark) and the self-audit [I built what I benchmark](https://ofriperetz.dev/articles/i-built-what-i-benchmark-heres-how-i-try-not-to-cheat). The version-pinning failure mode it leans on is dissected in [bias in measurement](https://ofriperetz.dev/articles/bias-in-measurement).

This page is built to be a reference — bookmark it, and [follow me on Dev.to](https://dev.to/ofri-peretz) for the rest of the measurement series.

---

## References

1. National Academies of Sciences, Engineering, and Medicine. (2019). *Reproducibility and Replicability in Science*. The National Academies Press. [nap.nationalacademies.org](https://nap.nationalacademies.org/catalog/25303/reproducibility-and-replicability-in-science) — The authoritative report that standardized these definitions. Available free.

2. Drummond, C. (2009). [Replicability is not reproducibility: nor is it good science](https://www.site.uottawa.ca/~cdrummon/pubs/ICMLws09.pdf). *Proceedings of the Evaluation Methods for Machine Learning Workshop, 26th ICML*. — First cleanly distinguished the two in a computational context, a decade before the NAS report.

3. Open Science Collaboration. (2015). [Estimating the reproducibility of psychological science](https://doi.org/10.1126/science.aac4716). *Science*, 349(6251). — The 100-study replication project behind this article's opening numbers.

4. Begley, C. G., & Ellis, L. M. (2012). [Raise standards for preclinical cancer research](https://doi.org/10.1038/483531a). *Nature*, 483, 531–533. — The industrial audit that confirmed 6 of 53 landmark studies; a foundational document of the reproducibility crisis.

5. Collberg, C., & Proebsting, T. A. (2016). [Repeatability in computer systems research](https://doi.org/10.1145/2812803). *Communications of the ACM*, 59(3), 62–69. — Found that a large fraction of published results couldn't be independently built or run. The gap between "we ran it" and "someone else can run it" appears in every field.

---

*Foundations series: ← [Goodhart's Law](https://ofriperetz.dev/articles/goodharts-law-explained) · [hub](https://ofriperetz.dev/foundations) · [Sample size & power](https://ofriperetz.dev/articles/sample-size-and-statistical-power) →*

*Part of the [Interlace ESLint ecosystem](https://eslint.interlace.tools). Source on [GitHub](https://github.com/ofri-peretz/eslint) · npm: [@interlace](https://www.npmjs.com/~ofriperetz) · Follow: [Dev.to/ofri-peretz](https://dev.to/ofri-peretz) · [ofriperetz.dev](https://ofriperetz.dev)*
