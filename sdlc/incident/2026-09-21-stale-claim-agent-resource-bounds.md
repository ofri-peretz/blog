---
stage: incident
detected: 2026-09-21
detector: stale-claim
severity: 3sigma
articles: ["agent-resource-bounds", "ai-agent-unbounded-loop-audit", "ai-agents-rebranded-my-oss-ecosystem-two-pipelines-were-dead", "eslint-in-the-browser-live-lint-playground", "eslint-plugin-cold-start-optimization", "eslint-plugin-dependency-weight", "eslint-plugin-maintenance-signals", "injection-beyond-sql", "labelled-corpus-f1-leaderboard", "lint-harness-measured-nothing", "migrate-renamed-plugin-packages", "modernization-lint-as-codemod", "numbers-in-prose-rot", "rule-yield-distribution-own-plugin", "significance-from-a-lookup-table", "token-in-localstorage-field-study"]
intent: 
status: open
---

## What the detector saw

156 committed claim(s) no longer match the command that produced them.

```
agent-resource-bounds — installed SDK version under test
  expected 7.0.31   now node:internal/modules/cjs/loader:1568
  node -p "require('ai/package.json').version"
agent-resource-bounds — `stopWhen` defaults to a 1-step ceiling
  expected `stopWhen = isStepCount(1)`, at two call sites   now grep: node_modules/ai/dist/index.js: No such file or directory
  grep -no "stopWhen = [a-zA-Z0-9_()]*" node_modules/ai/dist/index.js
agent-resource-bounds — those two sites are `streamText`/`generateText`
  expected lines 4992 and 8439 of the same bundle   now /bin/sh: 1: Syntax error: EOF in backquote substitution
  same grep; compare against the `declare function` lines in `dist/index.d.ts
agent-resource-bounds — the rename landed in v5, not earlier
  expected `chore: rename maxTokens to maxOutputTokens`, under heading `## 5.0.0`   now /bin/sh: 1: ,: not found
  grep -n "rename maxTokens" node_modules/ai/CHANGELOG.md`, then read the nearest `##
agent-resource-bounds — plugin's declared ESLint range
  expected `^8.0.0 \   now /bin/sh: 1: \: not found
  \
agent-resource-bounds — plugin's declared Node minimum
  expected `>=18.0.0`   now /bin/sh: 1: Syntax error: EOF in backquote substitution
  node -p "require('./package.json').engines.node"` in the plugin package
ai-agent-unbounded-loop-audit — plugin under test
  expected 2.1.3   now node:internal/modules/cjs/loader:1568
  node -p "require('eslint-plugin-vercel-ai-security/package.json').version"
ai-agent-unbounded-loop-audit — linter under test
  expected 9.39.5   now 9.39.4
  node -p "require('eslint/package.json').version"
ai-agent-unbounded-loop-audit — candidate source files in the 14 repos
  expected 20,004   now /bin/sh: 1: →: not found
  npx tsx ai-bounds-sweep.mts <14 roots>` → `candidateFiles
ai-agent-unbounded-loop-audit — files importing the AI SDK
  expected 474   now /bin/sh: 1: Syntax error: EOF in backquote substitution
  same run → `sdkFiles
ai-agent-unbounded-loop-audit — **files with a generation call site**
  expected **116**  ← the denominator   now /bin/sh: 1: Syntax error: EOF in backquote substitution
  same run → `callFiles
ai-agent-unbounded-loop-audit — distinct projects in the corpus
  expected 14 (16 dirs − 2 duplicate clones)   now /bin/sh: 1: Syntax error: EOF in backquote substitution
  dedupe.ts` content fingerprint over the SDK-bearing dirs
ai-agent-unbounded-loop-audit — no output cap — files
  expected 103 of 116 (88.8%)   now /bin/sh: 1: Syntax error: EOF in backquote substitution
  same run → `bounds["…/require-max-tokens"].callFiles
ai-agent-unbounded-loop-audit — no output cap — repositories
  expected **12 of 14**   now /bin/sh: 1: Syntax error: EOF in backquote substitution
  verify.mts` per-repo breakdown
ai-agent-unbounded-loop-audit — no timeout — files / repos
  expected 50 of 116 (43.1%) / 9 of 14   now /bin/sh: 1: same: not found
  same
ai-agent-unbounded-loop-audit — no abort signal — files / repos
  expected 44 of 116 (37.9%) / 7 of 14   now /bin/sh: 1: same: not found
  same
ai-agent-unbounded-loop-audit — largest single contributor (`cloudflare_agents`)
  expected 52 of the 103 no-cap files (50.5%)   now /bin/sh: 1: Syntax error: EOF in backquote substitution
  verify.mts` per-repo breakdown
ai-agent-unbounded-loop-audit — parse/config errors across the run
  expected 0   now /bin/sh: 1: Syntax error: EOF in backquote substitution
  same run → `parseErrors
ai-agents-rebranded-my-oss-ecosystem-two-pipelines-were-dead — the pinned CLI exists and when it published
  expected 54.20.1 on 2026-07-03   now /bin/sh: 1: Syntax error: EOF in backquote substitution
  read `time['54.20.1']` from the npm registry document for `vercel
ai-agents-rebranded-my-oss-ecosystem-two-pipelines-were-dead — the drifted CLI exists and when it published
  expected 58.4.4 on 2026-07-30   now /bin/sh: 1: time[58.4.4]: not found
  read `time['58.4.4']` from the same document
ai-agents-rebranded-my-oss-ecosystem-two-pipelines-were-dead — majors an unpinned npx could cross in that window
  expected 4   now /bin/sh: 1: 54: not found
  54 to 58 between those two publish dates
ai-agents-rebranded-my-oss-ecosystem-two-pipelines-were-dead — every call consumes the pin, which is the article's own caveat
  expected 4 invocations   now npm warn exec The following package was not found and will be installed: vercel@59.23.2
  same file: `npx "vercel@$VERCEL_CLI_VERSION"` on the pull, both build calls and the deploy
ai-agents-rebranded-my-oss-ecosystem-two-pipelines-were-dead — the sibling deploy workflow is pinned too
  expected vercel@56.3.2   now name: Deploy production

