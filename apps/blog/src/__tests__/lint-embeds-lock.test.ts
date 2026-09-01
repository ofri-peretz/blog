/**
 * Live-lint playground locks — the flagship embed's contracts.
 *
 * The playground's promises: every definition names a published article
 * and a plugin the worker actually bundles; every sample is vulnerable
 * ON PURPOSE (a demo that opens on silence teaches nothing); the
 * analyzer runs entirely in the browser (no fetch anywhere on the
 * path); the bundle hides behind an explicit gate; and both funnel
 * events are wired. Each promise is pinned to the source that keeps it.
 */
import { type ESLint, Linter } from "eslint";
import jwtPlugin from "eslint-plugin-jwt";
import nodeSecurityPlugin from "eslint-plugin-node-security";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { LINT_EMBEDS, type PlaygroundPluginId } from "../lib/lint-embeds";

/** The same map the worker enumerates — kept in lockstep by the tests below. */
const PLUGINS: Record<PlaygroundPluginId, ESLint.Plugin> = {
  jwt: jwtPlugin as ESLint.Plugin,
  "node-security": nodeSecurityPlugin as ESLint.Plugin,
};

const ARTICLES = path.resolve(__dirname, "../../content/articles");
const read = (rel: string): string =>
  readFileSync(path.resolve(__dirname, "..", rel), "utf-8");

const WORKER = read("workers/lint.worker.ts");
const CLIENT = read("lib/lint-client.ts");
const COMPONENT = read("components/article-playground.tsx");

