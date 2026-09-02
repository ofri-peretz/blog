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
  // newsletter:subscribe is frozen here, but its FIRING assertion lives in
  // newsletter-capture-lock.test.ts — the surface owns a settled-success
  // condition (fire on state "ok", once per mount) that does not fit the
  // uniform "each surface fires its event" shape below. (Review asked for
  // this pointer; the next person following the pattern should not have to
  // grep for it.)
  "newsletter:subscribe",
  "corpus_map:dot_click",
  "series:pager_click",
  "article:playground_cta_click",
  "article:thread_click",
  "corpus_map:your_thread",
  "article:plugin_card_click",
  "quick_open:palette_view",
  "quick_open:result_click",
  "article:code_copy_click",
  "article:read_depth",
  "article:bench_receipt_click",
  "series:resume_click",
  "loom:weave_change",
  "loom:preset_click",
  "loom:permalink_copy",
  "loom:export",
  "loom:embed_open",
  "article:playground_open",
  "article:playground_edit",
] as const;

describe("typed event names are frozen", () => {
  it.each(FROZEN_EVENTS)("%s is declared in the BlogEvent union", (name) => {
    expect(ANALYTICS).toContain(`"${name}"`);
  });
});

// WIRING, not firing. Every assertion in this block reads source text, and
// text cannot show that an event was ever SENT — only that the surface is
// wired to send it. The distinction is not pedantic: every event named here
// reads zero in production, so 14 assertions have been claiming these fire
// while nothing has ever contradicted them.
//
// Structural evidence is legitimate for a structural claim ("this is a
// TrackedLink carrying slug + package" is exactly what the source can show).
// What over-claimed was the verb. Renamed rather than converted, because
// rendering 14 surfaces to re-prove what a grep already establishes would
// cost runtime and buy nothing. The one genuine behaviour in the block —
// read depth — moved to a rendered test. See the behavioural-claims finding.
describe("each surface is WIRED to its event", () => {
  it("corpus map dots are wired to track clicks", () => {
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

  it("the map is wired to send your-thread with the aggregate count only", () => {
    expect(MAP).toContain('track("corpus_map:your_thread"');
    expect(MAP).toContain("read_count: trace.ids.length");
    // The thread itself never leaves the browser — no slugs in the event.
    expect(MAP).not.toMatch(/your_thread[\s\S]{0,120}slugs?:/);
  });

  it("plugin cards are TrackedLinks carrying slug + package", () => {
    const CARDS = read("components/article-plugins.tsx");
    expect(CARDS).toContain('event="article:plugin_card_click"');
    expect(CARDS).toContain("slug: currentSlug, package: p.name");
  });

  it("quick-open is wired to send open (source only) and select (slug only)", () => {
    const SEARCH = read("components/corpus-search.tsx");
    expect(SEARCH).toContain('track("quick_open:palette_view", { source: "hotkey" })');
    expect(SEARCH).toContain('track("quick_open:palette_view", { source: "button" })');
    expect(SEARCH).toContain('track("quick_open:result_click", { to_slug: doc.slug })');
    // The typed query never leaves the browser — search terms are
    // free-text and the analytics contract is aggregate-only. Anchored
    // on the track CALLS: prose may say "query"; a payload must not.
    expect(SEARCH).not.toMatch(
      /track\("quick_open:(palette_view|result_click)"[\s\S]{0,120}quer/,
    );
  });

  it("the resume offer is a TrackedLink carrying the destination", () => {
    const MAP = read("components/woven-corpus-map.tsx");
    expect(MAP).toContain('event="series:resume_click"');
    expect(MAP).toContain("props={{ to_slug: resume.next.slug }}");
  });

  it("the bench receipt's run link is a TrackedLink carrying the slug", () => {
    const RECEIPT = read("components/article-bench-receipt.tsx");
    expect(RECEIPT).toContain('event="article:bench_receipt_click"');
    expect(RECEIPT).toContain("props={{ slug: currentSlug }}");
  });

  it("thread links are TrackedLinks with from/to + direction", () => {
    const THREADS = read("components/article-threads.tsx");
    expect(THREADS).toContain('event="article:thread_click"');
    expect(THREADS).toContain("from_slug: currentSlug");
    expect(THREADS).toContain("to_slug: item.slug");
    expect(THREADS).toContain("direction,");
  });

  it("the loom is wired to send weave_change on every applied state", () => {
    const LOOM = read("components/loom/loom-composer.tsx");
    expect(LOOM).toContain('track("loom:weave_change"');
    expect(LOOM).toContain("series: next.series.join(\",\")");
  });

  it("loom presets and permalink copy each carry their own event", () => {
    const LOOM = read("components/loom/loom-composer.tsx");
    expect(LOOM).toContain('track("loom:preset_click", { preset: preset.id })');
    // Copy fires only AFTER the clipboard write resolves — same honesty
    // rule as article:code_copy_click.
    expect(LOOM).toMatch(
      /await navigator\.clipboard\.writeText[\s\S]{0,200}track\("loom:permalink_copy"/,
    );
  });

  it("read depth is wired: passive, rAF-throttled, once-per-milestone guard", () => {
    // NAME NARROWED, and the behaviour moved rather than mocked. Whether a
    // milestone fires ONCE, and whether the listener removes itself, are
    // functions of scroll position — and the component reads
    // getBoundingClientRect() and window.innerHeight, which jsdom returns as
    // zeroes. A unit test would have to fake the rects, and would then be
    // asserting the arithmetic of its own mock rather than the component.
    //
    // So this keeps the structural half (the guard exists, the listener is
    // passive and throttled, the page mounts it) and the behavioural half
    // lives in journey-audit.mjs, where a real browser scrolls a real
    // article and the capture request is observed on the wire.
    const DEPTH = read("components/reading-depth.tsx");
    expect(DEPTH).toContain('track("article:read_depth"');
    // Once per milestone — the fired set is the guard.
    expect(DEPTH).toMatch(/fired\.has\(milestone\)/);
    // Passive + rAF-throttled: reading measurement must never cost
    // scroll performance.
    expect(DEPTH).toContain("{ passive: true }");
    expect(DEPTH).toContain("requestAnimationFrame");
    // Both milestones exist, and the page renders the component.
    expect(DEPTH).toContain('mark("half")');
    expect(DEPTH).toContain('mark("full")');
    const PAGE = read("app/articles/[slug]/page.tsx");
    expect(PAGE).toContain("<ReadingDepth slug={slug} />");
  });

  it("loom export is ordered after the download hand-off in source", () => {
    const LOOM = read("components/loom/loom-composer.tsx");
    // Same honesty rule: the guard (`if (!svg) return`) sits above, so a
    // click with nothing to serialize reports nothing.
    expect(LOOM).toMatch(/downloadSvg\(svg, name\);[\s\S]{0,120}track\("loom:export"/);
  });
});
