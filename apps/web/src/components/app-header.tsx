import Image from "next/image";
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
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm font-semibold tracking-tight hover:text-foreground/80"
        >
          <Image
            src="/ofri-profile.webp"
            alt=""
            width={28}
            height={28}
            priority
            className="size-7 rounded-full border border-border object-cover"
          />
          ofri peretz
        </Link>
        <nav aria-label="Primary" className="hidden items-center gap-6 sm:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
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
