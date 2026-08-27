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
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { LINT_EMBEDS } from "../lib/lint-embeds";

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
    "%s: the sample is vulnerable on purpose — the demo must not open on silence",
    (_slug, def) => {
      // Cheap structural tripwires per plugin, not a lint run (that
      // needs the browser bundle): the sample keeps the exact tokens
      // its rules exist to catch.
      const tripwires: Record<string, RegExp> = {
        jwt: /["']none["']/,
        "node-security": /\beval\s*\(|exec\s*\(/,
      };
      expect(def.initialCode).toMatch(tripwires[def.pluginId]);
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
