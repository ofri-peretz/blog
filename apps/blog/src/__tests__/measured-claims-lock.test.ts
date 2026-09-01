/**
 * Measured-claims lock — copy that quotes a number must match the thing it
 * measures.
 *
 * Twice in one day a live claim was wrong: the playground invite said "three
 * of the 35 rules" against a plugin shipping 42, and the gate button said
 * "~400 KB" against a bundle of 362. Neither was caught by a test, because
 * nothing connected the sentence to the measurement.
 *
 * THE RULE THAT MATTERS: if this lock cannot find a number to compare, that
 * is a FAILURE, not a skip. The first draft of this check used a pattern that
 * could not match the live label; `.exec()` returned null, `null * 1024` was
 * NaN, and every comparison against NaN is false — so it would have passed
 * silently forever. A lock that no-ops when its input changes shape is worse
 * than no lock, because it also carries the belief that the thing is covered.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { brotliCompressSync, constants } from "node:zlib";
import { describe, expect, it } from "vitest";

const APP = path.resolve(__dirname, "../..");
const ARTIFACT = path.join(APP, "public/lint-worker.js");

/**
 * How far the quoted size may sit from the measured one.
 *
 * Not equality: a dependency bump moves the bytes by a few KB and a red build
 * on every bump trains people to edit the number without reading it, which is
 * the opposite of the point. 8% fails when the claim becomes MISLEADING and
 * stays quiet when it is merely stale in the last digit. ~400 vs 362 is 10.5%
 * — the drift that prompted this lock sits outside the band, which is the
 * calibration check for the band itself.
 */
const TOLERANCE = 0.08;

function measuredBrotliBytes(): number {
  if (!existsSync(ARTIFACT)) {
    // Hermetic: no network, no external data. Same script predev/prebuild run.
    execFileSync("node", [path.join(APP, "scripts/build-lint-worker.mjs")], {
      cwd: APP,
      stdio: "ignore",
    });
  }
  return brotliCompressSync(readFileSync(ARTIFACT), {
    params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
  }).length;
}

describe("the gate label matches the bundle it describes", () => {
  it("quotes a size, and quotes one this lock can read", () => {
    const component = readFileSync(
      path.join(APP, "src/components/article-playground.tsx"),
      "utf-8",
    );
    const quoted = /\(~?(\d+)\s*KB\)/.exec(component);

    // NOT a skip. If the label stops quoting a size, or quotes it in a shape
    // this pattern cannot read, the claim has escaped verification and that is
    // the failure this file exists to report.
    expect(
      quoted,
      "the playground gate no longer quotes a size this lock can parse — " +
        "either restore a `(NNN KB)` in article-playground.tsx, or update this " +
        "pattern deliberately. Do not let it silently stop checking.",
    ).not.toBeNull();
    expect(Number(quoted?.[1])).toBeGreaterThan(0);
  });

  it("is within tolerance of the real brotli size", () => {
    const component = readFileSync(
      path.join(APP, "src/components/article-playground.tsx"),
      "utf-8",
    );
    const quoted = /\(~?(\d+)\s*KB\)/.exec(component);
    expect(quoted).not.toBeNull();

    const claimedBytes = Number(quoted![1]) * 1024;
    const measured = measuredBrotliBytes();
    const drift = Math.abs(claimedBytes - measured) / measured;

    expect(
      drift,
      `gate label says ${quoted![1]} KB; the bundle is ${Math.round(measured / 1024)} KB ` +
        `(${measured} bytes brotli). That is ${(drift * 100).toFixed(1)}% off, outside the ` +
        `${TOLERANCE * 100}% band. Update the label in article-playground.tsx — and if an ` +
        `article quotes this number too, update that in the same change.`,
    ).toBeLessThanOrEqual(TOLERANCE);
  }, 60_000);
});
