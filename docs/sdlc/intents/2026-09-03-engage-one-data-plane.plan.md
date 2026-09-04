---
kind: plan
slug: 2026-09-03-engage-one-data-plane
opened: 2026-09-03
---

# Plan: run the loop from a clean `main` worktree, data root by environment

Intent: [`2026-09-03-engage-one-data-plane.intent.md`](./2026-09-03-engage-one-data-plane.intent.md)

## Ground truth

| Claim                          | Value                                                                                                                                                    | Source                                                                           | Read on    |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ---------- |
| Live checkout branch and drift | `chore/content-focus-h2-2026`; 49 ahead / 27 behind on `footprint/scripts`; 392 uncommitted lines in 4 engage files; 77 untracked                        | `git log --oneline origin/main..HEAD -- footprint/scripts`, `git status --short` | 2026-09-03 |
| Dry-run merge of main          | 15 conflicts                                                                                                                                             | `git merge-tree --write-tree HEAD origin/main`                                   | 2026-09-03 |
| Data root in the shared lib    | `FOOTPRINT_ROOT = join(__dirname, "..")`                                                                                                                 | `footprint/scripts/_engage-lib.ts:20`                                            | 2026-09-03 |
| Loop entry                     | `engage-run.sh` hardcodes `FOOTPRINT=/Users/ofri/repos/ofriperetz.dev/agents/footprint`, `cd`s there, runs `scripts/*.ts` relative                       | `engage-run.sh`                                                                  | 2026-09-03 |
| Self-heal on main exists       | `git pull --ff-only` when parked on clean `main`                                                                                                         | PR #143 body                                                                     | 2026-09-03 |
| launchd jobs loaded            | `com.ofri.engage` (loop, every 5 min), `com.ofri.engage-app` (keepalive), plus publish-next, adopters, social-watcher, intel-enrich, datasync (exit 127) | `launchctl list \| grep ofri`                                                    |
| Control room data root         | `FOOTPRINT_ROOT` env, else `~/repos/ofriperetz.dev/agents/footprint`                                                                                     | `apps/engage/src/lib/footprint.ts:16`                                            | 2026-09-03 |

## Approach

Split code from data with one environment variable, the same one the control
room already honours. A clean worktree of `main` at
`~/repos/ofriperetz.dev/agents-main` runs the scripts; `FOOTPRINT_ROOT` points
every data path at the live footprint directory. The plist for the loop sets the
variable and calls the worktree's `engage-run.sh`. The self-heal in that script
keeps the worktree on `main`.

**Rejected: merging `main` into the chore branch.** Fifteen conflicts in files
the user is mid-way through, and it would have to be repeated on every merge.

**Rejected: symlinking data directories into the worktree.** Some engagement
files are tracked, so a symlinked directory shows as a type change, the tree is
no longer clean, and the self-heal stops.

**Rejected: a second copy of the data.** Two queues is the two-ledger problem again.

## Sequence

1. `_engage-lib.ts`: `FOOTPRINT_ROOT = process.env.FOOTPRINT_ROOT ?? join(__dirname, "..")`.
   Audit every `engage-*.ts` / `_engage-*.ts` for its own `__dirname` or
   hardcoded footprint path; route through `FOOTPRINT_ROOT`. Add
   `_engage-paths.selfcheck.ts` that greps the scripts for `__dirname` and
   `/agents/footprint` outside the lib and fails on any hit.
2. `engage-run.sh`: `SCRIPTS="$(cd "$(dirname "$0")" && pwd)"`;
   `FOOTPRINT="${FOOTPRINT_ROOT:-$SCRIPTS/..}"`; export `FOOTPRINT_ROOT`;
   run `"$NPX" tsx "$SCRIPTS/<script>"` with `cwd=$FOOTPRINT` so `.env`
   injection and relative data paths keep working. Logs stay under
   `$FOOTPRINT/engagement/run-logs`.
3. `launchd/com.ofri.engage.plist`: program `…/agents-main/footprint/scripts/engage-run.sh`,
   `EnvironmentVariables.FOOTPRINT_ROOT=/Users/ofri/repos/ofriperetz.dev/agents/footprint`.
   `engage-install.sh` installs from the worktree.
4. Create the worktree `agents-main` on `main`; install; verify one full
   `engage-run.sh auto` cycle writes to the live data dir and nothing to the
   worktree (`git status` clean after the run).
5. Remove the loop's plist from the live checkout's install path so the old
   tree can no longer be started by accident. The legacy hub stays as a file.

## Gates

- `_engage-paths.selfcheck.ts` red before step 1 (it must find the current
  `__dirname` uses), green after.
- After step 4: `git -C agents-main status --short` empty after a real `auto`
  run; the run log for that cycle lives under the live data dir.
- Human: confirm the worktree location and that the three other jobs stay put.

## Risks

- A script with a path this audit misses writes into the worktree; the
  post-run clean-tree check is what catches it, so it runs on every install.
- The worktree's `node_modules` is the live checkout's dependency set at
  `main`; if `main` adds a dependency the worktree needs `npm ci` — the
  self-heal should refuse to pull when the lockfile changes, and say so.
