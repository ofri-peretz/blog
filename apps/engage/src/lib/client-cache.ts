"use client";

/**
 * Client-side response cache, shared across page navigations.
 *
 * The problem: every panel fetched with `cache: "no-store"` plus a cache-buster
 * on mount. App-Router navigation unmounts the page, so going control room →
 * queue → back re-ran every request from scratch — a dozen round-trips, some of
 * them multi-second, to redisplay data that was on screen ten seconds earlier.
 *
 * A module-level Map is the right scope: it lives as long as the tab, survives
 * component unmount and client navigation, and dies on a hard reload — which is
 * the behaviour you actually want from a control room ("F5 means I want the
 * truth").
 *
 * Exactly two things cause a miss:
 *   1. the entry is older than its TTL, or
 *   2. `force` — the section's own refresh button.
 *
 * `cache: "no-store"` stays on the underlying fetch deliberately. This layer
 * decides when to ask; the browser HTTP cache must not also be guessing, or a
 * forced refresh would return the same stale bytes and the button would look
 * broken.
 */

interface Entry {
  at: number;
  data: unknown;
  /** In-flight request, so two panels mounting together make one call. */
  inflight?: Promise<unknown>;
}

const store = new Map<string, Entry>();

/** 5 minutes. Long enough to make navigation free, short enough that a number
 *  on screen is never mysteriously old. Per-call TTL overrides it. */
export const DEFAULT_TTL = 5 * 60_000;

export async function cachedFetch<T = unknown>(
  key: string,
  url: string,
  opts: { ttl?: number; force?: boolean } = {},
): Promise<T> {
  const ttl = opts.ttl ?? DEFAULT_TTL;
  const hit = store.get(key);

  if (!opts.force && hit) {
    if (hit.inflight) return hit.inflight as Promise<T>;
    if (Date.now() - hit.at < ttl) return hit.data as T;
  }

  // Only bust the browser cache when forcing. Adding a unique param on every
  // call is what made this layer necessary in the first place.
  const sep = url.includes("?") ? "&" : "?";
  const finalUrl = opts.force ? `${url}${sep}refresh=1&_=${Date.now()}` : url;

  const inflight = fetch(finalUrl, { cache: "no-store" })
    .then((r) => r.json())
    .then((data) => {
      store.set(key, { at: Date.now(), data });
      return data as T;
    })
    .catch((e) => {
      // Drop the failed placeholder so the next mount retries rather than
      // awaiting a promise that already rejected.
      store.delete(key);
      throw e;
    });

  store.set(key, { at: hit?.at ?? 0, data: hit?.data, inflight });
  return inflight as Promise<T>;
}

/** When a section was last actually fetched — drives the "8s ago" label. */
export function cachedAt(key: string): number | null {
  return store.get(key)?.at || null;
}
