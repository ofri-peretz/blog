---
stage: incident
detected: 2026-09-28
detector: stale-claim
severity: 3sigma
articles: ["agent-resource-bounds", "ai-agent-unbounded-loop-audit", "ai-agents-rebranded-my-oss-ecosystem-two-pipelines-were-dead", "burgee-change-one-import", "burgee-zero-dependency-cli-stack", "eslint-in-the-browser-live-lint-playground", "eslint-plugin-cold-start-optimization", "lint-harness-measured-nothing", "migrate-renamed-plugin-packages", "rule-yield-distribution-own-plugin", "significance-from-a-lookup-table"]
intent: 
status: open
---

## What the detector saw

51 committed claim(s) no longer match the command that produced them.

```
agent-resource-bounds — installed SDK version under test
  expected 7.0.31   now node:internal/modules/cjs/loader:1568
  node -p "require('ai/package.json').version"
agent-resource-bounds — `stopWhen` defaults to a 1-step ceiling
  expected `stopWhen = isStepCount(1)`, at two call sites   now grep: node_modules/ai/dist/index.js: No such file or directory
  grep -no "stopWhen = [a-zA-Z0-9_()]*" node_modules/ai/dist/index.js
ai-agent-unbounded-loop-audit — plugin under test
  expected 2.1.3   now node:internal/modules/cjs/loader:1568
  node -p "require('eslint-plugin-vercel-ai-security/package.json').version"
ai-agent-unbounded-loop-audit — linter under test
  expected 9.39.5   now 9.39.4
  node -p "require('eslint/package.json').version"
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
burgee-change-one-import — the swapped file runs on Node 20 (1 = ok)
  expected 1   now file:///home/runner/work/blog/blog/sdlc/spec/burgee-change-one-import.repro.mjs:440
  node sdlc/spec/burgee-change-one-import.repro.mjs node20-swap-runs
burgee-change-one-import — the swapped file runs on Node 22 (1 = ok)
  expected 1   now file:///home/runner/work/blog/blog/sdlc/spec/burgee-change-one-import.repro.mjs:440
  node sdlc/spec/burgee-change-one-import.repro.mjs node22-swap-runs
burgee-change-one-import — oracle: `burgee/commander` passed / reference (control re-run below)
  expected 1360/1360   now fatal: cannot change to '../burgee': No such file or directory
  node -e "const j=JSON.parse(require('child_process').execSync('git -C ../burgee show burgee@0.11.1:packages/compat-oracle/baseline/commander.json'));console.log(j.passed+'/'+j.reference)"
burgee-change-one-import — vendored commander suite: release
  expected 15.0.0   now fatal: cannot change to '../burgee': No such file or directory
  node -e "const j=JSON.parse(require('child_process').execSync('git -C ../burgee show burgee@0.11.1:packages/compat-oracle/vendor/commander/.source.json'));console.log(j.version)"
burgee-change-one-import — vendored commander suite: files
  expected 110   now fatal: cannot change to '../burgee': No such file or directory
  node -e "const j=JSON.parse(require('child_process').execSync('git -C ../burgee show burgee@0.11.1:packages/compat-oracle/vendor/commander/.source.json'));console.log(j.files)"
burgee-zero-dependency-cli-stack — commander tree / bytes (article: 1 pkg, 203 KB)
  expected 1 / 207,368 B   now node:internal/modules/cjs/loader:1568
  node measure.mjs commander commander
burgee-zero-dependency-cli-stack — chalk tree / bytes (article: 1, 55 KB)
  expected 1 / 56,029 B   now node:internal/modules/cjs/loader:1568
  node measure.mjs chalk chalk
burgee-zero-dependency-cli-stack — ora tree / bytes (article: 17, 278 KB)
  expected 17 / 284,686 B   now node:internal/modules/cjs/loader:1568
  node measure.mjs ora ora
burgee-zero-dependency-cli-stack — inquirer tree / bytes (article: 27, 1002 KB)
  expected 27 / 1,026,413 B   now node:internal/modules/cjs/loader:1568
  node measure.mjs inquirer inquirer
burgee-zero-dependency-cli-stack — string-width tree / bytes (article: 4, 36 KB)
  expected 4 / 36,801 B   now node:internal/modules/cjs/loader:1568
  node measure.mjs string-width string-width
burgee-zero-dependency-cli-stack — cosmiconfig tree / bytes (article: 4, 1789 KB)
  expected 4 / 1,832,269 B   now node:internal/modules/cjs/loader:1568
  node measure.mjs cosmiconfig cosmiconfig
burgee-zero-dependency-cli-stack — execa tree / bytes (article: 18, 632 KB)
  expected 18 / 647,091 B   now node:internal/modules/cjs/loader:1568
  node measure.mjs execa execa
burgee-zero-dependency-cli-stack — signal-exit tree / bytes (article: 1, 75 KB)
  expected 1 / 76,966 B   now node:internal/modules/cjs/loader:1568
  node measure.mjs signal-exit signal-exit
burgee-zero-dependency-cli-stack — terminal-link tree / bytes (article: 6, 60 KB)
  expected 6 / 61,152 B   now node:internal/modules/cjs/loader:1568
  node measure.mjs terminal-link terminal-link
burgee-zero-dependency-cli-stack — burgee tree / bytes (article: 6, 1169 KB)
  expected 6 / 1,197,083 B   now node:internal/modules/cjs/loader:1568
  node measure.mjs burgee burgee@0.10.0 roundel@0.4.3 bellpull@0.2.3 closeout@0.4.1 linegauge@0.4.4 seniority@0.4.3
burgee-zero-dependency-cli-stack — roundel tree / bytes (article: 1, 76 KB)
  expected 1 / 77,712 B   now node:internal/modules/cjs/loader:1568
  node measure.mjs roundel roundel@0.4.3
burgee-zero-dependency-cli-stack — flagstaff tree / bytes (article: 5, 546 KB)
  expected 5 / 559,467 B   now node:internal/modules/cjs/loader:1568
  node measure.mjs flagstaff flagstaff@0.3.7 roundel@0.4.3 closeout@0.4.1 paratext@0.5.4 linegauge@0.4.4
burgee-zero-dependency-cli-stack — caique tree / bytes (article: 3, 302 KB)
  expected 3 / 309,194 B   now node:internal/modules/cjs/loader:1568
  node measure.mjs caique caique@0.4.3 closeout@0.4.1 linegauge@0.4.4
burgee-zero-dependency-cli-stack — linegauge tree / bytes (article: 1, 83 KB)
  expected 1 / 84,579 B   now node:internal/modules/cjs/loader:1568
  node measure.mjs linegauge linegauge@0.4.4
burgee-zero-dependency-cli-stack — seniority tree / bytes (article: 1, 149 KB)
  expected 1 / 152,430 B   now node:internal/modules/cjs/loader:1568
  node measure.mjs seniority seniority@0.4.3
burgee-zero-dependency-cli-stack — bellpull tree / bytes (article: 1, 96 KB)
  expected 1 / 97,864 B   now node:internal/modules/cjs/loader:1568
  node measure.mjs bellpull bellpull@0.2.3
burgee-zero-dependency-cli-stack — closeout tree / bytes (article: 1, 100 KB)
  expected 1 / 102,262 B   now node:internal/modules/cjs/loader:1568
  node measure.mjs closeout closeout@0.4.1
burgee-zero-dependency-cli-stack — paratext tree / bytes (article: 1, 91 KB)
  expected 1 / 93,104 B   now node:internal/modules/cjs/loader:1568
  node measure.mjs paratext paratext@0.5.4
burgee-zero-dependency-cli-stack — one-per-layer stack (article: 70 pkgs, 3,851 KB)
  expected 70 / 3,943,599 B   now node:internal/modules/cjs/loader:1568
  node measure.mjs stack-commander commander chalk ora inquirer string-width cosmiconfig execa signal-exit terminal-link
burgee-zero-dependency-cli-stack — yargs variant of the stack (not in article)
  expected 80 / 4,235,554 B   now node:internal/modules/cjs/loader:1568
  node measure.mjs stack-yargs yargs chalk ora inquirer string-width cosmiconfig execa signal-exit terminal-link
burgee-zero-dependency-cli-stack — burgee family installed together (article: 9 pkgs, 1,577 KB)
  expected 9 / 1,614,350 B   now node:internal/modules/cjs/loader:1568
  node measure.mjs family-all9 burgee@0.10.0 roundel@0.4.3 flagstaff@0.3.7 caique@0.4.3 linegauge@0.4.4 seniority@0.4.3 bellpull@0.2.3 closeout@0.4.1 paratext@0.5.4
burgee-zero-dependency-cli-stack — like-for-like stack (article: 28 pkgs, 662 KB)
  expected 28 / 677,694 B   now node:internal/modules/cjs/loader:1568
  node measure.mjs stack-graded100 commander chalk ora @inquirer/core string-width signal-exit
burgee-zero-dependency-cli-stack — maintainer accounts, one-per-layer stack (article: 25)
  expected 25   now node:internal/modules/cjs/loader:1568
  node maintainers.mjs stack-commander
burgee-zero-dependency-cli-stack — maintainer accounts, family (article: 1)
  expected 1   now node:internal/modules/cjs/loader:1568
  node maintainers.mjs family-all9
burgee-zero-dependency-cli-stack — maintainer accounts, like-for-like stack (article: 14)
  expected 14   now node:internal/modules/cjs/loader:1568
  node maintainers.mjs stack-graded100
burgee-zero-dependency-cli-stack — js-yaml plus argparse inside cosmiconfig's tree (article: 1,702 KB)
  expected 1,571,291 + 171,548 = 1,742,839 B   now /bin/sh: 1: cd: can't cd to w/cosmiconfig
  cd w/cosmiconfig && node -e "const f=require('fs'),z=d=>f.readdirSync(d,{withFileTypes:true}).reduce((t,e)=>t+(e.isDirectory()?z(d+'/'+e.name):e.isFile()?f.statSync(d+'/'+e.name).size:0),0);console.log(z('node_modules/js-yaml'),z('node_modules/argparse'))"
burgee-zero-dependency-cli-stack — cosmiconfig graded through seniority (article: 186 of 243)
  expected 186 / 243   now fatal: cannot change to 'burgee': No such file or directory
  git -C burgee show 7fb62c2:apps/docs/content/docs/compatibility.mdx
burgee-zero-dependency-cli-stack — re-run: burgee/commander bundle vs commander (article: 1.520×)
  expected 59,421 / 39,084 = 1.520   now node:internal/modules/cjs/loader:1568
  node bundle.mjs
eslint-in-the-browser-live-lint-playground — raw worker bundle, unminified over the wire
  expected 1764382 bytes   now /bin/sh: 1: cannot open apps/blog/public/lint-worker.js: No such file
  wc -c < apps/blog/public/lint-worker.js
eslint-in-the-browser-live-lint-playground — `./universal` absent from every ESLint 8
  expected absent in 8.57.1   now {
  ".": "./lib/api.js",
  "./package.json": "./package.json",
  "./use-at-your-own-risk": "./lib/unsupported-api.js"
}
  npm view eslint@8.57.1 exports --json
eslint-plugin-cold-start-optimization — npm dist-tag `latest` for typescript
  expected 7.0.2   now {
  dev: '3.9.4',
  'tag-for-publishing-older-releases': '4.1.6',
  insiders: '4.6.2-insiders.20220225',
  beta: '6.0.0-beta',
  rc: '7.0.1-rc',
  latest: '7.0.2',
  next: '7.1.0-dev.20260928.1'
}
  npm view typescript dist-tags
eslint-plugin-cold-start-optimization — devkit published unpacked size
  expected 407996 bytes   now 410399
  npm view @interlace/eslint-devkit dist.unpackedSize
lint-harness-measured-nothing — a path outside `cwd` yields zero and exit 0
  expected `exit=0`, empty stderr   now /bin/sh: 1: Syntax error: redirection unexpected
  eslint --no-config-lookup --config <cfg> <file outside cwd>
migrate-renamed-plugin-packages — successor postgresql-security version
  expected 2.2.1   now 2.3.5
  npm view eslint-plugin-postgresql-security version
migrate-renamed-plugin-packages — successor jwt-security version
  expected 3.0.3   now 3.3.0
  npm view eslint-plugin-jwt-security version
rule-yield-distribution-own-plugin — files scanned
  expected 100 `.tsx`   now apps/blog/src/components/mobile-nav.tsx
apps/blog/src/components/reading-depth.tsx
apps/blog/src/components/structured-data.tsx
apps/blog/src/components/series-nav.tsx
apps/blog/src/components/app-footer.tsx
apps/blog/src/components/theme-provider.tsx
apps/blog/src/components/article-subscribe.tsx
apps/blog/src/components/corpus-search.tsx
apps/blog/src/components/ui/timeline-map.tsx
apps/blog/src/components/ui/typography.tsx
apps/blog/src/components/ui/checkbox.tsx
apps/blog/src/components/ui/lint-playground.tsx
apps/blog/src/components/ui/button.tsx
apps/blog/src/components/ui/toggle.tsx
apps/blog/src/components/ui/code-editor.tsx
apps/blog/src/components/ui/code-block.tsx
apps/blog/src/components/ui/series-table.tsx
apps/blog/src/components/ui/section.tsx
apps/blog/src/components/ui/meteors.tsx
apps/blog/src/components/ui/radial-weave.tsx
apps/blog/src/components/ui/newsletter-form.tsx
apps/blog/src/components/ui/sheet.tsx
apps/blog/src/components/ui/container.tsx
apps/blog/src/components/ui/article-card.tsx
apps/blog/src/components/ui/card.tsx
apps/blog/src/components/ui/border-beam.tsx
apps/blog/src/components/ui/avatar.tsx
apps/blog/src/components/ui/reading-strand.tsx
apps/blog/src/components/ui/stack.tsx
apps/blog/src/components/ui/section-index.tsx
apps/blog/src/components/ui/delta.tsx
apps/blog/src/components/ui/badge.tsx
apps/blog/src/components/ui/form.tsx
apps/blog/src/components/ui/skeleton.tsx
apps/blog/src/components/ui/sunny-background.tsx
apps/blog/src/components/ui/time-series.tsx
apps/blog/src/components/ui/cloud-particles.tsx
apps/blog/src/components/ui/input.tsx
apps/blog/src/components/ui/dialog.tsx
apps/blog/src/components/ui/data-state.tsx
apps/blog/src/components/ui/command-palette.tsx
apps/blog/src/components/ui/hero-strand.tsx
apps/blog/src/components/ui/number-ticker.tsx
apps/blog/src/components/floating-toc.tsx
apps/blog/src/components/article-code-block.tsx
apps/blog/src/components/article-bench-receipt.tsx
apps/blog/src/components/tracked-link.tsx
apps/blog/src/components/home/hero-backdrop.tsx
apps/blog/src/components/npm/package-card.tsx
apps/blog/src/components/npm/install-snippet.tsx
apps/blog/src/components/npm/sparkline.tsx
apps/blog/src/components/theme-toggle.tsx
apps/blog/src/components/article-plugins.tsx
apps/blog/src/components/landing/also-building.tsx
apps/blog/src/components/landing/featured-project.tsx
apps/blog/src/components/landing/impact-metrics-block.tsx
apps/blog/src/components/landing/work-experience.tsx
apps/blog/src/components/landing/devto-articles.tsx
apps/blog/src/components/landing/agenda.tsx
apps/blog/src/components/charts/downloads-by-package.tsx
apps/blog/src/components/loom/loom-composer.tsx
apps/blog/src/components/article-playground.tsx
apps/blog/src/components/article-weave.tsx
apps/blog/src/components/app-header.tsx
apps/blog/src/components/record-reading.tsx
apps/blog/src/components/markdown-article.tsx
apps/blog/src/components/brand-mark.tsx
apps/blog/src/components/read-tick.tsx
apps/blog/src/components/article-threads.tsx
apps/blog/src/components/woven-corpus-map.tsx
apps/blog/src/app/page.tsx
apps/blog/src/app/articles/page.tsx
apps/blog/src/app/articles/loading.tsx
apps/blog/src/app/articles/[slug]/page.tsx
apps/blog/src/app/articles/[slug]/loading.tsx
apps/blog/src/app/error.tsx
apps/blog/src/app/npm/page.tsx
apps/blog/src/app/loom/page.tsx
apps/blog/src/app/global-error.tsx
apps/blog/src/app/scorecard/page.tsx
apps/blog/src/app/scorecard/error.tsx
apps/blog/src/app/layout.tsx
apps/blog/src/app/og/route.tsx
apps/blog/src/app/not-found.tsx
apps/blog/src/app/foundations/page.tsx
apps/blog/src/__tests__/article-code-copy-lock.test.tsx
apps/blog/src/__tests__/series-navigator-lock.test.tsx
apps/blog/src/__tests__/scorecard-lock.test.tsx
apps/blog/src/__tests__/your-thread-lock.test.tsx
apps/blog/src/__tests__/corpus-map-lock.test.tsx
apps/blog/src/__tests__/article-threads-lock.test.tsx
apps/blog/src/__tests__/numbered-sections-lock.test.tsx
apps/blog/src/__tests__/hero-strand-lock.test.tsx
apps/blog/src/__tests__/number-ticker-ssr-lock.test.tsx
apps/blog/src/__tests__/article-receipts-lock.test.tsx
apps/blog/src/__tests__/reading-strand-lock.test.tsx
apps/blog/src/__tests__/homepage-lock.test.tsx
apps/blog/src/__tests__/bench-receipts-lock.test.tsx
apps/blog/src/__tests__/plugin-cards-lock.test.tsx
apps/blog/src/__tests__/lint-run-toc-lock.test.tsx
apps/blog/src/__tests__/resume-thread-lock.test.tsx
  find apps/blog/src -name '*.tsx'
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
significance-from-a-lookup-table — Self-check assertions after adding the probes + firing
  expected 19   now npm error code ENOENT
  npm --prefix ../eslint/benchmarks run stats:check
```

## Class

A claim that was true when written and is false now. No review pass can catch this class — nothing in the article changed. If this recurs for the same spec, the spec's command is not specific enough, and that is an eval gap rather than an author mistake.

## Triage

_Pending. Rewrite | retire | ignore — and why._
