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

export async function GET() {
  const cacheKey = "devto:articles";
  const cached = getCache<{ articles: DevToArticle[]; source: string }>(
    cacheKey,
  );
  if (cached) return Response.json({ ...cached, source: "cache" });

  const apiKey = process.env.DEVTO_API_KEY;
  if (!apiKey) {
    console.warn(
      "[devto-articles] No DEVTO_API_KEY configured, using public API",
    );
    try {
      const res = await fetch(
        "https://dev.to/api/articles?username=ofri-peretz&per_page=100",
        { signal: AbortSignal.timeout(10_000) },
      );
      const articles = (await res.json()) as DevToArticle[];
      const mapped = (articles || []).map((a) => ({
        ...a,
        page_views_count: 0,
      }));
      return Response.json({ articles: mapped, source: "public-api" });
    } catch (e) {
      console.error("[devto-articles] Public API error:", e);
      return Response.json({ articles: [], source: "error" });
    }
  }

  try {
    const res = await fetch("https://dev.to/api/articles/me/all?per_page=100", {
      headers: { "api-key": apiKey },
      signal: AbortSignal.timeout(10_000),
    });
    const articles = (await res.json()) as DevToArticle[];
    const sorted = (articles || [])
      .filter((a) => a.published_at)
      .sort(
        (a, b) =>
          new Date(b.published_at).getTime() -
          new Date(a.published_at).getTime(),
      );
    const result = { articles: sorted, source: "api" };
    setCache(cacheKey, result, CACHE_TTL.FRESH);
    return Response.json(result);
  } catch (error) {
    console.error("[devto-articles] Failed to fetch:", error);
    try {
      const res = await fetch(
        "https://dev.to/api/articles?username=ofri-peretz&per_page=100",
        { signal: AbortSignal.timeout(10_000) },
      );
      const articles = (await res.json()) as DevToArticle[];
      const mapped = (articles || []).map((a) => ({
        ...a,
        page_views_count: 0,
      }));
      return Response.json({ articles: mapped, source: "fallback-public" });
    } catch {
      return Response.json({ articles: [], source: "error" });
    }
  }
}
