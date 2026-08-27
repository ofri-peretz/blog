"use client";

import * as React from "react";

import { track } from "@/lib/analytics";

/**
 * The reading funnel's missing half: how far readers actually get.
 *
 * Watches the article body (`#article-reading-span`) and fires
 * `article:read_depth` exactly once per milestone — `half` when the
 * viewport bottom passes 50% of the body, `full` at (effectively) the
 * end. Scroll math over IntersectionObserver because the body is far
 * taller than the viewport: thresholds on a single tall element fire
 * on visibility fractions of the ELEMENT in view, not reading
 * progress.
 *
 * A leaf client component (the RecordReading pattern): renders
 * nothing, and the article page stays a server component. The listener
 * is passive, rAF-throttled, and removes itself after `full`.
 */
export function ReadingDepth({ slug }: { slug: string }) {
  React.useEffect(() => {
    const body = document.getElementById("article-reading-span");
    if (!body) return;

    const fired = new Set<string>();
    let scheduled = false;

    const measure = () => {
      scheduled = false;
      const rect = body.getBoundingClientRect();
      if (rect.height <= 0) return;
      const read = Math.min(rect.height, Math.max(0, window.innerHeight - rect.top));
      const fraction = read / rect.height;
      const mark = (milestone: "half" | "full") => {
        if (fired.has(milestone)) return;
        fired.add(milestone);
        track("article:read_depth", { slug, milestone });
      };
      if (fraction >= 0.5) mark("half");
      // 0.98, not 1: the last points of a body routinely sit under a
      // sticky footer or the fold rounding — "read it all" must not
      // hinge on the final 2%.
      if (fraction >= 0.98) mark("full");
      if (fired.size === 2) window.removeEventListener("scroll", onScroll);
    };

    const onScroll = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(measure);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    // A short article can start beyond a milestone with no scroll ever
    // happening — measure once on mount.
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [slug]);
  return null;
}
