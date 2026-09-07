---
stage: incident
detected: 2026-09-07
detector: stale-claim
severity: 3sigma
articles:
  [
    "agent-resource-bounds",
    "ai-agents-rebranded-my-oss-ecosystem-two-pipelines-were-dead",
    "eslint-in-the-browser-live-lint-playground",
    "eslint-plugin-cold-start-optimization",
    "eslint-plugin-dependency-weight",
    "eslint-plugin-maintenance-signals",
    "injection-beyond-sql",
    "migrate-renamed-plugin-packages",
    "modernization-lint-as-codemod",
  ]
intent: sdlc/intent/fix-unverifiable-spec-commands-2026-09-07.md
status: open
---

## What the detector saw

80 committed claim(s) no longer match the command that produced them.

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
  expected 4 invocations   now npm warn exec The following package was not found and will be installed: vercel@59.11.7
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
  next: '7.1.0-dev.20260907.1'
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
migrate-renamed-plugin-packages — successor postgresql-security version
  expected 2.2.1   now 2.3.5
  npm view eslint-plugin-postgresql-security version
migrate-renamed-plugin-packages — successor jwt-security version
  expected 3.0.3   now 3.2.2
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
```

## Class

**Two populations, and only the smaller one is what the detector's headline says.**

Classifying all 80 rows by their `now` value:

| count | what the `now` value actually is                                                                                                             | what it means                                                                          |
| ----: | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
|    71 | a shell or runtime error — `/bin/sh: 1: Syntax error`, `<token>: not found`, `No such file or directory`, `node:internal/modules/cjs/loader` | the spec's command **did not run**. The claim is UNVERIFIABLE, not false               |
|    ~5 | a whole-file or whole-JSON dump (`name: Deploy production`, a bare `{`), or a compiler error                                                 | the command ran but the spec selects the wrong thing, so the comparison is meaningless |
|    ~4 | a different value of the right shape (`2.3.5` where `2.3.2` was claimed)                                                                     | genuine DRIFT — a claim that was true when written and is false now                    |

The original text of this section described only the last row. Reported as "80 stale claims" it says our published articles have gone false at scale; what it mostly measures is that **the detector's own commands are broken** — unmatched backticks, unescaped pipes, a bare `\` reaching the shell, and commands run from a directory where `node_modules` does not exist.

That distinction decides the remediation, and the two do not overlap:

- **71 broken commands** — fix the spec commands. No article prose is wrong; nothing to rewrite. Until they run, these specs assert nothing, which is worse than a stale claim because it looks like coverage.
- **~5 over-broad commands** — narrow the selector (see the `deploy.yml` case: dumping 190 lines to compare one version string).
- **~4 genuine drift** — rewrite or retire the claim, the class this document was originally written for.

If this recurs for the same spec, the spec's command is not specific enough, and that is an eval gap rather than an author mistake.

## Triage

_Pending. Rewrite | retire | ignore — and why._
