#!/usr/bin/env node
// Reproduces every behavioural number in sdlc/spec/burgee-change-one-import.md.
//
// The article is a tutorial, so its evidence is not a count read out of a repo:
// it is what a real program does before and after one import changes. This
// script builds that program in a temp directory with pinned versions, runs the
// same argv the article runs, and prints ONE value per probe so the stage-6
// detector (scripts/sdlc/detect-stale-claims.mjs) can re-check it weekly.
//
//   node sdlc/spec/burgee-change-one-import.repro.mjs <probe>
//   node sdlc/spec/burgee-change-one-import.repro.mjs all      # every probe
//
// First run installs commander@15.0.0 and burgee@0.9.2 into the temp dir (one
// `npm install`, network); later runs reuse it. Node >= 24, burgee's floor.
import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";

// Override to re-pin: BURGEE_VERSION=0.10.0 node …repro.mjs all
const BURGEE = process.env.BURGEE_VERSION ?? "0.9.2";
const COMMANDER = "15.0.0";
const DIR = join(tmpdir(), `blog-burgee-change-one-import-${BURGEE}`);

// The program exactly as the article prints it, on real commander.
const ORIGINAL = `#!/usr/bin/env node
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
    let lines = readFileSync(file, "utf8").trimEnd().split("\\n");
    if (opts.skipBlank) lines = lines.filter((l) => l.trim() !== "");
    console.log(\`\${lines.length} lines in \${file}\`);
  });

program
  .command("longest")
  .description("print the longest lines in a file")
  .argument("<file>", "file to read")
  .option("-n, --top <count>", "how many lines to show", "3")
  .action((file, opts) => {
    const lines = readFileSync(file, "utf8").trimEnd().split("\\n");
    const top = lines
      .sort((a, b) => b.length - a.length)
      .slice(0, Number(opts.top));
    for (const line of top)
      console.log(\`\${String(line.length).padStart(4)}  \${line}\`);
  });

program.parse();
`;

// The one-line migration.
const SWAPPED = ORIGINAL.replace('from "commander"', 'from "burgee/commander"');

// The second edit: return the result, and keep prose off stdout for a machine.
const ANSWERING = SWAPPED.replace(
  "const program = new Command();",
  `// A machine asked: keep prose off stdout and let the return value answer.
const machine = ["--json", "--mcp"].some((f) => process.argv.includes(f));
const say = (text) => {
  if (!machine) console.log(text);
};

const program = new Command();`,
)
  .replace(
    "    console.log(`${lines.length} lines in ${file}`);\n",
    "    say(`${lines.length} lines in ${file}`);\n    return { file, lines: lines.length };\n",
  )
  .replace(
    "    for (const line of top)\n      console.log(`${String(line.length).padStart(4)}  ${line}`);\n",
    "    for (const line of top) say(`${String(line.length).padStart(4)}  ${line}`);\n    return top.map((line) => ({ length: line.length, line }));\n",
  );

// One declaration a commander user can add: what the command does, for MCP.
const EFFECTS = SWAPPED.replace(
  '  .description("count the lines in a file")\n',
  '  .description("count the lines in a file")\n  .effects("read_only")\n',
);
const EFFECTS_ON_COMMANDER = EFFECTS.replace(
  'from "burgee/commander"',
  'from "commander"',
);

// CommonJS spelling of the swapped program: require(esm) on Node 24.
const SWAPPED_CJS = SWAPPED.replace(
  'import { readFileSync } from "node:fs";\nimport { Command } from "burgee/commander";',
  'const { readFileSync } = require("node:fs");\nconst { Command } = require("burgee/commander");',
);

// burgee's own syntax, for the native exit code the façade does not adopt.
const NATIVE = `import { defineCommand, run } from 'burgee';
run(defineCommand({
  name: 'greet',
  effects: 'read_only',
  options: { name: { type: 'string', required: true, description: 'who' } },
  run: ({ options }) => ({ greeting: options.name }),
}));
`;

const SAMPLE = "alpha\n\nbravo charlie\ndelta echo foxtrot golf\n\nhotel\n";

// Each derived program must actually differ from its source, or a formatting
// change upstream would silently turn a probe into a comparison of one file.
for (const [name, derived, from] of [
  ["SWAPPED", SWAPPED, ORIGINAL],
  ["ANSWERING", ANSWERING, SWAPPED],
  ["EFFECTS", EFFECTS, SWAPPED],
  ["EFFECTS_ON_COMMANDER", EFFECTS_ON_COMMANDER, EFFECTS],
  ["SWAPPED_CJS", SWAPPED_CJS, SWAPPED],
]) {
  if (derived === from) throw new Error(`${name}: replacement matched nothing`);
}
if ((ANSWERING.match(/^    return /gm) ?? []).length !== 2)
  throw new Error("ANSWERING: expected both actions to return");

