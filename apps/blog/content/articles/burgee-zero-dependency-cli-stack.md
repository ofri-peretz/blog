---
title: "burgee Installs 9 Packages Where a commander Stack Installs 70. It Still Fails 3 of Its Own Gates."
description: "Part 2 of the dependency-weight method: nine CLI layers, counted. 70 packages from 25 maintainers against 9 from one, and the rows where the nine weigh more."
slug: "burgee-zero-dependency-cli-stack"
published: false
canonical_url: "https://ofriperetz.dev/articles/burgee-zero-dependency-cli-stack"
cover_image: "https://ofriperetz.dev/cdn/blog-cover-image/burgee-zero-dependency-cli-stack.jpg"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/burgee-zero-dependency-cli-stack-og.jpg"
tier: "T3"
reading_time_minutes: 4
tags:
  - "node"
  - "javascript"
  - "cli"
  - "opensource"
series: null
author:
  name: Ofri Peretz
  avatar: https://avatars.githubusercontent.com/u/46347627
  title: Security Engineering Leader
---

A Node CLI that takes the usual package for each of nine layers:

```bash
npm i commander chalk ora inquirer string-width cosmiconfig execa signal-exit terminal-link
```

**70 packages, maintained by 25 npm accounts.** The nine packages of burgee, the CLI family I maintain, cover the same layers and install **9 packages from 1 account**.

That is the flattering row. [Part 1](https://ofriperetz.dev/articles/eslint-plugin-dependency-weight) counted ESLint plugin trees and printed the rows against my own plugins. Same method here, same rule.

## Layer by layer {#layers}

Each incumbent is the first name in burgee's own "Replaces" column, so the stack comes from my design surface, not a neutral sample. Resolved 2026-09-23, one package at a time; KB is 1,024 bytes on disk, whole tree included.

| incumbent     | pkgs | KB   | burgee    | pkgs | KB   |
| ------------- | ---- | ---- | --------- | ---- | ---- |
| commander     | 1    | 203  | burgee    | 6    | 1169 |
| chalk         | 1    | 55   | roundel   | 1    | 76   |
| ora           | 17   | 278  | flagstaff | 5    | 547  |
| inquirer      | 27   | 1002 | caique    | 3    | 302  |
| string-width  | 4    | 36   | linegauge | 1    | 83   |
| cosmiconfig   | 4    | 1789 | seniority | 1    | 149  |
| execa         | 18   | 632  | bellpull  | 1    | 96   |
| signal-exit   | 1    | 75   | closeout  | 1    | 100  |
| terminal-link | 6    | 60   | paratext  | 1    | 91   |

**On bytes, burgee's side is heavier in six of nine layers.** The engine alone installs six packages to commander's one. Installed together: 3,851 KB against 1,577 KB. The incumbent trees overlap a little (79 summed, 70 installed); burgee's overlap completely (20 summed, 9 installed).

## Where that byte gap comes from {#bytes}

Three layers carry it, none cleanly.

- **cosmiconfig is 1,789 KB, and 1,702 of that is js-yaml and its argparse.** seniority parses no YAML: it reads the JSON subset and refuses the rest by name. Against cosmiconfig's own test suite it passes 186 of 243.
- **execa has no graded drop-in.** bellpull's compat row is cross-spawn, not execa.
- **inquirer** is graded through `@inquirer/core` (41 of 41), not `inquirer` itself.

Keep only the layers where burgee's drop-in scores what the incumbent scores on the incumbent's own test suite (burgee's compat oracle runs them): commander, chalk, ora, `@inquirer/core`, string-width, signal-exit. **28 packages, 662 KB.** burgee still installs all nine, 1,577 KB. **Like for like, burgee is 2.4× heavier on disk**, while the count stays 28 against 9 and the maintainers 14 against one.

## The three gates burgee publishes as not met {#gates}

burgee's [README](https://github.com/ofri-peretz/burgee/blob/main/README.md) states nine gates; three fail their ≤ 1.0× target. I re-ran each with burgee's own fixtures:

| gate                                   | published | my re-run  |
| -------------------------------------- | --------- | ---------- |
| `burgee` bundle vs cac                 | 2.636×    | 2.661×     |
| `burgee/commander` bundle vs commander | 1.514×    | 1.520×     |
| cold start vs cac                      | 1.443×    | 1.71–2.30× |

The bundle rows agree within a percent. My cold-start runs, on a laptop at load average above 150, read worse than burgee's CI figure; either way, not met. burgee's lighter rows compare it against cac, commander or yargs **plus** cosmiconfig, exit-hook and restore-cursor (0.282×, 0.468×, 0.531×). If a parser is all you need, read the bare rows.

## What "zero dependencies" means here {#precise}

Six of the nine declare no dependencies. burgee, flagstaff and caique depend only on each other: **no dependency outside the family**, which is not zero. burgee's README table says 0 runtime dependencies; the registry lists five, all siblings.

One account is also a concentration. Mid-measurement, the registry received burgee@0.10.0 at 05:34 UTC and the linegauge@0.4.3 it requires at 05:42; for eight minutes `npm i burgee` failed with `ETARGET`. And the family needs Node 24, where the incumbent stack installs on Node 22.18. If you support Node 22, the incumbents are your option.

## How to check yours {#method}

Part 1's four lines, plus bytes and maintainers:

```bash
mkdir /tmp/w && cd /tmp/w && npm init -y >/dev/null
npm i --package-lock-only <your dependencies>
node -e "console.log(Object.keys(require('./package-lock.json').packages).filter(k=>k.startsWith('node_modules/')).length)"
npm ci --ignore-scripts && node -e "let t=0;const f=require('fs'),w=d=>f.readdirSync(d,{withFileTypes:true}).forEach(e=>{const p=d+'/'+e.name;e.isDirectory()?e.name!=='.bin'&&w(p):e.isFile()&&e.name!=='.package-lock.json'&&(t+=f.statSync(p).size)});w('node_modules');console.log(t)"
node -e "const l=require('./package-lock.json').packages,m=new Set();Promise.all(Object.keys(l).filter(k=>k.startsWith('node_modules/')).map(k=>fetch('https://registry.npmjs.org/'+k.split('node_modules/').pop().replace('/','%2F')).then(r=>r.json()).then(d=>d.maintainers.forEach(x=>m.add(x.name))))).then(()=>console.log(m.size))"
```

Part 1 subtracted a 69-package ESLint baseline; here the shared baseline is Node, zero packages. pnpm and yarn resolve the same counts; I did not measure bun.

---

_Run it on your CLI: how many npm accounts can ship code into your tree, and did you know that number before today?_

::dev-to-cta{url="https://github.com/ofri-peretz/burgee"}
If the method earns a place in your release review, ⭐ [star the repo](https://github.com/ofri-peretz/burgee).
::
