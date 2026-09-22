import numbers from "@/data/interlace-numbers.json";
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
 *
 * The Projects section exists because the index used to read as an
 * ESLint-only site: an agent asked "what does Ofri Peretz build?" had
 * nothing here to answer with beyond the article list. Each entry is one
 * line an agent can quote, pointing at the canonical repo or docs.
 */
export const dynamic = "force-static";

const SITE_URL = "https://ofriperetz.dev";

/**
 * One line per project. The ESLint counts come from interlace-numbers.json
 * (synced from the eslint monorepo), never typed in here, so this surface
 * cannot drift from the homepage and the structured data.
 */
const PROJECTS: { name: string; url: string; summary: string }[] = [
  {
    name: "Interlace ESLint ecosystem",
    url: "https://github.com/ofri-peretz/eslint",
    summary: `${numbers.plugins.total} ESLint plugins, ${numbers.rules.total} rules, security-first; docs at https://eslint.interlace.tools`,
  },
  {
    name: "burgee",
    url: "https://github.com/ofri-peretz/burgee",
    summary:
      "agent-native CLI framework, drop-in for commander and yargs; one " +
      "declaration → help, --json, --schema, MCP, completions; nine " +
      "packages, zero external dependencies. Docs: https://burgee.interlace.tools",
  },
  {
    name: "Interlace Serverless",
    url: "https://serverless.interlace.tools",
    summary: "TypeScript-first plugins for the Serverless Framework v4+",
  },
  {
    name: "Interlace Design System",
    url: "https://interlace.tools",
    summary:
      "a shadcn-style component registry this site is built from (ds.interlace.tools)",
  },
];

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
    "## Projects",
    "",
    ...PROJECTS.map((p) => `- [${p.name}](${p.url}): ${p.summary}`),
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
    `- [llms-full.txt](${SITE_URL}/llms-full.txt): every article above as markdown, in one file`,
    "",
  ];

  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