# The only path from `main` to ofriperetz.dev.
#
# Build and test run here on GitHub Actions (free on public repos); Vercel
# receives only the prebuilt output. `github.enabled: false` in vercel.json
# keeps Vercel's own GitHub app from building or previewing anything.
#
# Secrets: VERCEL_ORG_ID + VERCEL_PROJECT_ID (repo-level), VERCEL_TOKEN
# (scoped to the `production` environment so nothing else can read it).

on:
  push:
    branches: [main]
  workflow_dispatch:

concurrency:
  group: deploy-production
  cancel-in-progress: false

env:
  APEX: ofriperetz.dev
  SITE_URL: https://ofriperetz.dev
  VERCEL_CLI_VERSION: 54.20.1

jobs:
  deploy:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    environment:
      name: production
      url: https://ofriperetz.dev  # must be a literal; env is not available here
    env:
      VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
      VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
      VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}

    steps:
      # ── Setup ────────────────────────────────────────────────────────────
      - uses: actions/checkout@v7

      - uses: actions/setup-node@v7
        with:
          node-version-file: .nvmrc
          # v7 auto-caches when package.json declares a packageManager, then
          # hard-fails on the missing lockfile this repo deliberately does not
          # commit. The Restore npm cache step below covers ~/.npm instead,
          # keyed on manifests rather than a lockfile.
          package-manager-cache: false

      # The lockfile is intentionally uncommitted (exact versions come from
      # .npmrc) so linux never inherits darwin native bindings — which rules
      # out setup-node's lockfile-keyed cache, but not caching the npm
      # download dir. Keyed on the manifests that decide what gets installed.
      - name: Restore npm cache
        uses: actions/cache@v6
        with:
          path: ~/.npm
          key: npm-${{ runner.os }}-${{ hashFiles('package.json', 'apps/*/package.json', '.npmrc') }}
          restore-keys: npm-${{ runner.os }}-

      - name: Install dependencies
        run: npm install --no-audit --no-fund --include=optional

      # ── Gates: nothing ships unless these pass ───────────────────────────
      - name: Test
        run: npm run test

      - name: Lint
        run: npm run lint

      # ── Build ────────────────────────────────────────────────────────────
      # Only `vercel build` runs: it produces .vercel/output AND fails on the
      # same compile errors `npm run build` would catch, so running both just
      # built the app twice. CI already gates build on the PR.
      - name: Install Vercel CLI
        run: npm i -g vercel@${{ env.VERCEL_CLI_VERSION }}

      # Must run from the repo root: the project's Root Directory is apps/blog
      # and the CLI resolves it relative to CWD (running inside apps/blog gives
      # apps/blog/apps/blog). --token is explicit; the CLI ignores the env var.
      - name: Pull Vercel project settings
        run: vercel pull --yes --environment=production --token="$VERCEL_TOKEN"

      - name: Build
        run: vercel build --prod --token="$VERCEL_TOKEN"
        env:
          NEXT_PUBLIC_SITE_URL: ${{ env.SITE_URL }}

      # ── Deploy ───────────────────────────────────────────────────────────
      # Two separate flags, both needed — conflating them cost several runs:
      #   --skip-domain  disables auto-aliasing (we alias ourselves below)
      #   --no-wait      returns as soon as the deployment is queued
      # Without --no-wait the CLI blocks on "Running Checks…", which never
      # resolve here: ssoProtection (all_except_custom_domains) puts every
      # *.vercel.app URL behind an SSO redirect the checks cannot get past.
      # That hung ten deploys. Since we no longer wait, the next step polls
      # for READY itself before promoting.
      - name: Deploy
        id: deploy
        timeout-minutes: 8
        run: |
          set -euo pipefail
          url=$(vercel deploy --prebuilt --prod --skip-domain --no-wait --token="$VERCEL_TOKEN" | tail -1)
          [ -n "$url" ] || { echo "::error::vercel deploy returned no URL"; exit 1; }
          echo "url=$url" >> "$GITHUB_OUTPUT"
          echo "deployed: $url"

      # The apex has a promotion pin that has silently swallowed promotes
      # before (see incident-ledger.md). `alias set` is a different API path,
      # so try it when promote does not take.
      - name: Promote to apex
        timeout-minutes: 5
        env:
          # Via env, never inlined into the script: `${{ }}` is substituted as
          # text before bash parses the line, so a value containing a quote
          # would break out of it (CWE-78).
          URL: ${{ steps.deploy.outputs.url }}
        run: |
          set -euo pipefail
          # --no-wait means the deployment may still be building. Poll for
          # READY (its own state, not the checks) before promoting.
          # Poll the REST API, not `vercel inspect`: the CLI prints an
          # ANSI-coloured, title-case "status  ● Ready" line that is fragile to
          # parse (an earlier grep for /READY/ matched nothing and every poll
          # read "unknown"). readyState is a plain uppercase enum.
          # 24 x 10s = 240s, inside this step's 5m budget.
          # Strip any trailing slash first: on "https://host/" a bare
          # ${URL##*/} would yield an empty id and every poll would 4xx.
          id="${URL%/}"; id="${id##*/}"
          [ -n "$id" ] || { echo "::error::could not derive deployment id from '$URL'"; exit 1; }
          state=""
          for _ in $(seq 1 24); do
            state=$(curl -sf -H "Authorization: Bearer $VERCEL_TOKEN" \
              "https://api.vercel.com/v13/deployments/${id}?teamId=${VERCEL_ORG_ID}" \
              | python3 -c 'import sys,json;print(json.load(sys.stdin).get("readyState",""))' 2>/dev/null || true)
            echo "  deployment state: ${state:-unknown}"
            case "$state" in
              READY) break ;;
              ERROR|CANCELED) echo "::error::deployment ended in $state"; exit 1 ;;
            esac
            sleep 10
          done

          # Never promote something that never reached READY — falling through
          # would alias the apex to a half-built deployment.
          if [ "$state" != "READY" ]; then
            echo "::error::$URL stuck in '${state:-unknown}' after 240s; not promoting."
            exit 1
          fi

          vercel promote "$URL" --yes --token="$VERCEL_TOKEN" \
            || vercel alias set "$URL" "$APEX" --token="$VERCEL_TOKEN" \
            || echo "promote and alias both failed — the verify step decides"

      # A green promote has historically meant nothing: deployments reached
      # Ready while the apex kept serving a six-day-old build. So check — but
      # ask the alias itself which deployment it points at, rather than
      # fingerprinting the HTML.
      #
      # (The previous version fetched /_next/BUILD_ID, which 404s on this
      # site. Both reads came back empty, so it reported "still serves
      # 'unknown'" on a deploy that had actually succeeded — a false alarm on
      # a green deploy, which is exactly the kind of wrong signal this step
      # exists to prevent.)
      - name: Verify apex serves this build
        timeout-minutes: 2
        env:
          URL: ${{ steps.deploy.outputs.url }}
        run: |
          set -euo pipefail
          host="${URL%/}"; host="${host##*/}"

          want=$(curl -sf -H "Authorization: Bearer $VERCEL_TOKEN" \
            "https://api.vercel.com/v13/deployments/${host}?teamId=${VERCEL_ORG_ID}" \
            | python3 -c 'import sys,json;print(json.load(sys.stdin).get("id",""))')
          [ -n "$want" ] || { echo "::error::could not resolve deployment id for $host"; exit 1; }
          echo "expecting apex -> $want"

          for _ in $(seq 1 6); do
            got=$(curl -sf -H "Authorization: Bearer $VERCEL_TOKEN" \
              "https://api.vercel.com/v4/aliases/${APEX}?teamId=${VERCEL_ORG_ID}" \
              | python3 -c 'import sys,json;print(json.load(sys.stdin).get("deploymentId",""))' 2>/dev/null || true)
            if [ "$got" = "$want" ]; then
              echo "apex verified: https://$APEX -> $want"
              exit 0
            fi
            echo "  apex currently -> ${got:-unknown}"
            sleep 5
          done

          echo "::error::https://$APEX points at '${got:-unknown}', expected '$want'."
          echo "::error::Promote did not take. Promote manually in the Vercel"
          echo "::error::dashboard (Project -> Deployments), then re-run."
          exit 1

      # Layout + contrast on the REAL deployed site. This runs after promote,
      # not before, because preview *.vercel.app URLs sit behind the SSO
      # redirect these checks cannot get past (see the Deploy step above) —
      # the apex is the first URL that is actually auditable.
      #
      # It therefore detects a regression rather than blocking it. That is
      # still the right trade: the alternative is auditing nothing. The cheap
      # half of the strategy — token contrast and the structural rules — DOES
      # gate every PR, in `npm test`.
      #
      # Drives the runner's preinstalled Chrome over CDP with node's built-in
      # WebSocket (node 24 via .nvmrc). No Playwright, nothing to install.
      # 12, not 5, and the step name no longer lies: the matrix is 16 viewports
      # x 9 routes x 2 themes = 288 combinations, not "6 routes".
      #
      # (16, not 14: VIEWPORTS is 4 narrow + 4 breakpoints x 2 + 2 wide + the
      # 2 zoom entries #127 added. An earlier revision of this comment said 14
      # and 252 while citing "286/288" three lines down — the second number was
      # right and the first was arithmetic done from memory. Review caught it.)
      #
      # The cause named in the previous revision of this comment is now fixed
      # rather than budgeted around. It read: "the script navigates afresh for
      # EVERY combination and then waits a fixed 600ms for webfonts — ~150s of
      # the 218s is that sleep. Navigating once per (route, theme) and resizing
      # between viewports would cut it by more than half. That is a change to
      # the measurement itself and wants its own PR with a before/after
      # comparison proving identical findings."
      #
      # It got one. The script now navigates once per (route, theme) — 18
      # navigations instead of 288 — and resizes between viewports.
      #
      # MEASURED against production, same machine, same 288 combinations:
      # 289s before, 111s after. 12 minutes was headroom for a run that sat on
      # a 300s ceiling; 6 is more than double the new figure and fails a hung
      # run four times sooner.
      - name: Audit layout + contrast (16 viewports x 9 routes x 2 themes)
        timeout-minutes: 6
        env:
          BASE: https://ofriperetz.dev
          CHROME: /usr/bin/google-chrome
        working-directory: apps/blog
        run: node scripts/layout-audit.mjs
  git show origin/main:.github/workflows/deploy.yml
