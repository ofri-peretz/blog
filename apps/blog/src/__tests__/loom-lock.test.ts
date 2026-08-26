/**
 * Loom structural locks — 2026-08-26.
 *
 * The Loom's promises are architectural, not visual: visitors never
 * cost an upstream query, permalinks SSR their exact weave, internal
 * Supabase series never leak into the public payload, and the vendored
 * chart stack stays under drift watch. None of that is visible in a
 * screenshot, so each promise is pinned to the source that keeps it.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (rel: string): string =>
  readFileSync(path.resolve(__dirname, "..", rel), "utf-8");

const CORPUS = read("lib/loom-corpus.ts");
const PAGE = read("app/loom/page.tsx");
const COMPOSER = read("components/loom/loom-composer.tsx");
const HEADER = read("components/app-header.tsx");
const SITEMAP = read("app/sitemap.ts");
const GLOBALS = read("app/globals.css");
const URL_MODULE = read("lib/loom-url.ts");
const DRIFT = readFileSync(
  path.resolve(__dirname, "../../../..", "scripts/check-vendored-drift.mjs"),
  "utf-8",
);

describe("quota safety — visitors never touch an upstream API", () => {
  it("the corpus is assembled inside unstable_cache on the ratchet channel", () => {
    expect(CORPUS).toContain("unstable_cache(");
    expect(CORPUS).toContain("TAG_RATCHET");
    expect(CORPUS).toContain("TWELVE_HOURS_SECONDS");
  });

  it("the corpus module is server-only — no client bundle can import the client", () => {
    expect(CORPUS).toContain('import "server-only";');
  });

  it("a missing client throws (never caches emptiness) — the /npm lesson", () => {
    expect(CORPUS).toContain("requireClient(");
  });

  it("the composer recomposes client-side — no fetch anywhere in it", () => {
    expect(COMPOSER).not.toContain("fetch(");
    expect(COMPOSER).not.toContain("supabase");
  });
});

describe("no internal series leak", () => {
  it("metric_snapshots is read through enumerated source+kind picks", () => {
    expect(CORPUS).toContain('.in("source"');
    expect(CORPUS).toContain('.in("kind"');
  });

  it("the pick list stays clear of internal sources", () => {
    for (const internal of ["devto-intel", "codecov-health", "github-config"]) {
      expect(CORPUS).not.toContain(`"${internal}"`);
    }
  });
});

describe("permalinks SSR their weave", () => {
  it("the page is force-dynamic (build has no Supabase creds — /npm doctrine)", () => {
    expect(PAGE).toContain('export const dynamic = "force-dynamic"');
  });

  it("the page parses searchParams into the composer's initial state", () => {
    expect(PAGE).toContain("parseLoomState(");
    expect(PAGE).toContain("getCachedLoomCorpus()");
    expect(PAGE).toContain("initialState={initialState}");
  });

  it("state changes mirror into the URL without a navigation", () => {
    expect(COMPOSER).toContain("history.replaceState");
  });

  it("back/forward re-parse the URL", () => {
    expect(COMPOSER).toContain('addEventListener("popstate"');
  });
});

describe("preset ids exist in the catalog the corpus emits", () => {
  // The corpus is runtime data, but every preset id is either a literal
  // in loom-corpus.ts (fixed catalog ids) or the npm total — so a
  // catalog rename must break HERE before it breaks a shipped preset.
  const presetIds = [...URL_MODULE.matchAll(/series: \[([^\]]*)\]/g)]
    .flatMap((m) => m[1].split(","))
    .map((s) => s.trim().replace(/["']/g, ""))
    .filter(Boolean);

  it("collected preset series ids from loom-url.ts (non-vacuous)", () => {
    expect(presetIds.length).toBeGreaterThanOrEqual(5);
  });

  it.each([...new Set(presetIds)])("%s is a catalog id literal", (id) => {
    expect(CORPUS).toContain(`"${id}"`);
  });
});

describe("the loom is reachable and drawable", () => {
  it("primary nav links to /loom", () => {
    expect(HEADER).toContain('href: "/loom"');
  });

  it("the sitemap lists /loom", () => {
    expect(SITEMAP).toContain("/loom`");
  });

  it("viz chrome tokens exist — without them the chart grid paints nothing", () => {
    for (const token of [
      "--color-viz-grid",
      "--color-viz-axis",
      "--color-viz-crosshair",
    ]) {
      expect(GLOBALS).toContain(token);
    }
  });
});

describe("vendored chart stack stays under drift watch", () => {
  const VENDORED_FILES = [
    "components/ui/time-series.tsx",
    "components/ui/series-table.tsx",
    "components/ui/scale.ts",
    "components/ui/data-state.tsx",
    "components/ui/data-state-model.ts",
  ];

  it.each(VENDORED_FILES)("%s is registered in check-vendored-drift", (f) => {
    expect(DRIFT).toContain(`"${f}"`);
  });

  it.each(VENDORED_FILES)("%s carries the provenance header", (f) => {
    expect(read(f)).toContain("VENDORED from the Interlace DS");
  });
});
