import { TrackedLink } from "@/components/tracked-link";
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
  currentSlug,
  className,
}: {
  series: SeriesContext | null;
  /** Slug of the article being read — marked, not linked, in the list. */
  currentSlug: string;
  className?: string;
}) {
  if (!series) return null;
  return (
    // Native <details>: the full series list ships in the SSR HTML
    // (every part crawlable from every part — 22 internal links a page
    // was hiding), opens with zero JS, and keyboard/AT behavior comes
    // from the platform.
    <details
      data-slot="series-banner"
      className={cn(
        "group rounded-md border border-border bg-muted/30 text-sm",
        className,
      )}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-2.5 text-muted-foreground [&::-webkit-details-marker]:hidden">
        <span>
          Part {series.index} of {series.total} in{" "}
          <span className="font-medium text-foreground">{series.name}</span>
        </span>
        <span
          aria-hidden="true"
          className="shrink-0 text-xs transition-transform duration-200 group-open:rotate-180"
        >
          ▾
        </span>
      </summary>
      <ol
        data-slot="series-banner-parts"
        className="border-t border-border/60 px-2 py-2"
      >
        {series.parts.map((part, i) => {
          const number = (
            <span
              aria-hidden="true"
              className="w-6 shrink-0 text-right font-mono text-xs text-muted-foreground [font-variant-numeric:tabular-nums]"
            >
              {i + 1}.
            </span>
          );
          return (
            <li key={part.slug}>
              {part.slug === currentSlug ? (
                <span
                  aria-current="page"
                  className="flex items-baseline gap-2.5 rounded bg-muted/50 px-2 py-1.5 font-medium text-foreground"
                >
                  {number}
                  {part.title}
                </span>
              ) : (
                <TrackedLink
                  href={`/articles/${part.slug}`}
                  event="series:pager_click"
                  props={{
                    from_slug: currentSlug,
                    to_slug: part.slug,
                    direction: "jump",
                  }}
                  className="flex items-baseline gap-2.5 rounded px-2 py-1.5 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                >
                  {number}
                  {part.title}
                </TrackedLink>
              )}
            </li>
          );
        })}
      </ol>
    </details>
  );
}

export function SeriesPager({
  series,
  currentSlug,
  className,
}: {
  series: SeriesContext | null;
  /** Slug of the article being read — the `from` side of pager events. */
  currentSlug: string;
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
        <TrackedLink
          href={`/articles/${series.prev.slug}`}
          event="series:pager_click"
          props={{
            from_slug: currentSlug,
            to_slug: series.prev.slug,
            direction: "prev",
          }}
          className="group rounded-lg border border-border p-4 transition-colors hover:bg-muted/40"
        >
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            ← Previous in series
          </span>
          <span className="mt-1 block font-medium text-foreground group-hover:underline group-hover:underline-offset-4">
            {series.prev.title}
          </span>
        </TrackedLink>
      ) : (
        <span aria-hidden className="hidden sm:block" />
      )}
      {series.next && (
        <TrackedLink
          href={`/articles/${series.next.slug}`}
          event="series:pager_click"
          props={{
            from_slug: currentSlug,
            to_slug: series.next.slug,
            direction: "next",
          }}
          className="group rounded-lg border border-border p-4 text-right transition-colors hover:bg-muted/40"
        >
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Next in series →
          </span>
          <span className="mt-1 block font-medium text-foreground group-hover:underline group-hover:underline-offset-4">
            {series.next.title}
          </span>
        </TrackedLink>
      )}
    </nav>
  );
}