function setup() {
  if (!existsSync(join(DIR, "node_modules", "burgee", "package.json"))) {
    mkdirSync(DIR, { recursive: true });
    writeFileSync(
      join(DIR, "package.json"),
      JSON.stringify({ name: "lines", private: true, type: "module" }),
    );
    execFileSync(
      "npm",
      [
        "install",
        "--no-audit",
        "--no-fund",
        "--silent",
        `commander@${COMMANDER}`,
        `burgee@${BURGEE}`,
      ],
      { cwd: DIR, stdio: "ignore" },
    );
  }
  writeFileSync(join(DIR, "cli.commander.js"), ORIGINAL);
  writeFileSync(join(DIR, "cli.js"), SWAPPED);
  writeFileSync(join(DIR, "cli.answering.js"), ANSWERING);
  writeFileSync(join(DIR, "cli.effects.js"), EFFECTS);
  writeFileSync(join(DIR, "cli.effects.commander.js"), EFFECTS_ON_COMMANDER);
  writeFileSync(join(DIR, "cli.cjs"), SWAPPED_CJS);
  writeFileSync(join(DIR, "native.js"), NATIVE);
  writeFileSync(join(DIR, "sample.txt"), SAMPLE);
}

/** Run one program with argv (and optional stdin); never throws. */
function run(file, args, input) {
  const r = spawnSync(process.execPath, [file, ...args], {
    cwd: DIR,
    encoding: "utf-8",
    input: input ?? "",
  });
  return { out: r.stdout, err: r.stderr, code: r.status };
}

const rpc = (...messages) =>
  messages.map((m) => JSON.stringify({ jsonrpc: "2.0", ...m })).join("\n") +
  "\n";
const INIT = {
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "repro", version: "0" },
  },
};
const lines = (s) => s.split("\n").filter((l) => l !== "");
const isJson = (l) => {
  try {
    JSON.parse(l);
    return true;
  } catch {
    return false;
  }
};

// Argv the article runs against both programs; parity means stdout, stderr and
// exit code are byte-identical on commander and on burgee/commander.
const PARITY = [
  ["--help"],
  ["count", "--help"],
  ["count", "sample.txt"],
  ["count", "sample.txt", "--skip-blank"],
  ["longest", "sample.txt", "-n", "2"],
  ["count"],
  ["count", "sample.txt", "--skp-blank"],
];

