import Link from "next/link";
import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { buttonVariants } from "@/components/ui/button-variants";
import { BrandMark } from "@/components/brand-mark";

export const metadata: Metadata = {
  title: "Page not found",
  description: "The page you're looking for doesn't exist on ofriperetz.dev.",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main id="main" data-slot="not-found-page">
      <Container size="content" className="py-24">
        <div className="rounded-lg border border-border bg-card p-10 text-center">
          <BrandMark className="mx-auto size-14" />
          <p className="mt-8 text-sm font-medium uppercase tracking-wider text-muted-foreground">
            404
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">
            That page wandered off
          </h1>
          <p className="mx-auto mt-3 max-w-md text-muted-foreground">
            The URL does not match anything published here. It may have been
            moved, renamed, or never existed in the first place.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/"
              className={buttonVariants({
                variant: "default",
                size: "default",
              })}
            >
              Go home
            </Link>
            <Link
              href="/articles"
              className={buttonVariants({
                variant: "outline",
                size: "default",
              })}
            >
              Browse articles
            </Link>
          </div>
        </div>
      </Container>
    </main>
  );
}
