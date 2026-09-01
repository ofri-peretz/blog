import { cn } from "@/lib/utils";

/**
 * The two-bar Interlace mark.
 *
 * Decorative by default (`aria-hidden`) — every current use sits next to visible
 * text that already names the brand, so announcing it would just duplicate that.
 * Extracted from app-header so the header and the 404 page cannot drift apart.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={cn("size-7 shrink-0", className)}
      aria-hidden="true"
      focusable="false"
    >
      <g transform="rotate(-30 50 50)">
        <rect
          x="8"
          y="20"
          width="66"
          height="28"
          rx="14"
          className="fill-brand-orange"
        />
        <rect
          x="26"
          y="52"
          width="66"
          height="28"
          rx="14"
          className="fill-brand-green"
        />
      </g>
    </svg>
  );
}
