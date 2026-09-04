---
slug: eslint-in-the-browser-live-lint-playground
stage: spec
status: approved
intent: sdlc/intent/eslint-in-the-browser-live-lint-playground.md
gathered: 2026-09-03
---

## Thesis

ESLint's `Linter`, with two published security plugins bundled inside it,
reaches a reader's browser in 459 KB. That is small enough that the honest move
is to ship the linter rather than describe it.

**The evidence moved the claim, and this is the interesting part.** The article
first published the figure as **362 KB**. That number came from `brotli -q 11`
run locally, on the assumption that a `content-encoding: br` response header
meant the reader received the same bytes. It does not: the header proves the
encoding, never the size, and a CDN compresses on the fly at a lower quality
than `-q 11`. The served artifact is **470,563 bytes — 459 KB**, byte-identical
input, 27% larger over the wire. The thesis survives; the headline number did
not, and this spec exists so the corrected one is never re-derived from memory.

## Ground truth

Every number in the finished article appears below. Commands are written
pipe-free so a markdown table cannot truncate them, and every one was re-run
on the `gathered` date from the repo root.

| Claim                                                                                                                    | Value                           | Command                                                                                                                         | Version                         | Verified   |
| ------------------------------------------------------------------------------------------------------------------------ | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | ---------- |
| raw worker bundle, unminified over the wire                                                                              | 1764382 bytes                   | `wc -c < apps/blog/public/lint-worker.js`                                                                                       | esbuild 0.28.2                  | 2026-09-03 |
| local brotli ceiling — NOT what a reader downloads                                                                       | 370746 bytes                    | `brotli -q 11 -f -o /tmp/w.br apps/blog/public/lint-worker.js` then `wc -c < /tmp/w.br`                                         | brotli 1.1.0                    | 2026-09-03 |
| what the CDN actually sends — the quotable figure                                                                        | 470563 bytes                    | `curl -s -H 'Accept-Encoding: br' -o /tmp/served.br https://ofriperetz.dev/lint-worker.js` then `wc -c < /tmp/served.br`        | live deployment                 | 2026-09-03 |
| first version of `eslint` exporting `./universal`                                                                        | 9.11.0                          | `npm view eslint@9.10.0 exports --json` returns no `./universal`; `npm view eslint@9.11.0 exports --json` does                  | npm registry                    | 2026-09-03 |
| `./universal` absent from every ESLint 8                                                                                 | absent in 8.57.1                | `npm view eslint@8.57.1 exports --json`                                                                                         | eslint 8.57.1                   | 2026-09-03 |
| eslint the bundle was built against                                                                                      | 9.39.4                          | `node -p "JSON.parse(require('node:fs').readFileSync('node_modules/eslint/package.json','utf8')).version"`                      | 9.39.4                          | 2026-09-03 |
| eslint-plugin-jwt bundled                                                                                                | 2.2.14                          | `node -p "JSON.parse(require('node:fs').readFileSync('node_modules/eslint-plugin-jwt/package.json','utf8')).version"`           | 2.2.14                          | 2026-09-03 |
| eslint-plugin-node-security bundled                                                                                      | 5.2.3                           | `node -p "JSON.parse(require('node:fs').readFileSync('node_modules/eslint-plugin-node-security/package.json','utf8')).version"` | 5.2.3                           | 2026-09-03 |
| esbuild performing the bundle                                                                                            | 0.28.2                          | `node -p "JSON.parse(require('node:fs').readFileSync('node_modules/esbuild/package.json','utf8')).version"`                     | 0.28.2                          | 2026-09-03 |
| security plugins inside the worker                                                                                       | 2                               | `grep -c "^import .* from \"eslint-plugin-" apps/blog/src/workers/lint.worker.ts`                                               | jwt 2.2.14, node-security 5.2.3 | 2026-09-03 |
| rules the node-security embed enables                                                                                    | 3                               | read `rules` on the `getting-started-eslint-plugin-node-security` entry in `apps/blog/src/lib/lint-embeds.ts`                   | node-security 5.2.3             | 2026-09-03 |
| Node floor the build step inherits (semver `or` spelled out — the real separator is a pipe, which would split this cell) | ^18.18.0 or ^20.9.0 or >=21.1.0 | read `engines.node` from `node_modules/eslint/package.json`                                                                     | eslint 9.39.4                   | 2026-09-03 |
| Node the measurements were taken on                                                                                      | 24.18.0                         | `cat .nvmrc`                                                                                                                    | 24.18.0                         | 2026-09-03 |
| network calls the worker can make                                                                                        | none                            | `grep -n -e fetch -e XMLHttpRequest -e WebSocket -e importScripts apps/blog/src/workers/lint.worker.ts` exits 1                 | jwt 2.2.14                      | 2026-09-03 |

The article quotes **459 KB** as the round figure for 470,563 bytes
(470563 / 1024 = 459.5). No other rounding appears in the text.

## Known traps pre-empted

- [x] **Export shape** — the worker imports plugin default exports and uses
      them as `plugins: { [pluginId]: plugin }`. It never reads `.configs` off
      a default import, which is the crash this trap names.
- [x] **Rule counts** — the only count in the article is 3, read from the
      `rules` object the embed actually passes to `Linter.verify`, not from a
      directory listing.
- [x] **Config option names** — no rule options are configured; every rule is
      set to the bare `"error"` severity.
- [x] **Detection logic** — the node-security sample is an Express handler on
      purpose. `detect-child-process` is provenance-gated and stays silent
      unless the command resolves back to an attacker-reachable root, which is
      how an earlier version of that embed advertised three rules and could
      fire only one.
- [x] **Frozen identifiers** — this article is published. `slug`, `devto_id`,
      `devto_url`, `canonical_url`, `cover_image` and `social_image` are
      unchanged by the correction; only `title`, `description`,
      `reading_time_minutes` and the body move. The dev.to permalink still
      contains "362-kb" and stays that way — a stale number in a URL is
      accepted debt, and renaming it would 404 every inbound link.

## Outline

1. The hole in every lint-rule article — no evidence row; the premise.
2. **ESLint ships in 459 KB** — the three byte rows, and the `9.11.0` floor
   row directly after the `eslint/universal` sentence.
3. The recipe: worker, build step, client seam — versions rows.
4. Three traps — no numeric claims beyond the raw-bundle row (1.7 MB).
5. Try it — the "2 plugins" and "3 rules" rows.
6. Reproduce it — every byte row, restated as runnable commands with the
   repo-root prefix the reader needs.

## Framing check

Landscape throughout. The article names the ESLint and typescript-eslint
playgrounds as excellent prior art and states plainly that browser-hosted
linting is not new; its own contribution is stated as placement, not
superiority. No comparison table appears, so the self-graded-fixture
disclosure does not apply.
