"use client";

import { SunnyBackground } from "@/components/ui/sunny-background";
import { CloudParticles } from "@/components/ui/cloud-particles";
import { Meteors } from "@/components/ui/meteors";
import { useReducedMotion } from "@/lib/use-reduced-motion";

/**
 * Hero background animation cluster — theme-aware twin surfaces, gated on
 * `prefers-reduced-motion`.
 *
 * Light theme renders the daylight pair (sun + clouds) over a Rayleigh-
 * scattered sky gradient. Dark theme renders the cosmic pair (currently
 * just the meteor shower; a future stars / shooting-stars layer would
 * land alongside it inside the same dark-only wrapper).
 *
 * The split mirrors the Nuxt blog-old `Hero.vue` source — its
 * `<DaylightBackground>` lived inside `block dark:hidden` and its
 * `<CosmicBackground>` lived inside `hidden dark:block`. Letting the
 * daylight surface render in dark mode (the previous regression) made
 * the sun bleed through the hero copy and broke the cosmic mood.
 *
 * Each primitive still runs its own JS loop. When the user has
 * requested reduced motion we render nothing at all rather than rely on
 * the CSS-level neutralisation in `globals.css` — the JS loops would
 * still mount, paint once, and burn battery. MOTION_PHILOSOPHY §3.
 */
interface HeroBackdropProps {
  /** Stable selector for E2E tests; consumer provides — no default. */
  "data-testid"?: string;
}

export function HeroBackdrop({
  "data-testid": testId,
}: HeroBackdropProps = {}) {
  const reduced = useReducedMotion();
  if (reduced) return null;
  return (
    <div data-slot="hero-backdrop" data-testid={testId} aria-hidden>
      {/* Light theme: daylight surface — Rayleigh sky + sun + clouds. */}
      <div className="absolute inset-0 block dark:hidden">
        <SunnyBackground className="opacity-70" />
        <CloudParticles density={3} />
      </div>
      {/* Dark theme: cosmic surface — purple meteor shower. */}
      <div className="absolute inset-0 hidden dark:block">
        <Meteors number={3} />
      </div>
    </div>
  );
}
