import type { MetadataRoute } from "next";
import { getAllArticleSlugs } from "@/lib/source";

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
    { url: `${SITE_URL}/stats`, lastModified: new Date(), priority: 0.5 },
    { url: `${SITE_URL}/analytics`, lastModified: new Date(), priority: 0.4 },
  ];

  const articleEntries: MetadataRoute.Sitemap = getAllArticleSlugs().map(
    (slug) => ({
      url: `${SITE_URL}/articles/${slug}`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    }),
  );

  return [...staticEntries, ...articleEntries];
}
