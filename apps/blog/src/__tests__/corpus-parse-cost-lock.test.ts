/**
 * Corpus parse cost lock
 *
 * The homepage parses the whole corpus on every ISR render, and readingTime()
 * dominated that parse. This pins: readingTime() runs only for articles that
 * do not declare reading_time_minutes.
 */

import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
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
const declares = (slug: string) =>
  matter(readFileSync(join(ARTICLES_DIR, `${slug}.md`), "utf-8")).data
    .reading_time_minutes != null;

describe("corpus parse cost", () => {
  const slugs = getAllArticleSlugs();
  const withValue = slugs.filter(declares);
  const omitted = slugs.length - withValue.length;

  it("does not compute reading time for articles that declare it", () => {
    expect(withValue.length).toBeGreaterThan(0);

    readingTimeSpy.mockClear();
    for (const slug of withValue) getArticleBySlug(slug);
    expect(readingTimeSpy).not.toHaveBeenCalled();
  });

  it("still computes reading time for articles that omit it", () => {
    readingTimeSpy.mockClear();
    for (const slug of slugs) {
      expect(getArticleBySlug(slug)?.readingTimeMinutes).toBeGreaterThan(0);
    }
    expect(readingTimeSpy).toHaveBeenCalledTimes(omitted);
  });
});
