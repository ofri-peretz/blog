---
slug: burgee-change-one-import
stage: spec
intent: sdlc/intent/burgee-change-one-import.md
status: draft
gathered: 2026-09-23
---

## Thesis

The intent claimed that one import specifier — `commander` to
`burgee/commander` — and no other edit makes a commander program answer
`--json`, `--schema`, `--mcp` and `completion <shell>`.

**The evidence moved the claim.** The tutorial program was built and run on
`commander@15.0.0`, then on `burgee@0.9.2` after the swap. Half of the claim
holds unmodified and half does not:

- **Holds with one import.** Behaviour is unchanged on every invocation
  compared (7 / 7 byte-identical on stdout, stderr and exit code). `--schema`
  returns the full tree with a JSON Schema per command. `--json` turns parse
  errors into a typed envelope with a `fix`. MCP `tools/list` lists every
  command, marked `effects: "undeclared"`. `completion` emits five shells.
- **Needs a second edit.** burgee's envelope wraps an action's _return value_;
  commander discards return values, so commander actions print and return
  nothing. `--json` then prints the prose line followed by `"data":null`, and
  an MCP `tools/call` writes that prose line onto the JSON-RPC stream. The fix
  is per command: return the result and keep prose off stdout for a machine.
- **Two defects in 0.9.2**, disclosed rather than routed around: an MCP tool
  call passes a multi-word option by its camelCased key (`--skipBlank`) and is
  refused; the generated completions offer `--no-<flag>` spellings the program
  refuses. Both sit in `packages/burgee/src/mcp.ts` (`optionArgs` pushes
  `--${name}` and ignores the advertised `flag`) and the completion emitters,
  unchanged between tag `burgee@0.9.2` and origin/main `6377897aaf`.

This is the intent's kill criterion 1 firing for the data half of `--json` and
`--mcp`, handled by its own "re-scope to a narrower claim" branch: the article's
claim is that one import makes the program **describe** itself to an agent, and
that **answering** takes a `return`. Criterion 2 held (1360 / 1360 against a
1360 / 1360 control). Criterion 3 held for `--schema` and MCP discovery.

## Ground truth

`REPRO` below is `node sdlc/spec/burgee-change-one-import.repro.mjs`, run from
the repo root. It writes the article's program, its swapped copy and its
second-edit copy into `$TMPDIR/blog-burgee-change-one-import-0.9.2`, installs
the pinned versions once, and prints one value per probe. The burgee rows read
the sibling checkout at `../burgee` (`git fetch` first).

