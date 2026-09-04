---
slug: eslint-plugin-cold-start-optimization
stage: spec
intent: sdlc/intent/eslint-plugin-cold-start-optimization.md
status: approved
gathered: 2026-09-04
---

## Thesis

Two independent paths put a TypeScript compiler into every consumer's install:
our own non-optional peer, and a non-optional `typescript` peer that
`@typescript-eslint/utils` picked up partway through 8.x. Either alone is
sufficient, which is why marking our own peer optional changed nothing.

The evidence moved one claim hard. The draft said TypeScript 7's Go port is
2MB, framing the size problem as about to solve itself. Measured on the
`gathered` date, `typescript@7.0.2` — now npm's `latest` — installs **30.7MB**,
larger than the 24MB TypeScript 6 it replaces. The conclusion is unchanged and
better supported: the compiler did not shrink.

**Instrument.** Size rows are **install-tree** sizes — `npm init -y`, install
the single package, `du -sk node_modules` — not `dist.unpackedSize`. The two
differ by more than an order of magnitude for native packages (`oxc-resolver`
is 60KB unpacked and 1.6MB installed) and quoting the wrong one is the easiest
mistake to make in an article about size.

## Ground truth

| Claim                                                                          | Value                                           | Command                                                                                         | Version              | Verified   |
| ------------------------------------------------------------------------------ | ----------------------------------------------- | ----------------------------------------------------------------------------------------------- | -------------------- | ---------- |
| TypeScript 6 install tree, the headline number                                 | 24116 KB                                        | `npm i typescript@6.0.3` in an empty package then `du -sk node_modules`                         | typescript 6.0.3     | 2026-09-04 |
| TypeScript 7 install tree, the CORRECTED figure                                | 30732 KB                                        | `npm i typescript` in an empty package then `du -sk node_modules`                               | typescript 7.0.2     | 2026-09-04 |
| of which the platform-native Go binary                                         | 27132 KB                                        | `du -sk node_modules/@typescript/typescript-darwin-arm64` from that install                     | typescript 7.0.2     | 2026-09-04 |
| of which the JavaScript shim                                                   | 3600 KB                                         | `du -sk node_modules/typescript` from that install                                              | typescript 7.0.2     | 2026-09-04 |
| npm dist-tag `latest` for typescript                                           | 7.0.2                                           | `npm view typescript dist-tags`                                                                 | registry             | 2026-09-04 |
| utils subtree, the 4.5MB line item                                             | 4016 KB                                         | `du -sk node_modules/@typescript-eslint node_modules/ts-api-utils` after installing the package | utils 8.46.2         | 2026-09-04 |
| oxc-resolver install tree, the 1.5MB line item                                 | 1632 KB                                         | `npm i oxc-resolver` in an empty package then `du -sk node_modules`                             | oxc-resolver 11.24.2 | 2026-09-04 |
| utils 8.0.0 peers — the FIRST door is shut here                                | eslint only                                     | `npm view @typescript-eslint/utils@8.0.0 peerDependencies`                                      | 8.0.0                | 2026-09-04 |
| utils 8.46.2 peers — the SECOND door                                           | eslint AND typescript                           | `npm view @typescript-eslint/utils@8.46.2 peerDependencies`                                     | 8.46.2               | 2026-09-04 |
| the door is not optional                                                       | peerDependenciesMeta is empty                   | `npm view @typescript-eslint/utils@8.46.2 peerDependenciesMeta` returns nothing                 | 8.46.2               | 2026-09-04 |
| the peer appeared between these versions                                       | after 8.0.0, by 8.20.0                          | `npm view @typescript-eslint/utils@8.20.0 peerDependencies` already lists typescript            | 8.20.0               | 2026-09-04 |
| devkit declares zero runtime dependencies                                      | no `dependencies` field                         | `npm view @interlace/eslint-devkit dependencies` returns nothing                                | 1.19.2               | 2026-09-04 |
| devkit peers, all three optional                                               | matches the "Now" block in the article verbatim | `npm view @interlace/eslint-devkit peerDependencies peerDependenciesMeta`                       | 1.19.2               | 2026-09-04 |
| devkit eslint peer range (pipes spelled `or`; a literal pipe splits this cell) | ^8.40.0 or ^9.0.0 or ^10.0.0                    | same command                                                                                    | 1.19.2               | 2026-09-04 |
| plugins built on the devkit                                                    | 19                                              | `ls -d packages/eslint-plugin-*` in the monorepo                                                | monorepo at 2833399  | 2026-09-04 |
| devkit published unpacked size                                                 | 407996 bytes                                    | `npm view @interlace/eslint-devkit dist.unpackedSize`                                           | 1.19.2               | 2026-09-04 |
| npm auto-installs non-optional peers since npm 7                               | upstream issue reachable                        | `curl -s -o /dev/null -w '%{http_code}' -L https://github.com/npm/cli/issues/4828`              | live                 | 2026-09-04 |

**Not re-verified, and labelled as such in the article.** The timing figures
(devkit cold require 242ms to 13.6ms, 433 modules to 29, ESLint 288 to 216ms,
oxlint 320 to 145ms against a 68ms Rust floor, JS-plugin overhead 252 to 77ms),
the tarball census (20 packages, 5,432KB on Aug 2 to 3,037KB on Aug 23,
-44.1%), the devkit's own 339KB to 377KB, the 49% of rule modules loading
unused, the -70ms lazy-loading measurement and the 16.15 to 16.01ms JSDoc
result are all dated measurements taken at a pinned commit on one machine.
They are reproducible only against that commit and that hardware. The article
already says "timed at the pinned commit"; this spec records that they were
**not** re-run on 2026-09-04, rather than implying they were.

## Known traps pre-empted

- [x] **Export shape** — no plugin import appears; the code blocks are
      manifests, not configs.
- [x] **Rule counts** — none claimed. The 19 is a package count, taken from a
      directory of `eslint-plugin-*` packages, which is a directory listing but
      of packages rather than rules, so the `ls src/rules/` trap does not apply.
- [x] **Config option names** — none. The JSON blocks are `package.json` keys,
      each checked against the published manifest.
- [x] **Detection logic** — not applicable; no rule behaviour is claimed.
- [x] **Frozen identifiers** — unpublished. The slug carries no number.

## Outline

1. The compiler in `node_modules` — the two peer-door rows.
2. **Two numbers, and they are not the same number** — the tarball census
   rows, all marked not-re-verified.
3. **The three cuts** — the 24MB, 4.5MB and 1.5MB install-tree rows, and the
   devkit manifest rows.
4. **The part I got wrong** — the devkit unpacked-size row.
5. **What is still on the floor** — the 49% and -70ms rows, not re-verified.
6. Install — the peer-range row.

## Framing check

Landscape. `@typescript-eslint/utils` is described as having added a peer, with
the version where it happened, and not as having done something wrong — the
article's own manifest is the first door and is treated as the worse mistake.
No comparison table, so the fixture disclosure does not apply.
