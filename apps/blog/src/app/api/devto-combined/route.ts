import { CACHE_TTL, getCache, setCache } from "@/lib/cache";

interface DevToArticle {
  id: number;
  title: string;
  description: string;
  url: string;
  slug?: string;
  cover_image: string | null;
  social_image: string;
  published_at: string;
  reading_time_minutes: number;
  positive_reactions_count: number;
  comments_count: number;
  page_views_count: number;
  tag_list: string[];
  user: { name: string; username: string; profile_image: string };
}

interface CombinedResponse {
  articles: DevToArticle[];
  stats: { followers: number; totalViews: number };
  source: "api" | "cache" | "fallback";
}

const FALLBACK: CombinedResponse = {
  articles: [],
  stats: { followers: 85, totalViews: 1834 },
  source: "fallback",
};

export async function GET(): Promise<Response> {
  const cacheKey = "devto:combined";
  const cached = getCache<CombinedResponse>(cacheKey);
  if (cached) return Response.json({ ...cached, source: "cache" });

  const apiKey = process.env.DEVTO_API_KEY;

  if (!apiKey) {
    try {
      const res = await fetch(
        "https://dev.to/api/articles?username=ofri-peretz&per_page=100",
        { signal: AbortSignal.timeout(10_000) },
      );
      const articles = (await res.json()) as DevToArticle[];
      return Response.json({
        articles: (articles || []).map((a) => ({ ...a, page_views_count: 0 })),
        stats: { followers: 85, totalViews: 1834 },
        source: "fallback",
      });
    } catch {
      return Response.json(FALLBACK);
    }
  }

  try {
    const headers = { "api-key": apiKey };
    const [articlesRes, followersRes] = await Promise.all([
      fetch("https://dev.to/api/articles/me/all?per_page=100", {
        headers,
        signal: AbortSignal.timeout(10_000),
      }).then((r) => r.json() as Promise<DevToArticle[]>),
      fetch("https://dev.to/api/followers/users?per_page=1000", {
        headers,
        signal: AbortSignal.timeout(10_000),
      }).then((r) => r.json() as Promise<unknown[]>),
    ]);

    const articles = (articlesRes || [])
      .filter((a) => a.published_at)
      .sort(
        (a, b) =>
          new Date(b.published_at).getTime() -
          new Date(a.published_at).getTime(),
      );
    const totalViews = articles.reduce(
      (s, a) => s + (a.page_views_count || 0),
      0,
    );
    const followers = followersRes?.length ?? 45;

    const result: CombinedResponse = {
      articles,
      stats: { followers, totalViews },
      source: "api",
    };
    setCache(cacheKey, result, CACHE_TTL.FRESH);
    return Response.json(result);
  } catch (error) {
    console.error("[devto-combined] Failed:", error);
    try {
      const res = await fetch(
        "https://dev.to/api/articles?username=ofri-peretz&per_page=100",
        { signal: AbortSignal.timeout(10_000) },
      );
      const articles = (await res.json()) as DevToArticle[];
      return Response.json({
        articles: (articles || []).map((a) => ({ ...a, page_views_count: 0 })),
        stats: { followers: 85, totalViews: 1834 },
        source: "fallback",
      });
    } catch {
      return Response.json(FALLBACK);
    }
  }
}
