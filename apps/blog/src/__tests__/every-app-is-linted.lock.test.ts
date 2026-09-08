/*
 * Every app in this repo must be linted, by our own plugins.
 *
 * `apps/engage` shipped 152 source files — API routes included — with no
 * eslint config and no `lint` task, so `turbo run lint` ran in ONE package
 * and reported success. Nothing failed; the app was simply invisible to the
 * gate. Its first lint found 5,614 issues, including keyboard-accessibility
 * errors and `Date.now()` called during render.
 *
 * A monorepo that dogfoods twelve of its own plugins next door, while one app
 * is linted by nothing, is the worst possible advertisement for them. This
 * fails when an app is added without wiring it up.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO = join(process.cwd(), "..", "..");
const APPS = join(REPO, "apps");

/** Plugins every app of ours should run, regardless of what it depends on. */
const UNIVERSAL = [
  "eslint-plugin-secure-coding",
  "eslint-plugin-node-security",
  "eslint-plugin-browser-security",
  "eslint-plugin-conventions",
  "eslint-plugin-import-next",
  "eslint-plugin-modernization",
  "eslint-plugin-modularity",
  "eslint-plugin-reliability",
  "eslint-plugin-maintainability",
  "eslint-plugin-operability",
];
/** Only where React is actually a dependency. */
const REACT = ["eslint-plugin-react-a11y", "eslint-plugin-react-features"];

const apps = readdirSync(APPS, { withFileTypes: true })
  .filter((e) => e.isDirectory() && existsSync(join(APPS, e.name, "package.json")))
  .map((e) => e.name);

describe("every app is linted by the Interlace plugins", () => {
  it("finds the apps at all — an empty sweep proves nothing", () => {
    expect(apps.length).toBeGreaterThanOrEqual(2);
  });

  it.each(apps)("%s has an eslint config and a lint task", (app) => {
    const dir = join(APPS, app);
    const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
    expect(
      pkg.scripts?.lint,
      `${app} has no \`lint\` script, so \`turbo run lint\` skips it silently`,
    ).toBeTruthy();
    expect(
      existsSync(join(dir, "eslint.config.mjs")),
      `${app} has no eslint.config.mjs`,
    ).toBe(true);
  });

  it.each(apps)("%s wires every plugin that applies to it", (app) => {
    const dir = join(APPS, app);
    const cfg = readFileSync(join(dir, "eslint.config.mjs"), "utf8");
    const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    const required = [...UNIVERSAL, ...("react" in deps ? REACT : [])];
    /*
     * Matched on an import STATEMENT, anchored to the start of a line — not
     * on the package name appearing anywhere in the file.
     *
     * `cfg.includes("eslint-plugin-x")` is satisfied by a comment mentioning
     * a plugin that was removed; review caught that. The obvious repair —
     * strip comments, then match `from "…"` — is worse, and failed here:
     * apps/blog's header contains the line
     *
     *     //   a11y:     react-a11y (scoped to **\/*.tsx)
     *
     * whose `/*` opens a block comment as far as a regex is concerned, so the
     * stripper swallowed the next twenty lines INCLUDING every plugin import
     * and reported all twelve as missing. A comment broke the comment
     * stripper.
     *
     * An import cannot begin anywhere but the start of a line, and a comment
     * line begins with `//` or `*`. No stripping needed.
     */
    const imported = new Set(
      [...cfg.matchAll(/^\s*import\s[\s\S]*?from\s+["']([^"']+)["']/gm)].map(
        (m) => m[1],
      ),
    );
    const missing = required.filter((p) => !imported.has(p));
    expect(
      missing,
      `${app} is missing: ${missing.join(", ")}`,
    ).toEqual([]);
  });
});
