"use client";

import { useCallback, useState } from "react";

export interface DevToArticle {
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
  page_views_count?: number;
  tag_list: string[];
  user: { name: string; username: string; profile_image: string };
}

interface CombinedResponse {
  articles: DevToArticle[];
  stats: { followers: number; totalViews: number };
  source: "api" | "cache" | "fallback";
}

export function useDevToArticles() {
  const [articles, setArticles] = useState<DevToArticle[]>([]);
  const [followers, setFollowers] = useState(0);
  const [totalViews, setTotalViews] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchArticles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/devto-combined");
      const data = (await res.json()) as CombinedResponse;
      setArticles(data?.articles || []);
      setFollowers(data?.stats?.followers ?? 45);
      setTotalViews(data?.stats?.totalViews ?? 0);
    } catch (e) {
      setError("Failed to fetch articles from dev.to");
      console.error("dev.to combined API error:", e);
      setArticles([]);
      setFollowers(45);
      setTotalViews(0);
    } finally {
      setLoading(false);
    }
  }, []);

  return { articles, followers, totalViews, loading, error, fetchArticles };
}
