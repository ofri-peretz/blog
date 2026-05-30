"use client";

import { ArrowRight } from "lucide-react";
import { useVisitorTracking } from "@/hooks/use-visitor-tracking";
import { cn } from "@/lib/utils";

interface LinkedInCtaProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Stable selector for E2E tests; consumer provides — no default. */
  "data-testid"?: string;
}

const LINKEDIN_URL = "https://www.linkedin.com/in/ofri-peretz/";

export function LinkedInCta({
  className,
  "data-testid": testId,
  ...rest
}: LinkedInCtaProps) {
  const { track } = useVisitorTracking();

  const handleClick = () => {
    track("contact_intent_click");
    setTimeout(() => {
      window.open(LINKEDIN_URL, "_blank", "noopener,noreferrer");
    }, 100);
  };

  return (
    <button
      type="button"
      data-slot="linkedin-cta"
      data-testid={testId}
      onClick={handleClick}
      className={cn(
        "group inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-muted/40 px-5 py-2.5 text-sm font-medium text-foreground transition-all duration-300 hover:scale-[1.02] hover:bg-muted",
        className,
      )}
      {...rest}
    >
      <span className="text-muted-foreground">Want to reach out?</span>
      <span className="font-semibold">Let&apos;s Talk</span>
      <ArrowRight
        aria-hidden="true"
        className="-ml-2 h-4 w-4 opacity-0 transition-all duration-300 group-hover:ml-0 group-hover:opacity-100"
      />
    </button>
  );
}
