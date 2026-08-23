/**
 * RSS feed + draft-exposure lock
 *
 * Two regressions this pins, both found live on 2026-08-23:
 *
 *  1. sitemap.ts used getAllArticleSlugs(), which reads the articles directory
 *     and filters NOTHING. Three articles still sitting at `status: ready` in
 *     the release queue were listed in the public sitemap, and their pages
 *     returned 200 — the queue was crawlable days before it shipped.
 *
 *  2. The feed did not exist. Now that it does, it must never become the new
 *     leak: it derives from getAllArticles(), the same published-only view the
 *     site uses, so feed and site cannot disagree about what is published.
 *
 * Draft PAGES stay reachable deliberately — dev.to's canonical_url points at
 * this site, so the URL has to resolve the moment the publisher fires. The
 * contract is "reachable but unindexed", which is why the noindex assertion
 * below matters as much as the exclusion ones.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import matter from "gray-matter";

import { isPublished } from "@/lib/source";
import { GET } from "@/app/rss.xml/route";
import sitemap from "@/app/sitemap";
import { generateMetadata } from "@/app/articles/[slug]/page";

const PROJECT_ROOT = resolve(__dirname, "../..");
const ARTICLES_DIR = join(PROJECT_ROOT, "content", "articles");

/**
 * Unreleased articles, by the SHIPPED definition — not a re-implementation.
 * A test that re-derives the rule cannot catch the rule being wrong; it can
 * only catch the two copies drifting apart.
 */
function partitionSlugs(): { drafts: string[]; live: string[] } {
  const drafts: string[] = [];
  const live: string[] = [];
  for (const f of readdirSync(ARTICLES_DIR).filter((x) => x.endsWith(".md"))) {
    const data = matter(readFileSync(join(ARTICLES_DIR, f), "utf-8")).data;
    const slug = f.replace(/\.md$/, "");
    (isPublished(data as never) ? live : drafts).push(slug);
  }
  return { drafts, live };
}

const unpublishedSlugs = (): string[] => partitionSlugs().drafts;

async function feedXml(): Promise<string> {
  return await GET().text();
}

describe("rss feed", () => {
  it("is well-formed: every & is an entity", async () => {
    const xml = await feedXml();
    // A single raw ampersand makes the whole document unparseable and readers
    // reject the ENTIRE feed, not just the offending item.
    const raw = xml.match(/&(?!(amp|lt|gt|quot|apos);)/g);
    expect(raw, `unescaped & in feed: ${raw?.slice(0, 3)}`).toBeNull();
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain("<atom:link");
  });

  it("escapes markup metacharacters in interpolated values", async () => {
    const xml = await feedXml();
    // Between </title> and the next <link> there must be no stray tag-opener
    // that came from article text rather than from this template.
    for (const [, title] of xml.matchAll(/<title>([\s\S]*?)<\/title>/g)) {
      expect(title).not.toMatch(/<[a-zA-Z/]/);
    }
  });

  it("has at least one item and they are real article URLs", async () => {
    const xml = await feedXml();
    const items = [...xml.matchAll(/<item>/g)];
    expect(items.length).toBeGreaterThan(0);
    expect(xml).toContain("https://ofriperetz.dev/articles/");
  });

  it("excludes every unpublished article", async () => {
    const xml = await feedXml();
    for (const slug of unpublishedSlugs()) {
      expect(xml, `queued draft leaked into the feed: ${slug}`).not.toContain(
        `/articles/${slug}<`,
      );
    }
  });
});

describe("draft exposure", () => {
  it("keeps unpublished articles out of the sitemap", () => {
    const urls = sitemap().map((e) => String(e.url));
    for (const slug of unpublishedSlugs()) {
      expect(
        urls.some((u) => u.endsWith(`/articles/${slug}`)),
        `queued draft leaked into the sitemap: ${slug}`,
      ).toBe(false);
    }
  });

  it("still lists published articles in the sitemap", () => {
    const urls = sitemap().map((e) => String(e.url));
    expect(urls.some((u) => u.includes("/articles/"))).toBe(true);
  });

  it("marks unpublished article pages noindex, and published ones indexable", async () => {
    const drafts = unpublishedSlugs();
    if (drafts.length > 0) {
      const meta = await generateMetadata({
        params: Promise.resolve({ slug: drafts[0] }),
      });
      expect(meta.robots).toEqual({ index: false, follow: false });
      // The page must still resolve — dev.to's canonical points at it.
      expect(meta.alternates?.canonical).toBeTruthy();
    }

    const published = partitionSlugs().live;
    expect(published.length).toBeGreaterThan(0);
    const liveMeta = await generateMetadata({
      params: Promise.resolve({ slug: published[0] }),
    });
    expect(liveMeta.robots).toBeUndefined();
  });
});

describe("feed discoverability", () => {
  it("advertises the feed via <link rel=alternate> in <head>", () => {
    // Asserted against layout.tsx SOURCE, not by importing it: layout.tsx
    // pulls a "#interlace/*" subpath alias that vitest's resolver does not
    // handle, and adding that alias to the shared vitest config to satisfy
    // one assertion is a worse trade than reading the file.
    //
    // robots.txt has no field for a feed — this head link is the only
    // mechanism readers and aggregators use to find one. A feed that exists
    // but is unlisted is a feed nothing subscribes to.
    const layout = readFileSync(
      join(PROJECT_ROOT, "src", "app", "layout.tsx"),
      "utf-8",
    );
    expect(
      layout,
      "no application/rss+xml alternate in root metadata",
    ).toContain('"application/rss+xml"');
    expect(layout).toContain("/rss.xml");
  });
});
