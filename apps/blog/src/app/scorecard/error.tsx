"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Container } from "@/components/ui/container";
import { buttonVariants } from "@/components/ui/button-variants";

export default function ScorecardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[scorecard] render failed:", error);
  }, [error]);

  return (
    <main id="main" data-slot="scorecard-error-page">
      <Container size="content" className="py-24">
        <div className="rounded-lg border border-border bg-card p-10 text-center">
          <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Scorecard
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">
            The numbers are temporarily unavailable
          </h1>
          <p className="mx-auto mt-3 max-w-md text-muted-foreground">
            The underlying ledger couldn&apos;t be reached. This usually clears
            on its own within a few minutes. The receipts are still there —
            we&apos;re just not able to render them right now.
          </p>
          {error.digest && (
            <p className="mt-4 font-mono text-xs text-muted-foreground/70">
              ref: {error.digest}
            </p>
          )}
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={reset}
              className={buttonVariants({
                variant: "default",
                size: "default",
              })}
            >
              Try again
            </button>
            <Link
              href="/"
              className={buttonVariants({
                variant: "outline",
                size: "default",
              })}
            >
              Go home
            </Link>
          </div>
        </div>
      </Container>
    </main>
  );
}
