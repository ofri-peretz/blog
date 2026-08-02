"use client";

import Link from "next/link";
import { Container } from "@/components/ui/container";
import { buttonVariants } from "@/components/ui/button-variants";
import { BrandMark } from "@/components/brand-mark";

/**
 * Route-level error boundary. Catches render/data errors in any segment below
 * the root layout and replaces just that subtree — the header and footer stay
 * mounted.
 *
 * Must be a Client Component (React error boundaries are client-only), which
 * is also why there is no `metadata` export: Next serves a 500 for these and
 * the page is never indexable anyway.
 *
 * Errors in the ROOT layout itself escape this boundary — global-error.tsx
 * catches those.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main id="main" data-slot="error-page">
      <Container size="content" className="py-24">
        <div className="rounded-lg border border-border bg-card p-10 text-center">
          <BrandMark className="mx-auto size-14" />
          <p className="mt-8 text-sm font-medium uppercase tracking-wider text-muted-foreground">
            500
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">
            Something broke on our end
          </h1>
          <p className="mx-auto mt-3 max-w-prose text-muted-foreground">
            This one is not your fault. The page failed to render — retrying
            often clears it, and the failure has been logged either way.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {/* reset() re-renders the failed segment without a full page load. */}
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

          {/*
            The digest is a hash Next assigns to the server-side error; the real
            message and stack stay on the server. Showing it lets someone quote a
            reference in an issue without us leaking internals into the page.
          */}
          {error.digest ? (
            <p className="mt-8 font-mono text-xs text-muted-foreground">
              Reference: {error.digest}
            </p>
          ) : null}
        </div>
      </Container>
    </main>
  );
}