eslint-in-the-browser-live-lint-playground — raw worker bundle, unminified over the wire
  expected 1764382 bytes   now /bin/sh: 1: cannot open apps/blog/public/lint-worker.js: No such file
  wc -c < apps/blog/public/lint-worker.js
eslint-in-the-browser-live-lint-playground — local brotli ceiling — NOT what a reader downloads
  expected 370746 bytes   now /bin/sh: 1: cannot open /tmp/w.br: No such file
  brotli -q 11 -f -o /tmp/w.br apps/blog/public/lint-worker.js` then `wc -c < /tmp/w.br
eslint-in-the-browser-live-lint-playground — what the CDN actually sends — the quotable figure
  expected 470563 bytes   now /bin/sh: 1: cannot open /tmp/served.br: No such file
  curl -s -H 'Accept-Encoding: br' -o /tmp/served.br https://ofriperetz.dev/lint-worker.js` then `wc -c < /tmp/served.br
eslint-in-the-browser-live-lint-playground — first version of `eslint` exporting `./universal`
  expected 9.11.0   now /bin/sh: 1: Syntax error: ";" unexpected
  npm view eslint@9.10.0 exports --json` returns no `./universal`; `npm view eslint@9.11.0 exports --json` does
eslint-in-the-browser-live-lint-playground — `./universal` absent from every ESLint 8
  expected absent in 8.57.1   now {
  ".": "./lib/api.js",
  "./package.json": "./package.json",
  "./use-at-your-own-risk": "./lib/unsupported-api.js"
}
  npm view eslint@8.57.1 exports --json
eslint-in-the-browser-live-lint-playground — rules the node-security embed enables
  expected 3   now /bin/sh: 1: Syntax error: EOF in backquote substitution
  read `rules` on the `getting-started-eslint-plugin-node-security` entry in `apps/blog/src/lib/lint-embeds.ts