| Claim                                                                | Value                                    | Command                                                                                                                                                                                                                                                         | Version                        | Verified   |
| -------------------------------------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ---------- |
| lines that differ between the original and the migration             | 1                                        | `node sdlc/spec/burgee-change-one-import.repro.mjs swap-changed-lines`                                                                                                                                                                                          | burgee 0.9.2, commander 15.0.0 | 2026-09-23 |
| invocations byte-identical on both (stdout, stderr, exit code)       | 7/7                                      | `node sdlc/spec/burgee-change-one-import.repro.mjs parity-identical`                                                                                                                                                                                            | burgee 0.9.2, commander 15.0.0 | 2026-09-23 |
| `count sample.txt` output                                            | 6 lines in sample.txt                    | `node sdlc/spec/burgee-change-one-import.repro.mjs count-plain`                                                                                                                                                                                                 | burgee 0.9.2                   | 2026-09-23 |
| `count sample.txt --skip-blank` output                               | 4 lines in sample.txt                    | `node sdlc/spec/burgee-change-one-import.repro.mjs count-skip-blank`                                                                                                                                                                                            | burgee 0.9.2                   | 2026-09-23 |
| usage error (missing argument) exit code on the façade               | 1                                        | `node sdlc/spec/burgee-change-one-import.repro.mjs usage-error-exit`                                                                                                                                                                                            | burgee 0.9.2                   | 2026-09-23 |
| usage error exit code in burgee's native syntax                      | 2                                        | `node sdlc/spec/burgee-change-one-import.repro.mjs native-usage-exit`                                                                                                                                                                                           | burgee 0.9.2                   | 2026-09-23 |
| `require('burgee/commander')` runs on Node 24 (count, `--json`)      | 6 lines in sample.txt, then the envelope | `node sdlc/spec/burgee-change-one-import.repro.mjs cjs-require`                                                                                                                                                                                                 | burgee 0.9.2, Node 24.18.0     | 2026-09-23 |
| yarn installs burgee and runs the swap (1 = ok)                      | 1                                        | `node sdlc/spec/burgee-change-one-import.repro.mjs pm-yarn`                                                                                                                                                                                                     | yarn 1.22.22                   | 2026-09-23 |
| pnpm installs burgee and runs the swap (1 = ok)                      | 1                                        | `node sdlc/spec/burgee-change-one-import.repro.mjs pm-pnpm`                                                                                                                                                                                                     | pnpm 10.34.5                   | 2026-09-23 |
| bun installs burgee and runs the swap (1 = ok)                       | 1                                        | `node sdlc/spec/burgee-change-one-import.repro.mjs pm-bun`                                                                                                                                                                                                      | bun 1.4.2                      | 2026-09-23 |
| yarn 1 on Node 22 refuses with the engines error (1 = yes)           | 1                                        | `node sdlc/spec/burgee-change-one-import.repro.mjs yarn1-node22-exit`                                                                                                                                                                                           | yarn 1.22.22, Node 22.22.0     | 2026-09-23 |
| TypeScript, `moduleResolution: node`: TS2307 on `burgee/commander`   | 1                                        | `node sdlc/spec/burgee-change-one-import.repro.mjs ts-node10-ts2307`                                                                                                                                                                                            | TypeScript 5.9.3               | 2026-09-23 |
| TypeScript, `moduleResolution: bundler`: any TS error                | 0                                        | `node sdlc/spec/burgee-change-one-import.repro.mjs ts-bundler-errors`                                                                                                                                                                                           | TypeScript 5.9.3               | 2026-09-23 |
| TypeScript, `moduleResolution: nodenext`: any TS error               | 0                                        | `node sdlc/spec/burgee-change-one-import.repro.mjs ts-nodenext-errors`                                                                                                                                                                                          | TypeScript 5.9.3               | 2026-09-23 |
| commander's declared Node floor                                      | >=22.12.0                                | `npm view commander@15.0.0 engines.node`                                                                                                                                                                                                                        | commander 15.0.0               | 2026-09-23 |
| burgee's declared Node floor                                         | >=24                                     | `npm view burgee@0.9.2 engines.node`                                                                                                                                                                                                                            | burgee 0.9.2                   | 2026-09-23 |
| commands in `--schema`                                               | 2                                        | `node sdlc/spec/burgee-change-one-import.repro.mjs schema-commands`                                                                                                                                                                                             | burgee 0.9.2                   | 2026-09-23 |
| typo under `--json`: suggested fix                                   | --skip-blank                             | `node sdlc/spec/burgee-change-one-import.repro.mjs json-typo-fix`                                                                                                                                                                                               | burgee 0.9.2                   | 2026-09-23 |
| typo under `--json`: exit code                                       | 1                                        | `node sdlc/spec/burgee-change-one-import.repro.mjs json-typo-exit`                                                                                                                                                                                              | burgee 0.9.2                   | 2026-09-23 |
| MCP `tools/list` on the untouched program: tools                     | 2                                        | `node sdlc/spec/burgee-change-one-import.repro.mjs mcp-tools-listed`                                                                                                                                                                                            | burgee 0.9.2                   | 2026-09-23 |
| ... of which marked `effects: "undeclared"`                          | 2                                        | `node sdlc/spec/burgee-change-one-import.repro.mjs mcp-undeclared-tools`                                                                                                                                                                                        | burgee 0.9.2                   | 2026-09-23 |
| `.effects('read_only')` yields `readOnlyHint`                        | true                                     | `node sdlc/spec/burgee-change-one-import.repro.mjs effects-read-only-hint`                                                                                                                                                                                      | burgee 0.9.2                   | 2026-09-23 |
| the same file on real commander (TypeError) exits                    | 1                                        | `node sdlc/spec/burgee-change-one-import.repro.mjs effects-on-commander-exit`                                                                                                                                                                                   | commander 15.0.0               | 2026-09-23 |
| completion shells that exit 0 (bash, zsh, fish, pwsh, fig)           | 5                                        | `node sdlc/spec/burgee-change-one-import.repro.mjs completion-shells-exit-0`                                                                                                                                                                                    | burgee 0.9.2                   | 2026-09-23 |
| completion flags offered that the program refuses                    | 2                                        | `node sdlc/spec/burgee-change-one-import.repro.mjs completion-offers-refused-flags`                                                                                                                                                                             | burgee 0.9.2                   | 2026-09-23 |
| untouched `count --json`: stdout lines (prose + envelope)            | 2                                        | `node sdlc/spec/burgee-change-one-import.repro.mjs json-untouched-stdout-lines`                                                                                                                                                                                 | burgee 0.9.2                   | 2026-09-23 |
| untouched `count --json`: envelope `data`                            | null                                     | `node sdlc/spec/burgee-change-one-import.repro.mjs json-untouched-data`                                                                                                                                                                                         | burgee 0.9.2                   | 2026-09-23 |
| untouched MCP `tools/call`: non-JSON lines on stdout                 | 1                                        | `node sdlc/spec/burgee-change-one-import.repro.mjs mcp-untouched-non-json-lines`                                                                                                                                                                                | burgee 0.9.2                   | 2026-09-23 |
| after the second edit: non-JSON lines on the MCP stream              | 0                                        | `node sdlc/spec/burgee-change-one-import.repro.mjs mcp-answering-non-json-lines`                                                                                                                                                                                | burgee 0.9.2                   | 2026-09-23 |
| after the second edit: `count --json` `data.lines`                   | 6                                        | `node sdlc/spec/burgee-change-one-import.repro.mjs answering-json-lines`                                                                                                                                                                                        | burgee 0.9.2                   | 2026-09-23 |
| after the second edit: MCP tool result `data.lines`                  | 6                                        | `node sdlc/spec/burgee-change-one-import.repro.mjs mcp-answering-lines`                                                                                                                                                                                         | burgee 0.9.2                   | 2026-09-23 |
| after the second edit: human output vs original                      | identical                                | `node sdlc/spec/burgee-change-one-import.repro.mjs answering-human-unchanged`                                                                                                                                                                                   | burgee 0.9.2, commander 15.0.0 | 2026-09-23 |
| lines the second edit adds to the whole file                         | 7                                        | `node sdlc/spec/burgee-change-one-import.repro.mjs answering-added-lines`                                                                                                                                                                                       | burgee 0.9.2                   | 2026-09-23 |
| MCP call with a multi-word option (defect)                           | unknown option '--skipBlank'             | `node sdlc/spec/burgee-change-one-import.repro.mjs mcp-kebab-option-error`                                                                                                                                                                                      | burgee 0.9.2                   | 2026-09-23 |
| runtime throw under `--json`: stdout bytes                           | 0                                        | `node sdlc/spec/burgee-change-one-import.repro.mjs runtime-throw-json-stdout-bytes`                                                                                                                                                                             | burgee 0.9.2                   | 2026-09-23 |
| docs still say undeclared commands are not served (matches)          | 1                                        | `git -C ../burgee grep -h -c "only when it declares" origin/main -- apps/docs/content/docs/agent-surfaces.mdx`                                                                                                                                                  | burgee 6377897aaf              | 2026-09-23 |
| oracle: `burgee/commander` passed / reference (control re-run below) | 1360/1360                                | `node -e "const j=JSON.parse(require('child_process').execSync('git -C ../burgee show origin/main:packages/compat-oracle/baseline/commander.json'));console.log(j.passed+'/'+j.reference)"`                                                                     | burgee 6377897aaf              | 2026-09-23 |
| vendored commander suite: release                                    | 15.0.0                                   | `node -e "const j=JSON.parse(require('child_process').execSync('git -C ../burgee show origin/main:packages/compat-oracle/vendor/commander/.source.json'));console.log(j.version)"`                                                                              | burgee 6377897aaf              | 2026-09-23 |
| vendored commander suite: files                                      | 110                                      | `node -e "const j=JSON.parse(require('child_process').execSync('git -C ../burgee show origin/main:packages/compat-oracle/vendor/commander/.source.json'));console.log(j.files)"`                                                                                | burgee 6377897aaf              | 2026-09-23 |
| `lighter-than-commander` bundle gate, measured ratio (not met)       | 1.514                                    | `node -e "const r=String(require('child_process').execSync('git -C ../burgee show origin/main:README.md'));console.log(r.match(/lighter-than-commander\x60 \x7c ([\d.]+)/)[1])"`                                                                                | burgee 6377897aaf              | 2026-09-23 |
| commander unpacked size, bytes                                       | 207368                                   | `npm view commander@15.0.0 dist.unpackedSize`                                                                                                                                                                                                                   | commander 15.0.0               | 2026-09-23 |
| burgee plus its dependencies, unpacked bytes                         | 1188994                                  | `node -e "Promise.all(['burgee/0.9.2','bellpull/0.2.2','closeout/0.3.2','linegauge/0.4.2','roundel/0.4.2','seniority/0.4.2'].map(p=>fetch('https://registry.npmjs.org/'+p).then(r=>r.json()))).then(a=>console.log(a.reduce((t,m)=>t+m.dist.unpackedSize,0)))"` | burgee 0.9.2                   | 2026-09-23 |
| burgee's runtime dependencies (all from its own repo)                | 5                                        | `node -e "console.log(Object.keys(JSON.parse(require('child_process').execSync('npm view burgee@0.9.2 dependencies --json'))).length)"`                                                                                                                         | burgee 0.9.2                   | 2026-09-23 |

