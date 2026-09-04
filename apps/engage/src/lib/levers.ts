/**
 * What drives what — rank correlation between article shape and outcome,
 * over our own articles. Intent: docs/sdlc/intents/2026-09-04-engage-levers.
 *
 * Correlation, labelled as such: every lever carries n and r, and the caller
 * hides anything under the visibility threshold. Numeric features use
 * Spearman; yes/no features report the mean-outcome difference as a signed
 * effect with the same threshold applied to a rank-biserial r.
 */
export interface ArticleIn {
  id: number;
  slug: string;
  title: string;
  published_at: string;
  reading_time_minutes?: number;
  tag_list?: string[];
  body_markdown?: string;
  page_views_count?: number;
  public_reactions_count?: number;
  comments_count?: number;
}
export interface Snap { external_id: string; observed_on: string; views: number; comments: number }

export interface Features { [k: string]: number | boolean }

export function features(a: ArticleIn): Features {
  const body = a.body_markdown ?? "";
  const t = a.title ?? "";
  const d = new Date(a.published_at);
  const cst = new Date(d.toLocaleString("en-US", { timeZone: "America/Chicago" }));
  const tags = new Set((a.tag_list ?? []).map((x) => x.toLowerCase()));
  return {
    title_chars: t.length,
    title_has_number: /\d/.test(t),
    title_is_question: /\?/.test(t),
    title_has_colon: /[:—–]/.test(t),
    title_first_person: /\b(I|my|me)\b/.test(t),
    tag_count: tags.size,
    tag_ai: tags.has("ai"),
    tag_security: tags.has("security"),
    tag_javascript: tags.has("javascript"),
    tag_webdev: tags.has("webdev"),
    reading_minutes: a.reading_time_minutes ?? 0,
    body_words: body.split(/\s+/).filter(Boolean).length,
    code_blocks: (body.match(/```/g) ?? []).length / 2,
    images: (body.match(/!\[/g) ?? []).length,
    publish_weekday: cst.getDay(),
    publish_is_weekend: cst.getDay() === 0 || cst.getDay() === 6,
    publish_hour_cst: cst.getHours(),
  };
}

/** Views and comments in the first 14 days, from cumulative daily snapshots; null without coverage. */
export function outcome14(a: ArticleIn, snaps: Snap[]): { views14: number | null; comments14: number | null } {
  const mine = snaps.filter((s) => s.external_id === a.slug).sort((x, y) => x.observed_on.localeCompare(y.observed_on));
  if (mine.length === 0) return { views14: null, comments14: null };
  const pub = a.published_at.slice(0, 10);
  const end = new Date(Date.parse(pub) + 14 * 86_400_000).toISOString().slice(0, 10);
  const first = mine.find((s) => s.observed_on >= pub);
  const at14 = mine.find((s) => s.observed_on >= end);
  // Coverage must start within 2 days of publish, or the "start" baseline is not a start.
  if (!first || !at14 || Date.parse(first.observed_on) - Date.parse(pub) > 2 * 86_400_000) return { views14: null, comments14: null };
  return { views14: Math.max(0, at14.views - first.views), comments14: Math.max(0, at14.comments - first.comments) };
}

function ranks(xs: number[]): number[] {
  const idx = xs.map((v, i) => [v, i] as const).sort((a, b) => a[0] - b[0]);
  const r = new Array(xs.length).fill(0);
  for (let i = 0; i < idx.length; ) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) r[idx[k][1]] = avg;
    i = j + 1;
  }
  return r;
}
export function spearman(xs: number[], ys: number[]): number | null {
  const n = xs.length;
  if (n < 3 || n !== ys.length) return null;
  const rx = ranks(xs), ry = ranks(ys);
  const mx = rx.reduce((s, v) => s + v, 0) / n, my = ry.reduce((s, v) => s + v, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) { num += (rx[i] - mx) * (ry[i] - my); dx += (rx[i] - mx) ** 2; dy += (ry[i] - my) ** 2; }
  return dx && dy ? num / Math.sqrt(dx * dy) : null;
}

export interface Lever { feature: string; kind: "number" | "boolean"; outcome: string; n: number; r: number; note: string }

export function levers(articles: ArticleIn[], snaps: Snap[]): Lever[] {
  const rows = articles.map((a) => {
    const o = outcome14(a, snaps);
    const views = a.page_views_count ?? 0;
    return { f: features(a), views14: o.views14, comments14: o.comments14, rx100: views >= 50 ? (100 * (a.public_reactions_count ?? 0)) / views : null };
  });
  const outcomes: { id: string; get: (r: (typeof rows)[number]) => number | null }[] = [
    { id: "views14", get: (r) => r.views14 },
    { id: "comments14", get: (r) => r.comments14 },
    { id: "reactions_per_100_views", get: (r) => r.rx100 },
  ];
  const out: Lever[] = [];
  const featureNames = Object.keys(rows[0]?.f ?? {});
  for (const o of outcomes) {
    for (const fname of featureNames) {
      const pairs = rows.map((r) => [r.f[fname], o.get(r)] as const).filter(([, y]) => y != null) as [number | boolean, number][];
      if (pairs.length < 3) continue;
      const isBool = typeof pairs[0][0] === "boolean";
      const xs = pairs.map(([x]) => (isBool ? (x ? 1 : 0) : (x as number)));
      const ys = pairs.map(([, y]) => y);
      const r = spearman(xs, ys);
      if (r == null || !Number.isFinite(r)) continue;
      let note = "";
      if (isBool) {
        const yes = ys.filter((_, i) => xs[i] === 1), no = ys.filter((_, i) => xs[i] === 0);
        const m = (v: number[]) => (v.length ? v.reduce((s, x) => s + x, 0) / v.length : NaN);
        note = `${yes.length} yes (mean ${m(yes).toFixed(1)}) vs ${no.length} no (mean ${m(no).toFixed(1)})`;
      }
      out.push({ feature: fname, kind: isBool ? "boolean" : "number", outcome: o.id, n: pairs.length, r: Math.round(r * 100) / 100, note });
    }
  }
  return out.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
}
