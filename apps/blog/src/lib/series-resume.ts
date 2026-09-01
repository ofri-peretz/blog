/**
 * Resume-your-thread: given the reader's first-read thread and the
 * corpus's series structure, pick the one next part worth offering.
 *
 * Pure and client-safe — the thread never leaves the browser; the
 * server ships only the public series structure (SeriesIndex).
 */

export interface SeriesIndexPart {
  slug: string;
  title: string;
}

export interface SeriesIndex {
  /** slug → series name, for every article that belongs to a series. */
  seriesOf: Record<string, string>;
  /** series name → parts in reading order (oldest first). */
  parts: Record<string, SeriesIndexPart[]>;
}

export interface SeriesResume {
  series: string;
  /** Parts of this series the reader has finished. */
  readInSeries: number;
  total: number;
  next: SeriesIndexPart;
}

/**
 * Walk the thread newest-first; the first read article that belongs to
 * a series with an unread part AFTER it wins — the reader's most
 * recent series engagement, resumed forward, never backward. Returns
 * null when there is nothing honest to offer (no reads, no series
 * membership, series finished): a data gap renders nothing.
 */
export function pickResume(
  thread: readonly string[],
  index: SeriesIndex,
): SeriesResume | null {
  const readSet = new Set(thread);
  for (let i = thread.length - 1; i >= 0; i--) {
    const name = index.seriesOf[thread[i]];
    if (!name) continue;
    const parts = index.parts[name] ?? [];
    const at = parts.findIndex((p) => p.slug === thread[i]);
    if (at === -1) continue;
    for (let j = at + 1; j < parts.length; j++) {
      if (!readSet.has(parts[j].slug)) {
        return {
          series: name,
          readInSeries: parts.filter((p) => readSet.has(p.slug)).length,
          total: parts.length,
          next: parts[j],
        };
      }
    }
  }
  return null;
}
