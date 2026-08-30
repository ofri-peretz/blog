import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

import matter from "gray-matter";
// Stage-4 quality lock — the 9.5 publishing floor, enforced.
//
// Before this lock the floor lived in a Claude memory file, was applied by
// hand, in a different private repo, against a scorecard dated 2026-05-29.
// Measured 2026-08-30: 90 articles, 83 published, 0 carrying a score, and 29
// published since that scorecard. A standard only one person's session can
// see is a habit, not a standard.
//
// This is a RATCHET, not a cliff. Failing all 83 legacy articles on day one
// would get the lock reverted, so they are grandfathered in
// sdlc/baseline/unscored.json — a list that may only ever shrink.
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../../../..");
const ARTICLES = join(ROOT, "apps/blog/content/articles");
const BASELINE = join(ROOT, "sdlc/baseline/unscored.json");

const LENSES = [
  "growth_hook",
  "security_correctness",
  "structure_framing_voice",
  "compatibility",
  "reproducibility",
] as const;

const FLOOR = 9.5;

// Pinned so the ratchet cannot silently loosen. Growing the grandfathered set
// requires editing this number — a visible, reviewable act, which is the point.
const BASELINE_CEILING = 83;

type Article = {
  slug: string;
  file: string;
  data: Record<string, unknown>;
  published: boolean;
};

function articles(): Article[] {
  return readdirSync(ARTICLES)
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      const file = join(ARTICLES, f);
      const { data } = matter(readFileSync(file, "utf-8"));
      return {
        slug: (data.slug as string) || f.replace(/\.md$/, ""),
        file: `apps/blog/content/articles/${f}`,
        data,
        published: Boolean(data.devto_id),
      };
    });
}

const baseline = JSON.parse(readFileSync(BASELINE, "utf-8")) as {
  floor: number;
  unscored: string[];
};
const grandfathered = new Set(baseline.unscored);
const all = articles();
const published = all.filter((a) => a.published);

describe("stage 4 — the quality ratchet", () => {
  it("the baseline declares the same floor the lock enforces", () => {
    expect(baseline.floor).toBe(FLOOR);
  });

  it("the grandfathered set never grows", () => {
    // Shrinking is the only legal direction. Every removal is an article that
    // went through the chain and earned a score.
    expect(baseline.unscored.length).toBeLessThanOrEqual(BASELINE_CEILING);
  });

  it("the grandfathered set holds no duplicates", () => {
    expect(grandfathered.size).toBe(baseline.unscored.length);
  });

  it("every grandfathered slug is a real published article", () => {
    // Without this, the set could be padded with invented slugs to keep the
    // count under the ceiling while quietly exempting new work.
    const real = new Set(published.map((a) => a.slug));
    const phantom = baseline.unscored.filter((s) => !real.has(s));
    expect(
      phantom,
      `grandfathered slugs with no published article: ${phantom.join(", ")}`,
    ).toEqual([]);
  });

  it("no grandfathered article still carries a score", () => {
    // Once an article is scored it leaves the baseline. Leaving it in would
    // let a later regression below the floor go unnoticed.
    const stale = published
      .filter((a) => grandfathered.has(a.slug) && a.data.quality)
      .map((a) => a.slug);
    expect(
      stale,
      `scored but still grandfathered — remove from baseline: ${stale.join(", ")}`,
    ).toEqual([]);
  });
});

describe("stage 4 — no publish without a score", () => {
  it("every published article is either scored or grandfathered", () => {
    const offenders = published
      .filter((a) => !a.data.quality && !grandfathered.has(a.slug))
      .map((a) => a.file);
    expect(
      offenders,
      `published with no quality block and not grandfathered:\n  ${offenders.join("\n  ")}`,
    ).toEqual([]);
  });
});

describe("stage 4 — a score, where present, is complete and above the floor", () => {
  // Drafts are included: a draft that carries a score must carry a valid one.
  const scored = all.filter((a) => a.data.quality);

  it.each(
    scored.length
      ? scored.map((a) => [a.slug, a] as const)
      : [["(none scored yet)", null] as const],
  )("%s", (_slug, article) => {
    if (!article) return; // corpus not yet ratcheted; the gate above is what binds
    const q = article.data.quality as Record<string, unknown>;

    expect(q.panel_version, "quality.panel_version is required").toBeTruthy();
    expect(q.reviewed, "quality.reviewed is required").toBeTruthy();
    expect(q.spec, "quality.spec must point at the stage-2 spec").toBeTruthy();

    const lenses = q.lenses as Record<string, number> | undefined;
    expect(lenses, "quality.lenses is required").toBeTruthy();

    // Read through a Map: indexing a plain object with a loop variable is
    // exactly the shape our own detect-object-injection rule flags, and a
    // warning in the repo that publishes that rule is not a good look.
    const scores = new Map(Object.entries(lenses ?? {}));

    for (const lens of LENSES) {
      const score = scores.get(lens);
      expect(typeof score, `${article.slug}: lens "${lens}" is missing`).toBe(
        "number",
      );
      expect(
        score,
        `${article.slug}: lens "${lens}" scored ${score}, floor is ${FLOOR}`,
      ).toBeGreaterThanOrEqual(FLOOR);
    }

    const extra = [...scores.keys()].filter(
      (k) => !(LENSES as readonly string[]).includes(k),
    );
    expect(extra, `${article.slug}: unknown lens ${extra.join(", ")}`).toEqual(
      [],
    );
  });
});