eslint-in-the-browser-live-lint-playground — Node floor the build step inherits (semver `or` spelled out — the real separator is a pipe, which would split this cell)
  expected ^18.18.0 or ^20.9.0 or >=21.1.0   now /bin/sh: 1: Syntax error: EOF in backquote substitution
  read `engines.node` from `node_modules/eslint/package.json
eslint-plugin-cold-start-optimization — TypeScript 6 install tree, the headline number
  expected 24116 KB   now /bin/sh: 1: Syntax error: "in" unexpected
  npm i typescript@6.0.3` in an empty package then `du -sk node_modules
eslint-plugin-cold-start-optimization — TypeScript 7 install tree, the CORRECTED figure
  expected 30732 KB   now /bin/sh: 1: Syntax error: "in" unexpected
  npm i typescript` in an empty package then `du -sk node_modules
eslint-plugin-cold-start-optimization — of which the platform-native Go binary
  expected 27132 KB   now /bin/sh: 1: Syntax error: EOF in backquote substitution
  du -sk node_modules/@typescript/typescript-darwin-arm64` from that install
eslint-plugin-cold-start-optimization — of which the JavaScript shim
  expected 3600 KB   now /bin/sh: 1: Syntax error: EOF in backquote substitution
  du -sk node_modules/typescript` from that install
eslint-plugin-cold-start-optimization — npm dist-tag `latest` for typescript
  expected 7.0.2   now {
  dev: '3.9.4',
  'tag-for-publishing-older-releases': '4.1.6',
  insiders: '4.6.2-insiders.20220225',
  beta: '6.0.0-beta',
  rc: '7.0.1-rc',
  latest: '7.0.2',
  next: '7.1.0-dev.20260921.1'
}
  npm view typescript dist-tags
eslint-plugin-cold-start-optimization — utils subtree, the 4.5MB line item
  expected 4016 KB   now /bin/sh: 1: Syntax error: EOF in backquote substitution
  du -sk node_modules/@typescript-eslint node_modules/ts-api-utils` after installing the package
eslint-plugin-cold-start-optimization — oxc-resolver install tree, the 1.5MB line item
  expected 1632 KB   now /bin/sh: 1: Syntax error: "in" unexpected
  npm i oxc-resolver` in an empty package then `du -sk node_modules
eslint-plugin-cold-start-optimization — the peer appeared between these versions
  expected after 8.0.0, by 8.20.0   now /bin/sh: 1: Syntax error: EOF in backquote substitution
  npm view @typescript-eslint/utils@8.20.0 peerDependencies` already lists typescript
eslint-plugin-cold-start-optimization — devkit eslint peer range (pipes spelled `or`; a literal pipe splits this cell)
  expected ^8.40.0 or ^9.0.0 or ^10.0.0   now /bin/sh: 1: same: not found
  same command
eslint-plugin-cold-start-optimization — plugins built on the devkit
  expected 19   now /bin/sh: 1: Syntax error: EOF in backquote substitution
  ls -d packages/eslint-plugin-*` in the monorepo
eslint-plugin-cold-start-optimization — devkit published unpacked size
  expected 407996 bytes   now 407943
  npm view @interlace/eslint-devkit dist.unpackedSize
eslint-plugin-dependency-weight — bare eslint, the baseline (article: 69)
  expected 69   now /bin/sh: 1: Syntax error: EOF in backquote substitution
  npm i --package-lock-only eslint` then count `node_modules/` keys
eslint-plugin-dependency-weight — eslint-plugin-import tree (article: 205)
  expected 205   now /bin/sh: 1: same,: not found
  same, for that plugin
eslint-plugin-dependency-weight — eslint-plugin-react tree (article: 204)
  expected 204   now /bin/sh: 1: same: not found
  same
eslint-plugin-dependency-weight — eslint-plugin-jsx-a11y tree (article: 194)
  expected 194   now /bin/sh: 1: same: not found
  same
eslint-plugin-dependency-weight — eslint-plugin-unicorn tree (article: 110)
  expected 110   now /bin/sh: 1: same: not found
  same
eslint-plugin-dependency-weight — eslint-plugin-sonarjs tree (article: 83)
  expected 83   now /bin/sh: 1: same: not found
  same
eslint-plugin-dependency-weight — eslint-plugin-n tree (article: 80)
  expected 80   now /bin/sh: 1: same: not found
  same
eslint-plugin-dependency-weight — eslint-plugin-promise tree (article: 70)
  expected 70   now /bin/sh: 1: same: not found
  same
eslint-plugin-dependency-weight — eslint-plugin-security tree, the outlier (article: 3)
  expected 3   now /bin/sh: 1: same: not found
  same
eslint-plugin-dependency-weight — eslint-plugin-react-features tree (article: 71)
  expected 71   now /bin/sh: 1: same: not found
  same
eslint-plugin-dependency-weight — eslint-plugin-modernization tree (article: 71)
  expected 71   now /bin/sh: 1: same: not found
  same
eslint-plugin-dependency-weight — eslint-plugin-browser-security tree (article: 71)
  expected 71   now /bin/sh: 1: same: not found
  same
eslint-plugin-dependency-weight — eslint-plugin-import-next tree (article: 97)
  expected 97   now /bin/sh: 1: same: not found
  same
eslint-plugin-dependency-weight — the combined React setup (article: 228)
  expected 228   now /bin/sh: 1: same,: not found
  same, installing eslint plus react, jsx-a11y and import together
eslint-plugin-dependency-weight — the union is far below the sum of parts
  expected 228 vs 465   now /bin/sh: 1: 69+135+125+136: not found
  69+135+125+136 = 465 against a measured 228
eslint-plugin-maintenance-signals — jsx-a11y days since release (article: 655)
  expected 654   now /bin/sh: 1: time[dist-tags.latest]: not found
  fetch registry, read `time[dist-tags.latest]`, diff to 2026-08-12
eslint-plugin-maintenance-signals — react days since release (article: 495)
  expected 495   now /bin/sh: 1: same: not found
  same
eslint-plugin-maintenance-signals — import days since release (article: 417)
  expected 417   now /bin/sh: 1: same: not found
  same
eslint-plugin-maintenance-signals — scanjs-rules, dead tier (article: 3,296)
  expected 3295   now /bin/sh: 1: same: not found
  same
eslint-plugin-maintenance-signals — node, dead tier (article: 2,328)
  expected 2327   now /bin/sh: 1: same: not found
  same
eslint-plugin-maintenance-signals — standard, dead tier (article: 2,088)
  expected 2087   now /bin/sh: 1: same: not found
  same
eslint-plugin-maintenance-signals — flowtype, dead tier (article: 1,748)
  expected 1747   now /bin/sh: 1: same: not found
  same
eslint-plugin-maintenance-signals — xss, dead tier (article: 1,507)
  expected 1506   now /bin/sh: 1: same: not found
  same
eslint-plugin-maintenance-signals — security-node, dead tier (article: 951)
  expected 951   now /bin/sh: 1: same: not found
  same
eslint-plugin-maintenance-signals — the false-reassurance gap that creates
  expected 1548 days   now /bin/sh: 1: difference: not found
  difference between those two dates
eslint-plugin-maintenance-signals — security 3.0.1 publish date (article: June 2024)
  expected 2024-06-14   now /bin/sh: 1: Syntax error: EOF in backquote substitution
  read `time['3.0.1']
