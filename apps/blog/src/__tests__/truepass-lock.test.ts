/**
 * truepass keeps this suite honest: a test cannot go green by checking less.
 *
 * Two halves, both wired here and both easy to unwire without anyone noticing:
 *
 * 1. Its ESLint rules over the test files, at error: a focused test, a skip
 *    with no reason, a fixed sleep, a retry. Drop the block from
 *    eslint.config.mjs and every one of those lints clean again.
 * 2. `truepass diff --base origin/main` on pre-push, through the hookset
 *    preset's test-integrity station (`npm run hook:test-integrity`): an
 *    assertion moved to a weaker matcher, or a snapshot rewritten with no
 *    `Snapshot: <why>` line in the commit message. Delete the script and the
 *    station passes silently, because the preset runs it with --if-present.
 *
 * Each assertion below goes red if one of those is removed.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../../../..");
const read = (file: string): string =>
  readFileSync(resolve(ROOT, file), "utf8");

const rootPkg = JSON.parse(read("package.json")) as {
  scripts: Record<string, string>;
  devDependencies: Record<string, string>;
};

describe("truepass is wired", () => {
  it("is a root dev dependency at 1.x or later", () => {
    expect(rootPkg.devDependencies.truepass).toMatch(/^\^?[1-9]\d*\./);
  });

  it("the blog's lint config turns truepass.recommended on over the test files", () => {
    const config = read("apps/blog/eslint.config.mjs");
    expect(config).toContain(
      'import { configs as truepass } from "truepass/eslint";',
    );
    expect(config).toMatch(
      /\.\.\.truepass\.recommended,\s*\n\s*files: \["src\/__tests__\/\*\*\/\*\.test\.\{ts,tsx\}"/,
    );
  });

  it("pre-push runs truepass diff against origin/main", () => {
    expect(rootPkg.scripts["hook:test-integrity"]).toBe(
      "npx truepass diff --base origin/main",
    );
    // The station that calls the script comes from the hookset preset.
    expect(read("lefthook.yml")).toContain(
      "- packages/hookset/presets/lefthook/pre-push.yml",
    );
  });
});
