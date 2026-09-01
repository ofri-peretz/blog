import type { Article } from "./source";

/**
 * The corpus search index — one flat doc per published article, built
 * server-side (the header is a server component) and serialized to the
 * CorpusSearch client wrapper. ~82 docs of five short fields is a
 * few KB of RSC payload; no client fetch, no search service.
 */
export interface SearchDoc {
  slug: string;
  title: string;
  series: string | null;
  minutes: number;
  tags: string[];
}

export function buildSearchDocs(articles: Article[]): SearchDoc[] {
  return articles.map((a) => ({
    slug: a.slug,
    title: a.frontmatter.title,
    series: a.frontmatter.series ?? null,
    minutes: a.readingTimeMinutes,
    tags: a.frontmatter.tags,
  }));
}

/**
 * The grep haystack: what a typed query is matched against. Title alone
 * is not enough — "pg" or "security" should surface articles whose
 * titles never say the word, so series and tags ride along. Fed to the
 * palette as `itemToStringLabel`, which Base UI's collator-backed
 * filter matches case-insensitively.
 */
export function searchHaystack(doc: SearchDoc): string {
  return [doc.title, doc.series ?? "", ...doc.tags].join(" ");
}
