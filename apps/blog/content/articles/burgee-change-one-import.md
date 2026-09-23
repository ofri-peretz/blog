---
devto_url: "https://dev.to/ofri-peretz/one-import-moves-a-commander-cli-to-burgee-json-still-says-null-6h8"
devto_id: 4726357
title: "One Import Moves a commander CLI to burgee. --json Still Says null."
description: "Swapping commander for burgee/commander kept 7 of 7 invocations byte-identical and added --schema, MCP and completions. Getting data out took a return."
slug: "burgee-change-one-import"
published: true
canonical_url: "https://ofriperetz.dev/articles/burgee-change-one-import"
cover_image: "https://ofriperetz.dev/cdn/blog-cover-image/burgee-change-one-import.jpg"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/burgee-change-one-import-og.jpg"
tier: "TUTORIAL"
reading_time_minutes: 4
tags:
  - "node"
  - "javascript"
  - "webdev"
  - "ai"
series: null
author:
quality:
  panel_version: "1.0.0"
  reviewed: "2026-09-23"
  spec: sdlc/spec/burgee-change-one-import.md
  lenses:
    growth_hook: 9.6
    security_correctness: 9.6
    structure_framing_voice: 9.6
    compatibility: 9.6
    reproducibility: 9.6
---

I changed one line in a commander CLI:

```diff
- import { Command } from "commander";
+ import { Command } from "burgee/commander";
```

Help, output, errors and exit codes stayed byte-identical on seven invocations. The same file also answers `--schema`, `--mcp` and `completion <shell>`. And `--json` answers `"data":null`.

