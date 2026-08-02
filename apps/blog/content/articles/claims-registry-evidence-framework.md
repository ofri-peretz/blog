---
devto_url: "https://dev.to/ofri-peretz/marketing-pages-rot-silently-mine-print-an-expiry-date-on-every-claim-1km4"
devto_id: 4183785
title: "Marketing Pages Rot Silently. Mine Print an Expiry Date on Every Claim."
description: "The claims registry: one file where every public claim has a row, every row points at a versioned result file, and a 90-day staleness rule decides when a claim must re-earn its place. The contract, the lifecycle, and how any product adopts it in an afternoon."
slug: "claims-registry-evidence-framework"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/claims-registry-evidence-framework-og.jpg?v=b3"
cover_image: "https://ofriperetz.dev/cdn/blog-cover-image/claims-registry-evidence-framework.jpg?v=b3"
published: true
date: 2026-07-19
tags:
  - "security"
  - "devsecops"
  - "node"
  - "javascript"
canonical_url: https://ofriperetz.dev/articles/claims-registry-evidence-framework
tier: "T2"
reading_time_minutes: 6
author:
  name: Ofri Peretz
  avatar: https://avatars.githubusercontent.com/u/46347627
  title: Security Engineering Leader
---

Around 2026-08-01, a "verification pending" banner goes up on eleven claims in my serverless docs. Nothing will have broken. No competitor will have shipped. The banner goes up because every verified row in that repo's [`CLAIMS.md`](https://github.com/ofri-peretz/serverless/blob/main/CLAIMS.md) is stamped 2026-05-03 or 2026-05-04, the file gives evidence a 90-day warranty, and date arithmetic doesn't care that I wrote the rule.

Line 5 of that file:

> If a claim doesn't have a row, it can't ship in the docs. If "Last verified" is older than 90 days, the claim is **stale** and gets a "verification pending" banner in docs until refreshed.

That line exists because marketing pages rot silently: a claim gets written on the day it's true, nobody dates it, and the sentence sits there aging in public. The fix is one file per product line — **the claims registry**: every public claim holds a row, every row points at a versioned result file, and every date is an expiry date.

This is the methodology piece — the contract, the lifecycle, the staleness rule — and none of it is JavaScript-specific. If your product page makes claims, it transfers in an afternoon.

---

## What does a claim owe you before it ships? {#the-contract}

The contract is deliberately boring. A claim backed by static evidence — a benchmark you can run on a laptop — carries four fields: the claim text **exactly as it appears in docs or marketing**, the suite that measures it, a link to the latest result file, and the date it was last verified. Verbatim matters: paraphrase is where scope creep hides — if the row is politer than the landing page, the landing page is the claim nobody verified.

One worked row from each product line:

