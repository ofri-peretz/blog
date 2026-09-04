/**
 * How articles age — three points on each view curve, two shares, one class.
 * Intent: docs/sdlc/intents/2026-09-04-engage-decay.
 */
export interface Snap {
  external_id: string;
  observed_on: string;
  views: number;
}
export interface ArticleIn {
  slug: string;
  title: string;
  published_at: string;
  url?: string;
}

export const FEED_SHARE = 0.7;
export const SEARCH_SHARE = 0.4;
const DAY = 86_400_000;

export interface Decay {
  slug: string;
  title: string;
  url?: string;
  publishedOn: string;
  ageDays: number;
  views: number;
  /** Share of views by day three; null when the window has no start. */
  early: number | null;
  /** Share of views after day fourteen; null before the article is 28 days old. */
  tail: number | null;
  /** Views per day over the last fourteen days of snapshots. */
  rate: number | null;
  kind: "feed" | "search" | "mixed" | "too young" | "no window";
}

const at = (rows: Snap[], day: string) =>
  rows.find((s) => s.observed_on >= day) ?? null;
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

export function decay(a: ArticleIn, snaps: Snap[], now = Date.now()): Decay {
  const rows = snaps
    .filter((s) => s.external_id === a.slug)
    .sort((x, y) => x.observed_on.localeCompare(y.observed_on));
  const pub = a.published_at.slice(0, 10);
  const t0 = Date.parse(pub);
  const ageDays = Math.floor((now - t0) / DAY);
  const base: Decay = {
    slug: a.slug,
    title: a.title,
    url: a.url,
    publishedOn: pub,
    ageDays,
    views: rows.at(-1)?.views ?? 0,
    early: null,
    tail: null,
    rate: null,
    kind: "no window",
  };
  const first = at(rows, pub);
  // The start must be a start: a first snapshot two days late has already missed the spike.
  if (!first || Date.parse(first.observed_on) - t0 > 2 * DAY) return base;
  const latest = rows.at(-1)!;
  const d3 = at(rows, iso(t0 + 3 * DAY));
  const d14 = at(rows, iso(t0 + 14 * DAY));
  const total = Math.max(0, latest.views - first.views);
  const early =
    d3 && total > 0
      ? Math.round((100 * Math.max(0, d3.views - first.views)) / total) / 100
      : null;
  const back14 =
    rows
      .filter(
        (s) => s.observed_on <= iso(Date.parse(latest.observed_on) - 14 * DAY),
      )
      .at(-1) ?? null;
  const rate = back14
    ? Math.round((10 * Math.max(0, latest.views - back14.views)) / 14) / 10
    : null;
  if (ageDays < 28 || !d14) return { ...base, early, rate, kind: "too young" };
  const tail =
    total > 0
      ? Math.round((100 * Math.max(0, latest.views - d14.views)) / total) / 100
      : null;
  const kind: Decay["kind"] =
    early != null && early >= FEED_SHARE
      ? "feed"
      : tail != null && tail >= SEARCH_SHARE
        ? "search"
        : "mixed";
  return { ...base, early, tail, rate, kind };
}

export function summarize(rows: Decay[]) {
  const by = (k: Decay["kind"]) => rows.filter((r) => r.kind === k);
  const classed = rows.filter(
    (r) => r.kind === "feed" || r.kind === "search" || r.kind === "mixed",
  );
  const views = (xs: Decay[]) => xs.reduce((s, r) => s + r.views, 0);
  return {
    feed: by("feed").length,
    search: by("search").length,
    mixed: by("mixed").length,
    tooYoung: by("too young").length,
    noWindow: by("no window").length,
    viewsFromSearch: views(classed)
      ? Math.round((100 * views(by("search"))) / views(classed))
      : null,
    evergreen: classed
      .filter((r) => r.rate != null && r.rate > 0)
      .sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0))
      .slice(0, 10),
  };
}
