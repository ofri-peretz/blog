"use client";

import {
  ComponentPropsWithoutRef,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/lib/use-reduced-motion";

interface NumberTickerProps extends ComponentPropsWithoutRef<"span"> {
  value: number;
  /**
   * Where the count-up starts. Defaults to `value`, meaning no animation.
   * Passing a lower number opts into the count-up effect — but only in a
   * live browser: server HTML always carries the FINAL value, because the
   * pre-hydration render is what crawlers, LLMs, reader mode, and JS-off
   * visitors keep (UX_PHILOSOPHY §6 — a stat that says `0` reads as
   * broken; eight of them read as an abandoned project).
   */
  startValue?: number;
  direction?: "up" | "down";
  delay?: number;
  decimalPlaces?: number;
  /** Duration of animation in ms (default: 1500) */
  duration?: number;
  /**
   * Number notation. `"standard"` (default) renders the full grouped value
   * (e.g. `113,313`). `"compact"` falls back to K/M (e.g. `113K`, `1.2M`) — use
   * it where the full figure would overflow its container (narrow viewports).
   */
  notation?: "standard" | "compact";
}

/**
 * NumberTicker - Performance Optimized
 *
 * Uses requestAnimationFrame + easeOutExpo instead of Framer Motion springs.
 * This reduces the JS bundle size and eliminates the motion/react dependency
 * for a simple counting animation.
 */
export function NumberTicker({
  value,
  startValue,
  direction = "up",
  delay = 0,
  className,
  decimalPlaces = 0,
  duration = 1500,
  notation = "standard",
  ...props
}: NumberTickerProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [hasAnimated, setHasAnimated] = useState(false);
  const reduceMotion = useReducedMotion();
  const from = startValue ?? value;
  const shouldAnimate = from !== value;

  // Format number with locale (memoized to prevent useEffect recreation)
  const formatNumber = useCallback(
    (num: number) =>
      notation === "compact"
        ? Intl.NumberFormat("en-US", {
            notation: "compact",
            compactDisplay: "short",
            maximumFractionDigits: 1,
          }).format(num)
        : Intl.NumberFormat("en-US", {
            minimumFractionDigits: decimalPlaces,
            maximumFractionDigits: decimalPlaces,
          }).format(Number(num.toFixed(decimalPlaces))),
    [decimalPlaces, notation],
  );

  // Reduced-motion: jump straight to the final value — no easing, no observer.
  useEffect(() => {
    if (reduceMotion && ref.current) {
      ref.current.textContent = formatNumber(value);
    }
  }, [reduceMotion, value, formatNumber]);

  useEffect(() => {
    if (!ref.current || hasAnimated || reduceMotion || !shouldAnimate) return;

    // IntersectionObserver to trigger when in view
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true);

          const startTime = Date.now() + delay * 1000;
          const animFrom = direction === "down" ? value : from;
          const to = direction === "down" ? from : value;

          // The DOM shows the final value until now (honest static render);
          // snap to the animation origin only once the count-up is really
          // about to run.
          if (ref.current) {
            ref.current.textContent = formatNumber(animFrom);
          }

          const animate = () => {
            const now = Date.now();
            if (now < startTime) {
              requestAnimationFrame(animate);
              return;
            }

            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Ease out expo for smooth deceleration
            const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
            const current = animFrom + (to - animFrom) * eased;

            if (ref.current) {
              ref.current.textContent = formatNumber(current);
            }

            if (progress < 1) {
              requestAnimationFrame(animate);
            }
          };

          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [
    value,
    from,
    direction,
    delay,
    duration,
    decimalPlaces,
    hasAnimated,
    formatNumber,
    reduceMotion,
    shouldAnimate,
  ]);

  return (
    <span
      ref={ref}
      className={cn(
        // Use the foreground token so the ticker tracks the theme. Hardcoding
        // `text-black dark:text-white` would diverge if a consumer overrides
        // `--color-fd-foreground`. The token is the single source of truth.
        "inline-block tracking-wider text-fd-foreground tabular-nums",
        className,
      )}
      {...props}
    >
      {/* Always the FINAL value: this is the text crawlers, reader mode,
          and JS-off visitors keep. The count-up rewrites it client-side. */}
      {formatNumber(value)}
    </span>
  );
}