npm itself is the fourth package manager: `setup()` installs with it and every
other probe runs on that install. `pm-matrix` prints all four at once (`4/4`)
but can exceed the detector's 60-second budget on a cold cache, so the table
carries one row per manager instead. npm on Node 22 only warns (`EBADENGINE`)
and installs; yarn 1 exits 1.

### burgee 0.10.0 landed the same day

`burgee@0.10.0` reached npm `latest` at 2026-09-23T05:34Z, after this spec was
gathered. The article pins its install to `0.9.2`, so every claim holds as
written. Re-pinning is one command, and on 0.10.0 every behavioural probe
returns the same value, both defects included:
`BURGEE_VERSION=0.10.0 node sdlc/spec/burgee-change-one-import.repro.mjs all`.
The install size does move (closeout goes to `^0.4.0`), so the size row would
need re-measuring on a re-pin.

### The oracle re-run

The intent required the rate to be re-measured, not quoted. In a detached
worktree of burgee at `6377897aaf` (origin/main, 2026-09-22), Node 24.18.0,
after `npm ci` and `npx turbo run build --filter=burgee...`:

```console
$ npm run compat -- commander --control
control — each host graded against its real package
  commander    ████████████████████████  1360 / 1360  100.0% ▲ 0   (1 skipped on this OS)

$ npm run compat -- commander
compatibility
  commander    ████████████████████████  1360 / 1360  100.0% ▲ 0   (1 skipped on this OS)
```

