"use client";

import { useEffect, useState } from "react";

/**
 * Reads `prefers-reduced-motion: reduce` and reacts to user changes.
 *
 * The CSS reset in `brand.css` already neutralizes most animations for users
 * who request reduced motion (sets `animation-duration: 0.01ms`). This hook
 * is for components that need to **structurally** behave differently — e.g.
 * skip an opacity fade-in entirely, render a static frame instead of an
 * animation loop, or stop a `requestAnimationFrame` loop to save battery.
 *
 * Returns `false` during SSR so the first paint matches the no-motion-pref
 * default; flips to the actual preference on hydration. Components that
 * use this should make sure their no-motion path is the more conservative
 * (less expensive) render so SSR HTML is small.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    // SSR-safe hydration of the user's media-query preference. Known
    // exception to react-hooks/set-state-in-effect, documented in AGENTS.md.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return reduced;
}
