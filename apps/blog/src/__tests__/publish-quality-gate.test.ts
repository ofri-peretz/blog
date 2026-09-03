/**
 * The publish gate — exercised, not described.
 *
 * `sdlc-quality-lock` already asserts that a published article carries a score.
 * It cannot PREVENT a publish: it reads `devto_id`, which lands in the repo
 * after dev.to has accepted the post. On 2026-09-02 an unscored article went
 * live and main stayed green for a day.
 *
 * So this file tests the gate that runs before the API call, and it CALLS it
 * rather than grepping for it — the distinction the behavioural-claims audit
 * settled on. The two assertions that legitimately read source text are the
 * wiring ones, and they say "is wired", not "fires".
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

import matter from "gray-matter";
import { describe, expect, it } from "vitest";

import {
  refusalMessage,
  unscoredOffenders,
} from "../../scripts/quality-gate.mjs";

const ROOT = resolve(__dirname, "../../../..");
// Enough of the file after the gate call to contain its handling, and enough
// articles that the corpus read cannot have silently found nothing.
const HANDLER_WINDOW = 400;
const MIN_CORPUS = 50;
const SCRIPT = readFileSync(
  join(ROOT, "apps/blog/scripts/publish-to-devto.mjs"),
  "utf-8",
);
const BASELINE = JSON.parse(
  readFileSync(join(ROOT, "sdlc/baseline/unscored.json"), "utf-8"),
) as { unscored: string[] };

const scored = {
  slug: "has-a-score",
  frontmatter: { quality: { panel_version: "1.0.0" } },
};
const bare = { slug: "no-score-at-all", frontmatter: {} };
const legacy = { slug: BASELINE.unscored[0], frontmatter: {} };

describe("unscoredOffenders", () => {
  it("refuses an article with no quality block", () => {
    expect(unscoredOffenders([bare], [])).toEqual(["no-score-at-all"]);
  });

  it("passes an article that carries a quality block", () => {
    expect(unscoredOffenders([scored], [])).toEqual([]);
  });

  it("passes a grandfathered slug, and only because it is grandfathered", () => {
    expect(unscoredOffenders([legacy], BASELINE.unscored)).toEqual([]);
    // The same article, with the exemption withdrawn, is refused. Without this
    // the test above would pass just as well if the function returned [] always.
    expect(unscoredOffenders([legacy], [])).toEqual([legacy.slug]);
  });

  it("names every offender, not just the first", () => {
    expect(unscoredOffenders([bare, scored, legacy], [])).toEqual([
      "no-score-at-all",
      legacy.slug,
    ]);
  });

  it("treats a missing frontmatter object as unscored rather than crashing", () => {
    // getLocalArticles builds frontmatter from a hand-rolled parser that
    // returns {} on a malformed head. Unparseable must fail closed.
    expect(
      unscoredOffenders([{ slug: "malformed", frontmatter: undefined }], []),
    ).toEqual(["malformed"]);
  });
});

describe("the refusal tells the operator what to do", () => {
  const msg = refusalMessage(["some-slug"]);

  it("names the offending slug", () => {
    expect(msg).toContain("some-slug");
  });

  it("closes the wrong door explicitly", () => {
    // The tempting fix is to append the slug to the baseline. Saying so in the
    // error is cheaper than discovering it in review.
    expect(msg).toMatch(/NOT the fix/);
    expect(msg).toMatch(/may only ever shrink/);
  });
});

describe("the publish script is wired to the gate", () => {
  it("imports it", () => {
    expect(SCRIPT).toMatch(
      /import \{[^}]*unscoredOffenders[^}]*\} from "\.\/quality-gate\.mjs"/,
    );
  });

  it("calls it BEFORE it reaches dev.to", () => {
    // Ordering is the whole point: a gate that runs after the POST is the
    // situation this replaced.
    // The CALL SITE, not the declaration — `fetchExistingArticles` is defined
    // near the top of the file, so indexing on the bare name compares against
    // the wrong position and passes for the wrong reason. (Caught by this test
    // failing on its first run, which is the only reason it is worth writing.)
    const gate = SCRIPT.indexOf("unscoredOffenders(");
    const network = SCRIPT.indexOf("await fetchExistingArticles()");
    expect(gate, "the gate call is missing").toBeGreaterThan(-1);
    expect(network, "the network call site is missing").toBeGreaterThan(-1);
    expect(gate).toBeLessThan(network);
  });

  it("exits non-zero rather than warning", () => {
    const after = SCRIPT.slice(SCRIPT.indexOf("unscoredOffenders("));
    expect(after.slice(0, HANDLER_WINDOW)).toMatch(/process\.exit\(1\)/);
  });
});

describe("the gate, against the real corpus", () => {
  const dir = join(ROOT, "apps/blog/content/articles");
  const corpus = readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      const { data } = matter(readFileSync(join(dir, f), "utf-8"));
      return {
        slug: (data.slug as string) || f.replace(/\.md$/, ""),
        frontmatter: data as Record<string, unknown>,
        published: Boolean(data.devto_id),
      };
    });
  const refused = new Set(unscoredOffenders(corpus, BASELINE.unscored));

  it("reads a corpus at all", () => {
    expect(corpus.length).toBeGreaterThan(MIN_CORPUS);
  });

  it("never refuses an article that is already live", () => {
    // Updating a published post must keep working. If the gate and the lock
    // ever disagree about the published corpus, one of them is wrong about
    // what may ship — and this is the assertion that says which.
    const live = corpus.filter((a) => a.published && refused.has(a.slug));
    expect(
      live.map((a) => a.slug),
      "the gate would block an update to a live article",
    ).toEqual([]);
  });

  it("refuses exactly the unscored drafts — so a whole-corpus publish exits 1", () => {
    // The gate is deliberately STRICTER than sdlc-quality-lock, which only
    // judges articles already carrying a devto_id. A draft's first publish is
    // precisely the moment a score has to exist, and it is the moment the lock
    // structurally cannot see.
    const unscoredDrafts = corpus
      .filter((a) => !a.published && !a.frontmatter.quality)
      .map((a) => a.slug);
    expect([...refused].sort()).toEqual([...unscoredDrafts].sort());
  });
});
