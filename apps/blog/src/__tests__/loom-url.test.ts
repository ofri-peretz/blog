/**
 * Loom URL grammar — every weave is a permalink, so the codec IS the
 * feature. Two contracts:
 *
 *  1. Round-trip: serialize(parse(x)) reproduces x for valid states,
 *     and the default state serializes to the bare URL.
 *  2. Tolerance: a permalink from an older catalog (renamed ids,
 *     removed series, hand-edited garbage) degrades to a working page,
 *     never a crash and never an empty loom.
 */
import { describe, expect, it } from "vitest";

import {
  LOOM_DEFAULT,
  LOOM_PRESETS,
  MAX_THREADS,
  parseLoomState,
  serializeLoomState,
} from "../lib/loom-url";

const IDS = new Set([
  "npm:total",
  "npm:eslint-plugin-jwt",
  "github:stars",
  "site:page-views",
  "devto:views",
  "devto:comments-left",
  "github:external-prs",
  "github:downloads-per-star",
]);

const parse = (qs: string) => parseLoomState(new URLSearchParams(qs), IDS);

describe("round-trip", () => {
  it("a composed state survives serialize → parse", () => {
    const state = {
      series: ["github:stars", "devto:views"],
      form: "grid",
      window: "90d",
      normalize: "idx",
    } as const;
    expect(parse(serializeLoomState(state))).toEqual(state);
  });

  it("the default state serializes to the bare URL", () => {
    expect(serializeLoomState(LOOM_DEFAULT)).toBe("");
  });

  it("the radial poster form round-trips like any other", () => {
    const state = {
      series: ["npm:total"],
      form: "radial",
      window: "1y",
      normalize: "abs",
    } as const;
    expect(parse(serializeLoomState(state))).toEqual(state);
    expect(parse("form=radial").form).toBe("radial");
  });

  it("a single non-default field serializes alone", () => {
    expect(serializeLoomState({ ...LOOM_DEFAULT, window: "90d" })).toBe(
      "win=90d",
    );
  });

  it("series order is preserved — the first thread is the primary", () => {
    const state = parse("s=devto:views,npm:total");
    expect(state.series).toEqual(["devto:views", "npm:total"]);
  });
});

describe("tolerance", () => {
  it("unknown ids are dropped; survivors keep the weave", () => {
    expect(parse("s=npm:total,npm:renamed-away").series).toEqual(["npm:total"]);
  });

  it("all-unknown series fall back to the default weave, never zero", () => {
    expect(parse("s=gone:1,gone:2").series).toEqual(LOOM_DEFAULT.series);
  });

  it("duplicates are deduped", () => {
    expect(parse("s=npm:total,npm:total").series).toEqual(["npm:total"]);
  });

  it(`series are capped at ${MAX_THREADS}`, () => {
    const qs = `s=${[...IDS].join(",")}`;
    expect(parse(qs).series).toHaveLength(MAX_THREADS);
  });

  it("garbage enum values fall back to defaults", () => {
    const state = parse("form=pie&win=5min&norm=log");
    expect(state.form).toBe(LOOM_DEFAULT.form);
    expect(state.window).toBe(LOOM_DEFAULT.window);
    expect(state.normalize).toBe(LOOM_DEFAULT.normalize);
  });

  it("an empty query IS the default state", () => {
    expect(parse("")).toEqual(LOOM_DEFAULT);
  });
});

describe("presets", () => {
  it("every preset id is unique (analytics segments on them)", () => {
    const ids = LOOM_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every preset stays within the thread cap", () => {
    for (const preset of LOOM_PRESETS) {
      expect(preset.state.series.length).toBeLessThanOrEqual(MAX_THREADS);
    }
  });
});
