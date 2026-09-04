/**
 * Comment yield — did an article get people talking in its first fourteen days?
 *
 * Intent: docs/sdlc/intents/2026-09-03-engage-comment-yield. Lifetime
 * `comments_count` rewards old articles and hides the question; the window is
 * the honest measure, and it is what the article pipeline's engagement
 * reviewer implicitly promises. Every number here is a count of comments by
 * OTHER people with a dev.to `created_at` inside the window. Pure, so the
 * selfcheck can pin the window edge and the self-exclusion.
 */
export interface YieldComment {
  created_at: string;
  user?: { username?: string };
  children?: YieldComment[];
}

export interface YieldRow {
  id: number;
  title: string;
  url: string;
  publishedAt: string;
  /** Comments by others within `windowDays` of publish. */
  comments14d: number;
  /** Comments by others, lifetime. */
  commentsTotal: number;
  /** True once the window has fully elapsed — a young article's 0 is not a verdict. */
  windowClosed: boolean;
}

export const WINDOW_DAYS = 14;

export function yieldOf(
  article: { id: number; title: string; url: string; published_at: string },
  tree: YieldComment[],
  me: string,
  now = Date.now(),
  windowDays = WINDOW_DAYS,
): YieldRow {
  const pub = Date.parse(article.published_at);
  const edge = pub + windowDays * 86_400_000;
  let inWindow = 0;
  let total = 0;
  const walk = (nodes: YieldComment[]) => {
    for (const c of nodes) {
      if (c.user?.username !== me) {
        total++;
        const at = Date.parse(c.created_at);
        // Inclusive edge: day 14 at 23:59:59 counts, the next second does not.
        if (at >= pub && at <= edge) inWindow++;
      }
      walk(c.children ?? []);
    }
  };
  walk(tree);
  return {
    id: article.id,
    title: article.title,
    url: article.url,
    publishedAt: article.published_at.slice(0, 10),
    comments14d: inWindow,
    commentsTotal: total,
    windowClosed: now > edge,
  };
}

export interface YieldSummary {
  /** Articles published in the trailing window whose 14 days have elapsed. */
  articles30d: number;
  mean14d30d: number | null;
  withAny30d: number;
  articlesTotal: number;
  withAnyTotal: number;
}

export function summarize(rows: YieldRow[], now = Date.now(), sinceDays = 30): YieldSummary {
  const since = now - sinceDays * 86_400_000;
  // Only closed windows are verdicts; an article published yesterday has not
  // had its chance yet and would drag the mean down for no reason.
  const recent = rows.filter((r) => Date.parse(r.publishedAt) >= since && r.windowClosed);
  return {
    articles30d: recent.length,
    mean14d30d: recent.length
      ? Math.round((recent.reduce((s, r) => s + r.comments14d, 0) / recent.length) * 100) / 100
      : null,
    withAny30d: recent.filter((r) => r.comments14d > 0).length,
    articlesTotal: rows.length,
    withAnyTotal: rows.filter((r) => r.comments14d > 0).length,
  };
}

/** Pearson r over (score, yield) pairs; null below the sample floor. */
export function pearson(pairs: [number, number][], minN = 20): { r: number | null; n: number } {
  const n = pairs.length;
  if (n < minN) return { r: null, n };
  const mx = pairs.reduce((s, p) => s + p[0], 0) / n;
  const my = pairs.reduce((s, p) => s + p[1], 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (const [x, y] of pairs) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; syy += (y - my) ** 2; }
  if (sxx === 0 || syy === 0) return { r: null, n };
  return { r: Math.round((sxy / Math.sqrt(sxx * syy)) * 100) / 100, n };
}
