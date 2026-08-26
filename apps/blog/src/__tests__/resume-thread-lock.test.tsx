import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { pickResume, type SeriesIndex } from "../lib/series-resume";

/**
 * Resume-your-thread locks — the picker offers exactly the honest next
 * part (forward only, newest engagement first, nothing when there is
 * nothing), and the caption + navigator surfaces stay wired.
 */

const read = (rel: string): string =>
  readFileSync(path.resolve(__dirname, "..", rel), "utf-8");

const INDEX: SeriesIndex = {
  seriesOf: { a1: "Alpha", a2: "Alpha", a3: "Alpha", b1: "Beta", b2: "Beta" },
  parts: {
    Alpha: [
      { slug: "a1", title: "Alpha one" },
      { slug: "a2", title: "Alpha two" },
      { slug: "a3", title: "Alpha three" },
    ],
    Beta: [
      { slug: "b1", title: "Beta one" },
      { slug: "b2", title: "Beta two" },
    ],
  },
};

describe("pickResume", () => {
  it("offers the next unread part of the most recent series engagement", () => {
    // Read Alpha 1, then Beta 1 — Beta is the fresher thread.
    expect(pickResume(["a1", "b1"], INDEX)).toEqual({
      series: "Beta",
      readInSeries: 1,
      total: 2,
      next: { slug: "b2", title: "Beta two" },
    });
  });

  it("skips already-read parts and counts progress honestly", () => {
    // a1 and a2 read (a2 read out of order first) → next is a3, 2/3 done.
    expect(pickResume(["a2", "a1"], INDEX)).toEqual({
      series: "Alpha",
      readInSeries: 2,
      total: 3,
      next: { slug: "a3", title: "Alpha three" },
    });
  });

  it("resumes forward only — a finished series offers nothing", () => {
    expect(pickResume(["b1", "b2"], INDEX)).toBeNull();
    // The last part alone has nothing after it.
    expect(pickResume(["a3"], INDEX)).toBeNull();
  });

  it("a skipped part is offered via the earlier engagement (gap-fill)", () => {
    // Read 1 and 3: nothing follows 3, so the walk falls back to the
    // engagement at part 1 — whose next unread is the gap, part 2.
    expect(pickResume(["a1", "a3"], INDEX)).toEqual({
      series: "Alpha",
      readInSeries: 2,
      total: 3,
      next: { slug: "a2", title: "Alpha two" },
    });
  });

  it("no reads or no series membership → null (data gap renders nothing)", () => {
    expect(pickResume([], INDEX)).toBeNull();
    expect(pickResume(["standalone-article"], INDEX)).toBeNull();
  });
});

describe("wiring", () => {
  it("the map caption offers the resume link as a TrackedLink", () => {
    const MAP = read("components/woven-corpus-map.tsx");
    expect(MAP).toContain('event="series:resume_click"');
    expect(MAP).toContain("props={{ to_slug: resume.next.slug }}");
    // The offer reads the FULL thread, not the map-narrowed slugs.
    expect(MAP).toContain("pickResume(allThreadSlugs, seriesIndex)");
  });

  it("the articles page builds the series index from one ordering source", () => {
    const PAGE = read("app/articles/page.tsx");
    expect(PAGE).toContain("getSeriesContext(a.slug)");
    expect(PAGE).toContain("seriesIndex={seriesIndex}");
  });

  it("both series-navigator row kinds carry the read tick", () => {
    const NAV = read("components/series-nav.tsx");
    const ticks = NAV.match(/<ReadTick slug=\{part\.slug\} \/>/g) ?? [];
    expect(ticks.length).toBe(2);
  });

  it("the tick is aria-quiet with an sr-only equivalent", () => {
    const TICK = read("components/read-tick.tsx");
    expect(TICK).toContain('aria-hidden="true"');
    expect(TICK).toContain("sr-only");
    expect(TICK).toContain("text-brand-green");
  });
});