eslint-plugin-maintenance-signals — security 4.0.0 publish date (article: February 2026)
  expected 2026-02-19   now /bin/sh: 1: Syntax error: EOF in backquote substitution
  read `time['4.0.0']
eslint-plugin-maintenance-signals — security shipped again in June (article: June)
  expected 2026-06-12, v4.0.1   now /bin/sh: 1: Syntax error: EOF in backquote substitution
  read `time['4.0.1']
eslint-plugin-maintenance-signals — the silence between those two releases (article: 20 months)
  expected 20 months   now /bin/sh: 1: 2024-06-14: not found
  2024-06-14 to 2026-02-19
eslint-plugin-maintenance-signals — releases in 12mo for the three quiet plugins
  expected 0 each   now /bin/sh: 1: count: not found
  count version entries within 365 days of 2026-08-12
injection-beyond-sql — children of CWE-943, Research Concepts view
  expected exactly 4 — 89, 90, 643, 652   now /bin/sh: 1: ParentOf: not found
  on that page, read every `ParentOf` row under "Relevant to the view Research Concepts (View-1000)"
injection-beyond-sql — OWASP category the family folds into
  expected A03:2021 Injection   now /bin/sh: 1: Syntax error: EOF in backquote substitution
  curl -s -o /dev/null -w '%{http_code}' https://owasp.org/Top10/A03_2021-Injection/` returns 200
injection-beyond-sql — internal article links in the body
  expected all 5 resolve to files   now /bin/sh: 1: cannot open slug: No such file
  check `apps/blog/content/articles/<slug>.md` exists for each `/articles/` link
labelled-corpus-f1-leaderboard — labelled corpus size
  expected 69 vulnerable fixtures (TP+FN = 69 on every row)   now /bin/sh: 1: Syntax error: EOF in backquote substitution
  BENCHMARK-RESULTS.md` B2b table
labelled-corpus-f1-leaderboard — Interlace
  expected TP 69 / FP 0 / FN 0 — F1 100%   now /bin/sh: 1: same: not found
  same table
labelled-corpus-f1-leaderboard — eslint-plugin-sonarjs
  expected TP 27 / FP 9 / FN 42 — F1 51.4%   now /bin/sh: 1: same: not found
  same table
labelled-corpus-f1-leaderboard — eslint-plugin-security
  expected TP 10 / FP 7 / FN 59 — F1 23.3%   now /bin/sh: 1: same: not found
  same table
labelled-corpus-f1-leaderboard — @microsoft/eslint-plugin-sdl
  expected TP 6 / FP 2 / FN 63 — F1 15.6%   now /bin/sh: 1: same: not found
  same table
labelled-corpus-f1-leaderboard — eslint-plugin-no-unsanitized
  expected TP 4 / FP 1 / FN 65 — F1 10.8%   now /bin/sh: 1: same: not found
  same table
labelled-corpus-f1-leaderboard — eslint-plugin-security-node
  expected TP 4 / FP 3 / FN 65 — F1 10.5%   now /bin/sh: 1: same: not found
  same table
labelled-corpus-f1-leaderboard — every published F1 recomputes from its own TP/FP/FN
  expected 6 of 6 match to within 0.1pp   now /bin/sh: 1: Syntax error: word unexpected (expecting ")")
  2·P·R/(P+R)` recomputed independently of the document
labelled-corpus-f1-leaderboard — best community precision
  expected 80% — eslint-plugin-no-unsanitized (4 TP / 1 FP)   now /bin/sh: 1: derived: not found
  derived from the same table
lint-harness-measured-nothing — that skip is completely silent
  expected `exit=0`, empty stdout, empty stderr   now /bin/sh: 1: same: not found
  same run, with the only other file clean
lint-harness-measured-nothing — a path outside `cwd` yields zero and exit 0
  expected `exit=0`, empty stderr   now /bin/sh: 1: Syntax error: redirection unexpected
  eslint --no-config-lookup --config <cfg> <file outside cwd>
lint-harness-measured-nothing — that combination produced a false clean sweep
  expected 100 files scanned, 0 findings, 14 of 14 rules reported zero-yield   now /bin/sh: 1: cwd: not found
  rule-yield harness before the `cwd` fix
lint-harness-measured-nothing — the same corpus after the fix
  expected 308 findings across 54 of the same 100 files   now /bin/sh: 1: cwd: not found
  identical harness, `cwd` set to the target
migrate-renamed-plugin-packages — successor postgresql-security version
  expected 2.2.1   now 2.3.5
  npm view eslint-plugin-postgresql-security version
migrate-renamed-plugin-packages — successor jwt-security version
  expected 3.0.3   now 3.3.0
  npm view eslint-plugin-jwt-security version
modernization-lint-as-codemod — rules in the published package
  expected 4   now /bin/sh: 1: Syntax error: EOF in backquote substitution
  node -p "Object.keys(require('eslint-plugin-modernization').rules).length"` after installing 3.1.2
modernization-lint-as-codemod — peer range (pipes spelled as `or`, a literal pipe would split this cell)
  expected ^8.40.0 or ^9.0.0 or ^10.0.0   now /bin/sh: 1: peerDependencies.eslint: not found
  read `peerDependencies.eslint` from the installed package.json
modernization-lint-as-codemod — Node floor
  expected >=18.0.0   now /bin/sh: 1: engines.node: not found
  read `engines.node` from the installed package.json
modernization-lint-as-codemod — RE-RUN files linted, apps/blog/src
  expected 189   now /bin/sh: 1: Syntax error: EOF in backquote substitution
  walk `.ts`/`.tsx` under `apps/blog/src`, excluding `node_modules`, `dist`, `.next`, `build`, `.d.ts
