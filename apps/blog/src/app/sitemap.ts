import type { MetadataRoute } from "next";
import { getAllArticles } from "@/lib/source";

const SITE_URL = "https://ofriperetz.dev";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/articles`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    { url: `${SITE_URL}/loom`, lastModified: new Date(), priority: 0.6 },
    { url: `${SITE_URL}/stats`, lastModified: new Date(), priority: 0.5 },
    { url: `${SITE_URL}/analytics`, lastModified: new Date(), priority: 0.4 },
  ];

  // getAllArticles(), NOT getAllArticleSlugs(): the slug list reads the
  // directory and filters nothing, so every queued-but-unpublished draft was
  // being advertised to crawlers days before it shipped. Verified 2026-08-23 —
  // three articles still sitting at `status: ready` were live in this sitemap.
  //
  // The draft PAGES stay reachable on purpose (see the noindex in
  // articles/[slug]/page.tsx): dev.to's canonical_url points at this site, so
  // that URL must resolve the moment the publisher fires. Unindexed, not gone.
  const articleEntries: MetadataRoute.Sitemap = getAllArticles().map((a) => ({
    url: a.frontmatter.canonical_url ?? `${SITE_URL}/articles/${a.slug}`,
    lastModified: new Date(
      a.frontmatter.edited_at ?? a.frontmatter.published_at ?? Date.now(),
    ),
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  return [...staticEntries, ...articleEntries];
}
