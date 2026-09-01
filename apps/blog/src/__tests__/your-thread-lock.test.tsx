import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { readingThread, recordReading } from "../lib/reading-history";

/**
 * Your Thread locks — the reading-history contract (the thread belongs
 * to the reader), the article-page recording, and the map's consumption
 * wiring incl. the re-vendored trace provenance.
 */

const read = (...p: string[]): string =>
  readFileSync(path.resolve(__dirname, "..", ...p), "utf-8");

describe("reading history (the thread belongs to the reader)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("records in first-read order; revisits are not new steps", () => {
    recordReading("a");
    recordReading("b");
    recordReading("a");
    recordReading("c");
    expect(readingThread()).toEqual(["a", "b", "c"]);
  });

  it("corrupt storage is an empty thread, never a crash", () => {
    window.localStorage.setItem("reading-thread", "{not json");
    expect(readingThread()).toEqual([]);
    window.localStorage.setItem(
      "reading-thread",
      JSON.stringify({ v: 999, slugs: ["x"] }),
    );
    expect(readingThread()).toEqual([]);
  });

  it("a quota failure means the thread simply doesn't grow", () => {
    recordReading("a");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(() => recordReading("b")).not.toThrow();
    vi.restoreAllMocks();
    expect(readingThread()).toEqual(["a"]);
  });
});

describe("wiring", () => {
  it("the vendored map carries the trace (interlace#67), with provenance", () => {
    const SRC = read("components", "ui", "timeline-map.tsx");
    expect(SRC).toContain("the reader's trace from #67");
    expect(SRC).toContain("TimelineMapTrace");
    expect(SRC).toContain("computeTracePath");
  });

  it("every article read becomes a step of the thread", () => {
    const PAGE = read("app", "articles", "[slug]", "page.tsx");
    expect(PAGE).toContain("<RecordReading slug={slug} />");
  });

  it("the map passes the thread only when it IS one, and says so", () => {
    const MAP = read("components", "woven-corpus-map.tsx");
    // One read is a beginning, not yet a thread.
    expect(MAP).toContain("readSlugs.length < 2");
    expect(MAP).toContain("trace={trace}");
    expect(MAP).toMatch(/Your thread: \$\{readSlugs\.length\} of \$\{items\.length\} read\./);
    // The visible caption tells sighted readers what the warm strand is.
    expect(MAP).toContain("The warm strand is you");
    // History narrows to slugs actually on the map before counting, and
    // arrives via useSyncExternalStore (no effect+setState cascade; the
    // server snapshot is the honest empty crawler view). The parse now
    // lives in one upstream memo (blog#192 review) that the filter
    // derives from.
    expect(MAP).toMatch(/allThreadSlugs\.filter\(\(s\) => known\.has\(s\)\)/);
    expect(MAP).toMatch(/parseThreadSnapshot\(rawThread\)/);
    expect(MAP).toContain("useSyncExternalStore(");
    expect(MAP).toContain("serverThreadSnapshot");
  });
});
