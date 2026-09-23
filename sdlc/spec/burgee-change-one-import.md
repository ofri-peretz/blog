---
slug: burgee-change-one-import
stage: spec
intent: sdlc/intent/burgee-change-one-import.md
status: draft
gathered: 2026-09-23
---

## Thesis

The intent claimed that changing one import specifier (`commander` to
`burgee/commander`), and making no other edit, lets a commander program answer
`--json`, `--schema`, `--mcp` and `completion <shell>`.

**The evidence moved the claim.** The tutorial program was built and run on
`commander@15.0.0`, then swapped to burgee. It was first run on `0.9.2`. After
the two defects below were fixed, the whole tutorial was re-run on `0.11.1`,
which is the version the article now pins. Half of the claim holds unmodified
and half does not:

- **Holds with one import.** Behaviour is unchanged on every invocation
  compared: 7 / 7 byte-identical on stdout, stderr and exit code. `--schema`
  returns the full tree with a JSON Schema per command. `--json` turns parse
  errors into a typed envelope with a `fix`. MCP `tools/list` lists every
  command, marked `effects: "undeclared"`. `completion` emits five shells.
- **Needs a second edit. This is by design and unchanged in 0.11.1.** burgee's
  envelope wraps an action's _return value_, but commander discards return
  values, so commander actions print and return nothing. `--json` then prints
  the prose line followed by `"data":null`. An MCP `tools/call` writes that
  prose line onto the JSON-RPC stream; a fix for the stream is in progress
  upstream and not yet released. The fix in the program is per command: return
  the result, and keep prose off stdout when a machine is calling.
- **Two defects found on 0.9.2, both fixed in 0.11.1.** First, an MCP tool
  call passed a multi-word option by its camelCased key (`--skipBlank`), and
  the program refused it. Second, the completions offered `--no-<flag>`
  spellings the program refused. On 0.11.1 the call arrives as `--skip-blank`
  (the `skipBlank: true` row returns 4 lines), and completions offer 0 refused
  flags. The article reports both as found and fixed.

This is the intent's kill criterion 1 firing for the data half of `--json` and
`--mcp`, handled by that criterion's "re-scope to a narrower claim" branch. The
article's claim is now that one import makes the program **describe** itself to
an agent, and that **answering** takes a `return`. Criterion 2 held: 1360 / 1360
against a 1360 / 1360 control, re-run at the `burgee@0.11.1` tag. Criterion 3
held for `--schema` and MCP discovery.

## Ground truth

Every behavioural row runs one probe of
`sdlc/spec/burgee-change-one-import.repro.mjs` from the repo root. The script
writes three versions of the program into
`$TMPDIR/blog-burgee-change-one-import-0.11.1`: the article's original, its
swapped copy, and its second-edit copy. It installs the pinned versions once
(`--prefer-online`) and prints one value per probe. The burgee rows read the
sibling checkout at `../burgee` at tag `burgee@0.11.1`; run `git fetch --tags`
first. The Node 20 and 22 rows need those binaries, from `$NODE20` / `$NODE22`
or from nvm.

