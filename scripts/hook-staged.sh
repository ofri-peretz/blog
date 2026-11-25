#!/usr/bin/env sh
# hookset's `hook:staged` station for this repo: lint only the staged files, in the workspace
# that owns each one (each app has its own eslint and oxlint config). lefthook passes the staged
# paths, root-relative. Kept under 10 s: anything slower belongs to `hook:verify` on pre-push.
#
# Prettier is not here yet: `npm run format` reports 451 unformatted files on main, so a staged
# check would fail every edit to one of them. It joins once the corpus is formatted.
set -eu
for app in blog engage; do
  files=$(printf '%s\n' "$@" | grep -E "^apps/$app/.*\.(ts|tsx|js|mjs|cjs)$" | sed "s#^apps/$app/##" || true)
  [ -n "$files" ] || continue
  # shellcheck disable=SC2086 # one word per path is the point
  (cd "apps/$app" && npx --no -- eslint --no-warn-ignored --max-warnings 0 $files)
  if [ -f "apps/$app/.oxlintrc.json" ]; then
    # shellcheck disable=SC2086
    (cd "apps/$app" && npx --no -- oxlint -c .oxlintrc.json $files)
  fi
done
