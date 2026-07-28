---
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/abandoned-incumbent-map.jpg"
cover_image: "https://ofriperetz.dev/cdn/blog-cover-image/abandoned-incumbent-map.jpg"
devto_url: "https://dev.to/ofri-peretz/142076-weekly-downloads-zero-releases-since-2021-is-the-niche-defended-4hko"
devto_id: 4183799
title: "142,076 Weekly Downloads. Zero Releases Since 2021. Is the Niche Defended?"
description: "A Serverless plugin with 142k weekly downloads last shipped a release in 2021. Downloads said taken; the registry said abandoned; the platform's roadmap said something else entirely. The incumbent map — weekly downloads × years since last publish × open-issue decay — is how I decide what to build next, including the pick I shipped against two months before the fact-check caught up with me."
slug: "abandoned-incumbent-map"
published: true
date: 2026-07-19
tags:
  - "serverless"
  - "aws"
  - "opensource"
  - "node"
canonical_url: https://ofriperetz.dev/articles/abandoned-incumbent-map
tier: "T2"
reading_time_minutes: 6
author:
  name: Ofri Peretz
  avatar: https://avatars.githubusercontent.com/u/46347627
  title: Security Engineering Leader
---

Two reads from the npm registry, same package, same morning (2026-07-19):

```
downloads, last week:  142,076
last publish:          2021-05-21  (v3.2.0)
```

`serverless-iam-roles-per-function` is one of the Serverless Framework ecosystem's most-installed plugins, and it hasn't shipped a release since May 2021. Eleven weeks earlier: 118,761 weekly downloads (measured 2026-05-04). Zero releases in between; 23,315 weekly installs gained.

The package isn't surviving abandonment — its installed base is growing straight through it.

My first read was the common one: "142k a week, the niche is taken, I'm five years late." That's the misconception this article exists to correct. **High downloads don't mean a niche is taken. Downloads measure the installed base; maintenance decay measures whether the niche is defended.** The gap between those signals is where I decide what to build next, using what I call the **incumbent map**. Fair warning: I ran the arithmetic in May, shipped against its #1 row on 2026-05-07, and only ran the filter that kills that row while fact-checking this article in July. The method works; I ran half of it. Both halves are below, in the order I should have run them.

---

## How do you build an incumbent map? {#the-method}

Three signals per package, all public, all re-runnable:

1. **Weekly downloads — demand.** The installed base a maintained replacement would serve. Downloads are a [proxy metric](https://ofriperetz.dev/articles/proxy-metrics) — npm's own account of download counts includes build servers, mirrors, and robots, so the number tracks lockfile momentum, not humans choosing a package. As a _relative_ ranking of where demand pools inside one ecosystem, though, it's the best public signal there is.
2. **Years since last publish — supply-side decay.** Read the registry at `time[<latest-version>]`. Not `time.modified` — that field moves when npm touches registry metadata: `serverless-iam-roles-per-function` shows `modified: 2022-05-17`, a full year after its last release. Trust the version's own timestamp, nothing else.
3. **Open-issue decay — unmet demand.** No clean number here, so make the procedure explicit: sort open issues by reactions, list the recurring asks, date the last maintainer reply. For the plugin above: managed-policy attachment and custom role naming — asked for years across multiple issues, no maintainer commitment (the 2018 managed-policy ask drew "open for PRs"; nothing shipped since). And read the replies, not just titles; mine matter later.

The first two signals, as commands:

```bash
curl -s https://api.npmjs.org/downloads/point/last-week/<pkg>               # demand
curl -s https://registry.npmjs.org/<pkg> | jq '.time[."dist-tags".latest]'  # decay
```

Multiply, roughly: demand × decay × unanswered asks, ranked descending. Deliberately not a precise formula — a shortlist generator whose output you still have to judge.

The closest prior art is [OpenSSF Scorecard](https://github.com/ossf/scorecard): its `Maintained` check formalizes the same "is anyone home?" signal for the dependencies you _consume_ — a risk lens. The incumbent map points it the other way: not "should I trust this package?" but "should I compete with it?" I haven't seen that build-side version written down anywhere — a strong claim, and an open invitation to correct me.

## What does the serverless incumbent map actually show? {#the-map}

The worked example that produced my roadmap. Two zones, all numbers measured 2026-07-19:

**Defended — active maintainers, do not compete on maintenance:**

| Package                     | Downloads/wk | Last publish |
| --------------------------- | ------------ | ------------ |
| `serverless-offline`        | 627,578      | 2026-06-23   |
| `serverless-esbuild`        | 388,619      | 2026-05-21   |
| `serverless-domain-manager` | 304,882      | 2026-07-17   |
| `serverless-step-functions` | 208,865      | 2026-07-13   |

**Abandoned — demand present, nobody home:**

| Package                                  | Downloads/wk | Last publish | Silence |
| ---------------------------------------- | ------------ | ------------ | ------- |
| `serverless-iam-roles-per-function`      | 142,076      | 2021-05-21   | 5.2 yrs |
| `serverless-plugin-include-dependencies` | 52,500       | 2024-07-22   | 2.0 yrs |
| `serverless-plugin-common-excludes`      | 51,415       | 2021-07-06   | 5.0 yrs |
| `serverless-api-gateway-throttling`      | 36,528       | 2023-03-19   | 3.3 yrs |
| `serverless-plugin-tracing`              | 35,709       | 2017-10-13   | 8.8 yrs |
| `serverless-plugin-canary-deployments`   | 31,562       | 2022-04-11   | 4.3 yrs |
| `serverless-associate-waf`               | 28,787       | 2020-04-17   | 6.3 yrs |

The top zone shipped within two months. The bottom zone's median silence: five years — on packages still installed tens of thousands of times a week.

The map moves, in both directions. `serverless-associate-waf` shows demand finally decaying — down roughly a quarter from my May reading — so abandonment does reach the download number, on a lag of years, not months. And re-pulling before publishing deleted a row: `serverless-openapi-documenter`, filed in my May notes as a stale documentation-plugin niche, shipped a release on 2026-06-24. Someone re-defended it while I drafted. Row gone. An incumbent map is a snapshot, not a subscription — re-run it the week you commit, not the quarter you planned.

## When is a quiet package finished instead of dead? {#stable-vs-dead}

The honest counter-case, because the map's arithmetic will lie to you twice.

First: **stable is not dead.** `serverless-prune-plugin` sits at 414,154 downloads a week (measured 2026-07-19), last publish 2024-10-16. Twenty-one quiet months — and it may simply be done: its job is narrow, its surface barely moves. The separating question: **does the surface underneath the package move?** IAM — the ground `serverless-iam-roles-per-function` stands on — moves constantly: new AWS services, new actions, new policy patterns. Five silent years on a moving surface is decay; on a frozen surface, it can be completion. Same silence, opposite meanings — a classic [measurement-bias](https://ofriperetz.dev/articles/bias-in-measurement) trap.

Second: **platform absorption.** `serverless-plugin-typescript`: 151,586 downloads a week (measured 2026-07-19), dormant since 2023-06-05 — by raw arithmetic the juiciest target on the board. It's not on my list: Serverless Framework v4 builds TypeScript natively and won't run build plugins like it unless you explicitly opt out of the native build. That niche isn't undefended; it's dissolving. A replacement would be competing with the platform itself.

An installed base looks like a moat. The publish log says whether anyone still defends it; the platform roadmap, whether the castle is even staying put.

## How were the replacement targets actually picked? {#picking-targets}

The full pipeline, as actually run for the serverless line:

1. **Rank** every community plugin by demand × decay (the tables above are the output).
2. **Filter: is the niche still real?** — `serverless-plugin-typescript` fell here first. Then the same filter, run against the current v4 docs instead of my stale notes, reached the top row of my map: v4 ships per-function IAM roles natively — provider-statement inheritance on by default, log/VPC/event-source permissions auto-added, the plugin's own config fields accepted for migration. The [official IAM guide](https://www.serverless.com/framework/docs/providers/aws/guide/iam) credits the plugin for pioneering the feature and says you can now safely remove it. My #1 target wasn't an undefended niche; it was one the platform had absorbed — with honors.
3. **Filter: is the incumbent truly undefended?** — re-pull the registry the week you commit; that check removed `serverless-openapi-documenter`.
4. **Filter: is the unmet demand documented in public — and still unmet?** The newest open issue asks "Serverless Framework V4 Support?" — and the thread answers itself: a collaborator's "it works," then a comment pointing at the v4 docs above. The two features its tracker spent years asking for — managed policies, custom role names — shipped in v4's native implementation, not the plugin's. The counter-evidence to my top pick sat in the tracker I was reading for demand. Read the replies.

The worked example deleted two of its own rows — one while I drafted, one while I fact-checked. Here is what the second deletion cost, stated plainly: my May map scored `serverless-iam-roles-per-function` 23/25 — "the biggest single-plugin opportunity in the portfolio" — and I shipped `@interlace/serverless-iam-roles-per-function` 1.0.0 off that row on 2026-05-07 (the npm publish date; check it). The filter you just read ran two months later. The package stays published and does what it says; what it is not, anymore, is the line's growth bet — v4 owns that niche now. The ranked ROI analysis lives in the repo, unchanged, dates included — deliberately, as the before-artifact: you can see exactly the map I built from, and exactly what running filter 2 late overturned. Arithmetic generates the shortlist; filters, run against primary sources — _before you build_ — make the decision.

Notice the conflict of interest: the person selling replacements is grading the incumbents — the same conflict as [building what I benchmark](https://ofriperetz.dev/articles/i-built-what-i-benchmark-heres-how-i-try-not-to-cheat), with the same mitigation: every number here is a public registry read, stamped with its measurement date, re-runnable in one `curl` without me in the loop.

The map is step one of entering an ecosystem. Step two keeps the building honest — write down claims and evidence _before_ the marketing exists: [the claims registry](https://ofriperetz.dev/articles/claims-registry-evidence-framework). Different [package types need different metrics](https://ofriperetz.dev/articles/different-metrics-for-different-package-types) once you measure what you built — but the map is how you decide to build at all.

---

_What's the most-downloaded abandoned package in your ecosystem — React components? Terraform providers? Gradle plugins? Two registry reads will tell you. I'm collecting incumbent maps, and I'd genuinely like to see yours._

## Quick reference {#quick-reference}

| Signal                                        | What it measures                                         | Where to read it                                                                | Failure mode                                                              |
| --------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Weekly downloads                              | Installed base (demand) — not adoption, not health       | `api.npmjs.org/downloads/point/last-week/<pkg>`                                 | Mistaking base for defense; CI/mirror inflation                           |
| Years since last publish                      | Supply-side decay                                        | `registry.npmjs.org/<pkg>` → `time[<latest-version>]` — **not** `time.modified` | Finished ≠ dead on a frozen surface                                       |
| Open-issue decay                              | Unmet demand, stated in public                           | Issue tracker: sort by reactions, date the last maintainer reply                | Reading titles, not replies — the answer may be "the platform shipped it" |
| Deprecation/archive status + platform roadmap | Whether the niche still exists                           | Registry `deprecated` field, repo header, framework changelog + docs            | High downloads on a dissolving niche                                      |
| Decision rule                                 | demand × decay × unanswered asks → shortlist → 3 filters | This article                                                                    | It's a snapshot — re-run the week you commit                              |

## References

- ["numeric precision matters: how npm download counts work"](https://blog.npmjs.org/post/92574016600/numeric-precision-matters-how-npm-download-counts-work.html) (npm blog, 2014) — npm's own account of what a download includes (build servers, mirrors, robots); the primary source for why downloads can only ever be a demand proxy.
- [npm registry download-counts documentation](https://github.com/npm/registry/blob/main/docs/download-counts.md) — the API the map reads: the endpoints and the data pipeline behind the counts.
- [Serverless Framework IAM guide](https://www.serverless.com/framework/docs/providers/aws/guide/iam) — the platform-absorption primary source: v4's native per-function roles, statement inheritance, auto-added permissions, and the credit to the community plugin it replaces.
- [OpenSSF Scorecard](https://github.com/ossf/scorecard) — the closest prior art: its `Maintained` check operationalizes "is anyone home?" for consumption-side dependency risk; the incumbent map reuses that signal for build-side decisions.

## Related deep dives

- [Proxy Metrics: When the Number Isn't the Thing](https://ofriperetz.dev/articles/proxy-metrics) — why downloads, stars, and every other convenient number measure something adjacent to what you care about
- [Bias in Measurement](https://ofriperetz.dev/articles/bias-in-measurement) — how a real number still produces a wrong inference, including the too-clean-zero forensic
- [The Claims Registry](https://ofriperetz.dev/articles/claims-registry-evidence-framework) — step two of the playbook: the evidence discipline that comes before any claim
- [Different Metrics for Different Package Types](https://ofriperetz.dev/articles/different-metrics-for-different-package-types) — once you build, how the measuring has to change per package type
- [I Built What I Benchmark. Here's How I Try Not to Cheat.](https://ofriperetz.dev/articles/i-built-what-i-benchmark-heres-how-i-try-not-to-cheat) — the conflict-of-interest process this article's mitigation borrows

{% cta https://github.com/ofri-peretz/serverless %} Star the serverless repo — the map above is its roadmap {% endcta %}

---

_Part of the [Interlace ESLint ecosystem](https://eslint.interlace.tools). Source on [GitHub](https://github.com/ofri-peretz/eslint) · npm: [@interlace](https://www.npmjs.com/~ofriperetz) · Follow: [Dev.to/ofri-peretz](https://dev.to/ofri-peretz) · [ofriperetz.dev](https://ofriperetz.dev)_