describe("every definition is honest", () => {
  it.each(LINT_EMBEDS.map((d) => d.slug))("%s.md exists", (slug) => {
    expect(existsSync(path.join(ARTICLES, `${slug}.md`))).toBe(true);
  });

  it("one playground per article at most", () => {
    const slugs = LINT_EMBEDS.map((d) => d.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it.each(LINT_EMBEDS.map((d) => [d.slug, d] as const))(
    "%s: the worker bundles its plugin and the rules belong to it",
    (_slug, def) => {
      // The worker must IMPORT the plugin package the definition names
      // — a definition naming anything else posts to a worker that
      // throws. Our pluginIds map 1:1 onto eslint-plugin-<id> names.
      expect(WORKER).toContain(`from "eslint-plugin-${def.pluginId}"`);
      for (const rule of Object.keys(def.rules)) {
        expect(rule.startsWith(`${def.pluginId}/`)).toBe(true);
      }
    },
  );

  it.each(LINT_EMBEDS.map((d) => [d.slug, d] as const))(
    "%s: EVERY enabled rule fires on the sample — no rule is advertised and silent",
    (_slug, def) => {
      // A real lint run against the PUBLISHED plugins, not a text
      // tripwire. The browser bundle is only needed to run this in a
      // browser; node can run the same Linter over the same packages.
      //
      // The weaker textual version of this lock passed for the whole
      // first release while the node-security embed enabled three rules
      // and could only ever fire one: detect-child-process is
      // provenance-gated (it needs an attacker-reachable root like
      // `req`), and its sample only had a plain `userInput` parameter.
      // Grep-shaped locks cannot see that. This one fails on it.
      const findings = new Linter().verify(def.initialCode, {
        plugins: { [def.pluginId]: PLUGINS[def.pluginId] },
        languageOptions: { ecmaVersion: 2024, sourceType: "module" },
        rules: def.rules,
      });

      const fired = new Set(findings.map((f) => f.ruleId));
      for (const rule of Object.keys(def.rules)) {
        expect(
          fired.has(rule),
          `${rule} is enabled on this playground but fires nothing on its own sample — ` +
            `the reader is promised a rule that cannot speak. Fired: ${[...fired].join(", ") || "(nothing)"}`,
        ).toBe(true);
      }
    },
  );

  it.each(LINT_EMBEDS.map((d) => [d.slug, d] as const))(
    "%s: a rule count in the copy matches the plugin actually installed",
    (_slug, def) => {
      // Rule counts drift every time a plugin ships rules; the copy that
      // quotes one has to move with it. ("35 rules" outlived two majors
      // in the shipped invite before this lock existed.)
      const quoted = def.invite.match(/\b(\d+)\s+rules\b/);
      if (!quoted) return;
      expect(Number(quoted[1])).toBe(
        Object.keys(PLUGINS[def.pluginId].rules ?? {}).length,
      );
    },
  );
});

describe("the analyzer never leaves the browser", () => {
  it("no fetch on the whole path — worker, client, component", () => {
    for (const src of [WORKER, CLIENT, COMPONENT]) {
      expect(src).not.toContain("fetch(");
      expect(src).not.toContain("XMLHttpRequest");
    }
  });

  it("the worker's plugin map is enumerated, never dynamic", () => {
    expect(WORKER).toContain("const PLUGINS: Record<PlaygroundPluginId");
    expect(WORKER).not.toContain("import(");
  });

  it("the worker is lazy: created inside the first lint call, behind the gate", () => {
    expect(CLIENT).toContain('new Worker("/lint-worker.js")');
    // Lazy singleton — module scope holds null until asked.
    expect(CLIENT).toContain("let worker: Worker | null = null");
    // …and the component only mounts the playground after the gate.
    expect(COMPONENT).toMatch(/\{open \? \(/);
  });

  it("the worker asset is OUR esbuild output — pinned flags, never Next's bundlers", () => {
    // The graph needs node shims and (with oxc-resolver installed for
    // the repo's own linting) would otherwise pull native/wasm resolver
    // bindings; the spike-proven esbuild step owns it instead.
    const build = read("../scripts/build-lint-worker.mjs");
    expect(build).toContain('platform: "browser"');
    expect(build).toContain('"oxc-resolver": shims');
    expect(build).toContain('"node:fs": shims');
    const pkg = read("../package.json");
    expect(pkg).toContain('"predev": "node scripts/build-lint-worker.mjs"');
    expect(pkg).toContain('"prebuild": "node scripts/build-lint-worker.mjs"');
    // The artifact is generated, not committed.
    expect(read("../.gitignore")).toContain("public/lint-worker.js");
  });

  it("a dead worker rejects pending requests — failure is never a silent clean", () => {
    expect(CLIENT).toContain("worker.onerror");
    expect(CLIENT).toContain("lint worker failed");
  });
});

describe("the dev.to → playground crossing", () => {
  // In 60 days to 2026-08-30, ZERO readers reached the blog from dev.to.
  // The playground is the one thing that cannot exist on dev.to, so it is
  // the only real reason to cross — but only if the dev.to copy says so.
  it.each(LINT_EMBEDS.map((d) => [d.slug, d] as const))(
    "%s invites dev.to readers to the playground, keyed to its own slug",
    (slug, _def) => {
      const article = readFileSync(path.join(ARTICLES, `${slug}.md`), "utf-8");
      expect(
        article,
        `${slug} has a playground but its dev.to copy never mentions it`,
      ).toContain(`::playground-cta{slug="${slug}"}`);
    },
  );

  it("renders on dev.to and NOT on the blog, where the playground already is", async () => {
    const { preprocessMarkdown } = await import("../lib/markdown");
    const sample = [
      "Before.",
      "",
      '::playground-cta{slug="some-article"}',
      "Try it live.",
      "::",
      "",
      "After.",
    ].join("\n");

    const onBlog = preprocessMarkdown(sample);
    expect(onBlog).not.toContain("playground-cta");
    expect(onBlog).not.toContain("Try it live.");
    expect(onBlog).toContain("Before.");
    expect(onBlog).toContain("After.");

    // The dev.to half lives in the publish script, which runs main() at
    // import time — so this asserts its contract textually rather than
    // executing a publish as a side effect of the test suite.
    const publish = read("../scripts/publish-to-devto.mjs");
    expect(publish).toContain('::playground-cta\\{slug="([^"]+)"\\}');
    // Must emit an ALREADY-/go/ link: classifyDevtoLink rebuilds an
    // /articles/<slug> destination as `origin + pathname`, silently dropping
    // the #playground fragment and landing the reader at the top of the page.
    expect(publish).toContain("/go/${playgroundSlug}#playground");
  });

  it("the playground section has the anchor that link targets", () => {
    expect(COMPONENT).toContain('id="playground"');
  });
});

describe("wiring and measurement", () => {
  it("the article page renders the playground, slug-mapped", () => {
    const page = read("app/articles/[slug]/page.tsx");
    expect(page).toContain("<ArticlePlayground currentSlug={slug} />");
  });

  it("the gate is a DS pill and fires playground_open before mounting", () => {
    expect(COMPONENT).toContain('toggleVariants({ variant: "pill", size: "xs" })');
    expect(COMPONENT).toMatch(
      /track\("article:playground_open", \{ slug: currentSlug \}\);\s*setOpen\(true\)/,
    );
  });

  it("playground_edit fires once, on the first post-mount lint", () => {
    expect(COMPONENT).toContain("lints.current += 1");
    expect(COMPONENT).toMatch(/lints\.current === 2[\s\S]{0,120}article:playground_edit/);
  });

  it("the vendored playground surfaces are under drift watch", () => {
    const drift = readFileSync(
      path.resolve(__dirname, "../../../../scripts/check-vendored-drift.mjs"),
      "utf-8",
    );
    for (const file of ["components/ui/code-editor.tsx", "components/ui/lint-playground.tsx"]) {
      expect(drift).toContain(`"${file}"`);
      expect(read(file)).toContain("VENDORED from the Interlace DS");
    }
  });
});
