import { getAllArticles } from "@/lib/source";
import { SITE_URL } from "@/lib/article-jsonld";
import { renderArticleMarkdown } from "@/lib/article-markdown";

/**
 * /llms-full.txt — the whole published corpus as one markdown document
 * (the llmstxt.org companion to /llms.txt).
 *
 * /llms.txt is an index: an agent that wants the articles has to follow
 * ninety-odd links. This is the same content in one fetch, for tools that
 * load a site's corpus into context wholesale.
 *
 * Each article is rendered by renderArticleMarkdown — the exact renderer
 * behind the `/articles/<slug>.md` twin — so the two surfaces cannot drift,
 * and the corpus comes from getAllArticles(), the single definition of
 * "published" that the draft-exposure lock pins. A queued draft appears
 * here only when it appears everywhere else.
 *
 * force-static: the articles are files in the repo, so a deploy is the
 * only thing that can change the answer.
 */
export const dynamic = "force-static";

export function GET(): Response {
  const articles = getAllArticles();

  const preamble = [
    "# Ofri Peretz — full corpus",
    "",
    `> Every published article on ${SITE_URL}, as markdown, newest first — ` +
      `${articles.length} articles. The index with one link per article is ` +
      `${SITE_URL}/llms.txt.`,
    "",
  ].join("\n");

  // A horizontal rule alone would be ambiguous: every article's own header
  // already ends in one. The HTML comment names the boundary unambiguously
  // for anything splitting the file, and renders as nothing.
  const body = articles
    .map(
      (a) =>
        `<!-- article: ${a.slug} -->\n\n${renderArticleMarkdown(a).trimEnd()}\n`,
    )
    .join("\n");

  return new Response(`${preamble}\n${body}`, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