modernization-lint-as-codemod — RE-RUN total modernization findings
  expected 8 in 6 files   now /bin/sh: 1: Syntax error: EOF in backquote substitution
  Linter.verify` per file with the four rules at error, filename passed RELATIVE to the walk root
modernization-lint-as-codemod — RE-RUN prefer-at
  expected 6   now /bin/sh: 1: same: not found
  same run
modernization-lint-as-codemod — RE-RUN prefer-template-literal
  expected 2   now /bin/sh: 1: same: not found
  same run
modernization-lint-as-codemod — RE-RUN no-instanceof-array and prefer-event-target
  expected 0 each   now /bin/sh: 1: same: not found
  same run
modernization-lint-as-codemod — RE-RUN files matching no config (the vacuity guard)
  expected 0   now /bin/sh: 1: ruleId: not found
  count messages with a null `ruleId` in the same run
modernization-lint-as-codemod — harness fires on planted violations
  expected 3 findings   now /bin/sh: 1: Syntax error: EOF in backquote substitution
  run the same config over a file containing `a[a.length-1]`, `"x " + y` and `instanceof Array
modernization-lint-as-codemod — RE-RUN react-no-inline-functions, same tree, same day
  expected 110   now /bin/sh: 1: react-features/react-no-inline-functions: not found
  same harness, rule `react-features/react-no-inline-functions` at error
modernization-lint-as-codemod — the noisy rule fires on a `.map()` arrow in JSX
  expected 1 finding on a one-component file   now /bin/sh: 1: Syntax error: word unexpected (expecting ")")
  Linter.verify` on `xs.map(x => <li key={x}>{x}</li>)
modernization-lint-as-codemod — HISTORICAL files linted, four repos
  expected 389   now /bin/sh: 1: the: not found
  the same four-rule run, as published
modernization-lint-as-codemod — HISTORICAL findings
  expected 55 in 36 files   now Assembler messages:
  as published; 11 + 44 = 55, internally consistent
modernization-lint-as-codemod — HISTORICAL prefer-at
  expected 11   now Assembler messages:
  as published
modernization-lint-as-codemod — HISTORICAL prefer-template-literal
  expected 44   now Assembler messages:
  as published
modernization-lint-as-codemod — HISTORICAL react-no-inline-functions
  expected 476   now Assembler messages:
  as published
numbers-in-prose-rot — the canonical corpus totals
  expected interlace 1,375 / the compared set 23,325 across 20 repos, 23,682 files   now /bin/sh: 1: realSource: not found
  read `realSource` from benchmark-2026-08-14.json
numbers-in-prose-rot — document asserts a different pair
  expected "981 findings at 47% precision against 21,557 at 20%"   now Command failed: read from the queue document
  read from the queue document
numbers-in-prose-rot — a real figure attached to the wrong set
  expected document says "every other rule combined accounts for 0.6%"   now Command failed: read from the queue document
  read from the queue document
numbers-in-prose-rot — what 0.6% actually is
  expected the bottom FIVE rules — 142 of 23,325   now /bin/sh: 1: Syntax error: EOF in backquote substitution
  summed from the compared side of `realSource.byRule
numbers-in-prose-rot — what "every other rule" actually is
  expected 2,991 — 12.8%   now /bin/sh: 1: 23,325: not found
  23,325 − 20,334
numbers-in-prose-rot — the figure that does verify
  expected `security/detect-object-injection` 20,334 of 23,325 = 87.2%   now /bin/sh: 1: same: not found
  same byRule map
numbers-in-prose-rot — two further claims contradicted by data
  expected `detect-crlf` "297 files" and `unhandled-async` "176 files"; result files record 1 each   now /bin/sh: 1: Syntax error: EOF in backquote substitution
  grep` of the rule ids in the result JSONs
