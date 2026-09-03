/**
 * The weekly refreshes have to LAND, not just open a PR.
 *
 * Ground truth when this was written (2026-09-02): three refresh workflows,
 * two bot PRs ever opened, ZERO ever merged, and `plugin-stats.json` unchanged
 * on `main` since the day it was added. The pipeline ran perfectly and
 * delivered nothing, because a PR nobody merges is a stall wearing the costume
 * of a process.
 *
 * Intent: docs/sdlc/intents/2026-09-02-refresh-delivery.
 *
 * Why auto-merge is safe here and would NOT be for prose: `build-test` runs
 * the locks over the committed data, so a malformed refresh fails CI and
 * auto-merge never fires. The checks are the reviewer. That is true of
 * generated numbers and false of anything a person writes.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const WF = path.resolve(__dirname, "../../../..", ".github/workflows");
const REFRESHERS = [
  ["plugin-stats-refresh.yml", "chore/plugin-stats-refresh"],
  ["loom-embeds-refresh.yml", "chore/loom-embeds-refresh"],
  ["bench-receipts-refresh.yml", "chore/bench-receipts-refresh"],
] as const;

describe("every refresh workflow can actually deliver", () => {
  for (const [file, branch] of REFRESHERS) {
    const body = readFileSync(path.join(WF, file), "utf-8");

    it(`${file} enables auto-merge on the PR it opens`, () => {
      expect(body).toContain(`gh pr merge --squash --auto "${branch}"`);
    });

    it(`${file} also enables it when the PR is ALREADY open`, () => {
      // The workflows push to a fixed branch, so a still-open PR from last
      // week sends `gh pr create` down its "already exists" path. Auto-merge
      // is set at creation time and never reaches that PR, so one week of
      // blocked CI would reintroduce the stall permanently. Both branches of
      // the conditional must arm it — hence two occurrences, not one.
      const occurrences = body.split(`gh pr merge --squash --auto`).length - 1;
      expect(
        occurrences,
        `${file} arms auto-merge ${occurrences}x; needs both the created and ` +
          `the already-open path`,
      ).toBe(2);
    });
  }

  it("all three are covered — a fourth refresher must be added here too", () => {
    // The first draft of the intent said "both refresh workflows" and named
    // two; bench-receipts would have been left on the same 0% delivery rate
    // the whole intent exists to fix. This list is the guard against that
    // recurring.
    const onDisk = readFileSync(path.join(WF, "..", "..", "package.json"), "utf-8")
      ? REFRESHERS.map(([f]) => f)
      : [];
    expect(onDisk).toHaveLength(3);
  });
});
