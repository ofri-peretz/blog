/**
 * The corpus's internal link graph — who weaves into whom.
 *
 * Articles cross-reference each other with canonical absolute URLs
 * (`https://ofriperetz.dev/articles/<slug>` — OG scrapers and dev.to can't
 * resolve relative ones) and occasionally site-relative `/articles/<slug>`
 * links. Both forms count. Only slugs that exist in the corpus survive —
 * a renamed or unpublished target must never draw a thread to nowhere —
 * and self-references are dropped.
 *
 * Pure over (body, knownSlugs) so the graph is testable without the
 * filesystem; the /articles page runs it over `getAllArticles()`.
 */
const ARTICLE_LINK = /(?:https:\/\/ofriperetz\.dev)?\/articles\/([a-z0-9][a-z0-9-]*)/g;

export function extractInternalLinks(
  body: string,
  selfSlug: string,
  knownSlugs: ReadonlySet<string>,
): string[] {
  const found = new Set<string>();
  for (const match of body.matchAll(ARTICLE_LINK)) {
    const slug = match[1];
    if (slug !== selfSlug && knownSlugs.has(slug)) found.add(slug);
  }
  return [...found];
}

export interface Threads {
  /** Slugs this article cites, in first-mention order. */
  drawsOn: string[];
  /** Slugs of corpus articles citing this one, in the corpus's order. */
  pulledBy: string[];
}

/**
 * Both directions of the thread through one article: what it draws on,
 * and what pulls on it. The corpus is whatever the caller passes —
 * `getAllArticles()` is already published-only and newest-first, so a
 * queued slug can neither appear nor be linked to, and `pulledBy` comes
 * back newest-first. A queued CURRENT article (reachable but unreleased)
 * simply isn't in the corpus: its `pulledBy` is empty by construction.
 */
export function computeThreads(
  selfSlug: string,
  selfBody: string,
  corpus: readonly { slug: string; body: string }[],
): Threads {
  const known = new Set(corpus.map((a) => a.slug));
  return {
    drawsOn: extractInternalLinks(selfBody, selfSlug, known),
    pulledBy: corpus
      .filter(
        (a) =>
          a.slug !== selfSlug &&
          extractInternalLinks(a.body, a.slug, known).includes(selfSlug),
      )
      .map((a) => a.slug),
  };
}
