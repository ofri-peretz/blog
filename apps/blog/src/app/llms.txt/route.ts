import { getAllArticles } from "@/lib/source";

/**
 * /llms.txt — the corpus, agent-readable (https://llmstxt.org).
 *
 * A growing share of first reads happen inside AI assistants, and this
 * blog is ABOUT the tooling those assistants configure. The index links
 * each article's raw-markdown twin (`/articles/<slug>.md`) so an agent
 * gets clean markdown with provenance back to this domain instead of
 * scraping hydrated HTML.
 *
 * Same static discipline as search-index.json and rss.xml: the articles
 * are files in the repo, so a deploy is the only thing that can change
 * the answer — and the same single definition of "published"
 * (getAllArticles) keeps this surface from ever disagreeing with the
 * site about what exists. That shared definition is load-bearing: it is
 * what the draft-exposure lock pins.
 */
export const dynamic = "force-static";

const SITE_URL = "https://ofriperetz.dev";

export function GET(): Response {
  const articles = getAllArticles();

  const lines = [
    "# Ofri Peretz",
    "",
    "> Measured writing on static analysis, security tooling, and the " +
      `Interlace ESLint ecosystem — ${articles.length} articles. Every ` +
      "article has a raw-markdown twin: append `.md` to its URL (the " +
      "links below already do).",
    "",
    "## Articles",
    "",
    ...articles.map((a) => {
      const fm = a.frontmatter;
      return `- [${fm.title}](${SITE_URL}/articles/${a.slug}.md): ${fm.description}`;
    }),
    "",
    "## Feeds",
    "",
    `- [RSS](${SITE_URL}/rss.xml): full article feed`,
    "",
  ];

  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
