#!/usr/bin/env bash
# Reproduce the circular-dependency audit table. Pin each repo to the article's SHA.
set -euo pipefail
MADGE="npx madge@{{MADGE_VERSION}}"

# name|clone url|commit SHA|subpath scanned
REPOS=(
  "payload|https://github.com/payloadcms/payload|{{PAYLOAD_SHA}}|."
  "next|https://github.com/vercel/next.js|{{NEXTJS_SHA}}|."
  "medusa|https://github.com/medusajs/medusa|{{MEDUSA_SHA}}|."
  "strapi|https://github.com/strapi/strapi|{{STRAPI_SHA}}|."
  "twenty|https://github.com/twentyhq/twenty|{{TWENTY_SHA}}|."
)

mkdir -p repos results
for row in "${REPOS[@]}"; do
  IFS='|' read -r name url sha path <<< "$row"
  [ -d "repos/$name" ] || git clone --filter=blob:none "$url" "repos/$name"
  git -C "repos/$name" checkout "$sha"
  echo "== $name @ $sha =="
  $MADGE --circular --extensions ts "repos/$name/$path" | tee "results/$name.txt" || true
done
echo "Cycle count per repo = the '--circular' summary in results/<name>.txt"
echo "For per-cycle paths (the 'admin/types.ts' claims): add --json and inspect."
