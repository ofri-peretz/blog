"use client";

import posthog from "posthog-js";
import { useEffect } from "react";

/**
 * Marks this browser as OURS, so our own visits stop contaminating the
 * numbers we make decisions from.
 *
 * Why this exists: at ~11 pageviews a day, one person clicking around
 * their own site is a visible fraction of every metric. `loom:weave_change`
 * read 52 events / 2 people for August — almost certainly us, sitting in
 * the same dataset as the handful of real signals. Nothing in the stack
 * could tell the two apart: `$host` separates localhost from production
 * and `visitor_classified` carries `is_bot`, but neither answers "was
 * this Ofri on the live site?".
 *
 * How to use it — once per browser, per device:
 *   https://ofriperetz.dev/?internal=1   mark this browser as internal
 *   https://ofriperetz.dev/?internal=0   undo it
 *
 * `posthog.register` writes a SUPER PROPERTY, which posthog-js persists in
 * its own storage and attaches to every subsequent event automatically —
 * including `$pageview` and everything in lib/analytics.ts. So one visit
 * flags the browser for good, with no per-call-site changes.
 *
 * Queries and insights then exclude us with `is_internal != true`. The
 * property is deliberately absent (not `false`) for real readers, so a
 * filter that forgets it fails toward INCLUDING strangers rather than
 * silently hiding them.
 *
 * The parameter is stripped from the URL after it is read: a link with
 * `?internal=1` on it would otherwise mark a genuine reader as internal
 * and delete them from our data if it were ever shared or indexed.
 */
export function InternalTrafficFlag(): null {
  useEffect(() => {
    let flag: string | null = null;
    try {
      flag = new URLSearchParams(window.location.search).get("internal");
    } catch {
      return;
    }
    if (flag !== "1" && flag !== "0") return;

    try {
      if (flag === "1") posthog.register({ is_internal: true });
      else posthog.unregister("is_internal");
    } catch {
      // Analytics must never break the page.
    }

    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("internal");
      window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    } catch {
      // A failed tidy-up is cosmetic — the flag is already registered.
    }
  }, []);

  return null;
}
