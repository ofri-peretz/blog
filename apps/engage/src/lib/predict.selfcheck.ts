/**
 * npx tsx src/lib/predict.selfcheck.ts
 * Locks: z-scored lever sum, percentile among the corpus, and that the top
 * suggestion is the edit the levers point at. Synthetic corpus, no network.
 */
import assert from "node:assert/strict";
import {
  model,
  parseDraft,
  percentile,
  predict,
  score,
  suggest,
  VISIBLE,
} from "./predict";
import { features, type ArticleIn, type Lever } from "./levers";

const art = (i: number, code: number, ai = false): ArticleIn => ({
  id: i,
  slug: `a${i}`,
  title: `Article ${i}`,
  published_at: "2026-08-03T12:00:00Z",
  reading_time_minutes: 4,
  tag_list: ai ? ["ai", "eslint"] : ["eslint"],
  body_markdown: "x ".repeat(100) + "```js\n```\n".repeat(code),
});
const corpus = Array.from({ length: 30 }, (_, i) => art(i, i % 6, i % 5 === 0));
const levers: Lever[] = [
  {
    feature: "code_blocks",
    kind: "number",
    outcome: "comments14",
    n: 30,
    r: 0.55,
    note: "",
  },
  {
    feature: "tag_ai",
    kind: "boolean",
    outcome: "comments14",
    n: 30,
    r: 0.48,
    note: "",
  },
  // Visible, but no article in this corpus has an image: sd 0, no weight.
  {
    feature: "images",
    kind: "number",
    outcome: "comments14",
    n: 30,
    r: 0.9,
    note: "",
  },
  // Below the threshold on n: must not steer.
  {
    feature: "title_has_colon",
    kind: "boolean",
    outcome: "comments14",
    n: 12,
    r: -0.7,
    note: "",
  },
];
assert.equal(levers.filter(VISIBLE).length, 3, "threshold");

const m = model(corpus, levers, "comments14");
// images has sd 0 in this corpus and title_has_colon fails n: only two weights.
assert.deepEqual(
  m.weights.map((w) => w.feature),
  ["code_blocks", "tag_ai"],
);
assert.equal(m.scores.length, 30);

const low = features(art(99, 0));
const high = features(art(98, 5, true));
assert.ok(
  score(m, low) < score(m, high),
  "more code and the ai tag score higher",
);
assert.ok(
  percentile(m, score(m, low)) < 20,
  `low draft is low: ${percentile(m, score(m, low))}`,
);
assert.ok(
  percentile(m, score(m, high)) >= 90,
  `high draft is high: ${percentile(m, score(m, high))}`,
);

const s = suggest(m, low);
assert.equal(s.length, 2);
// Gains are in z units, so a tag toggle (one step over sd 0.4) outranks one
// more code block (one step over sd 1.7). Both levers, both positive.
assert.deepEqual(
  new Set(s.map((x) => x.feature)),
  new Set(["code_blocks", "tag_ai"]),
  JSON.stringify(s),
);
assert.ok(s[0].gain > 0 && s[0].gain >= s[1].gain);
// Nothing left to gain on a draft already at the top on both levers? The code
// count can always rise, so exactly one suggestion survives.
assert.deepEqual(
  suggest(m, high).map((x) => x.feature),
  ["code_blocks"],
);

const p = predict(art(97, 1), [m]);
assert.equal(p.outcomes.comments14.levers, 2);
assert.ok(
  p.outcomes.comments14.percentile >= 0 &&
    p.outcomes.comments14.percentile <= 100,
);

// parseDraft is the only layer between files on disk and the model input.
const raw = `---
title: "The \"real\" deal: a title with quotes inside"
slug: "the-real-deal"
reading_time_minutes: 4
tags:
  - "ai"
  - security
  - "eslint"
series: null
---

Body text with a fence.

\`\`\`js
x
\`\`\`
`;
const d = parseDraft("the-real-deal", raw)!;
assert.equal(d.title, 'The \"real\" deal: a title with quotes inside');
assert.deepEqual(d.tag_list, ["ai", "security", "eslint"]);
assert.equal(d.reading_time_minutes, 4);
assert.ok((d.body_markdown ?? "").includes("```js"));
assert.equal(
  parseDraft("x", raw.replace("slug:", "devto_id: 123\nslug:")),
  null,
  "a devto_id is publication",
);
assert.equal(parseDraft("x", "no frontmatter"), null);
// Missing reading time: estimated from the body at 200 words a minute.
assert.equal(
  parseDraft("x", "---\ntitle: t\n---\n" + "word ".repeat(450))!
    .reading_time_minutes,
  2,
);
console.log("predict.selfcheck: ok");
