"use client";

import posthog from "posthog-js";

/**
 * Typed analytics events for the blog's interactive surfaces.
 *
 * The homepage agenda claims "evidence over confidence" — this file is
 * that claim applied to our own UX decisions. Every event here answers a
 * specific question a shipped feature raised; don't add events that
 * don't. Pageviews are NOT captured here (the provider owns them,
 * exactly once — ANALYTICS_PHILOSOPHY).
 *
 * Event names are frozen by `analytics-events-lock.test.ts`: renaming
 * one silently orphans its PostHog insights, so a rename must be a
 * deliberate, test-acknowledged act.
 */
export type BlogEvent =
  /** Does the corpus map actually navigate readers, or just look good? */
  | {
      name: "corpus_map:dot_click";
      props: { slug: string; series: string | null };
    }
  /** Does series navigation chain one read into the next? */
  | {
      name: "series:pager_click";
      props: {
        from_slug: string;
        to_slug: string;
        /** prev/next = the pager; jump = the expandable series list. */
        direction: "prev" | "next" | "jump";
      };
    }
  /** Does the end-of-article CTA convert readers into playground users? */
  | { name: "article:playground_cta_click"; props: { slug: string } }
  /** Does the Threads section chain one read into the next? */
  | {
      name: "article:thread_click";
      props: {
        from_slug: string;
        to_slug: string;
        direction: "draws_on" | "pulled_by";
      };
    }
  /**
   * How many return readers actually see their own thread on the map?
   * Aggregate count only — the thread itself never leaves the browser.
   */
  | { name: "corpus_map:your_thread"; props: { read_count: number } }
  /** Do live plugin cards convert readers toward the product? */
  | {
      name: "article:plugin_card_click";
      props: { slug: string; package: string };
    }
  /**
   * Is grep-the-corpus discovered — and via the ⌘K chord or the header
   * button? The typed query is never sent (aggregate-only analytics).
   */
  | { name: "quick_open:palette_view"; props: { source: "hotkey" | "button" } }
  /** Does a search convert into a read? Destination only, no query. */
  | { name: "quick_open:result_click"; props: { to_slug: string } }
  /**
   * Which snippets get copied — the strongest "this article did its
   * job" signal a code-first blog has. Fires only on a successful
   * clipboard write (the DS CodeBlock onCopied seam), never on a bare
   * click that copied nothing.
   */
  | {
      name: "article:code_copy_click";
      props: {
        slug: string;
        language: string | null;
        /**
         * Our package named by an install-shaped copy (install-detect),
         * or null for a regular snippet. THE Discover→Configure
         * conversion dimension: `npm install eslint-plugin-x` copied is
         * the strongest configure-intent signal an article can produce.
         */
        package: string | null;
      };
    }
  /**
   * How far readers actually get — `half` at 50% of the body, `full`
   * at the end. Once per milestone per view (reading-depth.tsx); the
   * read-completion half of the reading funnel.
   */
  | {
      name: "article:read_depth";
      props: { slug: string; milestone: "half" | "full" };
    }
  /** Do weekly-re-earned numbers pull readers into the full public run? */
  | { name: "article:bench_receipt_click"; props: { slug: string } }
  /** Does the resume offer chain a return visit into the next part? */
  | { name: "series:resume_click"; props: { to_slug: string } }
  /**
   * Do visitors actually compose on the Loom, or only look at the
   * default weave? `series` is comma-joined catalog ids — our own
   * vocabulary, never user input.
   */
  | {
      name: "loom:weave_change";
      props: {
        series: string;
        form: "weave" | "grid" | "radial";
        window: "90d" | "1y" | "all";
        normalize: "abs" | "idx";
      };
    }
  /** Do the curated preset stories work as entry points into weaving? */
  | { name: "loom:preset_click"; props: { preset: string } }
  /**
   * Is a composed weave worth sharing? Fires only on a successful
   * clipboard write, mirroring article:code_copy_click.
   */
  | { name: "loom:permalink_copy"; props: { series: string } }
  /**
   * Did the poster forms earn a life OUTSIDE the site? An SVG download
   * is the strongest share signal the Loom has — a weave leaving as an
   * artifact, not a link.
   */
  | {
      name: "loom:export";
      props: { series: string; form: "weave" | "radial" };
    }
  /**
   * The articles→Loom funnel: a reader followed an embedded weave into
   * the instrument. This is the discovery signal the guided-walk wave
   * is gated on.
   */
  | { name: "loom:embed_open"; props: { slug: string; series: string } };

/** Props type for one event name — keeps name/props correlated at call sites. */
export type EventProps<N extends BlogEvent["name"]> = Extract<
  BlogEvent,
  { name: N }
>["props"];

export function track<N extends BlogEvent["name"]>(
  name: N,
  props: EventProps<N>,
): void {
  // The singleton is inert until the provider ran posthog.init(); capture
  // on an uninitialized instance is a silent no-op, which is the correct
  // failure mode for analytics.
  posthog.capture(name, props);
}
