---
kind: plan
slug: 2026-09-02-engage-truth-and-reach
opened: 2026-09-02
---

# Plan: one hub, verified sends, and an inbox that comes to you

Intent: [`2026-09-02-engage-truth-and-reach.intent.md`](./2026-09-02-engage-truth-and-reach.intent.md)

## Ground truth

Read on 2026-09-02 against the app started from this checkout (`apps/engage`,
`npm run dev`) and the data in `~/repos/ofriperetz.dev/agents/footprint`.

| Claim                                                               | Value                                                                                                                  | Source                                                                           | Read on    |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ---------- |
| Open items in the stream                                            | 50                                                                                                                     | `curl :7777/api/state` → `items.length`                                          | 2026-09-02 |
| Ever acted / ever drafted                                           | 106 / —                                                                                                                | same, `totals`                                                                   | 2026-09-02 |
| Replies waiting, drafted                                            | 32, 0 undrafted                                                                                                        | `curl :7777/api/threads`                                                         | 2026-09-02 |
| Last action in the control room's ledger                            | 2026-08-26T22:08Z                                                                                                      | `sqlite3 engage.db "select max(at) from actions"`                                | 2026-09-02 |
| Ledger actions, done / skip                                         | 143 / 18                                                                                                               | `sqlite3 engage.db "select action,count(*) from actions group by action"`        | 2026-09-02 |
| Items marked today, via                                             | 4, `engage-hub` (legacy)                                                                                               | last entries of `.devto-engaged.json`; queue `posted_at` 2026-09-03T03:29–03:30Z | 2026-09-02 |
| Comment conversion, all queue days                                  | 82 posted / 125 drafted (66%); 31 `reminded` + 7 `pending` never resolved                                              | python over `engagement/queue/*.json`                                            | 2026-09-02 |
| Reaction conversion                                                 | 20 / 49 (41%); 28 never resolved                                                                                       | same                                                                             | 2026-09-02 |
| `/api/state` wall time, cold / warm                                 | 11.4 s / 13.9 s                                                                                                        | `curl -w %{time_total}` twice                                                    | 2026-09-02 |
| `/api/people`, `/api/board`, `/api/network` cold                    | 15.5 s, 15.7 s, 147.8 s                                                                                                | same                                                                             | 2026-09-02 |
| `releaseQueue()` uses `lib/cache.ts`                                | no                                                                                                                     | `grep -n cache lib/footprint.ts`                                                 | 2026-09-02 |
| App `todayCST()` on 2026-09-02 22:30 CDT                            | `2026-09-03`                                                                                                           | `/api/state` → `date`; agents' `_engage-lib.ts` gives `2026-09-02`               | 2026-09-02 |
| `act` request body fields                                           | `kind, date, slot, action` — no text                                                                                   | `src/app/api/act/route.ts`                                                       | 2026-09-02 |
| `act("done")` sets                                                  | `posted`, immediately                                                                                                  | `lib/footprint.ts` `recordAction`                                                | 2026-09-02 |
| Digest buckets                                                      | `posted, skipped, failed, pending` only                                                                                | `agents/footprint/scripts/engage-digest.ts:35-42`                                | 2026-09-02 |
| launchd entry for the app                                           | none                                                                                                                   | `ls agents/footprint/launchd`                                                    | 2026-09-02 |
| Tests under `apps/engage`                                           | `lib/detect.selfcheck.ts` only                                                                                         | `find apps/engage -name '*test*' -o -name '*selfcheck*'`                         | 2026-09-02 |
| `.claude/launch.json` in this repo                                  | absent (PR #142 says to use it)                                                                                        | `ls .claude`                                                                     | 2026-09-02 |
| Local `main` vs `origin/main` on `apps/engage`, before this session | 3 commits behind (#147, #157, #153)                                                                                    | `git log main..origin/main -- apps/engage`; fast-forwarded 2026-09-02            | 2026-09-02 |
| Home-page sections on current `main`                                | 21, page height 16,013 px                                                                                              | DOM query over `h2,h3`                                                           | 2026-09-02 |
| DEV community network renders                                       | yes, 91 SVG nodes / 389 edges                                                                                          | DOM query on `[data-slot="network-graph"]`                                       | 2026-09-02 |
| Stalled-feed alerts at the top of the page                          | 38, all `npm.downloads.*`                                                                                              | `/` page text                                                                    | 2026-09-02 |
| npm series lag vs stall budget                                      | asOf 2026-08-31 on 09-02 (2-day source lag) vs `staleAfterHours: 36`                                                   | `/api/series?ids=npm.downloads.total`; `lib/series-npm.ts:92`                    | 2026-09-02 |
| Daily impact ingest location                                        | moved to the public `impact-ingest` repo on 2026-08-09                                                                 | `git log -- .github/workflows/daily-impact-ingest.yml` in `agents`               | 2026-09-02 |
| Unmerged engage work on `fix/exclude-automated-traffic`             | 15 commits, +2,516 lines, 5 files: `/customers` page, `/api/prs`, `/api/alerts`, `/api/customers`, `scripts/smoke.mjs` | `git log origin/main..origin/fix/exclude-automated-traffic -- apps/engage`       | 2026-09-02 |
| Merge dry-run of that branch onto `main`                            | 1 conflict, `src/app/page.tsx`                                                                                         | `git merge-tree --write-tree origin/main origin/fix/exclude-automated-traffic`   | 2026-09-02 |
| `com.ofri.datasync` launchd job                                     | loaded, last exit 127                                                                                                  | `launchctl list \| grep ofri`                                                    |

## Approach

Fix truth before reach, and delete before adding. The legacy hub is the first
thing to go: two surfaces writing two ledgers means every number on the home
page is wrong in a way nobody can see.

**Rejected:** a reconciler that reads the Dev.to comments API _on click_. Same
failure as drafting on click, which the app already documents: latency in the
flow and a hard dependency at the worst moment. The reconciler runs from the
existing five-minute launchd loop in `agents`, where the queue generator and the
reply crawler already live.

**Rejected:** re-implementing the release schedule inside the app to make
`/api/state` fast. `publish-next --json` owns the schedule; the runway text has
drifted once already when a second copy existed. Cache it.

**Rejected:** a menu-bar app or a Tauri shell for always-on. A `KeepAlive` plist
next to the four that already exist is one file.

## Sequence

Ordered only where forced. A, B and C are independent of each other; D and E
depend on A.

**A. One hub, one ledger** (this repo + `agents`)

1. Delete `agents/footprint/scripts/engage-hub.ts` and the `hub` script. Its
   only ledger, `.devto-engaged.json`, stays read-only history.
2. Add `.claude/launch.json` here with the `engage` config PR #142 describes.
3. Fix `todayCST()` in `lib/footprint.ts` to the `Intl.DateTimeFormat("en-CA",
{timeZone:"America/Chicago"})` form the generator uses. Lock: a test that pins
   22:30 CDT to the same calendar day.
4. `engage-digest.ts` counts `reminded`, `opened`, `expired`; the row sums to the total.

**B. Sends become verified** (this repo + `agents`)

5. `act` accepts `text`; `recordAction` stores it as `sent_text` and the ledger
   row carries it. `act("done")` sets `opened`, not `posted`.
6. New `agents/footprint/scripts/engage-reconcile.ts`, run hourly from
   `engage-run.sh auto` during business hours: for each `opened` comment, read
   `/api/comments?a_id=`, look for `ofri-peretz` newer than `posted_at`. Found →
   `posted` + `verified_at`; not found after 48 h → `expired`, reason `not
observed`. Reactions cannot be read back; they go `opened → posted` on click
   and the UI says so. On a 429, stop; never expire on a failed read.
7. Run the reconciler once over the 66-item backlog. Partnership table and
   gauges read `posted` only, with an "opened, unverified" count beside it.

**C. Speed** (this repo)

8. Route `releaseQueue()`, `/api/people` and `/api/board` through `lib/cache.ts`
   with a TTL until the next publish fire. Target `/api/state` < 500 ms warm.

**D. Reach: the inbox comes to you** (`agents`)

9. `engage-run.sh auto` gains a `threads` check: when `/api/threads` (or the
   reply-drafts file) has pending items, fire one Mac notification per day that
   deep-links to `http://localhost:7777`. `engage-healthcheck.ts` pings `/api/state`.
10. `launchd/com.ofri.engage-app.plist` with `KeepAlive`, running `npm run dev`
    in this checkout; installed by `engage-install.sh` beside the existing plists.

**F. Land the unmerged line, and quiet the false alarms** (this repo)

13. Rebase `fix/exclude-automated-traffic`'s 15 engage commits onto `main`
    (one conflict, `page.tsx`, from the DS rebuild) and open them as their own
    PR: the customer monitor, the live PR tracker, the alerts route, the
    vulnerability ledger, the smoke script. They were built on 2026-08-23 and
    never merged; that is the capability gap between memory and screen.
14. Set `staleAfterHours` for the `npm.downloads.*` catalog to 72. The source
    lags two days by construction, so 36 h produces 38 permanent alerts that
    push "Up next" below the fold and train the eye to ignore the section.

**E. Learn** (`agents`)

11. `engage-daily.ts` persists a relevance tier and one `alt_comment` per item in
    the morning batch. The app shows the tier and an "other take" swap, no
    network call.
12. The "talked back" signal the partnership table already computes feeds the
    draft prompt: the three comments that earned replies and the three that did
    not, as few-shot.

## Gates

- **Locks, shown red first, under `apps/engage/src/__tests__/`:**
  `act-lock.test.ts` — `done` with edited text yields `opened` and stores the
  text; today's code yields `posted` and drops it. `today-lock.test.ts` — 22:30
  CDT maps to the same day. `state-cache-lock.test.ts` — a second `/api/state`
  call within the TTL does not spawn `publish-next`.
- **In `agents`:** `engage-reconcile.test.ts` — state machine over a stubbed
  comments response, including the 429 branch; `engage-digest` row sums to total.
- **Human decisions before ship:** (1) accept this pair; (2) confirm whether the
  four items marked `posted` on 2026-09-03T03:29Z through the legacy hub were
  actually posted, or revert them to `pending` before the reconciler runs;
  (3) delete the legacy hub.
- PR per letter above, squash-merged, required checks green. Steps in `agents`
  follow that repo's PR flow.

## Risks

- **The unmerged branch predates the DS rebuild.** Its `page.tsx` changes will
  not apply mechanically; the sections have to be re-hung on the new layout.
  Budget it as a port, not a merge.

- **The comments endpoint may throttle the reconciler.** `lib/throttle.ts`
  already paces Dev.to calls in the app; the reconciler must reuse the same idea
  or it will produce `expired` items that were in fact posted. Mitigation is
  in step 6: never expire on a failed read.
- **Deleting the legacy hub removes a path someone may still type.** The `hub`
  npm script is removed in the same PR so it fails loudly, not silently.
- **`next dev` under launchd** recompiles on file change and holds a watcher; if
  it proves flaky, switch the plist to `next build && next start`.
- **The 66-item backlog reconciliation will mark many old items `expired`.** That
  is the honest number, but the conversion figure will drop before it rises.