| Claim                                                                | Value                 | Command                                                                                                                                                                                                                                                          | Version                         | Verified   |
| -------------------------------------------------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | ---------- |
| lines that differ between the original and the migration             | 1                     | `node sdlc/spec/burgee-change-one-import.repro.mjs swap-changed-lines`                                                                                                                                                                                           | burgee 0.11.1, commander 15.0.0 | 2026-09-23 |
| invocations byte-identical on both (stdout, stderr, exit code)       | 7/7                   | `node sdlc/spec/burgee-change-one-import.repro.mjs parity-identical`                                                                                                                                                                                             | burgee 0.11.1, commander 15.0.0 | 2026-09-23 |
| `count sample.txt` output                                            | 6 lines in sample.txt | `node sdlc/spec/burgee-change-one-import.repro.mjs count-plain`                                                                                                                                                                                                  | burgee 0.11.1                   | 2026-09-23 |
| `count sample.txt --skip-blank` output                               | 4 lines in sample.txt | `node sdlc/spec/burgee-change-one-import.repro.mjs count-skip-blank`                                                                                                                                                                                             | burgee 0.11.1                   | 2026-09-23 |
| usage error (missing argument) exit code on the façade               | 1                     | `node sdlc/spec/burgee-change-one-import.repro.mjs usage-error-exit`                                                                                                                                                                                             | burgee 0.11.1                   | 2026-09-23 |
| usage error exit code in burgee's native syntax                      | 2                     | `node sdlc/spec/burgee-change-one-import.repro.mjs native-usage-exit`                                                                                                                                                                                            | burgee 0.11.1                   | 2026-09-23 |
| `require('burgee/commander')` runs on Node 24 (first stdout line)    | 6 lines in sample.txt | `node sdlc/spec/burgee-change-one-import.repro.mjs cjs-require`                                                                                                                                                                                                  | burgee 0.11.1, Node 24.18.0     | 2026-09-23 |
| yarn installs burgee and runs the swap (1 = ok)                      | 1                     | `node sdlc/spec/burgee-change-one-import.repro.mjs pm-yarn`                                                                                                                                                                                                      | yarn 1.22.22                    | 2026-09-23 |
| pnpm installs burgee and runs the swap (1 = ok)                      | 1                     | `node sdlc/spec/burgee-change-one-import.repro.mjs pm-pnpm`                                                                                                                                                                                                      | pnpm 10.34.5                    | 2026-09-23 |
| bun installs burgee and runs the swap (1 = ok)                       | 1                     | `node sdlc/spec/burgee-change-one-import.repro.mjs pm-bun`                                                                                                                                                                                                       | bun 1.4.2                       | 2026-09-23 |
| the swapped file runs on Node 20 (1 = ok)                            | 1                     | `node sdlc/spec/burgee-change-one-import.repro.mjs node20-swap-runs`                                                                                                                                                                                             | burgee 0.11.1, Node 20.19.5     | 2026-09-23 |
| the swapped file runs on Node 22 (1 = ok)                            | 1                     | `node sdlc/spec/burgee-change-one-import.repro.mjs node22-swap-runs`                                                                                                                                                                                             | burgee 0.11.1, Node 22.22.0     | 2026-09-23 |
| TypeScript, `moduleResolution: node`: TS2307 on `burgee/commander`   | 1                     | `node sdlc/spec/burgee-change-one-import.repro.mjs ts-node10-ts2307`                                                                                                                                                                                             | TypeScript 5.9.3                | 2026-09-23 |
| TypeScript, `moduleResolution: bundler`: any TS error                | 0                     | `node sdlc/spec/burgee-change-one-import.repro.mjs ts-bundler-errors`                                                                                                                                                                                            | TypeScript 5.9.3                | 2026-09-23 |
| TypeScript, `moduleResolution: nodenext`: any TS error               | 0                     | `node sdlc/spec/burgee-change-one-import.repro.mjs ts-nodenext-errors`                                                                                                                                                                                           | TypeScript 5.9.3                | 2026-09-23 |
| commander's declared Node floor                                      | >=22.12.0             | `npm view commander@15.0.0 engines.node`                                                                                                                                                                                                                         | commander 15.0.0                | 2026-09-23 |
| burgee's declared Node range (two alternatives, joined by `or` here) | ^20.19.0 or >=22.13.0 | `npm view burgee@0.11.1 engines.node`                                                                                                                                                                                                                            | burgee 0.11.1                   | 2026-09-23 |
| commands in `--schema`                                               | 2                     | `node sdlc/spec/burgee-change-one-import.repro.mjs schema-commands`                                                                                                                                                                                              | burgee 0.11.1                   | 2026-09-23 |
| typo under `--json`: suggested fix                                   | --skip-blank          | `node sdlc/spec/burgee-change-one-import.repro.mjs json-typo-fix`                                                                                                                                                                                                | burgee 0.11.1                   | 2026-09-23 |
| typo under `--json`: exit code                                       | 1                     | `node sdlc/spec/burgee-change-one-import.repro.mjs json-typo-exit`                                                                                                                                                                                               | burgee 0.11.1                   | 2026-09-23 |
| MCP `tools/list` on the untouched program: tools                     | 2                     | `node sdlc/spec/burgee-change-one-import.repro.mjs mcp-tools-listed`                                                                                                                                                                                             | burgee 0.11.1                   | 2026-09-23 |
| ... of which marked `effects: "undeclared"`                          | 2                     | `node sdlc/spec/burgee-change-one-import.repro.mjs mcp-undeclared-tools`                                                                                                                                                                                         | burgee 0.11.1                   | 2026-09-23 |
| `.effects('read_only')` yields `readOnlyHint`                        | true                  | `node sdlc/spec/burgee-change-one-import.repro.mjs effects-read-only-hint`                                                                                                                                                                                       | burgee 0.11.1                   | 2026-09-23 |
| the same file on real commander (TypeError) exits                    | 1                     | `node sdlc/spec/burgee-change-one-import.repro.mjs effects-on-commander-exit`                                                                                                                                                                                    | commander 15.0.0                | 2026-09-23 |
| completion shells that exit 0 (bash, zsh, fish, pwsh, fig)           | 5                     | `node sdlc/spec/burgee-change-one-import.repro.mjs completion-shells-exit-0`                                                                                                                                                                                     | burgee 0.11.1                   | 2026-09-23 |
| completion flags offered that the program refuses (2 on 0.9.2)       | 0                     | `node sdlc/spec/burgee-change-one-import.repro.mjs completion-offers-refused-flags`                                                                                                                                                                              | burgee 0.11.1                   | 2026-09-23 |
| untouched `count --json`: stdout lines (prose + envelope)            | 2                     | `node sdlc/spec/burgee-change-one-import.repro.mjs json-untouched-stdout-lines`                                                                                                                                                                                  | burgee 0.11.1                   | 2026-09-23 |
| untouched `count --json`: envelope `data`                            | null                  | `node sdlc/spec/burgee-change-one-import.repro.mjs json-untouched-data`                                                                                                                                                                                          | burgee 0.11.1                   | 2026-09-23 |
| untouched MCP `tools/call`: non-JSON lines on stdout                 | 1                     | `node sdlc/spec/burgee-change-one-import.repro.mjs mcp-untouched-non-json-lines`                                                                                                                                                                                 | burgee 0.11.1                   | 2026-09-23 |
| after the second edit: non-JSON lines on the MCP stream              | 0                     | `node sdlc/spec/burgee-change-one-import.repro.mjs mcp-answering-non-json-lines`                                                                                                                                                                                 | burgee 0.11.1                   | 2026-09-23 |
| after the second edit: `count --json` `data.lines`                   | 6                     | `node sdlc/spec/burgee-change-one-import.repro.mjs answering-json-lines`                                                                                                                                                                                         | burgee 0.11.1                   | 2026-09-23 |
| after the second edit: MCP tool result `data.lines`                  | 6                     | `node sdlc/spec/burgee-change-one-import.repro.mjs mcp-answering-lines`                                                                                                                                                                                          | burgee 0.11.1                   | 2026-09-23 |
| after the second edit: human output vs original                      | identical             | `node sdlc/spec/burgee-change-one-import.repro.mjs answering-human-unchanged`                                                                                                                                                                                    | burgee 0.11.1, commander 15.0.0 | 2026-09-23 |
| lines the second edit adds to the whole file                         | 7                     | `node sdlc/spec/burgee-change-one-import.repro.mjs answering-added-lines`                                                                                                                                                                                        | burgee 0.11.1                   | 2026-09-23 |
| MCP call with `skipBlank: true`: `data.lines` (refused on 0.9.2)     | 4                     | `node sdlc/spec/burgee-change-one-import.repro.mjs mcp-kebab-option-lines`                                                                                                                                                                                       | burgee 0.11.1                   | 2026-09-23 |
| runtime throw under `--json`: stdout bytes                           | 0                     | `node sdlc/spec/burgee-change-one-import.repro.mjs runtime-throw-json-stdout-bytes`                                                                                                                                                                              | burgee 0.11.1                   | 2026-09-23 |
| oracle: `burgee/commander` passed / reference (control re-run below) | 1360/1360             | `node -e "const j=JSON.parse(require('child_process').execSync('git -C ../burgee show burgee@0.11.1:packages/compat-oracle/baseline/commander.json'));console.log(j.passed+'/'+j.reference)"`                                                                    | burgee tag burgee@0.11.1        | 2026-09-23 |
| vendored commander suite: release                                    | 15.0.0                | `node -e "const j=JSON.parse(require('child_process').execSync('git -C ../burgee show burgee@0.11.1:packages/compat-oracle/vendor/commander/.source.json'));console.log(j.version)"`                                                                             | burgee tag burgee@0.11.1        | 2026-09-23 |
| vendored commander suite: files                                      | 110                   | `node -e "const j=JSON.parse(require('child_process').execSync('git -C ../burgee show burgee@0.11.1:packages/compat-oracle/vendor/commander/.source.json'));console.log(j.files)"`                                                                               | burgee tag burgee@0.11.1        | 2026-09-23 |
| `lighter-than-commander` bundle gate, measured ratio (not met)       | 1.514                 | `node -e "const r=String(require('child_process').execSync('git -C ../burgee show burgee@0.11.1:README.md'));console.log(r.match(/lighter-than-commander\x60 \x7c ([\d.]+)/)[1])"`                                                                               | burgee tag burgee@0.11.1        | 2026-09-23 |
| commander unpacked size, bytes                                       | 207368                | `npm view commander@15.0.0 dist.unpackedSize`                                                                                                                                                                                                                    | commander 15.0.0                | 2026-09-23 |
| burgee plus the five packages it installs, unpacked bytes            | 1266628               | `node -e "Promise.all(['burgee/0.11.1','bellpull/0.3.1','closeout/0.5.1','linegauge/0.5.1','roundel/0.5.1','seniority/0.5.1'].map(p=>fetch('https://registry.npmjs.org/'+p).then(r=>r.json()))).then(a=>console.log(a.reduce((t,m)=>t+m.dist.unpackedSize,0)))"` | burgee 0.11.1                   | 2026-09-23 |
| burgee's runtime dependencies (all from its own repo)                | 5                     | `node -e "console.log(Object.keys(JSON.parse(require('child_process').execSync('npm view burgee@0.11.1 dependencies --json'))).length)"`                                                                                                                         | burgee 0.11.1                   | 2026-09-23 |