The `baseline/commander.json` row above is the committed record of the same
figure, which is what the weekly detector can re-read without a build. The
façade and MCP sources the grade exercises are byte-identical between tag
`burgee@0.9.2` (what `npm i burgee` installs) and `6377897aaf`:
`git -C ../burgee diff --stat burgee@0.9.2 origin/main -- packages/burgee/src/commander packages/burgee/src/mcp.ts` prints nothing.

### Every code block in the article was run

In the repro directory, on Node 24.18.0 with `jq` 1.7: the install block,
run from an empty directory (`npm install commander@15.0.0 burgee@0.9.2`,
`npm pkg set type=module`, `cp`, and the `printf` that writes `sample.txt`,
byte-identical to the repro's `SAMPLE`; afterwards all seven parity argv
match on stdout, stderr and exit code), the `diff <(…) <(…)`
help comparison, `--schema | jq -c '.commands[0].inputSchema'`, the
`--skp-blank --json` typo, `tools/list` through `jq -c`, the untouched and
the second-edit `count --json`, and the `tools/call` with `skipBlank`. Output
is pasted verbatim. The second-edit diff in the article is an excerpt of
`cli.answering.js` against `cli.js` (the `longest` command gets the same two
changes); the repro script builds the full file.

## Known traps pre-empted

