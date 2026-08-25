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
      props: { from_slug: string; to_slug: string; direction: "prev" | "next" };
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
    };

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