npm is the fourth package manager. `setup()` installs with it, and every other
probe runs on that install. `pm-matrix` prints all four at once (`4/4`) for a
person to read. The table instead carries one row per manager, so that each row
fits the detector's 60-second budget.

The Node range: commander 15 declares `>=22.12.0`, and burgee 0.11.1 declares
`^20.19.0 || >=22.13.0`. The swapped file runs on Node 20.19 and on Node 22
(rows above). The range is therefore wider at the bottom, and the only versions
it drops are Node 22.12.x.

### History: 0.9.2 and 0.10.0

The first draft was gathered on `burgee@0.9.2`. That version declared engines
`>=24`, and yarn 1 on Node 22 refused to install it. On 0.9.2, the MCP call with
`skipBlank` returned `unknown option '--skipBlank'`. The fish completions
offered `--no-skip-blank` and `--no-version`, and the program refused both.
`0.10.0` behaved the same way. To replay an earlier version, run
`BURGEE_VERSION=0.9.2 node sdlc/spec/burgee-change-one-import.repro.mjs all`.
Only the two defect probes differ from the 0.11.1 table, and they return the
values recorded here.

### The oracle re-run

The intent required the rate to be re-measured, not quoted. The run below is
from a detached worktree of burgee at tag `burgee@0.11.1` (`192a5f06f6`), on
Node 24.18.0, after `npm ci` and `npx turbo run build --filter=burgee...`:

```console
$ npm run compat -- commander --control
  commander    ████████████████████████  1360 / 1360  100.0% ▲ 0   (1 skipped on this OS)

$ npm run compat -- commander
  commander    ████████████████████████  1360 / 1360  100.0% ▲ 0   (1 skipped on this OS)
```

The same run at `6377897aaf` (the commit whose façade shipped as 0.9.2) gave
the same figures. The `baseline/commander.json` row is the committed record of
this result, which the weekly detector can re-read without a build.

### Every code block in the article was run

Everything below ran on Node 24.18.0 with `jq` 1.7, against `burgee@0.11.1`:

- The install block, run from an empty directory: `npm install
commander@15.0.0 burgee@0.11.1`, `npm pkg set type=module`, `cp`, and the
  `printf` that writes `sample.txt`. That file is byte-identical to the repro's
  `SAMPLE`. Afterwards, all seven parity invocations match on stdout, stderr and
  exit code.
- The `diff <(…) <(…)` help comparison.
- `--schema | jq -c '.commands[0].inputSchema'`.
- The `--skp-blank --json` typo.
- `tools/list` through `jq -c`.
- `count --json`, on both the untouched program and the second-edit program.
- The `tools/call` with `skipBlank`.

Output is pasted verbatim. The second-edit diff in the article is an excerpt of
`cli.answering.js` against `cli.js`; the `longest` command gets the same two
changes, and the repro script builds the full file.