- [x] **Export shape** — `import { Command } from 'burgee/commander'` is a
      named export, as in commander; `program`, `Option`, `Argument` and
      `createCommand` are also named exports of the subpath
      (`node_modules/burgee/dist/commander.d.ts`).
- [x] **Rule counts** — none in this article.
- [x] **Config option names** — none; the only non-commander API shown,
      `.effects('read_only')`, was run and its output recorded.
- [x] **Detection logic** — the MCP defect was read, not inferred:
      `optionArgs` in `packages/burgee/src/mcp.ts` iterates `node.options` and
      pushes `--${name}`, the camelCased key, never the schema's `flag`.
- [x] **Frozen identifiers** — new article, no `devto_id`. The slug is the
      intent's, `burgee-change-one-import`.
- [x] **Docs drift** — burgee's `agent-surfaces`, `vs/commander` and package
      README FAQ say an undeclared command is not served over MCP. 0.9.2 serves
      it, marked `effects: "undeclared"` (and `facade-surface.test.ts` pins the
      new behaviour). The article follows the running code and names the drift.
- [x] **Numbers not taken from burgee's README** — the README's 1154 KB
      installed size (2026-09-09) is not used; the article's 1,188,994 bytes is
      today's sum over the six published tarballs.

## Outline

1. Hook: the one-line diff, what stayed identical, and `"data":null` — rows
   _lines that differ_, _7/7_, _untouched `data`_.
2. The program — the file `ORIGINAL` in the repro script, verbatim.
3. The swap — install matrix (_pm-yarn/pnpm/bun_), CommonJS (_cjs-require_),
   TypeScript resolvers (_1_ / _0_ / _0_), help diff and parity (_7/7_), exit
   codes (_1_ vs native _2_), Node floors and yarn 1 on Node 22 (_exit 1_).
4. What answers with no other edit — `--schema` (_2 commands_), typed errors
   (_fix_, _exit 1_), MCP discovery (_2 tools, 2 undeclared_), `.effects`
   (_true_, and _exit 1_ on commander), completions (_5_).
5. Where one import stops — _2 stdout lines_, _null_, _1 non-JSON line_; the
   second edit; after it _6_, _6_, _0_, _identical_.
6. Two defects — _--skipBlank_, _2 refused flags_; runtime throw (_0 bytes_);
   docs drift (_1_).
7. What the grade covers — _1360/1360_, _15.0.0_, _110 files_.
8. When commander alone is the right size — _207368_, _1188994_, _5 deps_,
   _1.514_.

## Framing check

Landscape. commander is the incumbent this façade is graded against, not an
opponent: the article's last section is where commander alone is the
better-sized choice, with burgee's own unmet gate quoted, and it says plainly
that the swap buys nothing for a CLI no agent calls. The fixtures are ours
(our program, our sample file) and the grading suite is commander's; the two
defects are ours and are named. No banned vocabulary.
