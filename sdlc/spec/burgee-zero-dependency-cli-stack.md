---
slug: burgee-zero-dependency-cli-stack
stage: spec
intent: sdlc/intent/burgee-zero-dependency-cli-stack.md
status: draft
gathered: 2026-09-23
---

## Thesis

The intent's claim survives on the axis it named, **package count**: one
incumbent per layer resolves to 70 packages maintained by 25 npm accounts;
burgee's nine resolve to themselves, one account.

**The evidence moved the claim on the axis the intent did not name, bytes,
and that is the article.** Tree-inclusive, burgee's package is heavier than
the incumbent in six of nine layers. The full-stack byte gap in burgee's
favour (3,943,599 B against 1,614,853 B) is carried by three layers that are
not like-for-like: cosmiconfig (whose bytes are mostly js-yaml, a parser
seniority does not ship; seniority passes 186 of 243 of cosmiconfig's suite),
execa (no graded drop-in), and `inquirer` (graded only through
`@inquirer/core`). Restricted to the six layers where burgee's drop-in scores
what the incumbent scores on the incumbent's own suite, the incumbent stack is
28 packages and 677,694 B, and burgee still installs all nine: **2.38× heavier
on disk, 3.1× fewer packages, 14 maintainer accounts against 1.**

Two things happened during measurement that the article reports rather than
smooths: burgee `0.10.0` published eight minutes before a family dependency it
requires, so `npm i burgee` failed with `ETARGET`; and a local cold-start
re-run read worse than burgee's published CI figure.

### Kill criteria, evaluated

1. **External dependency on the registry**: did not fire. `npm view <pkg>
dependencies` for all nine: six declare none; burgee declares roundel,
   bellpull, closeout, linegauge, seniority; flagstaff declares roundel,
   closeout, paratext, linegauge; caique declares closeout, linegauge. The
   family tree resolves to exactly the nine.
2. **Graded row for every named incumbent**: did not fire for commander, yargs,
   chalk, ora; `inquirer` is graded through `@inquirer/core` only, and the
   article says so. execa and terminal-link (80%) and cosmiconfig (76.5%) are
   below or without a graded row, which is why the like-for-like stack exists.
3. **Difference within a handful**: did not fire. 70 against 9; like-for-like
   28 against 9.

## Instruments

Both scripts ran from an empty scratch directory on Node 24.18.0, npm 11.16.0,
macOS arm64. `measure.mjs` is part 1's method plus a byte walk; the byte walk
is the same one the article prints as a one-liner, which returned identical
totals on all three stacks (3,943,599 / 1,614,853 / 677,694).

```js
// measure.mjs <label> <pkg...> — part 1's count, plus installed bytes.
import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  lstatSync,
  rmSync,
  writeFileSync,
  existsSync,
} from "node:fs";
import { join } from "node:path";
const ROOT = new URL(".", import.meta.url).pathname;
const [label, ...pkgs] = process.argv.slice(2);
const dir = join(ROOT, "w", label.replace(/[^a-z0-9-]/gi, "_"));
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
const npm = (a) =>
  execFileSync("npm", a, {
    cwd: dir,
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  });
npm(["init", "-y"]);
npm(["i", "--package-lock-only", "--no-audit", "--no-fund", ...pkgs]);
const lock = JSON.parse(readFileSync(join(dir, "package-lock.json"), "utf8"));
const keys = Object.keys(lock.packages).filter((k) =>
  k.startsWith("node_modules/"),
);
npm(["ci", "--ignore-scripts", "--no-audit", "--no-fund"]);
function bytes(p) {
  let t = 0;
  for (const e of readdirSync(p, { withFileTypes: true })) {
    const f = join(p, e.name);
    const s = lstatSync(f);
    if (s.isSymbolicLink()) continue;
    if (s.isDirectory()) {
      if (e.name !== ".bin") t += bytes(f);
    } else if (!(p.endsWith("node_modules") && e.name === ".package-lock.json"))
      t += s.size;
  }
  return t;
}
const b = existsSync(join(dir, "node_modules"))
  ? bytes(join(dir, "node_modules"))
  : 0;
mkdirSync(join(ROOT, "out"), { recursive: true });
const resolved = keys.map(
  (k) =>
    `${k.slice(k.lastIndexOf("node_modules/") + 13)}@${lock.packages[k].version}`,
);
writeFileSync(
  join(ROOT, "out", `${label}.json`),
  JSON.stringify({ label, tree: keys.length, bytes: b, resolved }, null, 2),
);
console.log(`${label}\ttree=${keys.length}\tbytes=${b}`);
```

```js
// maintainers.mjs <label> — distinct npm maintainer accounts across a measured tree.
import { readFileSync } from "node:fs";
const { resolved } = JSON.parse(
  readFileSync(
    new URL(`./out/${process.argv[2]}.json`, import.meta.url),
    "utf8",
  ),
);
const m = new Set();
for (const spec of resolved) {
  const name = spec.slice(0, spec.lastIndexOf("@"));
  const doc = await (
    await fetch(`https://registry.npmjs.org/${name.replace("/", "%2F")}`)
  ).json();
  (doc.maintainers ?? []).forEach((x) => m.add(x.name));
}
console.log(
  process.argv[2],
  resolved.length,
  "packages",
  m.size,
  "maintainers",
);
```

Stacks, as passed to `measure.mjs`:

- **stack-commander**: `commander chalk ora inquirer string-width cosmiconfig execa signal-exit terminal-link`
  (the first incumbent in each row of burgee's README "Replaces" column)
- **stack-yargs**: the same with `yargs` for `commander`
- **stack-graded**: `commander chalk ora @inquirer/core string-width signal-exit`
  (layers whose burgee drop-in scores what the incumbent scores on its own suite)
- **family**: `burgee roundel flagstaff caique linegauge seniority bellpull closeout paratext`

KB in the article is bytes ÷ 1,024, rounded, the unit burgee's README uses.

## Ground truth

Resolved versions: burgee 0.10.0, roundel 0.4.2, flagstaff 0.3.6, caique 0.4.2,
linegauge 0.4.3, seniority 0.4.2, bellpull 0.2.2, closeout 0.4.0, paratext
0.5.3; commander 15.0.0, yargs 18.2.0, chalk 6.0.0, ora 9.4.1, inquirer 14.2.2,
@inquirer/core 12.0.3, string-width 8.2.2, cosmiconfig 10.0.1, execa 10.0.1,
signal-exit 4.1.0, terminal-link 5.0.0, cac 7.0.0.

| Claim                                                               | Value                                                                                                                               | Command                                                                                                                                     | Version                                         | Verified   |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ---------- |
| commander tree / bytes (article: 1 pkg, 203 KB)                     | 1 / 207,368 B                                                                                                                       | `node measure.mjs commander commander`                                                                                                      | commander 15.0.0                                | 2026-09-23 |
| chalk tree / bytes (article: 1, 55 KB)                              | 1 / 56,029 B                                                                                                                        | `node measure.mjs chalk chalk`                                                                                                              | chalk 6.0.0                                     | 2026-09-23 |
| ora tree / bytes (article: 17, 278 KB)                              | 17 / 284,686 B                                                                                                                      | `node measure.mjs ora ora`                                                                                                                  | ora 9.4.1                                       | 2026-09-23 |
| inquirer tree / bytes (article: 27, 1002 KB)                        | 27 / 1,026,413 B                                                                                                                    | `node measure.mjs inquirer inquirer`                                                                                                        | inquirer 14.2.2                                 | 2026-09-23 |
| string-width tree / bytes (article: 4, 36 KB)                       | 4 / 36,801 B                                                                                                                        | `node measure.mjs string-width string-width`                                                                                                | string-width 8.2.2                              | 2026-09-23 |
| cosmiconfig tree / bytes (article: 4, 1789 KB)                      | 4 / 1,832,269 B                                                                                                                     | `node measure.mjs cosmiconfig cosmiconfig`                                                                                                  | cosmiconfig 10.0.1                              | 2026-09-23 |
| execa tree / bytes (article: 18, 632 KB)                            | 18 / 647,091 B                                                                                                                      | `node measure.mjs execa execa`                                                                                                              | execa 10.0.1                                    | 2026-09-23 |
| signal-exit tree / bytes (article: 1, 75 KB)                        | 1 / 76,966 B                                                                                                                        | `node measure.mjs signal-exit signal-exit`                                                                                                  | signal-exit 4.1.0                               | 2026-09-23 |
| terminal-link tree / bytes (article: 6, 60 KB)                      | 6 / 61,152 B                                                                                                                        | `node measure.mjs terminal-link terminal-link`                                                                                              | terminal-link 5.0.0                             | 2026-09-23 |
| burgee tree / bytes (article: 6, 1169 KB)                           | 6 / 1,197,397 B                                                                                                                     | `node measure.mjs burgee burgee`                                                                                                            | burgee 0.10.0                                   | 2026-09-23 |
| roundel tree / bytes (article: 1, 76 KB)                            | 1 / 77,775 B                                                                                                                        | `node measure.mjs roundel roundel`                                                                                                          | roundel 0.4.2                                   | 2026-09-23 |
| flagstaff tree / bytes (article: 5, 547 KB)                         | 5 / 559,781 B                                                                                                                       | `node measure.mjs flagstaff flagstaff`                                                                                                      | flagstaff 0.3.6                                 | 2026-09-23 |
| caique tree / bytes (article: 3, 302 KB)                            | 3 / 309,382 B                                                                                                                       | `node measure.mjs caique caique`                                                                                                            | caique 0.4.2                                    | 2026-09-23 |
| linegauge tree / bytes (article: 1, 83 KB)                          | 1 / 84,642 B                                                                                                                        | `node measure.mjs linegauge linegauge`                                                                                                      | linegauge 0.4.3                                 | 2026-09-23 |
| seniority tree / bytes (article: 1, 149 KB)                         | 1 / 152,493 B                                                                                                                       | `node measure.mjs seniority seniority`                                                                                                      | seniority 0.4.2                                 | 2026-09-23 |
| bellpull tree / bytes (article: 1, 96 KB)                           | 1 / 97,927 B                                                                                                                        | `node measure.mjs bellpull bellpull`                                                                                                        | bellpull 0.2.2                                  | 2026-09-23 |
| closeout tree / bytes (article: 1, 100 KB)                          | 1 / 102,324 B                                                                                                                       | `node measure.mjs closeout closeout`                                                                                                        | closeout 0.4.0                                  | 2026-09-23 |
| paratext tree / bytes (article: 1, 91 KB)                           | 1 / 93,167 B                                                                                                                        | `node measure.mjs paratext paratext`                                                                                                        | paratext 0.5.3                                  | 2026-09-23 |
| one-per-layer stack (article: 70 pkgs, 3,851 KB)                    | 70 / 3,943,599 B                                                                                                                    | `node measure.mjs stack-commander commander chalk ora inquirer string-width cosmiconfig execa signal-exit terminal-link`                    | versions above                                  | 2026-09-23 |
| yargs variant of the stack (not in article)                         | 80 / 4,235,554 B                                                                                                                    | `node measure.mjs stack-yargs yargs chalk ora inquirer string-width cosmiconfig execa signal-exit terminal-link`                            | yargs 18.2.0                                    | 2026-09-23 |
| burgee family installed together (article: 9 pkgs, 1,577 KB)        | 9 / 1,614,853 B                                                                                                                     | `node measure.mjs family burgee roundel flagstaff caique linegauge seniority bellpull closeout paratext`                                    | versions above                                  | 2026-09-23 |
| like-for-like stack (article: 28 pkgs, 662 KB)                      | 28 / 677,694 B                                                                                                                      | `node measure.mjs stack-graded commander chalk ora @inquirer/core string-width signal-exit`                                                 | @inquirer/core 12.0.3                           | 2026-09-23 |
| like-for-like byte ratio (article: 2.4×)                            | 2.38                                                                                                                                | derived: 1,614,853 / 677,694                                                                                                                | derived                                         | 2026-09-23 |
| burgee heavier in six of nine layers                                | 6                                                                                                                                   | derived from the 18 per-package rows: heavier for engine, colour, render, text, lifecycle, terminal; lighter for prompt, config, process    | derived                                         | 2026-09-23 |
| trees summed vs installed (article: 79 vs 70; 20 vs 9)              | 79 / 70; 20 / 9                                                                                                                     | derived: 1+1+17+27+4+4+18+1+6 = 79; 6+1+5+3+1+1+1+1+1 = 20; installed from the two stack rows                                               | derived                                         | 2026-09-23 |
| maintainer accounts, one-per-layer stack (article: 25)              | 25                                                                                                                                  | `node maintainers.mjs stack-commander`                                                                                                      | registry packuments                             | 2026-09-23 |
| maintainer accounts, family (article: 1)                            | 1                                                                                                                                   | `node maintainers.mjs family`                                                                                                               | registry packuments                             | 2026-09-23 |
| maintainer accounts, like-for-like stack (article: 14)              | 14                                                                                                                                  | `node maintainers.mjs stack-graded`                                                                                                         | registry packuments                             | 2026-09-23 |
| js-yaml plus argparse inside cosmiconfig's tree (article: 1,702 KB) | 1,742,839 B                                                                                                                         | sum of file sizes under `w/cosmiconfig/node_modules/js-yaml` (1,571,291) and `.../argparse` (171,548), same walk as `measure.mjs`           | js-yaml 5.4.2, argparse 2.0.1                   | 2026-09-23 |
| seniority parses no YAML                                            | JSON subset only                                                                                                                    | `git -C burgee show origin/main:packages/seniority/src/cosmiconfig-defaults.ts` lines 9-15 and `loadYaml`                                   | seniority 0.4.2                                 | 2026-09-23 |
| engine depends on five siblings; six of nine declare none           | 5; 6                                                                                                                                | `npm view <pkg> dependencies --json` for each of the nine                                                                                   | versions above                                  | 2026-09-23 |
| burgee README says 0 runtime dependencies (article: 0)              | 0                                                                                                                                   | `git -C burgee show origin/main:README.md`, "Measured" table                                                                                | burgee 7fb62c2                                  | 2026-09-23 |
| cosmiconfig graded through seniority (article: 186 of 243)          | 186 / 243                                                                                                                           | `git -C burgee show origin/main:apps/docs/content/docs/compatibility.mdx`                                                                   | oracle run 2026-09-23                           | 2026-09-23 |
| inquirer graded through @inquirer/core (article: 41 of 41)          | 41 / 41                                                                                                                             | same file, row `inquirer-core`                                                                                                              | oracle run 2026-09-23                           | 2026-09-23 |
| like-for-like layers match the incumbent's own score                | commander 1360/1360, chalk 58/58, ora 99/99, @inquirer/core 41/41, string-width 229/229, signal-exit 134/135 (control also 134/135) | same file                                                                                                                                   | oracle run 2026-09-23                           | 2026-09-23 |
| bellpull's graded row is cross-spawn, none for execa                | cross-spawn 68/68                                                                                                                   | same file                                                                                                                                   | oracle run 2026-09-23                           | 2026-09-23 |
| burgee publishes nine gates, three not met                          | 9 / 3                                                                                                                               | `git -C burgee show origin/main:README.md`, "Measured" gate table                                                                           | burgee 7fb62c2                                  | 2026-09-23 |
| published: burgee bundle vs cac (article: 2.636×)                   | 2.636                                                                                                                               | same README table; results `benchmarks/results/cli-benchmarks/2026-09-22-fd0f6b2.json` claims.lighter-than-cac                              | burgee 7fb62c2                                  | 2026-09-23 |
| published: burgee/commander bundle vs commander (article: 1.514×)   | 1.514                                                                                                                               | same README table and results file, claims.lighter-than-commander                                                                           | burgee 7fb62c2                                  | 2026-09-23 |
| published: cold start vs cac (article: 1.443×)                      | 1.443                                                                                                                               | same README table                                                                                                                           | burgee 7fb62c2                                  | 2026-09-23 |
| published at-parity rows (article: 0.282×, 0.468×, 0.531×)          | 0.282 / 0.468 / 0.531                                                                                                               | same README table                                                                                                                           | burgee 7fb62c2                                  | 2026-09-23 |
| re-run: burgee bundle vs cac (article: 2.661×)                      | 27,815 / 10,452 = 2.661                                                                                                             | `node bundle.mjs` (below)                                                                                                                   | burgee 0.10.0, cac 7.0.0, esbuild 0.28.2        | 2026-09-23 |
| re-run: burgee/commander bundle vs commander (article: 1.520×)      | 59,421 / 39,084 = 1.520                                                                                                             | `node bundle.mjs`                                                                                                                           | burgee 0.10.0, commander 15.0.0, esbuild 0.28.2 | 2026-09-23 |
| re-run: cold start vs cac (article: 1.71–2.30×)                     | 2.301, 1.711, 1.956                                                                                                                 | `node cold.mjs 42`, three runs, load average 151-168                                                                                        | burgee 0.10.0, cac 7.0.0, Node 24.18.0          | 2026-09-23 |
| laptop load during the cold-start re-run (article: above 150)       | 151.79 to 167.75                                                                                                                    | `uptime` before each run                                                                                                                    | Apple M4 Pro, 14 cores                          | 2026-09-23 |
| burgee@0.10.0 on the registry (article: 05:34 UTC)                  | 2026-09-23T05:34:36.372Z                                                                                                            | `npm view burgee time --json`, key `0.10.0`                                                                                                 | burgee 0.10.0                                   | 2026-09-23 |
| linegauge@0.4.3 on the registry (article: 05:42 UTC, eight minutes) | 2026-09-23T05:42:49.846Z                                                                                                            | `npm view linegauge time --json`, key `0.4.3`; window 8 min 13 s                                                                            | linegauge 0.4.3                                 | 2026-09-23 |
| `npm i burgee` failed with ETARGET in that window                   | ETARGET on closeout@^0.4.0, observed 05:39:31 to 05:44:54 UTC                                                                       | `npm i --package-lock-only burgee`, polled every ~20 s                                                                                      | burgee 0.10.0                                   | 2026-09-23 |
| family needs Node 24                                                | >=24                                                                                                                                | `npm view <pkg> engines` for each of the nine                                                                                               | versions above                                  | 2026-09-23 |
| incumbent stack floor is Node 22.18                                 | ^22.18 or >=24                                                                                                                      | `npm view cosmiconfig engines` (the highest floor of the nine; commander is >=22.12.0)                                                      | cosmiconfig 10.0.1                              | 2026-09-23 |
| pnpm and yarn resolve the same counts                               | 70, 9, 28                                                                                                                           | `pnpm add --lockfile-only <stack>` counting `packages:` keys; `yarn add --ignore-scripts <stack>` counting `version` entries in `yarn.lock` | pnpm 10.17.0, yarn 1.22.22                      | 2026-09-23 |
| part 1's ESLint baseline (article: 69)                              | 69                                                                                                                                  | `sdlc/spec/eslint-plugin-dependency-weight.md`, first row                                                                                   | eslint latest at 2026-09-04                     | 2026-09-04 |

`bundle.mjs` is burgee B4's command re-run outside burgee: a fixture
`import { <symbol> } from '<specifier>'; export { <symbol> };` bundled with
`esbuild --bundle --minify --format=esm --platform=node --splitting`, bytes =
entry chunk plus chunks reached through `import-statement` edges.
`cold.mjs` is B2's shape: burgee's own fixtures from
`benchmarks/fixtures/cold-start/`, one discarded warm-up round, 42 interleaved
rounds with rotating start position, each spawning `node <fixture> greet ada`,
ratio of p50s. Both scripts were run in the scratch directory above and are
reproduced from those descriptions; neither changes burgee.

## Cross-check against burgee's published figures

Every disagreement found, with the reason. None is smoothed in the article.

| Figure                      | burgee publishes                                     | Measured here                                                                                                            | Why they differ                                                                                                                                                                                                                                                                                                                                                                                  |
| --------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| burgee runtime dependencies | 0 (README, comparison.mdx)                           | 5, all siblings                                                                                                          | The cell means "external". burgee has declared sibling dependencies since 0.5.0 (`npm view burgee@0.5.0 dependencies` returns roundel). The badge's "external dependencies 0" is exact; the table cell is not.                                                                                                                                                                                   |
| burgee installed            | 1154 KB                                              | 1169 KB (1,197,397 B)                                                                                                    | Version. 0.9.2 measured 1,188,994 B earlier the same day; 0.10.0 grew again.                                                                                                                                                                                                                                                                                                                     |
| yargs installed             | 515 KB (README), 526,898 B (benchmarks.mdx)          | 536,124 B                                                                                                                | Version: yargs 18.1.0 then, 18.2.0 now.                                                                                                                                                                                                                                                                                                                                                          |
| commander, cac installed    | 203 KB, 40 KB                                        | 207,368 B, 41,198 B                                                                                                      | Agree exactly.                                                                                                                                                                                                                                                                                                                                                                                   |
| cold start vs cac           | 1.443×                                               | 1.711 to 2.301×                                                                                                          | Machine and load. 1.443 is not in any committed results file; committed CI runs on 2026-09-22 read 1.431 to 1.508, burgee's own laptop runs 1.589 to 2.131. Mine ran at load 151-168. The gate is not met either way.                                                                                                                                                                            |
| burgee bundle               | 27,552 B, cac 10,457 B                               | 27,815 B, cac 10,452 B                                                                                                   | Published 0.10.0 against a dirty workspace commit (`fd0f6b2-dirty`); cac and esbuild versions identical. Ratio 2.636 vs 2.661.                                                                                                                                                                                                                                                                   |
| burgee/commander bundle     | 59,156 B, commander 39,085 B                         | 59,421 B, 39,084 B                                                                                                       | Same cause. Ratio 1.514 vs 1.520.                                                                                                                                                                                                                                                                                                                                                                |
| cosmiconfig ceiling         | 1,377,599 B (`foundation-ceilings.json`, 2026-09-17) | 1,832,269 B                                                                                                              | The ceiling equals `cosmiconfig@9.0.2` exactly (tree 17, re-measured here). A fresh `npm i cosmiconfig` resolves 10.0.1 (published 2026-08-30): tree 4, more bytes. burgee's walk resolved the copy hoisted in its own workspace, the trap `benchmarks/axes/weight.ts` documents. It understates the incumbent, i.e. it runs against burgee's own ratio.                                         |
| which ceiling               | 20,931 B                                             | 71,500 B                                                                                                                 | Same cause: equals `which@2.0.2` exactly; fresh install resolves 7.0.0.                                                                                                                                                                                                                                                                                                                          |
| dotenv ceiling              | 82,402 B                                             | 44,951 B                                                                                                                 | dotenv 18.0.3 published 2026-09-22, after the ceiling date; this one runs in burgee's favour.                                                                                                                                                                                                                                                                                                    |
| caique ceiling ratio        | 0.6718 (122,416 against @clack/prompts 182,219)      | tree-inclusive caique 309,382 B against @clack/prompts 182,472 B (`node measure.mjs clack @clack/prompts`, 1.8.1) = 1.70 | Method asymmetry: the ceilings file weighs "ours" as the package tarball alone and the incumbent tree-inclusive. For the six sibling-free packages the two are the same; caique depends on closeout and linegauge. Inside a burgee CLI those are already installed, so the tarball reading is the marginal cost; standalone, the tree reading is. Both are defensible; the file states only one. |

## Known traps pre-empted

- [x] **Export shape**: no package's API is imported in the article; the only
      code is shell and `node -e` one-liners, each run and checked above.
- [x] **Rule counts**: none claimed.
- [x] **Config option names**: none appear.
- [x] **Detection logic**: no rule behaviour is described. seniority's YAML
      behaviour is read from source (`cosmiconfig-defaults.ts`, `loadYaml`).
- [x] **Frozen identifiers**: unpublished; no `devto_id`.
- [x] **"Zero dependencies"**: stated as "no dependency outside the family";
      `npm i burgee` is six packages, printed as six.
- [x] **Registry drift mid-measurement**: every row re-measured after the
      0.10.0 release settled; versions pinned above.

## Outline

1. Hook: the one-per-layer install, 70 packages from 25 accounts, against 9
   from 1. Rows: stack-commander, family, both maintainer rows.
2. Layer by layer: the 18 per-package rows; "six of nine" row; the summed vs
   installed row.
3. Where the byte gap comes from: js-yaml row, seniority-YAML row, the three
   compat rows, the like-for-like stack, ratio and maintainer rows.
4. The three gates: nine published gates, the three published values, the
   three re-runs, the load row, the at-parity rows.
5. What zero means: the dependency rows, the README "0" row, the release
   window rows, the engines rows.
6. The method: the instruments; pnpm/yarn row; part 1's baseline row.

## Framing check

Landscape. The incumbents are named as the better option in two places the
article states outright: bytes like-for-like (2.4× in their favour) and Node 22
support. No banned vocabulary. The article discloses that the stacks are built
from burgee's own "Replaces" column and that the like-for-like cut uses
burgee's own compatibility oracle, i.e. fixtures drawn from our own design
surface, graded by the incumbents' own suites.