## Known traps pre-empted

- [x] **Export shape**: `import { Command } from 'burgee/commander'` is a
      named export, as in commander. `program`, `Option`, `Argument` and
      `createCommand` are also named exports of the subpath
      (`node_modules/burgee/dist/commander.d.ts`).
- [x] **Rule counts**: none in this article.
- [x] **Config option names**: none. The only non-commander API shown is
      `.effects('read_only')`, which was run and its output recorded.
- [x] **Detection logic**: the 0.9.2 MCP defect was found by reading the
      source, not by guessing. `optionArgs` in `packages/burgee/src/mcp.ts`
      pushed `--${name}`, the camelCased key, and never used the schema's
      `flag`. 0.11.1's docs now state that a tool call is turned back into the
      advertised flag, and the probe confirms it.
- [x] **Frozen identifiers**: this is a new article with no `devto_id`. The
      slug is the intent's, `burgee-change-one-import`.
- [x] **Docs drift**: 0.9.2's docs said an undeclared command was not served
      over MCP. 0.11.1's `agent-surfaces.mdx` documents what the code actually
      does (such a command is listed, with `effects: 'undeclared'`), so the
      article no longer needs the caveat.
- [x] **Numbers not taken from burgee's README**: the README's installed-size
      figure is not used. The article's 1,266,628 bytes is today's sum over
      the six published tarballs.

## Outline

1. Hook: the one-line diff, what stayed identical, and `"data":null`. Rows:
   _lines that differ_, _7/7_, _untouched `data`_.
2. The program: the file `ORIGINAL` in the repro script, verbatim.
3. The swap: install matrix (_pm-yarn/pnpm/bun_), CommonJS (_cjs-require_),
   TypeScript resolvers (_1_ / _0_ / _0_), help diff and parity (_7/7_), exit
   codes (_1_ vs native _2_), Node ranges and the Node 20 / 22 runs.
4. What answers with no other edit: `--schema` (_2 commands_), typed errors
   (_fix_, _exit 1_), MCP discovery (_2 tools, 2 undeclared_), `.effects`
   (_true_, and _exit 1_ on commander), completions (_5_).
5. Where one import stops: _2 stdout lines_, _null_, _1 non-JSON line_; the
   second edit; after it, _6_, _6_, _0_, _identical_.
6. Two defects, fixed in 0.11.1: the history section; now _4_ lines and _0_
   refused flags; runtime throw (_0 bytes_).
7. What the grade covers: _1360/1360_, _15.0.0_, _110 files_.
8. When commander alone is the right size: _207368_, _1266628_, _5 deps_,
   _1.514_.

## Framing check

Landscape. commander is the incumbent this façade is graded against, not an
opponent. The article's last section covers the case where commander alone is
the better-sized choice, and quotes burgee's own unmet size gate. The fixtures
are ours (our program and our sample file), and the grading suite is
commander's. The two defects were ours; the article names them and shows the
fixes working rather than just asserting them. No banned vocabulary.
