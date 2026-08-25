/**
 * The reader's thread — reading history for the corpus map's trace.
 *
 * localStorage only, by design: the thread belongs to the reader, never
 * to us. Nothing here is sent anywhere; PostHog sees only an aggregate
 * count when the map shows the thread (analytics.ts). SSR and crawlers
 * never see a history (module guards), so the server-rendered map is
 * honestly trace-free.
 *
 * Order = FIRST-read order, deduplicated: the thread tells the story of
 * how the corpus was traversed, and re-opening yesterday's article is
 * not a new step of the journey. Capped so a decade of reading cannot
 * outgrow the storage quota.
 */

const KEY = "reading-thread";
const VERSION = 1;
const MAX_SLUGS = 500;

interface StoredThread {
  v: number;
  slugs: string[];
}

function safeRead(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredThread;
    if (parsed.v !== VERSION || !Array.isArray(parsed.slugs)) return [];
    return parsed.slugs.filter((s): s is string => typeof s === "string");
  } catch {
    // Corrupt storage or privacy mode: an empty thread, never a crash.
    return [];
  }
}

/** The slugs read so far, in first-read order. Empty on SSR. */
export function readingThread(): string[] {
  return safeRead();
}

/** Record a visit. First-read order; revisits are not new steps. */
export function recordReading(slug: string): void {
  if (typeof window === "undefined") return;
  const slugs = safeRead();
  if (slugs.includes(slug)) return;
  slugs.push(slug);
  try {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ v: VERSION, slugs: slugs.slice(-MAX_SLUGS) }),
    );
  } catch {
    // Quota or privacy mode: the thread simply doesn't grow.
  }
}