rule-yield-distribution-own-plugin — rules unique to react-features (no eslint-plugin-react counterpart)
  expected 14   now /bin/sh: 1: Syntax error: EOF in backquote substitution
  bare rule names of `eslint-plugin-react-features` minus rule names of `eslint-plugin-react
rule-yield-distribution-own-plugin — files scanned
  expected 100 `.tsx`   now apps/blog/src/__tests__/article-threads-lock.test.tsx
apps/blog/src/__tests__/hero-strand-lock.test.tsx
apps/blog/src/__tests__/homepage-lock.test.tsx
apps/blog/src/__tests__/resume-thread-lock.test.tsx
apps/blog/src/__tests__/bench-receipts-lock.test.tsx
apps/blog/src/__tests__/article-receipts-lock.test.tsx
apps/blog/src/__tests__/plugin-cards-lock.test.tsx
apps/blog/src/__tests__/corpus-map-lock.test.tsx
apps/blog/src/__tests__/reading-strand-lock.test.tsx
apps/blog/src/__tests__/number-ticker-ssr-lock.test.tsx
apps/blog/src/__tests__/your-thread-lock.test.tsx
apps/blog/src/__tests__/scorecard-lock.test.tsx
apps/blog/src/__tests__/series-navigator-lock.test.tsx
apps/blog/src/__tests__/article-code-copy-lock.test.tsx
apps/blog/src/__tests__/lint-run-toc-lock.test.tsx
apps/blog/src/__tests__/numbered-sections-lock.test.tsx
apps/blog/src/app/global-error.tsx
apps/blog/src/app/page.tsx
apps/blog/src/app/error.tsx
apps/blog/src/app/foundations/page.tsx
apps/blog/src/app/og/route.tsx
apps/blog/src/app/articles/page.tsx
apps/blog/src/app/articles/[slug]/page.tsx
apps/blog/src/app/articles/[slug]/loading.tsx
apps/blog/src/app/articles/loading.tsx
apps/blog/src/app/npm/page.tsx
apps/blog/src/app/loom/page.tsx
apps/blog/src/app/scorecard/page.tsx
apps/blog/src/app/scorecard/error.tsx
apps/blog/src/app/not-found.tsx
apps/blog/src/app/layout.tsx
apps/blog/src/components/home/hero-backdrop.tsx
apps/blog/src/components/read-tick.tsx
apps/blog/src/components/theme-provider.tsx
apps/blog/src/components/theme-toggle.tsx
apps/blog/src/components/mobile-nav.tsx
apps/blog/src/components/markdown-article.tsx
apps/blog/src/components/reading-depth.tsx
apps/blog/src/components/npm/install-snippet.tsx
apps/blog/src/components/npm/sparkline.tsx
apps/blog/src/components/npm/package-card.tsx
apps/blog/src/components/floating-toc.tsx
apps/blog/src/components/loom/loom-composer.tsx
apps/blog/src/components/corpus-search.tsx
apps/blog/src/components/article-playground.tsx
apps/blog/src/components/article-code-block.tsx
apps/blog/src/components/ui/meteors.tsx
apps/blog/src/components/ui/reading-strand.tsx
apps/blog/src/components/ui/code-block.tsx
apps/blog/src/components/ui/border-beam.tsx
apps/blog/src/components/ui/code-editor.tsx
apps/blog/src/components/ui/timeline-map.tsx
apps/blog/src/components/ui/hero-strand.tsx
apps/blog/src/components/ui/number-ticker.tsx
apps/blog/src/components/ui/input.tsx
apps/blog/src/components/ui/section-index.tsx
apps/blog/src/components/ui/badge.tsx
apps/blog/src/components/ui/newsletter-form.tsx
apps/blog/src/components/ui/toggle.tsx
apps/blog/src/components/ui/typography.tsx
apps/blog/src/components/ui/checkbox.tsx
apps/blog/src/components/ui/skeleton.tsx
apps/blog/src/components/ui/stack.tsx
apps/blog/src/components/ui/time-series.tsx
apps/blog/src/components/ui/container.tsx
apps/blog/src/components/ui/avatar.tsx
apps/blog/src/components/ui/cloud-particles.tsx
apps/blog/src/components/ui/command-palette.tsx
apps/blog/src/components/ui/section.tsx
apps/blog/src/components/ui/button.tsx
apps/blog/src/components/ui/dialog.tsx
apps/blog/src/components/ui/form.tsx
apps/blog/src/components/ui/radial-weave.tsx
apps/blog/src/components/ui/sheet.tsx
apps/blog/src/components/ui/card.tsx
apps/blog/src/components/ui/series-table.tsx
apps/blog/src/components/ui/sunny-background.tsx
apps/blog/src/components/ui/article-card.tsx
apps/blog/src/components/ui/data-state.tsx
apps/blog/src/components/ui/lint-playground.tsx
apps/blog/src/components/ui/delta.tsx
apps/blog/src/components/series-nav.tsx
apps/blog/src/components/tracked-link.tsx
apps/blog/src/components/article-threads.tsx
apps/blog/src/components/article-bench-receipt.tsx
apps/blog/src/components/structured-data.tsx
apps/blog/src/components/landing/agenda.tsx
apps/blog/src/components/landing/also-building.tsx
apps/blog/src/components/landing/devto-articles.tsx
apps/blog/src/components/landing/work-experience.tsx
apps/blog/src/components/landing/impact-metrics-block.tsx
apps/blog/src/components/landing/featured-project.tsx
apps/blog/src/components/article-plugins.tsx
apps/blog/src/components/brand-mark.tsx
apps/blog/src/components/woven-corpus-map.tsx
apps/blog/src/components/charts/downloads-by-package.tsx
apps/blog/src/components/app-footer.tsx
apps/blog/src/components/article-subscribe.tsx
apps/blog/src/components/record-reading.tsx
apps/blog/src/components/app-header.tsx
apps/blog/src/components/article-weave.tsx
  find apps/blog/src -name '*.tsx'
rule-yield-distribution-own-plugin — files with at least one finding
  expected 54   now /bin/sh: 1: harness: not found
  harness output
rule-yield-distribution-own-plugin — total findings
  expected 308   now /bin/sh: 1: harness: not found
  harness output
rule-yield-distribution-own-plugin — top rule
  expected `react-no-inline-functions`, 113 findings across 38 files   now /bin/sh: 1: harness: not found
  harness output
rule-yield-distribution-own-plugin — second rule
  expected `react-render-optimization`, 71 across 27 files   now /bin/sh: 1: harness: not found
  harness output
rule-yield-distribution-own-plugin — remaining non-zero
  expected hooks-exhaustive-deps 42/15, require-data-slot 35/14, no-unnecessary-rerenders 32/12, no-inline-style 9/1, no-raw-color-literal 4/2, no-arbitrary-token-class 2/2   now /bin/sh: 1: harness: not found
  harness output
rule-yield-distribution-own-plugin — zero-yield rules
  expected 6 of 14 (42.9%): required-attributes, react-class-to-hooks, no-default-test-id, no-is-prefix-prop, no-kind-prop-discriminator, no-wrapper-sub-component   now /bin/sh: 1: harness: not found
  harness output
rule-yield-distribution-own-plugin — top-1 share
  expected 36.7%   now /bin/sh: 1: 113/308: not found
  113/308
rule-yield-distribution-own-plugin — top-2 share
  expected 59.7%   now /bin/sh: 1: 184/308: not found
  184/308
rule-yield-distribution-own-plugin — top-4 share
  expected 84.7%   now /bin/sh: 1: 261/308: not found
  261/308
rule-yield-distribution-own-plugin — mean findings per rule
  expected 22.0   now /bin/sh: 1: 308/14: not found
  308/14
significance-from-a-lookup-table — The lookup table as written
  expected `{ 1: 3.841, 2: 5.991, 3: 7.815 }`   now fatal: cannot change to '../eslint': No such file or directory
  git -C ../eslint show b40bc6781:benchmarks/suites/ilb-ai/run.js \
significance-from-a-lookup-table — Degrees of freedom are group-count driven
  expected `df = models.length - 1`   now fatal: cannot change to '../eslint': No such file or directory
  git -C ../eslint show b40bc6781:benchmarks/suites/ilb-ai/run.js \
significance-from-a-lookup-table — Bug introduced (four months live at time of writing)
  expected 2026-05-11, commit b40bc6781   now fatal: cannot change to '../eslint': No such file or directory
  git -C ../eslint log --format="%ad %h" --date=short -S criticalValues -- benchmarks/suites/ilb-ai/run.js \
significance-from-a-lookup-table — Second site, table extended but fallback kept
  expected `{1,2,3,4,5}` + `\   now /bin/sh: 1: \: not found
  \
