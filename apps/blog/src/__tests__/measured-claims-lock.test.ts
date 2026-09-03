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

/**
 * ONE definition, deliberately. Review caught this duplicated across the two
 * tests below — in the very file whose thesis is that a claim stated in two
 * places drifts apart. If the label format changes and only one copy is
 * updated, the shape test and the tolerance test start checking different
 * things and the gap between them is exactly where a bug lives.
 *
 * No /g flag: a shared regex with /g carries lastIndex between .exec() calls
 * and would return null on every other invocation.
 */
const SIZE_LABEL_RE = /\(~?(\d+)\s*KB\)/;

/**
 * WHAT THIS MEASURES, AND WHAT IT DOES NOT.
 *
 * `brotli -q 11` locally is the artifact's compressibility CEILING. It is not
 * what a reader downloads. Measured 2026-09-03:
 *
 *   raw                        1,764,382
 *   brotli -q 11, locally        370,746   (362 KB)
 *   what the CDN actually sends  470,563   (459 KB)  <- the honest number
 *
 * The gap is 27%, because the CDN compresses on the fly below -q 11. Same
 * artifact byte for byte; only the compressor differs.
 *
 * The published article claimed "362 KB over the wire" and cited
 * `content-encoding: br` as evidence — which proves the ENCODING, not the
 * size. This lock validated that same wrong number for the same reason: it
 * compared the label against local compression and called it verified.
 *
 * A proxy standing in for the thing itself, again. It stays hermetic on
 * purpose — no network in a unit test — so the fix is not to fetch, it is to
 * stop overclaiming: the label must quote the SERVED size, and this lock
 * asserts the served figure is at least the local ceiling and within a sane
 * margin of it. A label matching `-q 11` exactly is now a FAILURE, because
 * that is the number that is wrong.
 */
function measuredBrotliBytes(): number {
  if (!existsSync(ARTIFACT)) {
    // Hermetic: no network, no external data. Same script predev/prebuild run.
    execFileSync("node", [path.join(APP, "scripts/build-lint-worker.mjs")], {
      cwd: APP,
      // stderr INHERITED, not ignored: when the build breaks, execFileSync
      // throws with nothing but "Command failed" unless the real error is
      // allowed through. A red test that cannot say why is a tax. (Review.)
      stdio: ["ignore", "ignore", "inherit"],
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
    const quoted = SIZE_LABEL_RE.exec(component);

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

  it("quotes the SERVED size, not the local -q 11 ceiling", () => {
    const component = readFileSync(
      path.join(APP, "src/components/article-playground.tsx"),
      "utf-8",
    );
    const quoted = SIZE_LABEL_RE.exec(component);
    expect(quoted).not.toBeNull();

    const claimedBytes = Number(quoted![1]) * 1024;
    const localCeiling = measuredBrotliBytes();

    // The label must quote what the CDN SENDS, which is strictly larger than
    // the local -q 11 ceiling because the CDN compresses on the fly at a lower
    // quality. A label at or below the ceiling means someone quoted the local
    // number again — the exact error that shipped in the published article.
    expect(
      claimedBytes,
      `gate label says ${quoted![1]} KB, which is at or below the local ` +
        `brotli -q 11 ceiling of ${Math.round(localCeiling / 1024)} KB. That is ` +
        `the compressibility ceiling, NOT what a reader downloads — the CDN ` +
        `compresses below -q 11 and sends more. Measure the served size:\n` +
        `  curl -s -o /tmp/b -H 'Accept-Encoding: br' ` +
        `https://ofriperetz.dev/lint-worker.js && wc -c < /tmp/b`,
    ).toBeGreaterThan(localCeiling);

    // …but not absurdly larger. 2026-09-03: served 470,563 vs ceiling 370,746
    // = 1.27x. Anything past 1.6x means the artifact or the CDN changed and the
    // number needs re-measuring rather than nudging.
    const ratio = claimedBytes / localCeiling;
    expect(
      ratio,
      `gate label says ${quoted![1]} KB, ${ratio.toFixed(2)}x the local ceiling ` +
        `of ${Math.round(localCeiling / 1024)} KB. Measured 1.27x on 2026-09-03; ` +
        `past 1.6x something moved — re-measure the served size rather than ` +
        `adjusting this bound.`,
    ).toBeLessThanOrEqual(1.6);
  }, 60_000);
});
