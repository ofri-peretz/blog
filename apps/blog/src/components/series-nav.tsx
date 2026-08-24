import Link from "next/link";
import type { SeriesContext } from "@/lib/source";
import { cn } from "@/lib/utils";

/**
 * Series navigation for article pages.
 *
 * `SeriesBanner` sits above the body — one line of context ("Part 3 of 8
 * in <series>"). `SeriesPager` sits after the body — previous/next links
 * in reading order. Both render nothing when the article has no series,
 * so the article page composes them unconditionally.
 */
export function SeriesBanner({
  series,
  className,
}: {
  series: SeriesContext | null;
  className?: string;
}) {
  if (!series) return null;
  return (
    <p
      data-slot="series-banner"
      className={cn(
        "rounded-md border border-border bg-muted/30 px-4 py-2.5 text-sm text-muted-foreground",
        className,
      )}
    >
      Part {series.index} of {series.total} in{" "}
      <span className="font-medium text-foreground">{series.name}</span>
    </p>
  );
}

export function SeriesPager({
  series,
  className,
}: {
  series: SeriesContext | null;
  className?: string;
}) {
  if (!series || (!series.prev && !series.next)) return null;
  return (
    <nav
      data-slot="series-pager"
      aria-label={`${series.name} series navigation`}
      className={cn("grid gap-3 sm:grid-cols-2", className)}
    >
      {series.prev ? (
        <Link
          href={`/articles/${series.prev.slug}`}
          className="group rounded-lg border border-border p-4 transition-colors hover:bg-muted/40"
        >
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            ← Previous in series
          </span>
          <span className="mt-1 block font-medium text-foreground group-hover:underline group-hover:underline-offset-4">
            {series.prev.title}
          </span>
        </Link>
      ) : (
        <span aria-hidden className="hidden sm:block" />
      )}
      {series.next && (
        <Link
          href={`/articles/${series.next.slug}`}
          className="group rounded-lg border border-border p-4 text-right transition-colors hover:bg-muted/40"
        >
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Next in series →
          </span>
          <span className="mt-1 block font-medium text-foreground group-hover:underline group-hover:underline-offset-4">
            {series.next.title}
          </span>
        </Link>
      )}
    </nav>
  );
}
