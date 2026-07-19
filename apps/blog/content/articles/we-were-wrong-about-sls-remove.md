---
title: "We Were Wrong About sls remove"
description: "Our loudest serverless claim — 'ghost billing after sls remove' — failed our own E2E run. The trap is real, but it lives on a different path entirely. The full story of re-scoping a claim in public, and why the narrower version came out stronger."
slug: "we-were-wrong-about-sls-remove"
published: true
date: 2026-07-19
tags:
  - "serverless"
  - "aws"
  - "devops"
  - "node"
canonical_url: https://ofriperetz.dev/articles/we-were-wrong-about-sls-remove
tier: "T2"
reading_time_minutes: 7
author:
  name: Ofri Peretz
  avatar: https://avatars.githubusercontent.com/u/46347627
  title: Security Engineering Leader
---

The loudest claim in my serverless line was wrong. Early copy for `@interlace/serverless-api-gateway-caching` implied that the community caching plugin leaves an API Gateway cache cluster running — and billing — after `sls remove`, and that our cleanup hook fixes it. On 2026-05-04, our own E2E harness ran the community plugin through `sls remove` on live AWS: 31 seconds, exit 0, no orphans. CloudFormation deleted the stage and took the cache cluster with it. There is no `sls remove` ghost-billing bug.

The trap itself is real — I had reproduced it on live AWS the day before, 2026-05-03, in about ten minutes for roughly $0.005 of cache-cluster time. It just lives on a different path than the one we were loudest about. This article is the full telling of that re-scoping: the original claim, the two runs that killed and rebuilt it, and why the narrower claim that replaced it does more work than the broad one ever did.

---

## What was the original claim? {#the-original-claim}

The community `serverless-api-gateway-caching` (v1.11.0) manages the API Gateway cache cluster imperatively — it calls the AWS `UpdateStage` API during deploy instead of declaring the cluster in the CloudFormation template. CloudFormation never learns the cluster exists. From there, the inference writes itself: if CloudFormation doesn't know about the cluster, teardown won't remove it, so `sls remove` must leave it behind, billing forever. Our plugin ships a `before:remove:remove` hook that disables the cluster before teardown — so early copy implied, in effect: *the community plugin has a ghost-billing bug on `sls remove`, and we fix it.*

