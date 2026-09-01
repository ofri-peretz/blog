/**
 * Build the playground's lint worker as a STATIC asset
 * (public/lint-worker.js, gitignored) — deliberately outside Next's
 * bundlers.
 *
 * Why not let Next bundle it: the worker's graph (eslint's linter, our
 * plugins, the devkit barrel) imports node builtins and — once
 * oxc-resolver is installed for the repo's own linting — native/wasm
 * resolver bindings. Teaching BOTH webpack (dev) and Turbopack (build)
 * to shim all of that browser-conditionally is two fragile
 * configurations for one bundle; this esbuild step is the exact
 * pipeline the browser-bundle spike proved (392KB gzipped, rules
 * firing line-accurate), pinned here with the same aliases.
 *
 * Runs from predev/prebuild, hermetic from node_modules — no network,
 * no external data, so it needs none of the committed-JSON doctrine.
 */
import { buildSync } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const app = path.resolve(here, "..");
const shims = path.join(app, "src/workers/node-shims.ts");

buildSync({
  entryPoints: [path.join(app, "src/workers/lint.worker.ts")],
  outfile: path.join(app, "public/lint-worker.js"),
  bundle: true,
  minify: true,
  format: "iife",
  platform: "browser",
  define: { "process.env.NODE_ENV": '"production"' },
  // The worker global scope has no `process`; eslint touches more of it
  // than NODE_ENV (cwd, platform, emitWarning). The spike ran under
  // node where a real one existed — a browser worker gets this stub.
  banner: {
    js: 'var process={env:{NODE_ENV:"production"},platform:"browser",version:"v0.0.0",versions:{node:"0.0.0"},cwd:function(){return "/"},emitWarning:function(){},argv:[]};',
  },
  alias: {
    path: "path-browserify",
    "node:path": "path-browserify",
    fs: shims,
    "node:fs": shims,
    os: shims,
    "node:os": shims,
    util: shims,
    "node:util": shims,
    // The devkit's resolver is never exercised by playground rules;
    // with oxc-resolver installed for the repo's own linting, its
    // native/wasm bindings would otherwise ride into the bundle.
    "oxc-resolver": shims,
  },
});

console.log("[build-lint-worker] public/lint-worker.js built");
