#!/usr/bin/env node
// Count the rules a PUBLISHED plugin actually registers, from a clean install.
//
// The count must come from the built package, never from `ls src/rules/`
// (which counts helper directories and `__tests__`) and never from
// `grep -v index` (which silently drops rules whose names contain "index",
// e.g. `no-sensitive-indexeddb`). Both mistakes have shipped in articles.
//
// Installing into a throwaway directory rather than reading a local checkout
// is deliberate: the number a reader can reproduce is the one in the package
// they install, not the one in our working tree.
//
//   node scripts/sdlc/pkg-rule-count.mjs eslint-plugin-pg
//   node scripts/sdlc/pkg-rule-count.mjs eslint-plugin-pg@1.4.14
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const spec = process.argv[2];
if (!spec) {
  console.error("usage: pkg-rule-count.mjs <package>[@version]");
  process.exit(2);
}
const name = spec.startsWith("@")
  ? `@${spec.slice(1).split("@")[0]}`
  : spec.split("@")[0];

const dir = mkdtempSync(join(tmpdir(), "sdlc-count-"));
try {
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({ name: "probe", private: true }),
  );
  execFileSync(
    "npm",
    ["install", "--no-audit", "--no-fund", "--silent", spec],
    {
      cwd: dir,
      stdio: ["ignore", "ignore", "pipe"],
      timeout: 180_000,
    },
  );
  const out = execFileSync(
    process.execPath,
    [
      "-e",
      `const p=require(${JSON.stringify(name)});process.stdout.write(String(Object.keys(p.rules).length))`,
    ],
    { cwd: dir, encoding: "utf-8", timeout: 60_000 },
  );
  process.stdout.write(out.trim());
} finally {
  rmSync(dir, { recursive: true, force: true });
}
