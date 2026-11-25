import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

import matter from "gray-matter";
// Article frontmatter, enforced. The write-an-article skill used to list these
// fields as prose an agent had to remember; the list now lives here, and the
// failure names the article and the missing field. Every article's `tier`
// must be a known tier. Every scored article (the ones through the SDLC
// chain) must carry the full required set; the legacy corpus is the same
// intent I-7 ratchet the quality lock uses. The devto_* and published_at
// fields are written by publish-to-devto.mjs, so they are not listed here.
import { describe, expect, it } from "vitest";

const ARTICLES = resolve(__dirname, "../../content/articles");

export const TIERS = ["T0", "T1", "T2", "T3", "TOPIC", "TUTORIAL"] as const;
export const REQUIRED = [
  "title",
  "description",
  "slug",
  "canonical_url",
  "tier",
  "cover_image",
  "social_image",
  "reading_time_minutes",
  "tags",
] as const;

const all = readdirSync(ARTICLES)
  .filter((f) => f.endsWith(".md"))
  .map((f) => ({
    name: f,
    data: matter(readFileSync(join(ARTICLES, f), "utf-8")).data as Record<
      string,
      unknown
    >,
  }));

describe("article frontmatter", () => {
  it("reads the corpus", () => {
    expect(all.length).toBeGreaterThan(0);
  });

  it("every article's tier is a known tier", () => {
    const tiers = new Set<string>(TIERS);
    const offenders = all
      .filter((a) => !tiers.has(String(a.data.tier)))
      .map((a) => `${a.name}: tier ${String(a.data.tier)}`);
    expect(
      offenders,
      `tier must be one of ${TIERS.join(" ")}:\n  ${offenders.join("\n  ")}`,
    ).toEqual([]);
  });

  it("every scored article carries the required fields", () => {
    const fields = new Map<string, unknown>();
    const offenders: string[] = [];
    for (const a of all.filter((x) => x.data.quality)) {
      fields.clear();
      for (const [k, v] of Object.entries(a.data)) fields.set(k, v);
      for (const key of REQUIRED) {
        const value = fields.get(key);
        if (value === undefined || value === null || value === "")
          offenders.push(`${a.name}: ${key}`);
      }
    }
    expect(
      offenders,
      `scored articles missing required frontmatter:\n  ${offenders.join("\n  ")}`,
    ).toEqual([]);
  });

});
