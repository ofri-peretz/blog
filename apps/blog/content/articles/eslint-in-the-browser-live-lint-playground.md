---
title: "ESLint Ships in 459 KB, So My Blog Posts Lint Your Code"
description: "ESLint's linter ships in 459 KB with two real security plugins inside it. Here's the esbuild recipe that puts a working linter inside a blog post."
slug: "eslint-in-the-browser-live-lint-playground"
canonical_url: "https://ofriperetz.dev/articles/eslint-in-the-browser-live-lint-playground"
tier: "TOPIC"
published_at: "2026-09-02T13:07:33Z"
devto_id: 4556473
devto_url: "https://dev.to/ofri-peretz/i-shipped-eslint-to-the-browser-in-362-kb-now-my-blog-posts-lint-your-code-not-mine-3a4m"
cover_image: "https://ofriperetz.dev/cdn/blog-cover-image/eslint-in-the-browser-live-lint-playground.jpg"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/eslint-in-the-browser-live-lint-playground-og.jpg"
reading_time_minutes: 4
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
quality:
  panel_version: "1.0.0"
  reviewed: "2026-09-03"
  spec: sdlc/spec/eslint-in-the-browser-live-lint-playground.md
  lenses:
    growth_hook: 9.6
    security_correctness: 9.7
    structure_framing_voice: 9.6
    compatibility: 9.5
    reproducibility: 9.8
---

Every article about a lint rule has the same hole in it.

I paste a snippet, I paste the finding it produces. You think: _fine, but does it fire on **my** code?_ The article cannot answer — it can only ever show you someone else's code.

So I shipped the linter instead. On [the JWT article](https://ofriperetz.dev/articles/the-jwt-algorithm-none-attack-the-vulnerability-in-1-line-of-code-d9g) there is now a _Try it live_ button: paste your own `jwt.verify` call and the published rule runs on it, in your browser.

The reason is a number I did not expect.

## ESLint ships in 459 KB

`eslint/universal` exports the `Linter` class with no Node dependencies in its public surface: you hand it source text and a flat config, it hands you messages back.

It is a hard floor, not a polyfill: the `./universal` export first appears in **ESLint 9.11.0**. ESLint 9.10 and every ESLint 8 resolve it to nothing, so this recipe does not degrade on older majors — it fails at build time.

With **two real security plugins bundled inside it**:

|                                 | bytes       |
| ------------------------------- | ----------- |
| raw bundle                      | 1,764,382   |
| `brotli -q 11` locally          | 370,746     |
| **what the CDN actually sends** | **470,563** |

Quote the last row, not the second. I first published 362 KB, having confirmed `content-encoding: br` — which proves the encoding, not the size. The CDN compresses on the fly below `-q 11`, so the honest number is **459 KB**. Same artifact byte for byte; only the compressor differs.

Still the whole argument. At several megabytes you write a blog post about the rule. At 459 KB you ship the rule.

## The recipe

**The worker** holds the linter and never talks to a server:

```ts
import { Linter } from "eslint/universal";
import jwt from "eslint-plugin-jwt";

const PLUGINS = { jwt }; // enumerated, never dynamic
const linter = new Linter();

self.onmessage = ({ data: { id, code, pluginId, rules } }) => {
  const findings = linter.verify(code, {
    plugins: { [pluginId]: PLUGINS[pluginId] },
    languageOptions: { ecmaVersion: 2024, sourceType: "module" },
    rules,
  });
  self.postMessage({ id, findings }); // no network, ever
};
```

**The build step** is where the real work is — aliases and a banner:

```js
buildSync({
  entryPoints: ["src/workers/lint.worker.ts"],
  outfile: "public/lint-worker.js",
  bundle: true,
  minify: true,
  format: "iife",
  platform: "browser",
  // A worker global has no `process`. ESLint touches more of it than
  // NODE_ENV — cwd, platform, emitWarning — so stub it in a banner.
  banner: {
    js:
      'var process={env:{NODE_ENV:"production"},' +
      'platform:"browser",cwd:function(){return "/"},argv:[]};',
  },
  alias: {
    path: "path-browserify",
    "node:path": "path-browserify",
    fs: shims,
    os: shims,
    util: shims,
    // If anything in your graph pulls oxc-resolver, its native
    // bindings ride in and break the build. Rules never touch it.
    "oxc-resolver": shims,
  },
});
```

`shims` is a no-op `Proxy`, imported but never exercised.

**The client seam** is a lazy worker. The part worth copying is the failure path:

```ts
worker.onerror = () => {
  worker?.terminate();
  worker = null; // ← this line
  for (const entry of pending.values())
    entry.reject(new Error("worker failed"));
};
```

Nulling the singleton separates a playground that self-heals from one dead until reload. Without it every later lint posts into a corpse and the UI shows a clean result forever: "no findings" and "the analyzer is dead" look identical. So the surface renders **"unknown, not clean"** on failure, never an empty list.

## Three traps

**Don't let your framework bundle it.** Asking Next.js to build the worker means teaching both webpack and Turbopack about `node:` schemes: two fragile configs for one artifact. Use esbuild yourself.

**A real worker has no `process`.** My spike ran under Node so `ReferenceError: process is not defined` only appeared in the browser. A spike passing is not the thing working.

**Linting the artifact will OOM your editor.** ESLint tried to lint the 1.7 MB bundle and died with `Abort trap: 6`: heap exhaustion, not a native crash. Add `public/**` to `globalIgnores`.

## Try it

Both run published npm packages, the tarballs `npm install` gives you:

- **[JWT `alg:none`](https://ofriperetz.dev/articles/the-jwt-algorithm-none-attack-the-vulnerability-in-1-line-of-code-d9g)** — remove `"none"` from the algorithms array, watch the finding clear.
- **[node-security](https://ofriperetz.dev/articles/getting-started-eslint-plugin-node-security)** — three rules on an upload handler.

Nothing you type leaves the page — and the UI says so in as many words, because pasting auth code into a stranger's site deserves an explicit answer rather than an assumption.

## Reproduce it

Measured **2026-09-03** against eslint 9.39.4, eslint-plugin-jwt 2.2.14, eslint-plugin-node-security 5.2.3, esbuild 0.28.2, on Node 24.18. The build step itself inherits ESLint's floor, `^18.18.0 || ^20.9.0 || >=21.1.0` — there is no Oxlint variant of this recipe, because `eslint/universal` is ESLint's own export.

```bash
# from the repo root
node apps/blog/scripts/build-lint-worker.mjs
wc -c < apps/blog/public/lint-worker.js                  # 1764382
brotli -q 11 -c apps/blog/public/lint-worker.js | wc -c  # 370746
# what a reader actually downloads — measure this one, not the line above
curl -s -H 'Accept-Encoding: br' https://ofriperetz.dev/lint-worker.js | wc -c   # 470563
```

Those bytes drift as plugins ship rules; quote them with a date.

Browser-hosted linting is not new; [ESLint](https://eslint.org/play) and [typescript-eslint](https://typescript-eslint.io/play) both run excellent playgrounds. What is unusual is placement: not a destination you navigate to, but the rule the paragraph is arguing, running on your code, at the moment you wonder about it.

::dev-to-cta{url="https://github.com/ofri-peretz/eslint"}
⭐ Star the repo if you have ever wanted docs that run instead of assert.
::
