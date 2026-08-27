/**
 * Article-embed weave locks — the articles→Loom funnel's contracts.
 *
 * An embed is a claim inside a published article: its slug must name a
 * real article, its series must exist in the committed snapshot with
 * enough points to draw, and its permalink must be the SAME composition
 * the reader sees (one URL codec, round-tripped). A broken embed fails
 * HERE, before it silently vanishes from a page.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import loomEmbeds from "../data/loom-embeds.json";
import { LOOM_EMBEDS, type LoomEmbedSnapshot } from "../lib/loom-embeds";
import { parseLoomState, serializeLoomState } from "../lib/loom-url";

const snapshot = loomEmbeds as LoomEmbedSnapshot;
const ARTICLES = path.resolve(__dirname, "../../content/articles");
const read = (rel: string): string =>
  readFileSync(path.resolve(__dirname, "..", rel), "utf-8");

describe("every embed names a real article", () => {
  it.each(LOOM_EMBEDS.map((d) => d.slug))("%s.md exists", (slug) => {
    expect(existsSync(path.join(ARTICLES, `${slug}.md`))).toBe(true);
  });

  it("no article carries two embeds — one weave is a statement, two are noise", () => {
    const slugs = LOOM_EMBEDS.map((d) => d.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

describe("the snapshot can draw every definition", () => {
  it("has embeds to lock (non-vacuous)", () => {
    expect(LOOM_EMBEDS.length).toBeGreaterThanOrEqual(1);
  });

  it.each(LOOM_EMBEDS.flatMap((d) => d.state.series))(
    "%s is in the snapshot with enough points to draw",
    (id) => {
      const series = snapshot.series[id];
      expect(series).toBeTruthy();
      expect(series.points.length).toBeGreaterThanOrEqual(2);
    },
  );

  it("snapshot dates are ISO days and observedThrough is real", () => {
    expect(snapshot.observedThrough).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    for (const series of Object.values(snapshot.series)) {
      for (const point of series.points) {
        expect(point.t).toMatch(/^\d{4}-\d{2}-\d{2}/);
      }
    }
  });

  it("the snapshot carries only series a definition asked for — no payload creep", () => {
    const wanted = new Set(LOOM_EMBEDS.flatMap((d) => d.state.series));
    for (const id of Object.keys(snapshot.series)) {
      expect(wanted.has(id)).toBe(true);
    }
  });
});

describe("the permalink is the composition — one codec, round-tripped", () => {
  it.each(LOOM_EMBEDS.map((d) => [d.slug, d] as const))(
    "%s survives serialize → parse",
    (_slug, def) => {
      const ids = new Set(def.state.series);
      const qs = serializeLoomState(def.state);
      expect(parseLoomState(new URLSearchParams(qs), ids)).toEqual(def.state);
    },
  );
});

describe("the embed is wired, static, and tracked", () => {
  it("the article page renders ArticleWeave from the committed JSON", () => {
    const page = read("app/articles/[slug]/page.tsx");
    expect(page).toContain("<ArticleWeave");
    expect(page).toContain('from "@/data/loom-embeds.json"');
  });

  it("the component never fetches — the snapshot IS the data", () => {
    const component = read("components/article-weave.tsx");
    expect(component).not.toContain("fetch(");
    expect(component).not.toContain("supabase");
    expect(component).toContain('event="loom:embed_open"');
    // Same windowing/codec modules the composer uses — no forked math.
    expect(component).toContain('from "@/lib/loom-data"');
    expect(component).toContain("serializeLoomState");
  });

  it("the weekly refresh workflow runs the sync with the read-only key", () => {
    const workflow = readFileSync(
      path.resolve(__dirname, "../../../../.github/workflows/loom-embeds-refresh.yml"),
      "utf-8",
    );
    expect(workflow).toContain("sync-loom-embeds.mts");
    expect(workflow).toContain("SUPABASE_ANON_KEY");
    expect(workflow).toContain("schedule:");
  });
});
