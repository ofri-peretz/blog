import { getAllArticles, getArticleBySlug, isPublished } from "@/lib/source";
import { preprocessMarkdown } from "@/lib/markdown";

/**
 * The raw-markdown twin of an article page, for AI agents and anything
 * else that prefers markdown to hydrated HTML. Public URL shape is
 * `/articles/<slug>.md` — a beforeFiles rewrite in next.config maps it
 * here, because a route handler and the article page cannot share the
 * `articles/[slug]` segment. llms.txt lists these URLs.
 *
 * Draft exposure: article PAGES stay reachable pre-release on purpose
 * (dev.to's canonical_url must resolve), protected by noindex. That
 * contract does NOT extend here — nothing external points at a draft's
 * .md twin, so drafts get a plain 404, belt (dynamicParams=false) and
 * suspenders (the isPublished guard, which the draft-exposure lock
 * exercises directly).
 */
export const dynamic = "force-static";
export const dynamicParams = false;

const SITE_URL = "https://ofriperetz.dev";

export function generateStaticParams(): { slug: string }[] {
  return getAllArticles().map((a) => ({ slug: a.slug }));
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article || !isPublished(article.frontmatter)) {
    return new Response("Not found", { status: 404 });
  }

  const fm = article.frontmatter;
  const date = fm.published_at?.slice(0, 10) ?? fm.date;
  const header = [
    `# ${fm.title}`,
    "",
    `> ${fm.description}`,
    "",
    `- Canonical: ${SITE_URL}/articles/${slug}`,
    ...(date ? [`- Published: ${date}`] : []),
    ...(fm.series ? [`- Series: ${fm.series}`] : []),
    "",
    "---",
    "",
  ];

  // preprocessMarkdown converts the Nuxt-MDC block directives into plain
  // fenced markdown — agents get standard CommonMark, no house syntax.
  return new Response(header.join("\n") + preprocessMarkdown(article.body), {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
}