const probes = {
  // Line diff: how many lines differ between the original and the migration.
  "swap-changed-lines": () =>
    ORIGINAL.split("\n").filter((l, i) => l !== SWAPPED.split("\n")[i]).length,
  // How many of the PARITY argv behave byte-identically on both.
  "parity-identical": () =>
    PARITY.filter((a) => {
      const x = run("cli.commander.js", a);
      const y = run("cli.js", a);
      return x.out === y.out && x.err === y.err && x.code === y.code;
    }).length + `/${PARITY.length}`,
  "count-plain": () => run("cli.js", ["count", "sample.txt"]).out.trim(),
  "count-skip-blank": () =>
    run("cli.js", ["count", "sample.txt", "--skip-blank"]).out.trim(),
  // --json on the untouched program: lines on stdout, and the envelope's data.
  "json-untouched-stdout-lines": () =>
    lines(run("cli.js", ["count", "sample.txt", "--json"]).out).length,
  "json-untouched-data": () =>
    String(
      JSON.parse(
        lines(run("cli.js", ["count", "sample.txt", "--json"]).out).at(-1),
      ).data,
    ),
  // A typo under --json: a structured error with a suggested fix, exit 1.
  "json-typo-fix": () =>
    JSON.parse(
      run("cli.js", ["count", "sample.txt", "--skp-blank", "--json"]).out,
    ).error.fix,
  "json-typo-exit": () =>
    run("cli.js", ["count", "sample.txt", "--skp-blank", "--json"]).code,
  "schema-commands": () =>
    JSON.parse(run("cli.js", ["--schema"]).out).commands.length,
  "schema-version": () =>
    JSON.parse(run("cli.js", ["--schema"]).out).schemaVersion,
  "mcp-tools-listed": () => {
    const out = run(
      "cli.js",
      ["--mcp"],
      rpc(INIT, { id: 2, method: "tools/list" }),
    ).out;
    return JSON.parse(lines(out)[1]).result.tools.length;
  },
  // On the untouched program, a tool call writes the command's prose onto the
  // JSON-RPC stream: count the stdout lines that are not JSON.
  "mcp-untouched-non-json-lines": () => {
    const out = run(
      "cli.js",
      ["--mcp"],
      rpc(INIT, {
        id: 2,
        method: "tools/call",
        params: { name: "count", arguments: { file: "sample.txt" } },
      }),
    ).out;
    return lines(out).filter((l) => !isJson(l)).length;
  },
  "mcp-answering-non-json-lines": () => {
    const out = run(
      "cli.answering.js",
      ["--mcp"],
      rpc(INIT, {
        id: 2,
        method: "tools/call",
        params: { name: "count", arguments: { file: "sample.txt" } },
      }),
    ).out;
    return lines(out).filter((l) => !isJson(l)).length;
  },
  "mcp-answering-lines": () => {
    const out = run(
      "cli.answering.js",
      ["--mcp"],
      rpc(INIT, {
        id: 2,
        method: "tools/call",
        params: { name: "count", arguments: { file: "sample.txt" } },
      }),
    ).out;
    const reply = JSON.parse(lines(out)[1]);
    return JSON.parse(reply.result.content[0].text).data.lines;
  },
  // Known issue: a multi-word option arrives camelCased and is refused.
  "mcp-kebab-option-error": () => {
    const out = run(
      "cli.answering.js",
      ["--mcp"],
      rpc(INIT, {
        id: 2,
        method: "tools/call",
        params: {
          name: "count",
          arguments: { file: "sample.txt", skipBlank: true },
        },
      }),
    ).out;
    const reply = JSON.parse(lines(out)[1]);
    return JSON.parse(reply.result.content[0].text).error.message;
  },
  "answering-json-lines": () =>
    JSON.parse(run("cli.answering.js", ["count", "sample.txt", "--json"]).out)
      .data.lines,
  "answering-human-unchanged": () =>
    run("cli.answering.js", ["count", "sample.txt"]).out ===
    run("cli.commander.js", ["count", "sample.txt"]).out
      ? "identical"
      : "differs",
  "answering-added-lines": () =>
    ANSWERING.split("\n").length - SWAPPED.split("\n").length,
  "completion-shells-exit-0": () =>
    ["bash", "zsh", "fish", "pwsh", "fig"].filter(
      (sh) => run("cli.js", ["completion", sh]).code === 0,
    ).length,
  // Known issue: completions offer --no-<flag> spellings the program refuses.
  "completion-offers-refused-flags": () => {
    const fish = run("cli.js", ["completion", "fish"]).out;
    const offered = [...fish.matchAll(/-l (no-[a-z-]+)/g)].map((m) => m[1]);
    return offered.filter(
      (f) =>
        run(
          "cli.js",
          f === "no-version" ? [`--${f}`] : ["count", "sample.txt", `--${f}`],
        ).code !== 0,
    ).length;
  },
  // How many tools carry no declared effects on the untouched program.
  "mcp-undeclared-tools": () => {
    const out = run(
      "cli.js",
      ["--mcp"],
      rpc({ id: 2, method: "tools/list" }),
    ).out;
    return JSON.parse(lines(out)[0]).result.tools.filter(
      (t) => t.annotations?.effects === "undeclared",
    ).length;
  },
  "effects-read-only-hint": () => {
    const out = run(
      "cli.effects.js",
      ["--mcp"],
      rpc({ id: 2, method: "tools/list" }),
    ).out;
    const count = JSON.parse(lines(out)[0]).result.tools.find(
      (t) => t.name === "count",
    );
    return String(count.annotations.readOnlyHint);
  },
  // `.effects()` is burgee's: the same file no longer runs on real commander.
  "effects-on-commander-exit": () =>
    run("cli.effects.commander.js", ["count", "sample.txt"]).code,
  "cjs-require": () =>
    run("cli.cjs", ["count", "sample.txt", "--json"]).out.trim(),
  "native-usage-exit": () => run("native.js", []).code,
  // yarn, pnpm and bun each install burgee into a wiped dir and run the swap;
  // one probe per manager so each fits the detector's 60s budget.
  "pm-yarn": () => pmRuns("yarn", ["-y", "yarn@1", "add", `burgee@${BURGEE}`]),
  "pm-pnpm": () => pmRuns("pnpm", ["-y", "pnpm@10", "add", `burgee@${BURGEE}`]),
  "pm-bun": () => pmRuns("bun", ["-y", "bun@1", "add", `burgee@${BURGEE}`]),
  "pm-matrix": () =>
    // npm is the fourth: setup() installed with it and every other probe ran on it.
    `${["yarn", "pnpm", "bun"].filter((pm) => probes[`pm-${pm}`]() === 1).length + 1}/4`,
  // yarn 1 enforces engines: on Node 22 it refuses burgee (npm only warns).
  // Needs a Node 22 binary: $NODE22, or the newest v22 under $NVM_DIR.
  "yarn1-node22-exit": () => {
    const node22 = process.env.NODE22 ?? findNode22();
    if (!node22) throw new Error("no Node 22 binary found (set NODE22)");
    const dir = freshDir("yarn-node22", { name: "y22", private: true });
    // yarn's bin is `#!/usr/bin/env node`, so Node 22 has to lead PATH.
    const r = spawnSync("npx", ["-y", "yarn@1", "add", `burgee@${BURGEE}`], {
      cwd: dir,
      encoding: "utf-8",
      env: { ...process.env, PATH: `${dirname(node22)}:${process.env.PATH}` },
      timeout: 50_000,
    });
    if (r.error) throw r.error;
    // 1 only for the engines refusal itself, never for a network failure.
    return r.status !== 0 && /engine "node" is incompatible/.test(r.stderr)
      ? 1
      : 0;
  },
  // TypeScript: the `exports` subpath resolves under bundler/nodenext, not under
  // the legacy `node` (node10) resolver. node10 counts TS2307; the others count
  // every TS error, so a different resolution failure cannot read as 0.
  "ts-node10-ts2307": () => tsErrors("node", "commonjs"),
  "ts-bundler-errors": () => tsErrors("bundler", "esnext", "any"),
  "ts-nodenext-errors": () => tsErrors("nodenext", "nodenext", "any"),
  "runtime-throw-json-stdout-bytes": () =>
    run("cli.answering.js", ["count", "missing.txt", "--json"]).out.length,
  "usage-error-exit": () => run("cli.js", ["count"]).code,
};

