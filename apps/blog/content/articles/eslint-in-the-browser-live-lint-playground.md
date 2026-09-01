---
title: "I Shipped ESLint to the Browser in 362 KB. Now My Blog Posts Lint Your Code, Not Mine."
description: "Articles about lint rules can only ever show you someone else's code. ESLint's own linter compresses to 362 KB with two real plugins inside it — small enough to just ship. Here's the ~60-line esbuild recipe that puts a working linter in a blog post, the four traps that cost me an evening, and the demo bug that shipped because my test grepped for a string instead of running the rule."
slug: "eslint-in-the-browser-live-lint-playground"
canonical_url: "https://ofriperetz.dev/articles/eslint-in-the-browser-live-lint-playground"
tier: "TOPIC"
published_at: "2026-08-31T06:00:00Z"
cover_image: "https://ofriperetz.dev/cdn/blog-cover-image/eslint-in-the-browser-live-lint-playground.jpg"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/eslint-in-the-browser-live-lint-playground-og.jpg"
reading_time_minutes: 9
tags:
  - "javascript"
  - "eslint"
  - "webdev"
  - "showdev"
author:
  name: "Ofri Peretz"
  username: "ofri-peretz"
  avatar: "https://media2.dev.to/dynamic/image/width=640,height=640,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Fuser%2Fprofile_image%2F3669992%2F50a1f256-472c-48a1-85e8-149459647ea7.png"
  twitter: "ofriperetzdev"
series: null
---

Every article about a lint rule has the same hole in it.

I write "this rule catches `algorithms: ["HS256", "none"]`", I paste a snippet, I paste the finding it produces. You read it and think: *fine, but does it fire on **my** code?* And the article cannot answer. It can only ever show you someone else's code, findings I generated on my machine, screenshotted into prose. You have to install the thing to find out whether it was worth installing.

