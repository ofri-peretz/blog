/**
 * Pace budget — warns, never blocks. Except one row, which is a real API limit.
 *
 * The previous model capped the day at 0–3 comments and then told you
 * "everything is handled". Against Forem's actual floor of one comment per five
 * minutes (`comment_antispam_creation`), that cap ran ~50x under the ceiling.
 * So the limit moves here and becomes visible instead of silent, and it limits
 * by PACE rather than by count: how human the rhythm looks, not how much you did.
 *
 * `hard: true` marks the only genuine platform limit. Everything else is a
 * detection heuristic — our guess at what looks automated — and guesses should
 * warn, not stop a human who can see the number and decide.
 */
import type { Item } from "./footprint";

export type Level = "green" | "amber" | "red";

export interface Gauge {
  label: string;
  value: string;
  level: Level;
  /** True only for limits Dev.to actually enforces server-side. */
  hard: boolean;
  hint?: string;
}

export interface Acted {
  kind: "comment" | "reaction";
  author: string;
  at: number;
}

const MIN = 60_000;

export function gauges(acted: Acted[], now = Date.now()): Gauge[] {
  const comments = acted.filter((a) => a.kind === "comment");
  const sinceLast = comments.length
    ? now - Math.max(...comments.map((c) => c.at))
    : Infinity;
  const lastHour = acted.filter((a) => now - a.at < 60 * MIN);
  const lastDay = acted.filter((a) => now - a.at < 24 * 60 * MIN);
  const authors = new Set(lastDay.map((a) => a.author));

  const mins = (ms: number) =>
    ms === Infinity ? "—" : `${Math.floor(ms / MIN)}m`;

  return [
    {
      label: "Since last comment",
      value: mins(sinceLast),
      hard: true,
      level: sinceLast >= 5 * MIN ? "green" : sinceLast >= 3 * MIN ? "amber" : "red",
      hint: "Forem rejects a second comment inside 5 minutes (comment_antispam_creation). This one is enforced server-side.",
    },
    {
      label: "Actions this hour",
      value: String(lastHour.length),
      hard: false,
      level: lastHour.length <= 4 ? "green" : lastHour.length <= 8 ? "amber" : "red",
      hint: "Detection heuristic, not an API limit. Bursts read as automation.",
    },
    {
      label: "Actions today",
      value: String(lastDay.length),
      hard: false,
      level: lastDay.length <= 12 ? "green" : lastDay.length <= 25 ? "amber" : "red",
      hint: "Forem's own floor allows ~100/day. This is a conservatism dial, not a ceiling.",
    },
    {
      label: "Distinct authors today",
      value: String(authors.size),
      hard: false,
      level:
        lastDay.length === 0 || authors.size >= 3
          ? "green"
          : authors.size === 2
            ? "amber"
            : "red",
      hint: "Repeatedly hitting one author is the clearest automation tell.",
    },
  ];
}

/** The only condition that should ever disable the primary button. */
export function blocked(gs: Gauge[]): Gauge | null {
  return gs.find((g) => g.hard && g.level === "red") ?? null;
}

export function authorCooldownDays(
  author: string,
  all: Item[],
  now = Date.now(),
): number | null {
  const hits = all
    .filter(
      (i) => i.article.author === author && (i.status === "posted"),
    )
    .map((i) => Date.parse(i.date));
  if (!hits.length) return null;
  return Math.floor((now - Math.max(...hits)) / (24 * 60 * MIN));
}
