/**
 * Loom series math — the pure transforms every weave runs through.
 *
 * These run on both sides of the wire (corpus assembly on the server,
 * recomposition in the browser), so a regression here skews every chart
 * silently — no crash, just wrong numbers drawn confidently.
 */
import { describe, expect, it } from "vitest";

import {
  addDays,
  MIN_INDEX_BASE,
  indexTo100,
  mondayOf,
  weeklyTotals,
  windowPoints,
} from "../lib/loom-data";
import { windowCutoff } from "../lib/loom-url";

describe("mondayOf", () => {
  it("maps a Wednesday to its week's Monday", () => {
    expect(mondayOf("2026-08-26")).toBe("2026-08-24");
  });

  it("maps a Monday to itself", () => {
    expect(mondayOf("2026-08-24")).toBe("2026-08-24");
  });

  it("maps a Sunday to the Monday six days back, not forward", () => {
    expect(mondayOf("2026-08-30")).toBe("2026-08-24");
  });
});

describe("weeklyTotals", () => {
  const week = (monday: string, values: number[]) =>
    values.map((value, i) => ({ day: addDays(monday, i), value }));

  it("sums a complete week under its Monday key", () => {
    const points = weeklyTotals(
      week("2026-08-10", [1, 2, 3, 4, 5, 6, 7]),
      "2026-08-16",
    );
    expect(points).toEqual([{ t: "2026-08-10", v: 28 }]);
  });

  it("drops the trailing partial week instead of drawing a cliff", () => {
    const points = weeklyTotals(
      [
        ...week("2026-08-10", [1, 1, 1, 1, 1, 1, 1]),
        // Two days of the following week — observedThrough is Tuesday.
        ...week("2026-08-17", [100, 100]),
      ],
      "2026-08-18",
    );
    expect(points.map((p) => p.t)).toEqual(["2026-08-10"]);
  });

  it("keeps the current week once observedThrough reaches its Sunday", () => {
    const points = weeklyTotals(
      week("2026-08-17", [1, 1, 1, 1, 1, 1, 1]),
      "2026-08-23",
    );
    expect(points).toEqual([{ t: "2026-08-17", v: 7 }]);
  });

  it("interior gaps do not drop a bucket — the sum is what was reported", () => {
    const points = weeklyTotals(
      [
        { day: "2026-08-10", value: 5 },
        // 08-11..08-13 missing (registry reported nothing)
        { day: "2026-08-14", value: 7 },
      ],
      "2026-08-23",
    );
    expect(points).toEqual([{ t: "2026-08-10", v: 12 }]);
  });

  it("sorts buckets chronologically regardless of input order", () => {
    const points = weeklyTotals(
      [
        { day: "2026-08-18", value: 1 },
        { day: "2026-08-11", value: 1 },
      ],
      "2026-08-30",
    );
    expect(points.map((p) => p.t)).toEqual(["2026-08-10", "2026-08-17"]);
  });
});

describe("indexTo100", () => {
  it("bases at the first non-null, non-zero point AND starts there", () => {
    // The leading zero is dropped rather than drawn as index 0. The control
    // promises "start = 100"; a line that begins at 0 breaks that promise,
    // and the zeros carry no ratio information — every one is 0/base.
    expect(
      indexTo100([
        { t: "a", v: 0 },
        { t: "b", v: 50 },
        { t: "c", v: 75 },
      ]),
    ).toEqual([
      { t: "b", v: 100 },
      { t: "c", v: 150 },
    ]);
  });

  it("every indexed series starts at exactly 100", () => {
    for (const input of [
      [
        { t: "a", v: 0 },
        { t: "b", v: 0 },
        { t: "c", v: 12 },
        { t: "d", v: 19 },
      ],
      [
        { t: "a", v: null },
        { t: "b", v: 40 },
        { t: "c", v: 60 },
      ],
      [
        { t: "a", v: 70 },
        { t: "b", v: 70 },
      ],
    ]) {
      expect(indexTo100(input)[0]?.v, JSON.stringify(input)).toBe(100);
    }
  });

  it("preserves nulls — a gap is not a zero", () => {
    expect(
      indexTo100([
        { t: "a", v: 10 },
        { t: "b", v: null },
      ]),
    ).toEqual([
      { t: "a", v: 100 },
      { t: "b", v: null },
    ]);
  });

  it("returns nothing when no base exists", () => {
    expect(
      indexTo100([
        { t: "a", v: 0 },
        { t: "b", v: null },
      ]),
    ).toEqual([]);
  });

  it("refuses a base too small to carry a ratio", () => {
    // THE REPORTED BUG. 19 GitHub stars against a base of 1 drew a line to
    // 1,900 on a chart captioned "GitHub stars", and was read as 1,900 stars
    // — which is exactly what it looked like. A base of 1 is not a scale, it
    // is a 100x multiplier.
    const stars = [
      { t: "2025-12-01", v: 0 },
      { t: "2025-12-13", v: 1 },
      { t: "2026-09-04", v: 19 },
    ];
    expect(indexTo100(stars)).toEqual([]);
  });

  it("draws nothing anywhere near the floor, and everything at it", () => {
    // The boundary stated twice, so a change to MIN_INDEX_BASE cannot quietly
    // move it in one direction only.
    const at = (base: number) => indexTo100([{ t: "a", v: base }]);
    expect(at(MIN_INDEX_BASE - 1)).toEqual([]);
    expect(at(MIN_INDEX_BASE)).toEqual([{ t: "a", v: 100 }]);
  });

  it("rounds to one decimal — readouts, not physics", () => {
    expect(
      indexTo100([
        { t: "a", v: 30 },
        { t: "b", v: 40 },
      ])[1].v,
    ).toBe(133.3);
  });
});

describe("windowPoints + windowCutoff", () => {
  const points = [
    { t: "2026-01-01", v: 1 },
    { t: "2026-05-01", v: 2 },
    { t: "2026-08-01", v: 3 },
  ];

  it("cutoff is inclusive", () => {
    expect(windowPoints(points, "2026-05-01")).toHaveLength(2);
  });

  it("'all' keeps everything", () => {
    expect(
      windowPoints(points, windowCutoff("all", "2026-08-26")),
    ).toHaveLength(3);
  });

  it("'90d' counts back from observedThrough, not from the wall clock", () => {
    expect(windowCutoff("90d", "2026-08-26")).toBe("2026-05-28");
  });

  it("'1y' spans 365 days", () => {
    expect(windowCutoff("1y", "2026-08-26")).toBe("2025-08-26");
  });
});