One import describes the CLI to an agent; answering takes a `return`. I [maintain burgee](https://ofriperetz.dev/articles/i-built-what-i-benchmark-heres-how-i-try-not-to-cheat); everything below ran on `commander@15.0.0` and `burgee@0.11.1`.

## The program {#program}

Plain commander, ESM, as `cli.commander.js`:

```js
#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { Command } from "commander";

const program = new Command();
program
  .name("lines")
  .description("Count and rank the lines in a text file")
  .version("1.0.0");

program
  .command("count")
  .description("count the lines in a file")
  .argument("<file>", "file to read")
  .option("--skip-blank", "ignore empty lines")
  .action((file, opts) => {
    let lines = readFileSync(file, "utf8").trimEnd().split("\n");
    if (opts.skipBlank) lines = lines.filter((l) => l.trim() !== "");
    console.log(`${lines.length} lines in ${file}`);
  });

program
  .command("longest")
  .description("print the longest lines in a file")
  .argument("<file>", "file to read")
  .option("-n, --top <count>", "how many lines to show", "3")
  .action((file, opts) => {
    const lines = readFileSync(file, "utf8").trimEnd().split("\n");
    const top = lines
      .sort((a, b) => b.length - a.length)
      .slice(0, Number(opts.top));
    for (const line of top)
      console.log(`${String(line.length).padStart(4)}  ${line}`);
  });

program.parse();
```

## The swap {#swap}

```bash
npm install commander@15.0.0 burgee@0.11.1   # or: yarn/pnpm/bun add
npm pkg set type=module
cp cli.commander.js cli.js
printf 'alpha\n\nbravo charlie\ndelta echo foxtrot golf\n\nhotel\n' > sample.txt
```

All four work, as does `require()`. TypeScript's legacy `node` resolver cannot see the subpath. After the import swap in `cli.js`:

```console
$ diff <(node cli.commander.js --help) <(node cli.js --help) && echo identical
identical
```

Same for `count --help`, both commands, a missing argument and a typo. Usage errors still exit `1`; burgee's native exit `2` for "rewrite the command" does not come with the swap. Once `commander` leaves `dependencies`, the declared Node range goes from `>=22.12.0` to `^20.19.0 || >=22.13.0`. The swapped file ran on Node 20 and 22; only 22.12.x drops out.

## What answers with no other edit {#free}

**`--schema`**: the command tree as data, [a JSON Schema per command](https://ofriperetz.dev/articles/securing-ai-agents-in-the-vercel-ai-sdk):

```console
$ node cli.js --schema | jq -c '.commands[0].inputSchema'
{"type":"object","properties":{"file":{"type":"string","description":"file to read"},"skipBlank":{"type":"boolean","flag":"--skip-blank","description":"ignore empty lines"}},"required":["file"],"additionalProperties":false}
```

**Errors under `--json`**: typed, with the fix:

```console
$ node cli.js count sample.txt --skp-blank --json
{"ok":false,"error":{"code":"commander.unknownOption","message":"unknown option '--skp-blank'","fix":"--skip-blank"}}
```

**[MCP](https://modelcontextprotocol.io) discovery**: every command becomes a tool, and an undeclared one says so instead of guessing a hint:

```console
$ echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node cli.js --mcp | jq -c '.result.tools[] | {name, annotations}'
{"name":"count","annotations":{"effects":"undeclared"}}
{"name":"longest","annotations":{"effects":"undeclared"}}
```

`.effects("read_only")` on `count` yields `readOnlyHint: true`. That call is a one-way door: real commander throws a `TypeError`.

**Completions**: `completion <shell>` for bash, zsh, fish, pwsh and fig, as static output.

## Where one import stops {#return}

```console
$ node cli.js count sample.txt --json
6 lines in sample.txt
{"ok":true,"data":null,"meta":{"provenance":{}}}
```

burgee's envelope wraps what an action _returns_. commander discards return values, so commander programs rarely write one. Under `--mcp`, that printed line lands on the JSON-RPC stream, where no client can parse it.

The second edit, in `cli.answering.js`: return the result, and keep prose off stdout when a machine asked:

```diff
+const machine = ["--json", "--mcp"].some((f) => process.argv.includes(f));
+const say = (text) => {
+  if (!machine) console.log(text);
+};
 ...
-    console.log(`${lines.length} lines in ${file}`);
+    say(`${lines.length} lines in ${file}`);
+    return { file, lines: lines.length };
```

```console
$ node cli.answering.js count sample.txt --json
{"ok":true,"data":{"file":"sample.txt","lines":6},"meta":{"provenance":{}}}
```

Humans still see `6 lines in sample.txt`. MCP tool calls get the same envelope. The `argv` test is crude. 0.11.1's façade has no public "machine asked?" flag yet.

## Two defects, fixed in 0.11.1 {#defects}

Drafting on 0.9.2, I hit two defects in what the swap adds. An MCP call ignored the schema's `"flag":"--skip-blank"` and passed `--skipBlank`, which the program refused. Completions offered `--no-skip-blank` and `--no-version`, likewise refused. I fixed both in 0.11.1. The same call now answers:

```console
$ echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"count","arguments":{"file":"sample.txt","skipBlank":true}}}' | node cli.answering.js --mcp | jq -r '.result.content[0].text'
{"ok":true,"data":{"file":"sample.txt","lines":4},"meta":{"provenance":{"skipBlank":{"source":"flag"}}}}
```

Still open: an action's throw stays uncaught under `--json`.

## What the grade covers {#graded}

[commander's own suite](https://github.com/tj/commander.js/tree/v15.0.0/tests) (v15.0.0, 110 files, unmodified) runs against `burgee/commander` next to a control on real commander. Re-run for this article: **1360 / 1360**, control 1360 / 1360. That grade measures what you _keep_. The two defects sat in what you _gain_, which commander's tests cannot see.

## When commander alone is the right size {#size}

On disk, commander 15.0.0 unpacks to 207,368 bytes; burgee 0.11.1 and the [five sibling packages](https://ofriperetz.dev/articles/burgee-zero-dependency-cli-stack) it installs, to 1,266,628. In a bundle, burgee's own `lighter-than-commander` gate reads **not met, 1.514×**. If no agent will call your CLI, commander is the smaller choice.

[burgee vs commander](https://burgee.interlace.tools/docs/vs/commander) · [compatibility](https://burgee.interlace.tools/docs/compatibility) · [source](https://github.com/ofri-peretz/burgee)

_Which command in your CLI prints something an agent currently scrapes with a regex, and what would returning it instead break?_