So I stopped writing about the rule and shipped the linter instead. On [the JWT article](https://ofriperetz.dev/articles/the-jwt-algorithm-none-attack-the-vulnerability-in-1-line-of-code-d9g) there's now a button that says *Try it live*. Click it, paste your own `jwt.verify` call, and the actual published rule runs on it — in your browser, on your keystrokes, with nothing leaving the page.

The reason this is possible is a number I did not expect.

## ESLint compresses to 362 KB

ESLint ships a browser build. `eslint/universal` exports the `Linter` class with no Node dependencies in its public surface — you hand it source text and a flat config, it hands you messages back. No file system, no CLI, no plugin resolution.

Bundled with **two real security plugins** inside it, here is what that weighs:

| | bytes |
|---|---|
| raw bundle | 1,764,382 |
| gzip | 463,039 |
| **brotli (what actually ships)** | **370,746** |

362 KB over the wire, and production serves brotli — I checked the response headers rather than assuming. That is one mid-sized hero image. It is less than the JavaScript most marketing sites load to render a cookie banner.

That number is the whole argument. At 3 MB you write a blog post about the rule. At 362 KB you ship the rule.

And it is lazy: the bundle sits behind an explicit gate, so an article costs nothing until a reader asks for it. The button says what it will cost before it costs it.

## The recipe

Three pieces: a worker, a build step, a client seam. This is the entire thing.

**The worker** holds the linter and the plugins. It never talks to a server:

```ts
// src/workers/lint.worker.ts
import { Linter } from "eslint/universal";
import jwt from "eslint-plugin-jwt";
import nodeSecurity from "eslint-plugin-node-security";

// Enumerated, never dynamic — the worker ships exactly the plugins the
// embeds name, and a request for anything else is an error.
const PLUGINS = { jwt, "node-security": nodeSecurity };
const linter = new Linter();

self.onmessage = (event) => {
  const { id, code, pluginId, rules } = event.data;
  try {
    const findings = linter.verify(code, {
      plugins: { [pluginId]: PLUGINS[pluginId] },
      languageOptions: { ecmaVersion: 2024, sourceType: "module" },
      rules,
    });
    self.postMessage({ id, ok: true, findings });
  } catch (error) {
    self.postMessage({ id, ok: false, error: String(error) });
  }
};
```

**The build step** is where the interesting work is. A handful of aliases and a banner:

```js
// scripts/build-lint-worker.mjs
import { buildSync } from "esbuild";

const shims = "./src/workers/node-shims.ts";

buildSync({
  entryPoints: ["src/workers/lint.worker.ts"],
  outfile: "public/lint-worker.js",
  bundle: true,
  minify: true,
  format: "iife",
  platform: "browser",
  define: { "process.env.NODE_ENV": '"production"' },
  // A worker global has no `process`. ESLint touches more of it than
  // NODE_ENV — cwd, platform, emitWarning — so stub it in a banner.
  banner: {
    js: 'var process={env:{NODE_ENV:"production"},platform:"browser",' +
        'cwd:function(){return "/"},emitWarning:function(){},argv:[]};',
  },
  alias: {
    path: "path-browserify",
    "node:path": "path-browserify",
    fs: shims, "node:fs": shims,
    os: shims, "node:os": shims,
    util: shims, "node:util": shims,
    // Don't skip this one. If anything in your graph pulls oxc-resolver
    // (eslint-plugin-import-next does), its native/wasm bindings ride
    // into the bundle and break the build. Rules never exercise it.
    "oxc-resolver": shims,
  },
});
```

`node-shims.ts` is a no-op `Proxy` — the modules are imported but never exercised by rule logic, so they only need to exist:

```ts
const noop: unknown = new Proxy(function () {}, {
  get: () => noop,          // any property access keeps returning the proxy
  apply: () => undefined,   // any CALL no-ops — not "returns a proxy"
});
export default noop;
export const readFileSync = noop, existsSync = noop, platform = noop,
  inspect = noop, EOL = "\n" /* … */;
```

**The client seam** is one lazy worker and an id-matched request map. The part worth copying is the failure path:

```ts
worker.onerror = () => {
  const entries = [...pending.values()];
  pending.clear();
  worker?.terminate();
  worker = null;          // ← this line
  for (const entry of entries) entry.reject(new Error("lint worker failed"));
};
```

Nulling the singleton is the difference between a playground that self-heals and one that is dead until reload. Without it every later lint posts into a corpse, and the UI shows a clean result forever — the worst possible failure, because "no findings" and "the analyzer is dead" look identical to a reader.

That's why the surface renders **"unknown, not clean"** on failure, never an empty list.

## The four traps

Each of these cost real time, so here they are with the error text you'll actually see.

**1. Don't let your framework bundle it.** My first attempt asked Next.js to build the worker. That means teaching *both* webpack (dev) and Turbopack (build) about `node:` schemes and shims — two fragile configs for one bundle. Worse, this repo lints itself with `eslint-plugin-import-next`, which pulls `oxc-resolver`, whose **native/wasm bindings** then ride into the graph and break any bundler pass. The fix was to stop negotiating: `public/lint-worker.js` is our own esbuild artifact, gitignored, built by `predev`/`prebuild`.

**2. A real worker has no `process`.** My spike ran under Node, where one existed, so this only appeared in the browser:

```
ReferenceError: process is not defined
```

Hence the banner stub. The spike passing is not the same as the thing working.

**3. Linting the artifact will OOM your editor.** Once the 1.7 MB bundle landed in `public/`, ESLint tried to lint it:

```
Abort trap: 6
```

That looks like a native crash. It's a JS heap exhaustion on a 4 GB default. Add `public/**` to `globalIgnores`.

**4. Ship the fragment on a redirect, not a path.** Unrelated to bundling, but it cost me twice: my link router rebuilds article destinations as `origin + pathname`, which **silently drops `#playground`**. Readers landed at the top of a long article instead of on the thing they clicked for. Fragments survive a 302, so link to the redirect and let the browser carry the hash.

## The demo that was wrong for three days

Here is the part I'd rather not write.

The node-security playground advertised three rules: `detect-eval-with-expression`, `detect-child-process`, and `no-zip-slip`. It shipped, it looked right, and **only one of them could ever fire.**

`detect-child-process` is provenance-gated by design — it resolves a command back to an attacker-reachable root like `req` or `event` rather than flagging any dynamic string, because that's the difference between a finding and noise. My sample's only input was a bare `userInput` parameter, which satisfied neither it nor `no-zip-slip`. Two of the three rules sat there silent, advertised to every reader.

The lock that was supposed to prevent this looked like diligence:

```ts
const tripwires = { "node-security": /\beval\s*\(|exec\s*\(/ };
expect(def.initialCode).toMatch(tripwires[def.pluginId]);
```

It greps the sample for `eval(` or `exec(`. The sample contains both. **The test passes just as happily when the rules say nothing** — it never ran a linter. A test shaped like a grep can only ever check that text exists.

The replacement runs the real thing against the published packages:

```ts
const findings = new Linter().verify(def.initialCode, {
  plugins: { [def.pluginId]: PLUGINS[def.pluginId] },
  languageOptions: { ecmaVersion: 2024, sourceType: "module" },
  rules: def.rules,
});
const fired = new Set(findings.map((f) => f.ruleId));
for (const rule of Object.keys(def.rules)) {
  expect(fired.has(rule), `${rule} is enabled but fires nothing on its own sample`).toBe(true);
}
```

It failed immediately on the shipped sample, which is the only evidence a test is worth anything. The new sample is an upload handler that trips all three on consecutive lines.

The generalisable lesson isn't "write better tests". It's that **a test which asserts on the shape of your input instead of the behaviour of your system will pass for the entire life of the bug.** If your rule fixture never invokes the rule, you have written a very confident spell-checker.

## Try it

Two playgrounds are live. Both run published packages from npm — the same tarballs `npm install` gives you, not a demo build:

- **[The JWT `alg:none` article](https://ofriperetz.dev/articles/the-jwt-algorithm-none-attack-the-vulnerability-in-1-line-of-code-d9g)** — one rule, `jwt/no-algorithm-none`. Remove `"none"` from the algorithms array and watch the finding clear; put it back and watch it return.
- **[The node-security guide](https://ofriperetz.dev/articles/getting-started-eslint-plugin-node-security)** — three rules on an upload handler that trips all of them.

Paste your own code. It runs in your browser; nothing you type leaves the page. That last sentence is in the UI too, because asking someone to paste authentication code into a stranger's website deserves an explicit answer about where it goes.

## Reproduce it

Everything above was measured on **2026-08-31** against these versions:

| package | version |
|---|---|
| eslint | 9.39.4 |
| eslint-plugin-jwt | 2.2.14 (13 rules) |
| eslint-plugin-node-security | 5.2.3 (42 rules) |
| esbuild | 0.28.2 |
| path-browserify | 1.0.1 |

```bash
node scripts/build-lint-worker.mjs
wc -c < public/lint-worker.js          # 1764382
gzip -9 -c public/lint-worker.js | wc -c   # 463039
brotli -q 11 -c public/lint-worker.js | wc -c  # 370746
```

Those bytes will drift as the plugins ship rules — quote them with a date, as I have, rather than letting them quietly become wrong.

## What this is actually for

I don't think the interesting claim here is "look, a playground". Browser-hosted linting isn't new; ESLint and typescript-eslint both run one, and they're excellent. What's unusual is the *placement*: not a destination you navigate to and configure, but the rule the paragraph is arguing, running inline, on your code, at the moment you're wondering about it.

If you maintain a linter, a plugin, or developer docs, the recipe above is about sixty lines and it removes the gap between "here is what my tool finds" and "here is what it finds in yours". That gap is where adoption goes to die. Docs that assert are a pitch; docs that execute are evidence.

The linter is 362 KB. It fits.