significance-from-a-lookup-table — `pValue` field was a rendered string
  expected `significant ? "< 0.05" : "> 0.05"`   now fatal: cannot change to '../eslint': No such file or directory
  git -C ../eslint show b40bc6781:benchmarks/suites/ilb-ai/run-antigravity.js \
significance-from-a-lookup-table — Same field is numeric `1` on the df<2 branch
  expected `pValue: 1`   now fatal: cannot change to '../eslint': No such file or directory
  git -C ../eslint show b40bc6781:benchmarks/suites/ilb-ai/run.js \
significance-from-a-lookup-table — No correction anywhere in either repo
  expected 0 matches   now /bin/sh: 1: Syntax error: Unterminated quoted string
  git -C ../eslint grep -niE "bonferroni\
significance-from-a-lookup-table — Sampled verdict χ²=7.0, df=4 — true tail
  expected p = 0.1359 (old verdict: significant)   now /bin/sh: 1: Syntax error: EOF in backquote substitution
  npm --prefix ../eslint/benchmarks run stats:check` (asserts 0.1359 ± 1e-3)
significance-from-a-lookup-table — Sampled verdict χ²=7.0, df=5 — the widest miss
  expected p = 0.2206 (old verdict: significant)   now /bin/sh: 1: Syntax error: EOF in backquote substitution
  npm --prefix ../eslint/benchmarks run stats:check` — asserted to 1e-3
significance-from-a-lookup-table — Sampled verdicts wrong under the table
  expected 6 of 6   now /bin/sh: 1: Syntax error: EOF in backquote substitution
  npm --prefix ../eslint/benchmarks run stats:check` — the old predicate and all six pairs are committed in `stats.selfcheck.ts`; it asserts all six disagree AND that every disagreement is a false positive
significance-from-a-lookup-table — Replacement reproduces df=1 critical value
  expected p(3.841, 1) = 0.05001   now npm error code ENOENT
  npm --prefix ../eslint/benchmarks run stats:check
significance-from-a-lookup-table — Replacement reproduces df=2 critical value
  expected p(5.991, 2) = 0.05001   now npm error code ENOENT
  npm --prefix ../eslint/benchmarks run stats:check
significance-from-a-lookup-table — Replacement reproduces df=3 critical value
  expected p(7.815, 3) = 0.04999   now npm error code ENOENT
  npm --prefix ../eslint/benchmarks run stats:check
significance-from-a-lookup-table — Replacement covers df the table never had
  expected p(9.488, 4) = 0.04999; p(11.07, 5) = 0.05001   now npm error code ENOENT
  npm --prefix ../eslint/benchmarks run stats:check
significance-from-a-lookup-table — Lookup tables remaining in suites after the fix
  expected 0   now fatal: cannot change to '../eslint': No such file or directory
  git -C ../eslint grep -n criticalValues -- "benchmarks/suites/**" \
significance-from-a-lookup-table — Probe p-values, the four with no prior row
  expected 0.0916 (8.0,4); 0.0611 (9.0,4); 0.0752 (10.0,5); 0.0620 (12.0,6)   now /bin/sh: 1: Syntax error: EOF in backquote substitution
  npm --prefix ../eslint/benchmarks run stats:check` — each asserted to 1e-3
significance-from-a-lookup-table — The one real firing, from stored output
  expected chiSq=18.43, df=4, true p=0.001017, verdict correct   now /bin/sh: 1: Syntax error: EOF in backquote substitution
  npm --prefix ../eslint/benchmarks run stats:check` (asserts p=0.001017 and that the verdict was correct)
significance-from-a-lookup-table — Stored run files carrying a chi-squared verdict
  expected 3 of 11 files; 1 with df>=4   now fatal: cannot change to '../eslint': No such file or directory
  git -C ../eslint ls-tree --name-only 08dfad0b9 -- benchmarks/results/ilb-ai/ \
significance-from-a-lookup-table — Unscoped-grep phantoms, benchmarks+scripts, extension filters dropped
  expected 3, all base64 in package-lock integrity hashes   now /bin/sh: 1: Syntax error: Unterminated quoted string
  git -C ../eslint grep -niE "bonferroni\
significance-from-a-lookup-table — Self-check assertions after adding the probes + firing
  expected 19   now npm error code ENOENT
  npm --prefix ../eslint/benchmarks run stats:check
token-in-localstorage-field-study — candidate source files
  expected 258,117   now /bin/sh: 1: →: not found
  npx tsx storage-sweep.mts <root>` → `candidateFiles
token-in-localstorage-field-study — **files touching web storage**
  expected **1,423** ← denominator   now /bin/sh: 1: Syntax error: EOF in backquote substitution
  same run → `storageFiles
token-in-localstorage-field-study — repositories touching web storage
  expected 189   now /bin/sh: 1: Syntax error: EOF in backquote substitution
  same run → `storageRepos.length
token-in-localstorage-field-study — `no-jwt-in-storage` — findings / files / repos
  expected 45 / 39 / 19   now /bin/sh: 1: Syntax error: EOF in backquote substitution
  same run → `rules[…]
token-in-localstorage-field-study — `no-sensitive-localstorage` — findings / repos
  expected 3 / 2   now /bin/sh: 1: same: not found
  same run
token-in-localstorage-field-study — `no-sensitive-sessionstorage` — findings / repos
  expected 1 / 1   now /bin/sh: 1: same: not found
  same run
token-in-localstorage-field-study — `no-cookie-auth-tokens` — findings
  expected 0   now /bin/sh: 1: same: not found
  same run
token-in-localstorage-field-study — parse errors
  expected 16   now /bin/sh: 1: Syntax error: EOF in backquote substitution
  same run → `parseErrors
token-in-localstorage-field-study — duplicate clones among the 19 flagged repos
  expected 0   now /bin/sh: 1: Syntax error: EOF in backquote substitution
  dedupe.ts` content fingerprint
token-in-localstorage-field-study — **flagged repos that really store a credential**
  expected **13 of 19**   now /bin/sh: 1: manual: not found
  manual read of all 39 files, table below
token-in-localstorage-field-study — of those 13, government digital services
  expected **7**   now /bin/sh: 1: table: not found
  table below
```

## Class

A claim that was true when written and is false now. No review pass can catch this class — nothing in the article changed. If this recurs for the same spec, the spec's command is not specific enough, and that is an eval gap rather than an author mistake.

## Triage

_Pending. Rewrite | retire | ignore — and why._
