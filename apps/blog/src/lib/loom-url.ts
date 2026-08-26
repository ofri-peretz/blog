// The Loom's URL grammar — every composed weave is a permalink.
//
// The URL is the ONLY state store (URL_PHILOSOPHY: shareable state
// lives in the address bar, not in component memory). Parse tolerates
// anything — unknown ids are dropped, unknown enum values fall back to
// the default — because a permalink pasted after the catalog changed
// must degrade to a working page, never a crash. Serialize omits every
// field that equals the default, so the canonical entry URL stays
// bare `/loom`.
//
// Pure module: no React, no next/navigation — the round-trip is locked
// by unit tests that run without a DOM.

import type { LoomGroup } from "./loom-data";

export const LOOM_FORMS = ["weave", "grid"] as const;
export type LoomForm = (typeof LOOM_FORMS)[number];

export const LOOM_WINDOWS = ["90d", "1y", "all"] as const;
export type LoomWindow = (typeof LOOM_WINDOWS)[number];

export const LOOM_NORMS = ["abs", "idx"] as const;
export type LoomNorm = (typeof LOOM_NORMS)[number];

/**
 * Five threads, no more. `TimeSeries` plots at most five (dash + hue
 * pairs run out), and a weave a reader cannot untangle teaches nothing.
 * The constraint is the product — a small system that generates every
 * view beats an unbounded builder (the In Pieces law).
 */
export const MAX_THREADS = 5;

export interface LoomState {
  /** Ordered series ids — the first is the weave's primary thread. */
  series: readonly string[];
  form: LoomForm;
  window: LoomWindow;
  normalize: LoomNorm;
}

export const LOOM_DEFAULT: LoomState = {
  series: ["npm:total"],
  form: "weave",
  window: "all",
  normalize: "abs",
};

function pick<T extends string>(
  raw: string | null,
  allowed: readonly T[],
  fallback: T,
): T {
  return allowed.includes(raw as T) ? (raw as T) : fallback;
}

export function parseLoomState(
  params: URLSearchParams,
  validIds: ReadonlySet<string>,
): LoomState {
  const series = (params.get("s") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter((id) => validIds.has(id))
    .filter((id, i, arr) => arr.indexOf(id) === i)
    .slice(0, MAX_THREADS);
  return {
    series: series.length > 0 ? series : LOOM_DEFAULT.series,
    form: pick(params.get("form"), LOOM_FORMS, LOOM_DEFAULT.form),
    window: pick(params.get("win"), LOOM_WINDOWS, LOOM_DEFAULT.window),
    normalize: pick(params.get("norm"), LOOM_NORMS, LOOM_DEFAULT.normalize),
  };
}

/** Query string ("s=…&form=…"), or "" when the state IS the default. */
export function serializeLoomState(state: LoomState): string {
  const params = new URLSearchParams();
  if (state.series.join(",") !== LOOM_DEFAULT.series.join(",")) {
    params.set("s", state.series.join(","));
  }
  if (state.form !== LOOM_DEFAULT.form) params.set("form", state.form);
  if (state.window !== LOOM_DEFAULT.window) params.set("win", state.window);
  if (state.normalize !== LOOM_DEFAULT.normalize) {
    params.set("norm", state.normalize);
  }
  return params.toString();
}

/** How the thread picker names its groups. */
export const LOOM_GROUP_LABELS: Record<LoomGroup, string> = {
  npm: "npm",
  devto: "DEV.to",
  github: "GitHub",
  site: "Site",
};

/**
 * Curated entry weaves — each is nothing but a URL state, so "guided"
 * and "composed" are the same machinery. Ids are frozen by the
 * analytics lock (loom:preset_click segments on them).
 */
export interface LoomPreset {
  id: string;
  label: string;
  state: LoomState;
}

export const LOOM_PRESETS: readonly LoomPreset[] = [
  {
    id: "adoption",
    label: "Adoption",
    state: {
      series: ["npm:total"],
      form: "weave",
      window: "all",
      normalize: "abs",
    },
  },
  {
    id: "attention",
    label: "Attention",
    state: {
      series: ["site:page-views", "devto:views", "github:stars"],
      form: "weave",
      window: "all",
      normalize: "idx",
    },
  },
  {
    id: "reciprocity",
    label: "Reciprocity",
    state: {
      series: ["github:external-prs", "devto:comments-left"],
      form: "weave",
      window: "all",
      normalize: "abs",
    },
  },
  {
    id: "ratio",
    label: "The ratio",
    state: {
      series: ["github:downloads-per-star"],
      form: "weave",
      window: "all",
      normalize: "abs",
    },
  },
];

/** The cutoff date for a window, given "today" (observedThrough). */
export function windowCutoff(window: LoomWindow, observedThrough: string): string {
  if (window === "all") return "0000-00-00";
  const d = new Date(`${observedThrough}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - (window === "90d" ? 90 : 365));
  return d.toISOString().slice(0, 10);
}
