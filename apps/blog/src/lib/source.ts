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
  published?: boolean;
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
    published: fm.published !== false,
    published_at: fm.published_at as string | undefined,
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

export function getAllArticles(): Article[] {
  const files = readdirSync(getArticlesDir()).filter((f) => f.endsWith(".md"));
  return files
    .map(loadArticle)
    .filter((a) => a.frontmatter.published !== false)
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
