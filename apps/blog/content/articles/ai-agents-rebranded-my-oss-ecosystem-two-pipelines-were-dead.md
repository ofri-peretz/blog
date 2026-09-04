---
title: "I Let AI Agents Rebrand My Entire OSS Ecosystem in One Night. Two Pipelines Were Silently Dead."
description: "Merged is a feeling. Live is a measurement. 13 PRs across 5 repos in one night of parallel AI agents — and two delivery pipelines that had been silently dead for weeks."
slug: "ai-agents-rebranded-my-oss-ecosystem-two-pipelines-were-dead"
canonical_url: "https://ofriperetz.dev/articles/ai-agents-rebranded-my-oss-ecosystem-two-pipelines-were-dead"
cover_image: "https://ofriperetz.dev/cdn/blog-cover-image/ai-agents-rebranded-my-oss-ecosystem-two-pipelines-were-dead.jpg"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/ai-agents-rebranded-my-oss-ecosystem-two-pipelines-were-dead-og.jpg"
tier: "T3"
reading_time_minutes: 4
tags:
  - "ai"
  - "webdev"
  - "security"
  - "eslint"
series: null
author:
quality:
  panel_version: "1.0.0"
  reviewed: "2026-09-04"
  spec: sdlc/spec/ai-agents-rebranded-my-oss-ecosystem-two-pipelines-were-dead.md
  lenses:
    growth_hook: 9.6
    security_correctness: 9.7
    structure_framing_voice: 9.7
    compatibility: 9.5
    reproducibility: 9.5
---

Two of my five repositories had delivery pipelines that were silently dead. Not failing loudly — _dead_. One site had served a two-week-old build while every deploy "ran". One repo had merged four PRs with zero CI checks since May, because an empty check rollup looks a lot like a green one.

I found out because of a rebrand. In one night, AI agents and I merged 13 pull requests across those five repos and repainted all of it from Tailwind violet to burnt orange. Nothing surfaces a dead pipeline like finally shipping something you care about seeing.

---

## Merged is a feeling. Live is a measurement. {#merged-vs-live}

**Pipeline one.** The ESLint docs site had a deploy workflow that had failed on _every run for two weeks_. The rebrand merged — 1,580 tests green — and production kept serving the violet build from mid-July. Root cause: the workflow ran an unpinned `npx vercel`, which had drifted to a new major (58.4.4) whose bundled builder emits functions referencing files _outside_ the build output directory. The deploy ships an archive of only that directory, so the platform side died with `ENOENT` on a file that was never packed. Dropping the archive flag is no escape hatch either — the artifact is 18,316 files against a 15,000-file deploy cap (measured on our plan, not quoted from docs). The fix was one line: pin every invocation to the CLI of the last green deploy — `vercel@54.20.1`, which npm published on 3 July and which was still what ran on the last deploy that worked, on 6 July. (`58.4.4` published on 30 July, so an unpinned `npx` crossed four majors in under a month.)

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

A green dashboard is a [proxy metric](https://ofriperetz.dev/articles/proxy-metrics) for a working delivery pipeline, and like every proxy it fails in the direction that flatters you — [the metric quietly becoming the target](https://ofriperetz.dev/articles/goodharts-law-explained): a pipeline emitting _nothing_ scores identically to one emitting success. Neither pipeline showed red. One showed stale green, the other showed silence, and silence renders as green if you don't look closely.

So here is the check I run now, and the one thing from that weekend I'd hand to someone else as-is:

### The live check {#the-live-check}

> A change is done when a request to _production_ returns the thing you shipped — a version string, an asset hash, a hex value from the diff. Not when CI is green, not when the PR is merged, not when the deploy job reports success. Three failure modes it catches, in the order they bit me: **built ≠ delivered** (the deploy dies after the build passes), **disabled ≠ passing** (no checks renders like good checks), **downstream ≠ upstream** (the fix lands where the next sync overwrites it).

Why is a discipline doing a robot's job? It shouldn't be for long — the check is one `curl` of a version string away from being the deploy job's last step, failing the run when production disagrees with the artifact. Mine is still manual as I write this, which is exactly the admission the live check exists to force.

## What the agents could not do

The agents wrote effectively all of the diff, each in an isolated worktree with its own PR and its own green checks. What they could not do was notice. Every one of those PRs was green. Neither dead pipeline was in any diff, so no reviewer — human or model — was going to find it by reading code.

That's the division of labor I build [linters for AI-generated code](https://ofriperetz.dev/articles/claude-wrote-nestjs-service-eslint-found-6-security-holes) around: the machine executes at a scale you can't, and the checks that face _production_ are the part you own. Trust is not a feeling about the model. It's a property of the harness — and a harness that never queries production isn't one.

---

The ecosystem the agents rebranded is the Interlace ESLint plugins — source at [github.com/ofri-peretz/eslint](https://github.com/ofri-peretz/eslint), packages at [npmjs.com/~ofriperetz](https://www.npmjs.com/~ofriperetz), and more of this at [dev.to/ofri-peretz](https://dev.to/ofri-peretz). Every number on those pages obeys the same-day-evidence rule as this article.

_When did you last verify a pipeline **delivered** — not built, delivered? And what's the longest one stayed silently dead on you before something you shipped exposed it?_