**Serverless.** The claim "Composite score 88% vs community 30% (7 of 7 dimensions)" points at the `api-gateway-caching` suite and its result file [`latest.json`](https://github.com/ofri-peretz/serverless/blob/main/benchmarks/benchmark-results/api-gateway-caching/latest.json), last verified 2026-05-04. Open the file: composite 0.88 for my plugin (measured from local source at v0.0.0, not a published release) against 0.3025 for the community `serverless-api-gateway-caching@1.11.0`, all seven weighted dimensions scored, including the one I lose outright: bundle weight, 78 KB unpacked against their 47 KB. The row carries the loss because the file does.

**ESLint.** The [sister registry's](https://github.com/ofri-peretz/eslint/blob/main/CLAIMS.md) row reads "Top of leaderboard on the ILB-Arena 40-vuln / 38-safe corpus (1st of 18 plugins tested, 17 security-relevant)" and points at the ilb-arena suite's dated result file, where `summary.leaderboard[0].rank == 1`. That row survived an audit its neighbor didn't: the registry had been asserting "97.6% precision, 100% recall, 98.8% F1" — figures that appear nowhere in the cited JSON, which reports 100% across the board. The 2026-05-13 audit withdrew the claim rather than substitute the perfect score — 100% on a 40-fixture self-authored corpus is the textbook "regression test, not benchmark" failure mode. The ordinal claim kept its row; the flattering one kept only its receipt, in a "Withdrawn claims" section. The suite column enforces [validity](https://ofriperetz.dev/articles/valid-vs-reliable-metrics) — measure what the copy asserts; the result file makes the claim [reproducible](https://ofriperetz.dev/articles/reproducibility-vs-replicability) — regenerate the number without trusting me.

Claims only live infrastructure can verify get a second row flavor: claim text, the E2E step that asserts it, the last release verified. "Cache MISS on first request, HIT within TTL" maps to steps 4–5 of a deploy-and-assert run against real AWS, last verified 2026-05-03.

The contract also kills a third category — the adjective. "Battle-tested," "blazing fast," "production-grade": [proxies](https://ofriperetz.dev/articles/proxy-metrics) for measurements nobody made. No suite outputs "battle-tested," so no row, so no ship. The registry doesn't argue with weak claims; it has nowhere to put them.

## How does a claim live and die? {#claim-lifecycle}

Draft → evidenced → stale → re-verified or retired — every transition a visible edit to one file.

**Draft.** The add-a-claim procedure opens with its most important sentence: *don't write the marketing copy first.* Build or extend the benchmark until it produces a measurable result for your product and at least one competitor, add the row with today's date, and only then write the copy. The rule is that blunt because my instinct runs the other way — when I draft a README, the adjective arrives before the evidence.

**Pending.** Unbacked copy isn't deleted — it's routed into a "Pending claims" section next to the suite that would back it. As of today my serverless registry holds 11 verified rows (4 static-evidence, 7 live-evidence) and 2 pending, both "Not started." Pending is the honest parking lot: marketing wishes become a benchmark backlog, priced in engineering hours instead of adjectives.

**Re-scoped.** The state nobody plans for: the measurement comes back and narrows the claim. Early copy in my serverless line implied we fix a ghost-billing bug in `sls remove`. Then the community-plugin E2E ran on 2026-05-04: `sls remove` came back clean — 31 seconds, exit 0, no orphans. The real trap is uninstalling the plugin while keeping the service. The original copy went into a re-scoped row — original text, what we measured, what's true — instead of being quietly rewritten ([told in full here](https://ofriperetz.dev/articles/we-were-wrong-about-sls-remove)). The most useful rows in my registry are the ones that say I was wrong, in writing, next to the run file that proved it.

**Retired** is a re-scope with nothing left: no narrower version survives the measurement. The row stays; the docs copy goes.

## When does a claim go stale — and who decides? {#staleness}

The misconception to kill: **"claims go stale when the product changes."** They don't. A claim goes stale when its *evidence* ages past its warranty — the product changing is just one way that happens. Your code can be byte-for-byte identical while the competitor you compared against ships three releases and the runtime you benchmarked goes end-of-life. The sentence didn't move; everything it pointed at did.

That's why staleness is *declared, not discovered*. Discovered staleness means a reader catches the drift, and the correction arrives after the damage. Declared staleness is date arithmetic: "Last verified" older than 90 days, banner up, mechanically, before anyone is misled. Ninety isn't sacred; it's a warranty one maintainer can honor — pick yours and enforce it the same way.

What keeps this from becoming a refresh treadmill is the version stamp. "eslint-plugin-security has 27.5% recall" rots — a standing claim about the present. "eslint-plugin-security v2.1.1 scored 27.5% recall on our 40-fixture corpus, on ESLint 8.57.0" is a dated measurement no future release can falsify — true forever. Financial statements solved this long ago: a balance sheet is always "as of" a date. Stamped measurements carry zero refresh obligation; only *standing* claims — "fastest," "most complete," anything in the present tense — sit under the 90-day clock.

The opening countdown is this rule running on its author: the banner lands around 2026-08-01 whether or not I get the re-runs done first. The ESLint registry is already there — one row, a synthetic-corpus speedup last verified 2026-01-02, carries the "re-verify recommended" flag today. That's the system working on me, twice.

## How do you adopt this in an afternoon? {#generalizing}

Nothing above depends on ESLint, serverless, or even software — the suite can be a load test, an accessibility audit, or a lab assay. The afternoon version:

1. Create `CLAIMS.md` at the repo root. The whole starting file:

   ```markdown
   # Claims Registry

   > No row, no ship. "Last verified" older than 90 days →
   > "verification pending" banner in docs until refreshed.

   | Claim (verbatim from docs/marketing)   | Suite               | Latest result              | Last verified |
   | -------------------------------------- | ------------------- | -------------------------- | ------------- |
   | "Composite score 88% vs community 30%" | api-gateway-caching | benchmarks/.../latest.json | 2026-05-04    |
   ```

2. Inventory every public claim — README, landing page, package description — verbatim, no paraphrase.
3. For each, name the evidence (suite + latest result + date) or move it to Pending.
4. For everything new: evidence first, row second, copy last.
5. On refresh, commit the new result as a dated file (`<suite>/<YYYY-MM-DD>_v<version>/`) and bump the date — what you claimed, and when it was last true, becomes repo history.

This isn't an island. The closest neighbor is the [OpenSSF Scorecard](https://scorecard.dev/), which treats a repo's security posture as automated, publicly specified checks pointed at repositories from the outside. The claims registry is the manual, product-side sibling, pointed inward at your own marketing copy ([corpus design](https://ofriperetz.dev/articles/how-to-design-a-ground-truth-corpus) covers the datasheets-for-datasets lineage). And it pairs with the conflict-of-interest discipline in [I Built What I Benchmark](https://ofriperetz.dev/articles/i-built-what-i-benchmark-heres-how-i-try-not-to-cheat): I built the products *and* the registry that polices them — a suspicious arrangement, which is why every row names the command that would catch me.

Next in this arc: [We Were Wrong About sls remove](https://ofriperetz.dev/articles/we-were-wrong-about-sls-remove) — the re-scope told in full, because the lifecycle is easiest to believe when you watch it delete a claim I liked.

## Quick reference {#quick-reference}

| Question            | Answer                                                                                    |
| ------------------- | ----------------------------------------------------------------------------------------- |
| What gets a row     | Every claim in docs/marketing, verbatim — no paraphrase                                   |
| Static-evidence row | Claim text · suite · latest result file · last-verified date                              |
| Live-evidence row   | Claim text · E2E step · last release verified                                             |
| Ship rule           | No row → the claim cannot ship in docs                                                    |
| Staleness rule      | "Last verified" > 90 days → "verification pending" banner until refreshed                 |
| Lifecycle           | Draft → evidenced → stale → re-verified or retired; re-scoped when measurement narrows it |
| New-claim order     | Evidence first, row second, marketing copy last                                           |
| Unbacked copy       | Routed to Pending with the suite that would back it — never into docs                     |
| Refresh mechanics   | Re-run suite → commit dated result file (`<suite>/<YYYY-MM-DD>_v<version>/`) → bump date  |
| The immortal form   | Version-stamped: "vX scored Y (measured DATE)" — a dated measurement, true forever        |

The suite that generates the ESLint result files is public — go check:

{% cta https://github.com/ofri-peretz/eslint-benchmark-suite %} ⭐ Star the benchmark suite — the result files this registry points at {% endcta %}

Before the clock catches yours: what's the oldest undated claim on your product page right now — and would it survive a re-run today?

---

## References

- [OpenSSF Scorecard](https://scorecard.dev/) — the Open Source Security Foundation's automated checks on open-source repos; cited as the closest prior art for treating claims as named, publicly specified checks rather than prose.
- Gebru et al., [Datasheets for Datasets](https://arxiv.org/abs/1803.09010) (arXiv:1803.09010, later published in CACM) — cited for the documentation-contract idea the registry applies to marketing claims instead of datasets: standardized fields, stated provenance, explicit scope.

---

*Part of the [Interlace ESLint ecosystem](https://eslint.interlace.tools). Source on [GitHub](https://github.com/ofri-peretz/eslint) · npm: [@interlace](https://www.npmjs.com/~ofriperetz) · Follow: [Dev.to/ofri-peretz](https://dev.to/ofri-peretz) · [ofriperetz.dev](https://ofriperetz.dev)*
