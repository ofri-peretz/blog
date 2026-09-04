/**
 * Rising now — posts in our tags that will be read today, ranked before they
 * are. Intent: docs/sdlc/intents/2026-09-04-engage-radar.
 *
 * Two facts a person would check, printed and multiplied: reactions per
 * hour since publish, and how much of the post is our subject.
 */
import { HOME_TAGS } from "./league";

export interface RadarIn {
  id: number;
  title: string;
  url: string;
  published_at: string;
  positive_reactions_count?: number;
  public_reactions_count?: number;
  comments_count?: number;
  tag_list?: string[] | string;
  user?: { username?: string };
}

export interface RadarRow {
  id: number;
  title: string;
  url: string;
  author: string;
  ageH: number;
  reactions: number;
  comments: number;
  velocity: number;
  relevance: number;
  hits: string[];
  score: number;
  commented: boolean;
}

/** Our subject, as words. A hit is one of these in the title or tags. */
export const KEYWORDS = [
  "eslint",
  "lint",
  "linter",
  "static analysis",
  "sast",
  "security",
  "vulnerab",
  "injection",
  "xss",
  "cwe",
  "owasp",
  "secret",
  "credential",
  "supply chain",
  "npm",
  "typescript",
  "node",
  "nestjs",
  "express",
  "prisma",
  "postgres",
  "jwt",
  "ai code",
  "agent",
  "mcp",
  "benchmark",
  "false positive",
];

export const MAX_AGE_H = 24;
export const OWN = "ofri-peretz";

const tags = (a: RadarIn): string[] =>
  (Array.isArray(a.tag_list) ? a.tag_list : String(a.tag_list ?? "").split(","))
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

/** Hours since publish; Infinity for a missing or malformed date, so the age cut drops it rather than letting NaN through. */
export function ageHours(a: RadarIn, now = Date.now()): number {
  const t = Date.parse(a.published_at ?? "");
  return Number.isFinite(t) ? Math.max(0, (now - t) / 3_600_000) : Infinity;
}

/** Reactions per hour, with a one-hour floor so a five-minute-old post is not infinite. */
export function velocity(a: RadarIn, now = Date.now()): number {
  const rx = a.positive_reactions_count ?? a.public_reactions_count ?? 0;
  return Math.round((100 * rx) / Math.max(1, ageHours(a, now))) / 100;
}

/** Keyword hits in title and tags, plus home-tag overlap; the hits are returned for the panel. */
export function relevance(a: RadarIn): { relevance: number; hits: string[] } {
  const hay = `${a.title} ${tags(a).join(" ")}`.toLowerCase();
  // "lint" inside "eslint" is one hit, not two: drop a hit contained in another.
  const raw = KEYWORDS.filter((k) => hay.includes(k));
  const hits = raw.filter((k) => !raw.some((o) => o !== k && o.includes(k)));
  const home = tags(a).filter((t) =>
    (HOME_TAGS as readonly string[]).includes(t),
  );
  return {
    relevance: hits.length + home.length,
    hits: [...hits, ...home.map((t) => `#${t}`)],
  };
}

export function rank(
  articles: RadarIn[],
  commented: Set<number>,
  now = Date.now(),
  limit = 15,
): RadarRow[] {
  const seen = new Set<number>();
  const rows: RadarRow[] = [];
  for (const a of articles) {
    if (seen.has(a.id) || a.user?.username === OWN) continue;
    seen.add(a.id);
    const ageH = ageHours(a, now);
    if (ageH > MAX_AGE_H) continue;
    const v = velocity(a, now);
    const r = relevance(a);
    rows.push({
      id: a.id,
      title: a.title,
      url: a.url,
      author: a.user?.username ?? "",
      ageH: Math.round(ageH * 10) / 10,
      reactions: a.positive_reactions_count ?? a.public_reactions_count ?? 0,
      comments: a.comments_count ?? 0,
      velocity: v,
      relevance: r.relevance,
      hits: r.hits,
      score: Math.round(100 * v * (1 + r.relevance)) / 100,
      commented: commented.has(a.id),
    });
  }
  return rows
    .sort((x, y) => y.score - x.score || y.reactions - x.reactions)
    .slice(0, limit);
}
