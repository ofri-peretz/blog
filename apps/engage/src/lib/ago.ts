/**
 * Relative time for a SOURCE timestamp — when the crawl, ingest row or sweep
 * was read — as opposed to when the page fetched it. Pure; the selfcheck pins
 * the units and the null case, because "3m ago" on a two-day-old row is the
 * exact lie the freshness intent exists to remove.
 */
export function ago(source: string | number | null | undefined, now = Date.now()): string | null {
  if (source == null || source === "") return null;
  const t = typeof source === "number" ? source : Date.parse(String(source).length === 10 ? `${source}T00:00:00Z` : String(source));
  if (!Number.isFinite(t)) return null;
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86_400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86_400)}d ago`;
}
export function iso(source: string | number | null | undefined): string {
  if (source == null) return "";
  const t = typeof source === "number" ? source : Date.parse(String(source).length === 10 ? `${source}T00:00:00Z` : String(source));
  return Number.isFinite(t) ? new Date(t).toISOString() : String(source);
}
