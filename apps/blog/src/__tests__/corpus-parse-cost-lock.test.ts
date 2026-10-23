/**
 * Corpus parse cost lock
 *
 * The homepage calls getAllArticles() on every ISR render, and that parses
 * every markdown file to show six cards. readingTime() over each body was
 * ~90% of that parse, and most articles already carry reading_time_minutes,
 * so the result was thrown away. The homepage request p95 rose with that
 * render work (2026-10-23). This pins: readingTime() runs only for articles
 * that do not declare their reading time.
 */

import { describe, it, expect, vi } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import matter from "gray-matter";

import { getAllArticleSlugs, getArticleBySlug } from "@/lib/source";

const readingTimeSpy = vi.hoisted(() => vi.fn());
vi.mock("reading-time", async (importOriginal) => {
  const actual = await importOriginal<typeof import("reading-time")>();
  readingTimeSpy.mockImplementation(actual.default);
  return { default: readingTimeSpy };
});

const ARTICLES_DIR = resolve(__dirname, "../../content/articles");
const declared = (file: string) =>
  matter(readFileSync(join(ARTICLES_DIR, file), "utf-8")).data
    .reading_time_minutes != null;

describe("corpus parse cost", () => {
  const files = readdirSync(ARTICLES_DIR).filter((f) => f.endsWith(".md"));

  it("does not compute reading time for articles that declare it", () => {
    const withValue = files.filter(declared);
    expect(withValue.length).toBeGreaterThan(0);

    readingTimeSpy.mockClear();
    for (const file of withValue) getArticleBySlug(file.replace(/\.md$/, ""));
    expect(readingTimeSpy).not.toHaveBeenCalled();
  });

  it("still computes reading time for articles that omit it", () => {
    readingTimeSpy.mockClear();
    const slugs = getAllArticleSlugs();
    for (const slug of slugs) {
      const article = getArticleBySlug(slug);
      expect(article?.readingTimeMinutes).toBeGreaterThan(0);
    }
    expect(readingTimeSpy).toHaveBeenCalledTimes(
      files.filter((f) => !declared(f)).length,
    );
  });
});
