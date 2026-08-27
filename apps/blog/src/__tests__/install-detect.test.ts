/**
 * install-detect — the Discover→Configure conversion dimension.
 *
 * The matcher decides which copies count as configure-intent, so its
 * edges ARE the funnel's edges: every package manager the docs print,
 * flags in any position before the name, our naming shapes only.
 */
import { describe, expect, it } from "vitest";

import { installedPackage } from "../lib/install-detect";

describe("installedPackage", () => {
  it.each([
    ["npm install eslint-plugin-node-security", "eslint-plugin-node-security"],
    ["npm i eslint-plugin-jwt", "eslint-plugin-jwt"],
    ["npm install --save-dev eslint-plugin-secure-coding", "eslint-plugin-secure-coding"],
    ["npm install -D eslint-plugin-import-next", "eslint-plugin-import-next"],
    ["pnpm add eslint-plugin-browser-security", "eslint-plugin-browser-security"],
    ["yarn add --dev eslint-plugin-pg", "eslint-plugin-pg"],
    ["bun add eslint-plugin-react-a11y", "eslint-plugin-react-a11y"],
    ["npm install @interlace/eslint-devkit", "@interlace/eslint-devkit"],
    ["npm install eslint-config-interlace", "eslint-config-interlace"],
  ])("%s → %s", (text, expected) => {
    expect(installedPackage(text)).toBe(expected);
  });

  it("finds the command inside a multi-line block", () => {
    expect(
      installedPackage("# add the plugin\nnpm install --save-dev eslint-plugin-mongodb-security\n"),
    ).toBe("eslint-plugin-mongodb-security");
  });

  it("a regular snippet is null — reading is not converting", () => {
    expect(installedPackage("const a = requireGuards(app);")).toBeNull();
  });

  it("installing someone ELSE'S package is null — the vocabulary is ours", () => {
    expect(installedPackage("npm install lodash")).toBeNull();
    // eslint core is not an eslint-plugin-* shape either.
    expect(installedPackage("npm install eslint")).toBeNull();
  });

  it("an uninstall is not an install", () => {
    expect(installedPackage("npm uninstall eslint-plugin-crypto")).toBeNull();
  });
});
