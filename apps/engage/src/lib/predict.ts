/**
 * Before you publish: the levers applied to a draft.
 * Intent: docs/sdlc/intents/2026-09-04-engage-predict.
 *
 * A model for one outcome is the visible levers for it, each with the corpus
 * mean and standard deviation of its feature. A draft scores the sum of r × z;
 * its percentile is the share of corpus articles scoring lower. No new
 * correlation is introduced here: a lever the panel does not show cannot
 * steer a draft.
 */
import { features, type ArticleIn, type Features, type Lever } from "./levers";

/** The panel's visibility threshold, shared so the two cannot drift. */
export const VISIBLE = (l: Lever) => l.n >= 20 && Math.abs(l.r) >= 0.2;

export interface Weight {
  feature: string;
  r: number;
  mean: number;
  sd: number;
}
export interface Model {
  outcome: string;
  weights: Weight[];
  scores: number[];
}

const num = (v: number | boolean | undefined) =>
  typeof v === "boolean" ? (v ? 1 : 0) : Number(v ?? 0);

export function model(
  corpus: ArticleIn[],
  levers: Lever[],
  outcome: string,
): Model {
  const fs = corpus.map(features);
  const weights: Weight[] = [];
  for (const l of levers.filter((l) => l.outcome === outcome && VISIBLE(l))) {
    const xs = fs.map((f) => num(f[l.feature]));
    const mean = xs.reduce((s, x) => s + x, 0) / (xs.length || 1);
    const sd = Math.sqrt(
      xs.reduce((s, x) => s + (x - mean) ** 2, 0) / (xs.length || 1),
    );
    if (sd > 0) weights.push({ feature: l.feature, r: l.r, mean, sd });
  }
  const m: Model = { outcome, weights, scores: [] };
  m.scores = fs.map((f) => score(m, f));
  return m;
}

export function score(m: Model, f: Features): number {
  return m.weights.reduce(
    (s, w) => s + w.r * ((num(f[w.feature]) - w.mean) / w.sd),
    0,
  );
}

/** Share of the corpus scoring below `s`, 0..100. */
export function percentile(m: Model, s: number): number {
  if (!m.scores.length) return 50;
  return Math.round(
    (100 * m.scores.filter((x) => x < s).length) / m.scores.length,
  );
}

/** One shape edit an author can make without touching prose. */
interface Edit {
  feature: string;
  up: string;
  down: string;
  apply: (f: Features, dir: 1 | -1) => Features | null;
}
const toggle = (feature: string, on: string, off: string): Edit => ({
  feature,
  up: on,
  down: off,
  apply: (f, dir) =>
    f[feature] === (dir === 1) ? null : { ...f, [feature]: dir === 1 },
});
const count = (feature: string, up: string, down: string, step = 1): Edit => ({
  feature,
  up,
  down,
  apply: (f, dir) =>
    dir === -1 && num(f[feature]) < step
      ? null
      : { ...f, [feature]: num(f[feature]) + dir * step },
});
export const EDITS: Edit[] = [
  count("code_blocks", "add a code block", "drop a code block"),
  count("images", "add an image", "drop an image"),
  count(
    "title_chars",
    "lengthen the title by ten characters",
    "shorten the title by ten characters",
    10,
  ),
  toggle(
    "title_has_colon",
    "put a colon in the title",
    "drop the colon from the title",
  ),
  toggle(
    "title_has_number",
    "put a number in the title",
    "take the number out of the title",
  ),
  toggle(
    "title_is_question",
    "make the title a question",
    "make the title a statement",
  ),
  toggle(
    "title_first_person",
    "write the title in first person",
    "take the first person out of the title",
  ),
  toggle("tag_ai", "add the ai tag", "drop the ai tag"),
  toggle("tag_security", "add the security tag", "drop the security tag"),
  toggle("tag_javascript", "add the javascript tag", "drop the javascript tag"),
  toggle("tag_webdev", "add the webdev tag", "drop the webdev tag"),
  {
    feature: "publish_weekday",
    up: "publish a day later in the week",
    down: "publish a day earlier in the week",
    apply: (f, dir) => {
      const d = num(f.publish_weekday) + dir;
      return d < 0 || d > 6 ? null : { ...f, publish_weekday: d };
    },
  },
];

export interface Suggestion {
  feature: string;
  edit: string;
  gain: number;
}

/** The `n` edits with the largest positive gain on `m`, tried one at a time. */
export function suggest(m: Model, f: Features, n = 2): Suggestion[] {
  const base = score(m, f);
  const out: Suggestion[] = [];
  for (const e of EDITS) {
    for (const dir of [1, -1] as const) {
      const g = e.apply(f, dir);
      if (!g) continue;
      const gain = score(m, g) - base;
      if (gain > 1e-9)
        out.push({
          feature: e.feature,
          edit: dir === 1 ? e.up : e.down,
          gain: Math.round(gain * 100) / 100,
        });
    }
  }
  return out.sort((a, b) => b.gain - a.gain).slice(0, n);
}

export interface Prediction {
  slug: string;
  title: string;
  publishAt: string;
  outcomes: Record<string, { percentile: number; levers: number }>;
  suggestions: Suggestion[];
}

export function predict(
  draft: ArticleIn,
  models: Model[],
  suggestOn = "comments14",
): Prediction {
  const f = features(draft);
  const outcomes: Prediction["outcomes"] = {};
  for (const m of models)
    outcomes[m.outcome] = {
      percentile: percentile(m, score(m, f)),
      levers: m.weights.length,
    };
  const sm = models.find((m) => m.outcome === suggestOn) ?? models[0];
  return {
    slug: draft.slug,
    title: draft.title,
    publishAt: draft.published_at,
    outcomes,
    suggestions: sm ? suggest(sm, f) : [],
  };
}
