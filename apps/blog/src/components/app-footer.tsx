import Link from "next/link";
import { cn } from "@/lib/utils";

const SOCIAL_LINKS = [
  { href: "https://github.com/ofri-peretz", label: "GitHub" },
  { href: "https://dev.to/ofri-peretz", label: "Dev.to" },
  { href: "https://www.linkedin.com/in/ofri-peretz/", label: "LinkedIn" },
  { href: "https://x.com/ofriperetzdev", label: "X" },
];

interface AppFooterProps extends React.HTMLAttributes<HTMLElement> {
  /** Stable selector for E2E tests; consumer provides — no default. */
  "data-testid"?: string;
}

export function AppFooter({
  className,
  "data-testid": testId,
  ...rest
}: AppFooterProps) {
  return (
    <footer
      data-slot="app-footer"
      data-testid={testId}
      className={cn("mt-auto border-t border-border bg-background", className)}
      {...rest}
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div className="text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Build Securely.</p>
          <p>
            Engineering Leader & Open Source Creator. Architect of the Interlace
            ESLint Ecosystem.
          </p>
        </div>
        <ul className="flex flex-wrap gap-4 text-sm">
          {SOCIAL_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                // See app-header: 24px min target, WCAG 2.2 SC 2.5.8 (AA).
                // These are standalone nav links, not links inside a sentence,
                // so the inline-text exception does not apply to them.
                className="inline-flex min-h-6 items-center text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <div className="border-t border-border">
        <p className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-4 text-xs text-muted-foreground">
          © {new Date().getFullYear()} Ofri Peretz. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