Notice what that claim actually was: an inference from architecture, shipped as if it were a measurement. And it was consistent — repeated the same way across the README, the docs, the comparison table. Consistency is reliability; whether the claim describes the failure that actually happens is [validity](https://ofriperetz.dev/articles/valid-vs-reliable-metrics) — and nobody had checked.

## What did the measurement actually show? {#what-measurement-showed}

Two runs on live AWS, one day apart, both against the pinned community release `1.11.0`.

**2026-05-03 — the trap, reproduced.** Deploy with the community plugin (a live stack in 49s), wait for the cache cluster to reach `AVAILABLE` (4–7 minutes), then do what a real team does when it stops wanting a plugin: delete it from the `plugins` array and redeploy the still-running service. The redeploy succeeds in ~28 seconds and **no plugin code runs** — the plugin is gone from the config, so it can't. The cluster afterward: `enabled: true, status: AVAILABLE, size: 0.5`. Still running, still billing. No CloudFormation event, no log line, no warning. And no exit through the plugin either: `sls caching disable` and `sls caching status` both return "command not found" — the community plugin registers no custom commands, so the only escape is dropping to the AWS CLI and patching `cacheClusterEnabled` to `false` by hand. Total cost of watching all of this happen: ~10 minutes, ~$0.005 — the recipe is public in [`docs/ghost-billing-reproduction.md`](https://github.com/ofri-peretz/serverless/blob/main/docs/ghost-billing-reproduction.md), cheap enough that ["it reproduced on my machine"](https://ofriperetz.dev/articles/reproducibility-vs-replicability) can be your finding rather than my assurance.

**2026-05-04 — the loud path, refuted.** The community E2E then ran the exact path our copy warned about: `sls remove` with the plugin still installed. Clean. 31 seconds, exit 0, no orphans — CloudFormation deleted the stage, and the cluster went with it.

The mechanism fits in one sentence: the cache cluster rides on the stage. Delete the stage — which is what `sls remove` does — and the cluster dies with the stack, no matter who created it. Keep the service deployed and remove only the plugin, and the stage stays up while the one tool that remembered the cluster leaves your toolchain.

I ran that second E2E to collect the evidence *for* the claim. It came back with the evidence against it — exit 0, no orphans, and a rewrite of my best line of copy. The same discipline that makes you distrust a [result that flatters you](https://ofriperetz.dev/articles/bias-in-measurement) is the one that makes you run the test that can defeat you, before someone else does.

## What is the re-scoped claim? {#the-re-scoped-claim}

The old copy didn't get quietly patched; it got re-scoped, on the record. Our [claims registry](https://ofriperetz.dev/articles/claims-registry-evidence-framework) keeps a dedicated table for exactly this case — original copy, what we measured, what's true — and the row for this incident reads, condensed: earlier copy implying "we fix `sls remove`'s ghost-billing bug" was wrong, because there is no `sls remove` ghost-billing bug. The orphaned-cluster trap lives on the **uninstall-while-keeping-service** path, where `sls caching disable` — an explicit offboarding command the community plugin doesn't have — is the actual fix. The `before:remove:remove` hook stays, verified live (stack deleted in 28s, zero residuals, measured 2026-05-03), but it's defense-in-depth now, not the headline.

That's the whole lifecycle in one incident: claim → reproduction attempt → refutation → re-scope → versioned evidence file. The refuting run is committed as a dated JSON next to the claim row; the trap ships as a recipe anyone can replay.

The stakes are why the claim deserved this much care. The cluster we reproduced was the smallest tier — 0.5 GB at $0.020/hour, $175.20/year. AWS's published cache pricing runs up to 237 GB at $33,288/year, and the charge is per stage, per region, with no flag on orphaned clusters. A number that size deserves a claim pointed at the path where the money actually leaks.

## Why is a narrower claim stronger? {#why-narrower-is-stronger}

Value investors call it margin of safety: you don't pay the price your own estimate says is fair — you pay less, so that being somewhat wrong doesn't ruin you. A claim scoped to exactly what the run files show carries the same margin. The broad claim had none: it rode on an untested inference, and a single ten-minute E2E from anyone could falsify it. Ours did, mercifully before anyone else's.

The narrow claim is also more useful to you. "Run `sls caching disable` before you remove the plugin from config" is an action. "Beware `sls remove`" would have taught you to distrust the one command that actually cleans up after itself — misallocating your caution away from the path that costs money and onto the path that doesn't.

Which is the misconception worth naming: **"walking back a claim costs credibility."** It's backwards. Unmeasured claims cost credibility — on a schedule you don't control. A published re-scope is the cheapest credibility purchase available: it costs one uncomfortable table row and buys back the right to be believed about everything the run files do support. The genre has old prior art — Buffett's shareholder letters have aired his own mistakes for decades, and it's the same model behind [how I try not to cheat in my own benchmarks](https://ofriperetz.dev/articles/i-built-what-i-benchmark-heres-how-i-try-not-to-cheat).

I'll admit the first instinct, reading the clean run, was the other genre: quietly delete the sentence and move on. That instinct — fix silently, stay loud — is exactly what a claims registry exists to make impossible, and the reason this article exists at all.

## Quick reference {#quick-reference}

| Question | Answer (measured 2026-05-03/04, community plugin v1.11.0) |
| --- | --- |
| Does `sls remove` orphan the community plugin's cache cluster? | No — CloudFormation deletes the stage and the cluster with it (31s, exit 0, no orphans) |
| Where is the actual trap? | Remove the plugin from `plugins` and redeploy the still-running service — no plugin code runs; cluster persists `enabled: true, AVAILABLE` |
| Is there a plugin-mediated escape (community v1.11.0)? | No — `sls caching disable` / `sls caching status` return "command not found"; manual `aws apigateway update-stage` required |
| What does an orphaned cluster cost? | $175.20/yr at 0.5 GB up to $33,288/yr at 237 GB — per stage, per region, unflagged by AWS |
| The safe offboarding path (`@interlace/serverless-api-gateway-caching`)? | `sls caching disable` before uninstalling; `before:remove:remove` covers `sls remove` (verified live: stack deleted in 28s, zero residuals) |
| Reproduce it yourself | ~10 minutes, ~$0.005 — [ghost-billing-reproduction.md](https://github.com/ofri-peretz/serverless/blob/main/docs/ghost-billing-reproduction.md) |

---

The claim that survived is smaller than the one we started with, and it's the only one of the two I'd defend in public — because defending it requires no rhetoric, just the run files. If a claim in our docs matters to you, check whether it has a row in [CLAIMS.md](https://github.com/ofri-peretz/serverless/blob/main/CLAIMS.md); if it doesn't, it isn't allowed to ship. That policy — and the re-scope you just read, kept on the record instead of buried — is the honest answer to "why should I trust a plugin author's comparison table."

{% cta https://github.com/ofri-peretz/serverless %} ⭐ Star the serverless repo — where claims ship with run files, or don't ship {% endcta %}

Next in this arc: one step earlier in the story. Before you can re-scope a claim about an incumbent plugin, you have to decide which incumbent is worth challenging at all — [the abandoned-incumbent map](https://ofriperetz.dev/articles/abandoned-incumbent-map) is how the serverless line made that call.

---

## References

- [Amazon API Gateway pricing — cache pricing](https://aws.amazon.com/api-gateway/pricing/) — the per-size price table behind every $/hour and $/year figure in this article.
- [Cache settings for REST APIs in API Gateway — Amazon API Gateway Developer Guide](https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-caching.html) — the stage-level cache settings (`cacheClusterEnabled`, cluster size) that make the cluster live and die with its stage.

## Related

- [Bias in Measurement](https://ofriperetz.dev/articles/bias-in-measurement) — why a result that flatters you is the one to re-run
- [Reproducibility vs Replicability](https://ofriperetz.dev/articles/reproducibility-vs-replicability) — the bar the $0.005 recipe is built to clear
- [Valid vs Reliable Metrics](https://ofriperetz.dev/articles/valid-vs-reliable-metrics) — how a claim can be perfectly consistent and still measure nothing
- [The Claims Registry](https://ofriperetz.dev/articles/claims-registry-evidence-framework) — the table this article's re-scoped row lives in
- [I Built What I Benchmark. Here's How I Try Not to Cheat.](https://ofriperetz.dev/articles/i-built-what-i-benchmark-heres-how-i-try-not-to-cheat) — the same discipline applied to the ESLint benchmarks

---

*Part of the [Interlace ESLint ecosystem](https://eslint.interlace.tools). Source on [GitHub](https://github.com/ofri-peretz/eslint) · npm: [@interlace](https://www.npmjs.com/~ofriperetz) · Follow: [Dev.to/ofri-peretz](https://dev.to/ofri-peretz) · [ofriperetz.dev](https://ofriperetz.dev)*
