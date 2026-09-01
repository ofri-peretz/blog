import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import matter from "gray-matter";
import readingTime from "reading-time";

export interface ArticleFrontmatter {
  title: string;
  description: string;
  slug?: string;
  canonical_url?: string;
  devto_url?: string;
  devto_id?: number;
  /** Tri-state on purpose: true / false / absent. See isPublished(). */
  published?: boolean;
  /** Authoring date, normalized to ISO yyyy-mm-dd (fallback when published_at is absent). */
  date?: string;
  published_at?: string;
  edited_at?: string | null;
  cover_image?: string | null;
  social_image?: string | null;
  reading_time_minutes?: number;
  tags: string[];
  reactions?: number;
  comments?: number;
  views?: number;
  series?: string | null;
  author?: {
    name?: string;
    username?: string;
    avatar?: string | null;
    twitter?: string | null;
  };
}

export interface Article {
  slug: string;
  frontmatter: ArticleFrontmatter;
  body: string;
  readingTimeMinutes: number;
}

// In serverless functions on Vercel, `process.cwd()` resolves to /var/task
// (or similar runtime root), not the project root. Anchor the articles dir
// to a path that survives the trip from build → bundle → lambda invocation.
//
// Two candidate locations are probed lazily (NOT at module init, so
// Turbopack doesn't flag the cwd reads as static-evaluation hazards):
//   1. <cwd>/content/articles  — `next dev`, build, and lambda where root
//      directory is `apps/blog`
//   2. <cwd>/apps/blog/content/articles  — lambda where cwd is the monorepo
//      root
//
// The result is memoized after the first call.
let articlesDirCache: string | null = null;

function getArticlesDir(): string {
  if (articlesDirCache !== null) return articlesDirCache;
  // Avoid the import-init eval-warning by requiring fs lazily inside the
  // function body. This is intentional — see comment above.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { existsSync } = require("node:fs") as typeof import("node:fs");
  const candidates = [
    path.join(process.cwd(), "content", "articles"),
    path.join(process.cwd(), "apps", "blog", "content", "articles"),
  ];
  for (const dir of candidates) {
    if (existsSync(dir)) {
      articlesDirCache = dir;
      return dir;
    }
  }
  console.warn(
    "[blog/source] content/articles not found at any candidate path:",
    candidates,
  );
  articlesDirCache = candidates[0];
  return candidates[0];
}

function normalize(fm: Record<string, unknown>): ArticleFrontmatter {
  return {
    title: (fm.title as string) ?? "",
    description: (fm.description as string) ?? "",
    slug: fm.slug as string | undefined,
    canonical_url: fm.canonical_url as string | undefined,
    devto_url: fm.devto_url as string | undefined,
    devto_id: fm.devto_id as number | undefined,
    published: typeof fm.published === "boolean" ? fm.published : undefined,
    published_at: fm.published_at as string | undefined,
    // YAML parses an unquoted `date: 2026-07-19` as a JS Date — normalize
    // to ISO yyyy-mm-dd here so consumers never see the two shapes.
    date:
      fm.date instanceof Date
        ? fm.date.toISOString().slice(0, 10)
        : typeof fm.date === "string"
          ? fm.date.slice(0, 10)
          : undefined,
    edited_at: (fm.edited_at as string | null) ?? null,
    cover_image: (fm.cover_image as string | null) ?? null,
    social_image: (fm.social_image as string | null) ?? null,
    reading_time_minutes: fm.reading_time_minutes as number | undefined,
    tags: Array.isArray(fm.tags) ? (fm.tags as string[]) : [],
    reactions: fm.reactions as number | undefined,
    comments: fm.comments as number | undefined,
    views: fm.views as number | undefined,
    series: (fm.series as string | null) ?? null,
    author:
      typeof fm.author === "object" && fm.author !== null
        ? (fm.author as ArticleFrontmatter["author"])
        : undefined,
  };
}

function loadArticle(filename: string): Article {
  const slug = filename.replace(/\.md$/, "");
  const raw = readFileSync(path.join(getArticlesDir(), filename), "utf-8");
  const parsed = matter(raw);
  const fm = normalize(parsed.data);
  const computed = readingTime(parsed.content);
  return {
    slug,
    frontmatter: fm,
    body: parsed.content,
    readingTimeMinutes: fm.reading_time_minutes ?? Math.ceil(computed.minutes),
  };
}

