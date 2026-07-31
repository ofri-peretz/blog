---
title: "I Let AI Agents Rebrand My Entire OSS Ecosystem in One Night. Two Pipelines Were Silently Dead."
description: "Merged is a feeling. Live is a measurement. 13 PRs across 5 repos in one night of parallel AI agents — and two delivery pipelines that had been silently dead for weeks."
slug: "ai-agents-rebranded-my-oss-ecosystem-two-pipelines-were-dead"
canonical_url: "https://ofriperetz.dev/articles/ai-agents-rebranded-my-oss-ecosystem-two-pipelines-were-dead"
cover_image: "https://ofriperetz.dev/cdn/blog-cover-image/ai-agents-rebranded-my-oss-ecosystem-two-pipelines-were-dead.jpg"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/ai-agents-rebranded-my-oss-ecosystem-two-pipelines-were-dead-og.jpg"
tier: "T3"
reading_time_minutes: 7
tags:
  - "ai"
  - "security"
  - "node"
  - "eslint"
series: null
author:
overall_score: 9.4
reviews:
  discovery & hook: 9.5
  discovery & hook_why: "The hook fires four competing named rules — \"frozen chassis,\" \"same-day evidence,\" \"the live check,\" \"grep finds names, not values\" — each strong enough to be THE takeaway. A stranger sharing this won't know which one..."
  technical: 9.5
  technical_why: "The Vercel failure is described as the builder \"emits functions referencing files _outside_ the build output directory.\" A Vercel-daily reader will want the specific culprit to cite it — name the framework preset / bu..."
  quality: 9.5
  quality_why: "The piece coins **four** competing named rules — \"frozen chassis,\" \"same-day evidence,\" \"the live check,\" \"grep finds names, not values\" — and each is strong enough to be THE takeaway. That mutual competition is the o..."
  practitioner: 9.3
  practitioner_why: "Pick ONE artifact and plant it. The piece coins four takeaways of near-equal strength — \"frozen chassis,\" \"same-day evidence,\" \"the live check,\" \"grep finds names not values.\" Each is citable, which is the problem: th..."
  linkability: 9.2
  linkability_why: "**Two H2 headings are aphoristic, not extractable (AEO).** \"Merged is a feeling. Live is a measurement.\" and its lead sentence (\"Now the two dead pipelines…\") both depend on earlier context — an answer engine can't li..."
  abstraction: 9.2
  abstraction_why: "**One section has no anchor, and it's a citable one.** Every other H2 carries a stable `{#…}` (`#freeze-the-chassis`, `#same-day-evidence`, `#merged-vs-live`, `#the-live-check`, `#grep-finds-names`), but `## What the ..."
  checklist: 10
  checklist_why: "The two T0/T1-adjacent concepts (proxy metric, Goodhart's Law) are handled correctly for T3 — applied to the incident in a single clause each and reached via a `Cited by`-style link (`/articles/proxy-metrics`, `/artic..."
  challenge: 8.7
  challenge_why: "Challenge unlock (Axis 2's only real ceiling): a sibling piece could apply the *same-day-evidence* + *live-check* discipline to a **Gemini**-authored change under a security/correctness eval with original benchmark da..."
  voice & agenda: 9.5
  voice & agenda_why: "Aphorism density is the one real cap. The \"X is Y, not Z\" parallel fires so often it shifts from voice to device: \"Agents multiply hands, not judgment.\" / \"Merged is a feeling. Live is a measurement.\" / \"Names are sea..."
---

Two of my five repositories had delivery pipelines that were silently dead. Not failing loudly — _dead_. One site had served a two-week-old build while every deploy "ran". One repo had merged four PRs with zero CI checks since May, because an empty check rollup looks a lot like a green one.

I found out because of a rebrand. Between Thursday 18:05 UTC and Friday 04:53 UTC, AI agents and I merged 13 pull requests across those five repos — a design system, a Storybook, three product sites, a blog, 20 ESLint plugins' docs — and repainted all of it from Tailwind violet to burnt orange. Nothing surfaces a dead pipeline like finally shipping something you care about seeing.

---

## Freeze the brand chassis before fanning out agents {#freeze-the-chassis}

