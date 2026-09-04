/** Self-check for levers.ts — `npx tsx src/lib/levers.selfcheck.ts`. */
import assert from "node:assert/strict";
import { spearman, outcome14, features, levers } from "./levers";
assert.equal(spearman([1, 2, 3, 4], [10, 20, 30, 40]), 1, "monotone up is 1");
assert.equal(spearman([1, 2, 3, 4], [40, 30, 20, 10]), -1, "monotone down is -1");
assert.ok(Math.abs(spearman([1, 2, 2, 4], [1, 3, 3, 4])!) > 0.9, "ties get average ranks");
assert.equal(spearman([1, 1, 1], [1, 2, 3]), null, "no variance is null, not 0");
const a = { id: 1, slug: "s", title: "I Ran 3 Things: A Question?", published_at: "2026-06-01T15:00:00Z", reading_time_minutes: 5, tag_list: ["ai", "security"], body_markdown: "x ```a``` y ![i](u) z" };
const f = features(a);
assert.equal(f.title_has_number, true); assert.equal(f.title_is_question, true); assert.equal(f.title_first_person, true); assert.equal(f.tag_ai, true); assert.equal(f.code_blocks, 1); assert.equal(f.images, 1);
const snaps = [
  { external_id: "s", observed_on: "2026-06-01", views: 10, comments: 0 },
  { external_id: "s", observed_on: "2026-06-08", views: 60, comments: 2 },
  { external_id: "s", observed_on: "2026-06-15", views: 90, comments: 3 },
  { external_id: "s", observed_on: "2026-06-30", views: 200, comments: 9 },
];
assert.deepEqual(outcome14(a, snaps), { views14: 80, comments14: 3 }, "day-14 minus day-0, not lifetime");
assert.deepEqual(outcome14({ ...a, published_at: "2026-05-01T00:00:00Z" }, snaps), { views14: null, comments14: null }, "coverage that starts a month after publish is not a window");
// A fixture where code blocks perfectly rank 14-day views: the lever must come out at r = 1 with n = 25.
{
  const arts = [] as any[]; const sn = [] as any[];
  for (let i = 0; i < 25; i++) {
    const slug = `f${i}`;
    arts.push({ id: 100 + i, slug, title: `t${i}`, published_at: "2026-06-01T12:00:00Z", body_markdown: "```x```\n".repeat(i), page_views_count: 0 });
    sn.push({ external_id: slug, observed_on: "2026-06-01", views: 0, comments: 0 }, { external_id: slug, observed_on: "2026-06-15", views: i * 10, comments: 0 });
  }
  const lever = levers(arts, sn).find((l) => l.feature === "code_blocks" && l.outcome === "views14");
  assert.ok(lever, "the code_blocks × views14 lever exists");
  assert.equal(lever!.n, 25);
  assert.equal(lever!.r, 1, "perfect monotone fixture scores r = 1");
}
assert.equal(features({ ...a, body_markdown: "```open" }).code_blocks, 0, "an unclosed fence is not half a block");
console.log("levers.selfcheck: ok");