/**
 * Is this article released?
 *
 * `published` is tri-state and 40 of the articles on disk simply do not carry
 * the field. Treating absence as published — which `published !== false` did —
 * is fail-open: on 2026-08-23 exactly one queued, unwritten-to-dev.to article
 * had no `published` key and was consequently live on the site, in the sitemap,
 * and indexable, days before its release slot.
 *
 * So absence defers to the fact rather than to an assumption. `devto_id` is
 * that fact — it is written back by the publisher and is the same signal
 * publish-next.ts trusts over graph status. An explicit flag still wins over
 * it in both directions, which keeps blog-only articles (`published: true`,
 * no dev.to copy) visible.
 */
export function isPublished(fm: ArticleFrontmatter): boolean {
  if (fm.published === false) return false;
  if (fm.published === true) return true;
  return fm.devto_id != null;
}

export function getAllArticles(): Article[] {
  const files = readdirSync(getArticlesDir()).filter((f) => f.endsWith(".md"));
  return files
    .map(loadArticle)
    .filter((a) => isPublished(a.frontmatter))
    .sort((a, b) => {
      const ad = a.frontmatter.published_at ?? "";
      const bd = b.frontmatter.published_at ?? "";
      return bd.localeCompare(ad);
    });
}

export function getArticleBySlug(slug: string): Article | null {
  try {
    return loadArticle(`${slug}.md`);
  } catch {
    return null;
  }
}

export function getAllArticleSlugs(): string[] {
  return readdirSync(getArticlesDir())
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.replace(/\.md$/, ""));
}

export interface SeriesNeighbor {
  slug: string;
  title: string;
}

export interface SeriesContext {
  name: string;
  /** 1-based position in reading order (oldest first). */
  index: number;
  total: number;
  prev: SeriesNeighbor | null;
  next: SeriesNeighbor | null;
  /** Every part in reading order — the expandable series list. */
  parts: SeriesNeighbor[];
}

/**
 * Series context for one article — 78 of 89 articles carry a `series`
 * frontmatter field, but until 2026-08-24 none of them linked to each
 * other: every article was a dead end and the series structure existed
 * only in frontmatter. Reading order is published_at ASCENDING (a series
 * is read oldest-first, unlike the index's newest-first).
 *
 * Pure over a caller-supplied corpus: getAllArticles() re-parses every
 * markdown file per call, so the corpus is loaded ONCE and threaded in —
 * both by the page and by tests iterating a whole series.
 */
export function buildSeriesContext(
  all: readonly Article[],
  slug: string,
): SeriesContext | null {
  const article = all.find((a) => a.slug === slug);
  const series = article?.frontmatter.series;
  if (!article || !series) return null;

  const members = all
    .filter((a) => a.frontmatter.series === series)
    .sort((a, b) => {
      const ad = a.frontmatter.published_at ?? "";
      const bd = b.frontmatter.published_at ?? "";
      // Slug as tie-breaker: without it, same-day articles keep the
      // caller's (newest-first) order — the reverse of reading order.
      return ad.localeCompare(bd) || a.slug.localeCompare(b.slug);
    });

  const index = members.findIndex((a) => a.slug === slug);
  if (index < 0) return null;

  const toNeighbor = (a: Article | undefined): SeriesNeighbor | null =>
    a ? { slug: a.slug, title: a.frontmatter.title } : null;

  return {
    name: series,
    index: index + 1,
    total: members.length,
    prev: toNeighbor(members[index - 1]),
    next: toNeighbor(members[index + 1]),
    parts: members.map((a) => ({ slug: a.slug, title: a.frontmatter.title })),
  };
}

// Production memo: SSG renders every article page in one build process, so
// without this the build does pages × files corpus parses (~7,900 reads at
// 89 articles). Dev stays un-memoized so content edits show without restart.
let corpusMemo: Article[] | null = null;
function getCorpus(): Article[] {
  if (process.env.NODE_ENV !== "production") return getAllArticles();
  return (corpusMemo ??= getAllArticles());
}

export function getSeriesContext(slug: string): SeriesContext | null {
  return buildSeriesContext(getCorpus(), slug);
}