The question I get about agent-heavy weekends is always about the agents — which model, how many, what prompts. That's the wrong end of the telescope. The thing that made 13 parallel PRs mergeable was decided before the first agent spawned: **the chassis was frozen.**

One mark: two pill bars at −30°, orange leading. Two theme-paired accent sets: `#f4794a`/`#0d9460` on dark, `#a84c17`/`#0a6b47` on light. One hard gate: WCAG AA everywhere, measured, not eyeballed. And three rules no agent could bend: no new colors, no new mark variants, dark-pair hexes never on a light surface — because the flagship orange that glows on `#0a0a0a` measures **2.73:1 on white**, nearly two full points under [the 4.5:1 minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).

Agents multiply hands, not judgment. Fan out twelve of them over an ambiguous brand and you get twelve interpretations of "make it orange" — each locally defensible, collectively a mess. Over a locked ground truth they converge, because there is nothing left to interpret. The constraint is what made the parallelism safe.

## Every number had to be measured the same day {#same-day-evidence}

The second standing rule of the weekend: **no claim without same-day evidence.** Not because agents lie, exactly — because they round up. An agent writing marketing copy will reach for "300K+ downloads" every time.

So "300K+" appears on my profile because the npm API said **307.8K that morning**, and "1.5K+ followers" because the Dev.to API said **1,552**. Every color change in every PR body carries its measured ratio: the new burnt orange primary is `#8a3a10` at **7.80:1** on white, where the violet it replaced sat at 8.98:1. Paste those into any contrast checker and you get my numbers, or you get a correction — and I want the correction. It's the same discipline as [printing an expiry date on every claim](https://ofriperetz.dev/articles/claims-registry-evidence-framework): a measured number is only true on the day it was measured.

