#!/usr/bin/env bash
# Lint each model's generated NestJS source and capture the raw ESLint output.
set -euo pipefail
mkdir -p results
for model in claude gemini; do
  if [ ! -d "$model" ] || [ -z "$(find "$model" -name '*.ts' 2>/dev/null)" ]; then
    echo "!! $model/ has no .ts source — paste the generated tree there first (see README)."
    continue
  fi
  echo "== $model =="
  npx eslint -c eslint.config.mjs "$model/**/*.ts" --format stylish | tee "results/$model.txt" || true
  errors=$(grep -cE '[0-9]+ error' "results/$model.txt" || true)
  echo "$model → results/$model.txt"
done
echo "Compare error counts + rule ids to the article's table (Claude: 6, Gemini: 2)."
