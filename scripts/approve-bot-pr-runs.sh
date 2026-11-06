#!/usr/bin/env bash
# Approve the pull_request runs GitHub holds for a PR this bot just opened.
#
# A PR opened with GITHUB_TOKEN gets its pull_request runs created as
# `action_required`: they wait for a maintainer to approve them, so the
# required build-test/eslint/oxlint never report and the PR sits BLOCKED
# (blog#277). Dispatching ci.yml instead does not help: those check runs land
# on the commit but branch protection does not credit them to the PR
# (observed on #325, 2026-11-06). Approving the held runs does.
#
# Best effort: a token that may not approve logs a warning, never fails the
# refresh, and the PR waits for a human approval as before.
set -uo pipefail
SHA=$(git rev-parse HEAD)
held() {
  gh run list --commit "$SHA" --event pull_request --status action_required \
    --json databaseId --jq '.[].databaseId' 2>/dev/null
}
# The runs appear a few seconds after the PR does, and not together: CI and
# Claude Code Review are both pull_request workflows. Once the first shows,
# give the rest a moment and list again.
for _ in $(seq 1 12); do
  IDS=$(held)
  [ -n "$IDS" ] && { sleep 15; IDS=$(held); break; }
  sleep 10
done
if [ -z "${IDS:-}" ]; then
  echo "::notice::no held pull_request runs for $SHA"
  exit 0
fi
for id in $IDS; do
  gh api -X POST "repos/$GITHUB_REPOSITORY/actions/runs/$id/approve" >/dev/null \
    && echo "approved run $id" \
    || echo "::warning::could not approve run $id; approve it in the PR's Checks tab"
done