Turned outward, it becomes a test you can run on anyone, including me: when a vendor quotes a benchmark, ask what date it was measured and whether the commit that changed the number carries the new number. If nobody can produce the date, you're reading marketing. Every figure on [eslint.interlace.tools](https://eslint.interlace.tools) is auditable that way on purpose — that's [the point of benchmarking the thing you also build](https://ofriperetz.dev/articles/i-built-what-i-benchmark-heres-how-i-try-not-to-cheat).

My favorite moment of the weekend is where the rule changed the design instead of the prose. The new primary on the tinted accent surface measured **6.78:1** — just under the 7:1 AAA floor the design system holds. An agent optimizing for the claim writes "near-AAA" and moves on. The rule forced the other direction: lighten the accent surface itself, remeasure, **7.19:1**, ship. When the number is the deliverable, measurement stops being documentation and starts being a design tool.

## Merged is a feeling. Live is a measurement. {#merged-vs-live}

Now the two dead pipelines, because this is where the weekend earned its keep.

**Pipeline one.** The ESLint docs site had a deploy workflow that had failed on _every run for two weeks_. The rebrand merged — 1,580 tests green — and production kept serving the violet build from mid-July. Root cause, once shipping forced the dig: the workflow ran an unpinned `npx vercel`, which had drifted to a new major (58.4.4) whose bundled builder emits functions referencing files _outside_ the build output directory. The deploy ships an archive of only that directory, so the platform side died with `ENOENT` on a file that was never packed. Dropping the archive flag is no escape hatch either — the artifact is 18,316 files against a 15,000-file deploy cap (measured on our plan, not quoted from docs). The fix was one line: pin every invocation to the CLI of the last green deploy, which ran on 54.20.1 back on July 6 — the drift had been accumulating for weeks before it started failing.

```yaml
# .github/workflows/deploy-docs.yml
env:
  VERCEL_CLI_VERSION: 54.20.1 # unpinned npx drifts majors; builder ENOENTs under --archive=tgz
# ...and every call has to actually consume it — the env var alone pins nothing:
#   npx vercel@${VERCEL_CLI_VERSION} build
#   npx vercel@${VERCEL_CLI_VERSION} deploy --prebuilt --archive=tgz
```

**Pipeline two.** The private repo that orchestrates all of this had its PR workflows manually disabled during a May billing crunch. Disabled workflows don't fail — they produce _nothing_. Four PRs merged over two months with an empty check rollup, which the merge button renders exactly as invitingly as a passing one. The repair is one command per workflow; noticing took two months and a rebrand.

```bash
gh workflow list --all --json name,state   # state: disabled_manually
```

A green dashboard is a [proxy metric](https://ofriperetz.dev/articles/proxy-metrics) for a working delivery pipeline, and like every proxy it fails in the direction that flatters you — [the metric quietly becoming the target](https://ofriperetz.dev/articles/goodharts-law-explained): a pipeline emitting *nothing* scores identically to one emitting success. Chess players call the countermeasure a blunder check — before you play the move you already like, stop and verify it loses nothing, _especially_ from a winning position, because winning positions are where you stop looking. Neither pipeline showed red. One showed stale green, the other showed silence, and silence renders as green if you don't look closely.

So here is the check I run now, and the one thing from this weekend I'd hand to someone else as-is:

### The live check {#the-live-check}

> A change is done when a request to _production_ returns the thing you shipped — a version string, an asset hash, a hex value from the diff. Not when CI is green, not when the PR is merged, not when the deploy job reports success. Three failure modes it catches, in the order they bit me: **built ≠ delivered** (the deploy dies after the build passes), **disabled ≠ passing** (no checks renders like good checks), **downstream ≠ upstream** (the fix lands where the next sync overwrites it).

Why is a discipline doing a robot's job? It shouldn't be for long — the check is one `curl` of a version string away from being the deploy job's last step, failing the run when production disagrees with the artifact. Mine is still manual as I write this, which is exactly the admission the live check exists to force.

The third failure mode deserves its own section.

## Grep finds names, not values {#grep-finds-names}

The violet I was purging wasn't a color, it was a _distribution system_. The design system baseline syncs components downstream into every site. Weeks earlier I had fixed a violet gradient directly in the blog — downstream. The upstream baseline still carried it, byte-identical, so the very next sync would have quietly reverted the fix. In a synced system, a downstream fix is a time bomb with a revert inside.

Then the second pass found what the first one couldn't: hero gradients defining violet as bare RGB triples — `139, 92, 246` — invisible to every grep for `violet` or `purple`. Names are searchable. Values are not. The only reliable sweep was rendering the actual surfaces and looking, which is also how the triples surfaced: production screenshots, not source search.

Same failure shape, different surface: a gate blocked the blog's deploy under the name "layout + contrast", and every finding was actually a **tap target** — prose links rendering 18–21px tall against [WCAG 2.2's 24×24px minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) — because an earlier refactor had renamed the sizing rule to `.prose a.standalone-link` and never shipped the build step that _applies_ the class. A selector matching nothing fails silently. **When a gate fails, read the findings, not the gate's name**; I nearly "fixed contrast" on pages whose contrast was fine.

## What the agents could not do

An honest ledger, since this is the part AI essays skip. The agents wrote effectively all of the diff — token surgery across ~30 files per PR, regenerated registries, 19 deterministic OG cards rendered by script for $0. In parallel, each in an isolated worktree with its own PR and its own green checks, because agents sharing a checkout is how you get raced files and hard resets.

What they could not do: freeze the chassis. Decide that the accent surface changes rather than the claim. Delete an entire comparison page because it argued by table what the site should argue by values — the single best branding decision of the weekend, and it was a deletion. Every irreversible call stayed human, and the weekend worked _because_ that boundary was explicit.

This is the same division of labor I build [linters for AI-generated code](https://ofriperetz.dev/articles/claude-wrote-nestjs-service-eslint-found-6-security-holes) around: the machine executes at a scale you can't, and the constraint system — the frozen chassis, the same-day-evidence rule, the live check — is the part you own. Dev.to's front page is full of essays asking whether we can still trust what AI ships. My weekend's answer: trust is not a feeling about the model. It's a property of the harness.

---

The ecosystem the agents rebranded is the Interlace ESLint plugins — source at [github.com/ofri-peretz/eslint](https://github.com/ofri-peretz/eslint), packages at [npmjs.com/~ofriperetz](https://www.npmjs.com/~ofriperetz), and more of this at [dev.to/ofri-peretz](https://dev.to/ofri-peretz). Every number on those pages obeys the same same-day-evidence rule as this article.

_When did you last verify a pipeline **delivered** — not built, delivered? And what's the longest one stayed silently dead on you before something you shipped exposed it?_
