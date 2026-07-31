import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";
import { MobileNav } from "./mobile-nav";
import { cn } from "@/lib/utils";

// /scorecard is the canonical metrics surface (supabase-backed North Star).
// /stats and /analytics remain reachable by direct URL until they're either
// folded into /scorecard or retired — keeping them in nav was redundant.
const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/articles", label: "Articles" },
  { href: "/npm", label: "npm" },
  { href: "/scorecard", label: "Scorecard" },
];

interface AppHeaderProps extends React.HTMLAttributes<HTMLElement> {
  /** Stable selector for E2E tests; consumer provides — no default. */
  "data-testid"?: string;
}

export function AppHeader({
  className,
  "data-testid": testId,
  ...rest
}: AppHeaderProps) {
  return (
    <header
      data-slot="app-header"
      data-testid={testId}
      className={cn(
        "sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-sm supports-backdrop-filter:bg-background/60",
        className,
      )}
      {...rest}
    >
      {/* min-h-14 rather than h-14, plus a gap: at 200% text (WCAG 1.4.4) every
          rem-sized control doubles — the 36px nav trigger becomes 72px — and a
          fixed-height row with nothing to give pushed the header 27px past a
          320px viewport. A minimum height leaves the normal case identical
          while letting the row grow when the text does. */}
      <div className="mx-auto flex min-h-14 max-w-6xl items-center justify-between gap-2 px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          // min-w-0 + truncate: the wordmark is the one part of this row that
          // can yield. Without min-w-0 a flex child refuses to shrink below its
          // content, so the controls to its right get pushed off-screen instead.
          className="flex min-w-0 items-center gap-2 truncate text-sm font-semibold tracking-tight hover:text-foreground/80"
        >
          {/* Inline, not next/image: the optimizer pipes every local src through
              /_next/image, which rejects SVG with a 400 unless dangerouslyAllowSVG
              is enabled. Inlining also drops a request for a 28px mark. Geometry is
              identical to render-cover.sh, so the header and all 78 covers share
              one shape. */}
          <svg
            viewBox="0 0 100 100"
            className="size-7 shrink-0"
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
          ofri peretz
        </Link>
        <nav aria-label="Primary" className="hidden items-center gap-6 sm:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              // inline-flex + min-h-6: bare `text-sm` gives a 20px-tall box,
              // under the 24x24 CSS px minimum in WCAG 2.2 SC 2.5.8 (AA).
              // The nav row is already items-center, so the extra height is
              // absorbed and nothing moves.
              className="inline-flex min-h-6 min-w-6 items-center justify-center text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <MobileNav links={NAV_LINKS} />
        </div>
      </div>
    </header>
  );
}
