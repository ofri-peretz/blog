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

/* ── The climb: one merged league over every sample, with thresholds and gaps ── */

export const LEVELS = [5, 10, 20, 50, 100, 200, 500] as const;

export interface Climb {
  authors: number;
  articles: number;
  ours: Line | null;
  rank: number | null;
  /** Reactions needed to hold each level's last place, from the sorted list. */
  thresholds: Record<number, number | null>;
  level: number | null;
  next: { level: number; reactionsNeeded: number } | null;
  nextUp: (Line & { rank: number; gap: number })[];
  top: (Line & { rank: number; rxPerArticle: number; tags: string[] })[];
  /** How many more articles the gap to the next level is, at two rates. */
  plan: { ourRxPerArticle: number; top10RxPerArticle: number; articlesAtOurRate: number | null; articlesAtTop10Rate: number | null };
}

export function mergeLeague(samples: { user?: { username?: string }; id: number; public_reactions_count?: number; comments_count?: number; tag_list?: string[] }[][], me: string): Climb {
  const seen = new Set<number>();
  const by = new Map<string, Line & { tagCounts: Map<string, number> }>();
  let articles = 0;
  for (const arts of samples) for (const a of arts) {
    if (seen.has(a.id)) continue;
    seen.add(a.id); articles++;
    const u = a.user?.username; if (!u) continue;
    const l = by.get(u) ?? { author: u, articles: 0, reactions: 0, comments: 0, tagCounts: new Map() };
    l.articles++; l.reactions += a.public_reactions_count ?? 0; l.comments += a.comments_count ?? 0;
    for (const t of a.tag_list ?? []) l.tagCounts.set(t, (l.tagCounts.get(t) ?? 0) + 1);
    by.set(u, l);
  }
  const ranked = [...by.values()].sort((x, y) => y.reactions - x.reactions || y.comments - x.comments || x.author.localeCompare(y.author));
  const idx = ranked.findIndex((l) => l.author === me);
  const ours = idx === -1 ? null : ranked[idx];
  const rank = idx === -1 ? null : idx + 1;
  const thresholds: Record<number, number | null> = {};
  for (const L of LEVELS) thresholds[L] = ranked[L - 1]?.reactions ?? null;
  const level = rank === null ? null : (LEVELS.find((L) => rank <= L) ?? null);
  const nextLevel = rank === null ? 500 : (LEVELS.filter((L) => L < rank).slice(-1)[0] ?? null);
  const need = nextLevel === null ? null : Math.max(0, (thresholds[nextLevel] ?? 0) + 1 - (ours?.reactions ?? 0));
  const top10 = ranked.slice(0, 10);
  const top10Rate = top10.length ? top10.reduce((s, l) => s + l.reactions / Math.max(1, l.articles), 0) / top10.length : 0;
  const ourRate = ours && ours.articles ? ours.reactions / ours.articles : 0;
  const strip = (l: Line & { tagCounts: Map<string, number> }, r: number) => ({ author: l.author, articles: l.articles, reactions: l.reactions, comments: l.comments, rank: r, rxPerArticle: Math.round((10 * l.reactions) / Math.max(1, l.articles)) / 10, tags: [...l.tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t]) => t) });
  return {
    authors: ranked.length, articles, ours: ours ? { author: ours.author, articles: ours.articles, reactions: ours.reactions, comments: ours.comments } : null, rank, thresholds, level,
    next: nextLevel === null || need === null ? null : { level: nextLevel, reactionsNeeded: need },
    nextUp: idx === -1 ? [] : ranked.slice(Math.max(0, idx - 5), idx).map((l, i) => ({ author: l.author, articles: l.articles, reactions: l.reactions, comments: l.comments, rank: Math.max(0, idx - 5) + i + 1, gap: l.reactions - (ours?.reactions ?? 0) })),
    top: ranked.slice(0, 25).map((l, i) => strip(l, i + 1)),
    plan: { ourRxPerArticle: Math.round(ourRate * 10) / 10, top10RxPerArticle: Math.round(top10Rate * 10) / 10, articlesAtOurRate: need === null ? null : ourRate > 0 ? Math.ceil(need / ourRate) : null, articlesAtTop10Rate: need === null ? null : top10Rate > 0 ? Math.ceil(need / top10Rate) : null },
  };
}
