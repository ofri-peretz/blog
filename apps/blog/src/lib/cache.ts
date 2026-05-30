/**
 * Tiered Caching Utility — ported verbatim from apps/blog/server/utils/cache.ts.
 *
 * Strategy:
 * - HISTORICAL: Long TTL (24h) for data that rarely changes (past dates)
 * - FRESH: Short TTL (1 min) for live/current data
 * - STANDARD: Medium TTL (5 min) for general API responses
 */

interface CacheEntry<T> {
  data: T;
  expires: number;
  createdAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

export const CACHE_TTL = {
  FRESH: 60 * 1000,
  STANDARD: 5 * 60 * 1000,
  HISTORICAL: 24 * 60 * 60 * 1000,
} as const;

export function getCache<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

export function setCache<T>(key: string, data: T, ttlMs: number): void {
  cache.set(key, {
    data,
    expires: Date.now() + ttlMs,
    createdAt: Date.now(),
  });
}

export function isHistoricalDate(dateStr: string): boolean {
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
}

export function getDateRangeKey(
  prefix: string,
  startDate: string,
  endDate: string,
): string {
  return `${prefix}:${startDate}:${endDate}`;
}

export function getTodayDate(): string {
  return new Date().toISOString().split("T")[0] ?? "";
}

export function getYesterdayDate(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString().split("T")[0] ?? "";
}

export function clearCache(): void {
  cache.clear();
}

export function getCacheStats(): { size: number; keys: string[] } {
  return {
    size: cache.size,
    keys: Array.from(cache.keys()),
  };
}
