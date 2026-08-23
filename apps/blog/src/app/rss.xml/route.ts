import { getAllArticles } from "@/lib/source";

const SITE_URL = "https://ofriperetz.dev";
const FEED_URL = `${SITE_URL}/rss.xml`;
const TITLE = "Ofri Peretz";
const DESCRIPTION =
  "Measured writing on static analysis, security tooling, and the Interlace ESLint ecosystem.";

/**
 * XML text escaping.
 *
 * Not optional and not cosmetic: a single raw `&` or `<` makes the whole
 * document unparseable, and feed readers reject the entire feed rather than
 * skipping the bad item. Article titles here routinely contain `&`, and
 * descriptions contain quotes — so every interpolated value goes through this.
 */
const XML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

const esc = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => XML_ESCAPES[c] ?? c);

/** RSS 2.0 requires RFC-822 dates; `toUTCString()` emits exactly that form. */
const rfc822 = (iso?: string): string =>
  new Date(
    iso && !Number.isNaN(Date.parse(iso)) ? iso : Date.now(),
  ).toUTCString();

/**
 * The feed is generated at build time — the articles are files in the repo, so
 * there is nothing to recompute per request. A deploy is the only thing that
 * can change the answer.
 */
export const dynamic = "force-static";

export function GET(): Response {
  // getAllArticles() already drops `published: false` and sorts newest-first.
  // Reusing it is the point: the feed can never disagree with the site about
  // what is published, because there is one definition of "published".
  const articles = getAllArticles();

  const items = articles
    .map((a) => {
      const fm = a.frontmatter;
      const url = fm.canonical_url ?? `${SITE_URL}/articles/${a.slug}`;
      return `    <item>
      <title>${esc(fm.title)}</title>
      <link>${esc(url)}</link>
      <guid isPermaLink="true">${esc(url)}</guid>
      <description>${esc(fm.description)}</description>
      <pubDate>${rfc822(fm.published_at)}</pubDate>
${fm.tags.map((t) => `      <category>${esc(t)}</category>`).join("\n")}
    </item>`;
    })
    .join("\n");

  // lastBuildDate tracks the newest article, not the build clock. A feed whose
  // lastBuildDate moves on every deploy trains aggregators to re-poll a feed
  // that has not changed.
  const newest = articles[0]?.frontmatter.published_at;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(TITLE)}</title>
    <link>${SITE_URL}</link>
    <description>${esc(DESCRIPTION)}</description>
    <language>en</language>
    <lastBuildDate>${rfc822(newest)}</lastBuildDate>
    <atom:link href="${FEED_URL}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
