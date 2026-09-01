"use client";

import { useCallback, useEffect, useState } from "react";

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

/**
 * A cached section with a working refresh button.
 *
 * The standalone pages (/queue, /calendar, /releases) each called
 * `cachedFetch` once on mount and rendered no refresh control at all, so the
 * only way to see new data was a hard reload — and because
 * `publisherSchedule()` also caches on the server for 10 minutes and only
 * busts on `?refresh=1`, which those pages never sent, a reload inside that
 * window returned the same rows anyway. Both layers had to be bypassed
 * together; forcing the client is what puts `refresh=1` on the URL.
 *
 * Returned as a hook rather than copied into three pages so the next page
 * cannot forget the `force` argument, which is exactly how the control room's
 * threads panel ended up with a button that did nothing.
 */
export function useCachedSection<T = unknown>(
  key: string,
  url: string,
  fallback: (e: unknown) => T,
): { data: T | null; at: number | null; busy: boolean; refresh: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [at, setAt] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const run = useCallback(
    (force: boolean) => {
      setBusy(true);
      cachedFetch<T>(key, url, { force })
        .then(setData)
        .catch((e) => setData(fallback(e)))
        .finally(() => {
          setAt(cachedAt(key) ?? Date.now());
          setBusy(false);
        });
    },
    // `fallback` is a fresh closure each render; depending on it would reload
    // on every render. The key/url pair is what identifies this section.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, url],
  );

  useEffect(() => {
    run(false);
  }, [run]);

  return { data, at, busy, refresh: () => run(true) };
}
