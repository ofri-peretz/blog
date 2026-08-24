/**
 * Article TOC extraction — h2 landmarks from RENDERED markdown HTML.
 *
 * Extracting from the rendered output (not the raw markdown) is the whole
 * point: heading ids are minted by the pipeline (explicit `{#id}` markers
 * or rehype-slug), and re-deriving them from source lines would silently
 * drift the moment either rule changed. The page renders the body once,
 * feeds the HTML here for the TOC, and passes the same HTML to
 * `MarkdownArticle` so the pipeline never runs twice.
 */

export interface ArticleTocItem {
  id: string;
  label: string;
}

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
};

export function extractArticleToc(html: string): ArticleTocItem[] {
  const items: ArticleTocItem[] = [];
  for (const m of html.matchAll(/<h2[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/h2>/g)) {
    const label = m[2]
      .replace(/<[^>]+>/g, "")
      .replace(/&(?:amp|lt|gt|quot|#39);/g, (e) => ENTITIES[e] ?? e)
      .trim();
    if (label) items.push({ id: m[1], label });
  }
  return items;
}
