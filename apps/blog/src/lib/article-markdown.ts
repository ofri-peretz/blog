import { SITE_URL } from "@/lib/article-jsonld";
import type { Article } from "@/lib/source";
import { preprocessMarkdown } from "@/lib/markdown";
// The same strip the dev.to publish path uses — one implementation of
// "surfaces outside our renderer show plain, post-diff code".
import { stripNotationMarkers } from "../../scripts/devto-link-transforms.mjs";

/**
 * One article as plain CommonMark: a provenance header, then the body.
 *
 * Shared by the `/articles/<slug>.md` twin and `/llms-full.txt`, so the two
 * agent surfaces cannot disagree about what an article says. Before this was
 * extracted, the twin was the only renderer; a second copy in llms-full would
 * have been the first place the notation strip got forgotten.
 *
 * preprocessMarkdown converts the Nuxt-MDC block directives into plain
 * fenced markdown, and stripNotationMarkers removes Shiki `[!code ...]`
 * render directives (dropping removed-diff lines) — agents get standard
 * CommonMark showing the post-diff code, no house syntax.
 */
export function renderArticleMarkdown(article: Article): string {
  const fm = article.frontmatter;
  const date = fm.published_at?.slice(0, 10) ?? fm.date;
  const header = [
    `# ${fm.title}`,
    "",
    `> ${fm.description}`,
    "",
    `- Canonical: ${SITE_URL}/articles/${article.slug}`,
    ...(date ? [`- Published: ${date}`] : []),
    ...(fm.series ? [`- Series: ${fm.series}`] : []),
    "",
    "---",
    "",
  ];
  return (
    header.join("\n") + stripNotationMarkers(preprocessMarkdown(article.body))
  );
}
