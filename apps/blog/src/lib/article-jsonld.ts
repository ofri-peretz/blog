import type { ArticleFrontmatter } from "@/lib/source";

export const SITE_URL = "https://ofriperetz.dev";
export const PERSON_NAME = "Ofri Peretz";

/**
 * The site's one Person node. The root layout's StructuredData emits it with
 * this @id on every page; everything else references it rather than
 * re-declaring an anonymous Person, so the article graph resolves to a single
 * author entity.
 */
export const PERSON_ID = `${SITE_URL}/#person`;

type JsonLd = Record<string, unknown>;

/**
 * JSON-LD for an article page: the BlogPosting and its BreadcrumbList.
 *
 * Pure over frontmatter so the lock can assert on the graph without
 * rendering the page (the page pulls in Shiki and the whole corpus).
 *
 * - author/publisher reference the site Person by @id. An article whose
 *   frontmatter names a different author keeps an inline Person — pointing a
 *   guest byline at our @id would assert something false.
 * - isPartOf is emitted only when the article carries a `series` value, as
 *   a CreativeWorkSeries named by it. There is no per-series page to link,
 *   so it has a name and no URL rather than an invented one.
 */
export function articleJsonLd(input: {
  fm: ArticleFrontmatter;
  url: string;
  image: string;
}): JsonLd[] {
  const { fm, url, image } = input;
  const authorName = fm.author?.name ?? PERSON_NAME;
  const author: JsonLd =
    authorName === PERSON_NAME
      ? {
          "@type": "Person",
          "@id": PERSON_ID,
          name: PERSON_NAME,
          url: SITE_URL,
        }
      : { "@type": "Person", name: authorName };

  const blogPosting: JsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "@id": `${url}#article`,
    headline: fm.title,
    description: fm.description,
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    image,
    datePublished: fm.published_at,
    dateModified: fm.edited_at ?? fm.published_at,
    keywords: fm.tags.join(", "),
    author,
    publisher: { "@id": PERSON_ID },
    ...(fm.series
      ? { isPartOf: { "@type": "CreativeWorkSeries", name: fm.series } }
      : {}),
  };

  const breadcrumbs: JsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      {
        "@type": "ListItem",
        position: 2,
        name: "Articles",
        item: `${SITE_URL}/articles`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: fm.title,
        item: url,
      },
    ],
  };

  return [blogPosting, breadcrumbs];
}