/** A wiped scratch dir under DIR with the given package.json. */
function freshDir(name, pkg) {
  const dir = join(DIR, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "package.json"), JSON.stringify(pkg));
  return dir;
}

/** 1 when `npx <args>` installs burgee and the swapped program runs, else 0. */
function pmRuns(pm, args) {
  const dir = freshDir(`pm-${pm}`, {
    name: `pm-${pm}`,
    private: true,
    type: "module",
  });
  writeFileSync(join(dir, "cli.js"), SWAPPED);
  writeFileSync(join(dir, "sample.txt"), SAMPLE);
  // A registry stall must fail loudly, inside the detector's 60s budget.
  const install = spawnSync("npx", args, {
    cwd: dir,
    stdio: "ignore",
    timeout: 50_000,
  });
  if (install.error) throw install.error;
  const r = spawnSync(process.execPath, ["cli.js", "count", "sample.txt"], {
    cwd: dir,
    encoding: "utf-8",
  });
  return r.stdout.trim() === "6 lines in sample.txt" ? 1 : 0;
}

function findNode22() {
  const root = join(
    process.env.NVM_DIR ?? join(homedir(), ".nvm"),
    "versions",
    "node",
  );
  if (!existsSync(root)) return undefined;
  const v22 = readdirSync(root)
    .filter((v) => v.startsWith("v22."))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .at(-1);
  return v22 ? join(root, v22, "bin", "node") : undefined;
}

/** TS2307 count (or every TS error, with code "any") for `import { Command } from "burgee/commander"` under a resolver. */
function tsErrors(resolution, module, code = "TS2307") {
  const dir = join(DIR, "ts");
  if (!existsSync(join(dir, "node_modules", "typescript"))) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ name: "ts", private: true }),
    );
    execFileSync(
      "npm",
      [
        "install",
        "--no-audit",
        "--no-fund",
        "--silent",
        "typescript@5.9.3",
        "@types/node@24",
        `burgee@${BURGEE}`,
      ],
      { cwd: dir, stdio: "ignore" },
    );
  }
  writeFileSync(
    join(dir, "a.ts"),
    'import { Command } from "burgee/commander";\nnew Command().name("x");\n',
  );
  const r = spawnSync(
    process.execPath,
    [
      join(dir, "node_modules", "typescript", "bin", "tsc"),
      "--noEmit",
      "--skipLibCheck",
      "--moduleResolution",
      resolution,
      "--module",
      module,
      "a.ts",
    ],
    { cwd: dir, encoding: "utf-8" },
  );
  return (r.stdout.match(code === "any" ? /error TS\d+/g : /TS2307/g) ?? [])
    .length;
}

const probe = process.argv[2];
if (!probe || (probe !== "all" && !(probe in probes))) {
  console.error(`usage: repro.mjs <${Object.keys(probes).join("|")}|all>`);
  process.exit(2);
}
setup();
if (probe === "all") {
  for (const [name, fn] of Object.entries(probes))
    console.log(`${name}: ${fn()}`);
} else {
  console.log(String(probes[probe]()));
}
