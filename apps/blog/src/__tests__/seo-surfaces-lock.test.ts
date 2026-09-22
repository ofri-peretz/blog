/**
 * SEO / answer-engine surfaces lock — sitemap, llms.txt projects, JSON-LD.
 *
 * Three regressions this pins, all found on 2026-09-22:
 *
 *  1. sitemap.ts listed /stats and /analytics — both permanent redirects to
 *     /scorecard in next.config.ts — and omitted /scorecard, /npm and
 *     /foundations. Crawlers were handed two 301s and not the pages they
 *     resolve to. A sitemap entry must be a page the app serves.
 *
 *  2. llms.txt described the site as ESLint-only. An agent asked what the
 *     author builds had no line to quote about anything else.
 *
 *  3. The site Person had no @id, and every BlogPosting declared its own
 *     anonymous Person — so nothing tied the articles to one author entity.
 *     Article pages also had no BreadcrumbList, and series membership lived
 *     only in frontmatter.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import sitemap from "@/app/sitemap";
import { GET as llmsTxt } from "@/app/llms.txt/route";
import { articleJsonLd, PERSON_ID, SITE_URL } from "@/lib/article-jsonld";
import { getAllArticles, type ArticleFrontmatter } from "@/lib/source";

const PROJECT_ROOT = resolve(__dirname, "../..");
const APP_DIR = join(PROJECT_ROOT, "src", "app");

/**
 * Redirect sources declared in next.config.ts, read from source. Scoped to
 * the redirects() body: headers() and rewrites() use the same `source:` key,
 * and /articles is a headers() source, not a redirect.
 */
function redirectSources(): Set<string> {
  const config = readFileSync(join(PROJECT_ROOT, "next.config.ts"), "utf-8");
  const start = config.indexOf("async redirects()");
  expect(start, "redirects() not found in next.config.ts").toBeGreaterThan(-1);
  const rest = config.slice(start + 1);
  const next = rest.search(/\basync \w+\(\)/);
  const block = next === -1 ? rest : rest.slice(0, next);
  return new Set([...block.matchAll(/source:\s*"([^"]+)"/g)].map((m) => m[1]));
}

describe("sitemap", () => {
  const staticPaths = sitemap()
    .map((e) => new URL(String(e.url)).pathname)
    .filter((p) => !p.startsWith("/articles/"));

  it("lists no URL that the site answers with a redirect", () => {
    const redirects = redirectSources();
    // Guard against the parse silently matching nothing — then this test
    // would pass for any sitemap at all.
    expect(redirects.has("/stats")).toBe(true);
    const offenders = sitemap()
      .map((e) => new URL(String(e.url)).pathname)
      .filter((p) => redirects.has(p));
    expect(offenders, `sitemap lists redirect sources: ${offenders}`).toEqual(
      [],
    );
  });

  it("every static entry is a page the app actually has", () => {
    for (const path of staticPaths) {
      const page = join(APP_DIR, path === "/" ? "" : path, "page.tsx");
      expect(
        existsSync(page),
        `sitemap lists ${path} but ${page} is missing`,
      ).toBe(true);
    }
  });

  it("includes the canonical metrics and series pages", () => {
    for (const path of ["/scorecard", "/npm", "/foundations"]) {
      expect(staticPaths, `sitemap omits ${path}`).toContain(path);
    }
  });
});

describe("llms.txt projects", () => {
  it("names every project, not only the ESLint ecosystem", async () => {
    const txt = await llmsTxt().text();
    const projects = txt.split("## Projects")[1]?.split("\n## ")[0] ?? "";
    expect(projects, "no ## Projects section").not.toBe("");
    expect(projects).toContain("https://github.com/ofri-peretz/eslint");
    expect(projects).toContain(
      "[burgee](https://github.com/ofri-peretz/burgee)",
    );
    expect(projects).toContain("https://burgee.interlace.tools");
    expect(projects).toMatch(/drop-in for commander and yargs/);
  });

  it("keeps the article index it had before", async () => {
    const txt = await llmsTxt().text();
    expect(txt).toContain("## Articles");
    expect(txt).toContain("## Feeds");
  });
});

describe("JSON-LD", () => {
  const layoutSchemas = readFileSync(
    join(PROJECT_ROOT, "src", "components", "structured-data.tsx"),
    "utf-8",
  );

  it("the site Person carries the @id everything else points at", () => {
    expect(PERSON_ID).toBe(`${SITE_URL}/#person`);
    expect(layoutSchemas).toContain('"@id": PERSON_ID');
    // No anonymous Person left behind in the site-wide schemas.
    expect(layoutSchemas).not.toMatch(/author:\s*\{\s*"@type":\s*"Person"/);
  });

  const base: ArticleFrontmatter = {
    title: "A title",
    description: "A description",
    tags: ["eslint"],
    published_at: "2026-09-01T00:00:00Z",
  };
  const url = `${SITE_URL}/articles/a-title`;
  const image = `${SITE_URL}/cdn/blog-cover-image/a-title.jpg`;

  it("BlogPosting.author and publisher reference the site Person by @id", () => {
    const [post] = articleJsonLd({ fm: base, url, image });
    expect(post["@type"]).toBe("BlogPosting");
    expect((post.author as Record<string, unknown>)["@id"]).toBe(PERSON_ID);
    expect((post.publisher as Record<string, unknown>)["@id"]).toBe(PERSON_ID);
  });

  it("does not claim a guest byline is the site author", () => {
    const [post] = articleJsonLd({
      fm: { ...base, author: { name: "Someone Else" } },
      url,
      image,
    });
    expect((post.author as Record<string, unknown>)["@id"]).toBeUndefined();
    expect((post.author as Record<string, unknown>).name).toBe("Someone Else");
  });

  it("emits a three-level BreadcrumbList ending at the article", () => {
    const crumbs = articleJsonLd({ fm: base, url, image }).find(
      (s) => s["@type"] === "BreadcrumbList",
    );
    expect(crumbs).toBeDefined();
    const items = crumbs!.itemListElement as Record<string, unknown>[];
    expect(items.map((i) => i.position)).toEqual([1, 2, 3]);
    expect(items.map((i) => i.item)).toEqual([
      SITE_URL,
      `${SITE_URL}/articles`,
      url,
    ]);
    expect(items[2].name).toBe(base.title);
  });

  it("isPartOf appears exactly when the article has a series", () => {
    const [none] = articleJsonLd({ fm: { ...base, series: null }, url, image });
    expect(none.isPartOf).toBeUndefined();
    const [inSeries] = articleJsonLd({
      fm: { ...base, series: "Foundations" },
      url,
      image,
    });
    expect(inSeries.isPartOf).toEqual({
      "@type": "CreativeWorkSeries",
      name: "Foundations",
    });
  });

  it("holds for the real corpus, not only fixtures", () => {
    const corpus = getAllArticles();
    expect(corpus.some((a) => a.frontmatter.series)).toBe(true);
    for (const a of corpus) {
      const [post] = articleJsonLd({
        fm: a.frontmatter,
        url: `${SITE_URL}/articles/${a.slug}`,
        image,
      });
      expect(Boolean(post.isPartOf), a.slug).toBe(
        Boolean(a.frontmatter.series),
      );
    }
  });

  it("the article page renders the helper's output, not a hand-rolled copy", () => {
    const page = readFileSync(
      join(APP_DIR, "articles", "[slug]", "page.tsx"),
      "utf-8",
    );
    expect(page).toContain("articleJsonLd(");
    expect(page).not.toContain('"@type": "BlogPosting"');
  });
});
