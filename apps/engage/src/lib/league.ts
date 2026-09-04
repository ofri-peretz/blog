/**
 * The arena: who earns reactions and comments in our tags, over 30 days.
 *
 * dev.to publishes no author score. What it does publish is every article's
 * reactions and comments, and `/articles?tag=&top=30` returns the tag's
 * top articles of the last 30 days. Aggregating three pages of that by
 * author gives an observable league table: our rank, the names above us and
 * their lines. Sample-bound by construction (top 300 per tag) — the width is
 * one constant. Pure aggregation here; the route crawls and caches 24 h.
 */
export const HOME_TAGS = ["security", "javascript", "node", "ai"] as const;
export const PAGES = 3;

export interface Line { author: string; articles: number; reactions: number; comments: number }
export interface TagTable {
  tag: string;
  authors: number;
  articles: number;
  ours: Line | null;
  rank: number | null;
  /** Share of authors we out-rank, 0..1; absent = 0. */
  percentile: number;
  above: Line[];
  top: Line[];
}

export function aggregate(tag: string, arts: { user?: { username?: string }; public_reactions_count?: number; comments_count?: number }[], me: string): TagTable {
  const byAuthor = new Map<string, Line>();
  for (const a of arts) {
    const u = a.user?.username;
    if (!u) continue;
    const l = byAuthor.get(u) ?? { author: u, articles: 0, reactions: 0, comments: 0 };
    l.articles++;
    l.reactions += a.public_reactions_count ?? 0;
    l.comments += a.comments_count ?? 0;
    byAuthor.set(u, l);
  }
  const ranked = [...byAuthor.values()].sort((x, y) => y.reactions - x.reactions || y.comments - x.comments || x.author.localeCompare(y.author));
  const idx = ranked.findIndex((l) => l.author === me);
  return {
    tag,
    authors: ranked.length,
    articles: arts.length,
    ours: idx === -1 ? null : ranked[idx],
    rank: idx === -1 ? null : idx + 1,
    percentile: idx === -1 || ranked.length < 2 ? 0 : (ranked.length - 1 - idx) / (ranked.length - 1),
    above: idx === -1 ? ranked.slice(0, 5) : ranked.slice(Math.max(0, idx - 5), idx),
    top: ranked.slice(0, 5),
  };
}

export function arenaSummary(tables: TagTable[]): { percentile: number; present: number } {
  return {
    percentile: tables.length ? Math.round((tables.reduce((s, t) => s + t.percentile, 0) / tables.length) * 1000) / 1000 : 0,
    present: tables.filter((t) => t.rank !== null).length,
  };
}
