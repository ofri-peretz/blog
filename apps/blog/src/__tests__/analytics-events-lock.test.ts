/**
 * Analytics events lock — 2026-08-24.
 *
 * The shipped interactive surfaces (corpus map, series pager, playground
 * CTA) were UX hypotheses with no measurement — contradicting the
 * homepage's own "evidence over confidence" claim. This locks two
 * contracts:
 *
 *  1. Event NAMES are frozen: renaming one silently orphans its PostHog
 *     insights, so a rename must break here first.
 *  2. Each surface actually fires its event — an instrumented feature
 *     that loses its wiring in a refactor reverts to a hypothesis
 *     without any test noticing otherwise.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (rel: string): string =>
  readFileSync(path.resolve(__dirname, "..", rel), "utf-8");

const ANALYTICS = read("lib/analytics.ts");
// The map is now the DS TimelineMap; the analytics seam lives in the
// client wrapper that injects Link + onItemClick.
const MAP = read("components/woven-corpus-map.tsx");
const PAGER = read("components/series-nav.tsx");
const ARTICLE = read("app/articles/[slug]/page.tsx");

const FROZEN_EVENTS = [
  "corpus_map:dot_click",
  "series:pager_click",
  "article:playground_cta_click",
  "article:thread_click",
  "corpus_map:your_thread",
] as const;

describe("typed event names are frozen", () => {
  it.each(FROZEN_EVENTS)("%s is declared in the BlogEvent union", (name) => {
    expect(ANALYTICS).toContain(`"${name}"`);
  });
});

describe("each surface fires its event", () => {
  it("corpus map dots track clicks", () => {
    expect(MAP).toContain('track("corpus_map:dot_click"');
  });

  it("series pager links are TrackedLinks with direction + from/to", () => {
    expect(PAGER).toContain('event="series:pager_click"');
    expect(PAGER).toContain("from_slug: currentSlug");
    expect(PAGER).toMatch(/direction: "prev"/);
    expect(PAGER).toMatch(/direction: "next"/);
  });

  it("the playground CTA is a TrackedLink carrying the article slug", () => {
    expect(ARTICLE).toContain('event="article:playground_cta_click"');
    expect(ARTICLE).toMatch(/<TrackedLink[\s\S]{0,500}eslint\.interlace\.tools\/play/);
  });

  it("the map fires your-thread with the aggregate count only", () => {
    expect(MAP).toContain('track("corpus_map:your_thread"');
    expect(MAP).toContain("read_count: readSlugs.length");
    // The thread itself never leaves the browser — no slugs in the event.
    expect(MAP).not.toMatch(/your_thread[\s\S]{0,120}slugs?:/);
  });

  it("thread links are TrackedLinks with from/to + direction", () => {
    const THREADS = read("components/article-threads.tsx");
    expect(THREADS).toContain('event="article:thread_click"');
    expect(THREADS).toContain("from_slug: currentSlug");
    expect(THREADS).toContain("to_slug: item.slug");
    expect(THREADS).toContain("direction,");
  });
});
