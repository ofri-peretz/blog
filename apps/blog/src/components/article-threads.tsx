import Link from "next/link";

import { TrackedLink } from "@/components/tracked-link";

/**
 * The corpus map's weave, delivered where readers actually are: every
 * article ends by showing its two thread directions — what it draws on,
 * and which later pieces pull on it. Finishing an article becomes
 * following the thread instead of leaving; backlinks are fully SSR, so
 * this is also the corpus's internal-linking surface for crawlers.
 *
 * App-local on purpose (like series-nav): thin composition of existing
 * link primitives over blog-specific data — no new visual language. The
 * only brand ink is the strand-b direction glyph, decorative and
 * aria-hidden; the direction is carried by the group headings.
 */

export interface ThreadItem {
  slug: string;
  title: string;
  series?: string | null;
  /** Reading minutes — the same time-budget cue the corpus map speaks. */
  minutes?: number;
}

// The ink budget, applied to lists: hub articles collect 50+ backlinks
// (cwe-taxonomy-explained has 52), and a wall of links buries the page
// footer. Show the nearest threads — the caller passes newest-first —
// and hand the whole territory to the corpus map, which is built for it.
const MAX_VISIBLE = 6;

export function ArticleThreads({
  currentSlug,
  drawsOn,
  pulledBy,
}: {
  currentSlug: string;
  drawsOn: readonly ThreadItem[];
  pulledBy: readonly ThreadItem[];
}) {
  if (drawsOn.length === 0 && pulledBy.length === 0) return null;
  return (
    <section
      data-slot="article-threads"
      aria-labelledby="article-threads-heading"
      className="mt-12 border-t border-border pt-8"
    >
      <h2
        id="article-threads-heading"
        className="text-sm font-medium uppercase tracking-wider text-muted-foreground"
      >
        Threads
      </h2>
      <div className="mt-4 grid gap-6 sm:grid-cols-2">
        <ThreadGroup
          label="This piece draws on"
          glyph="→"
          direction="draws_on"
          currentSlug={currentSlug}
          items={drawsOn}
        />
        <ThreadGroup
          label="Threads that pull on this one"
          glyph="←"
          direction="pulled_by"
          currentSlug={currentSlug}
          items={pulledBy}
        />
      </div>
    </section>
  );
}

function ThreadGroup({
  label,
  glyph,
  direction,
  currentSlug,
  items,
}: {
  label: string;
  glyph: string;
  direction: "draws_on" | "pulled_by";
  currentSlug: string;
  items: readonly ThreadItem[];
}) {
  if (items.length === 0) return null;
  const visible = items.slice(0, MAX_VISIBLE);
  const overflow = items.length - visible.length;
  return (
    <div data-slot={`article-threads-${direction}`}>
      <h3 className="text-sm text-muted-foreground">{label}</h3>
      <ul className="mt-2 space-y-2">
        {visible.map((item) => (
          <li key={item.slug} className="flex items-baseline gap-2 text-sm">
            <span aria-hidden="true" className="shrink-0 text-strand-b">
              {glyph}
            </span>
            <TrackedLink
              href={`/articles/${item.slug}`}
              event="article:thread_click"
              props={{
                from_slug: currentSlug,
                to_slug: item.slug,
                direction,
              }}
              className="inline-flex min-h-6 items-center font-medium text-foreground underline-offset-2 hover:underline"
            >
              {item.title}
            </TrackedLink>
            {(item.series || item.minutes != null) && (
              <span className="shrink-0 text-xs text-muted-foreground">
                {/* The series name hides below md: at 320px the full
                    meta pushed the whole document 22px sideways, and at
                    exactly 640px (the sm edge) long series names still
                    overflowed by up to 32px — both the browser audit's
                    catches. Minutes always render; they are the budget. */}
                {item.series ? (
                  <span className="hidden md:inline">· {item.series} </span>
                ) : null}
                {item.minutes != null ? <>· {item.minutes} min</> : null}
              </span>
            )}
          </li>
        ))}
      </ul>
      {overflow > 0 && (
        <p className="mt-2 text-sm text-muted-foreground">
          …and{" "}
          <Link
            href="/articles"
            className="inline-flex min-h-6 items-center underline underline-offset-2 hover:text-foreground"
          >
            {overflow} more on the corpus map
          </Link>
        </p>
      )}
    </div>
  );
}
