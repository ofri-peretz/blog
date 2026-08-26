import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { buildSearchDocs, searchHaystack } from "../lib/search-docs";
import type { Article } from "../lib/source";

/**
 * Grep-the-corpus locks — the ⌘K palette stays reachable, searchable
 * beyond titles, accessible, and drift-tracked.
 */

const read = (rel: string): string =>
  readFileSync(path.resolve(__dirname, "..", rel), "utf-8");

const article = (over: Partial<Article["frontmatter"]> = {}): Article => ({
  slug: "pool-exhaustion",
  body: "",
  readingTimeMinutes: 7,
  frontmatter: {
    title: "Transaction race conditions begin on pool",
    description: "",
    tags: ["postgresql", "eslint"],
    series: "Postgres Security",
    ...over,
  },
});

describe("search docs (the grep index)", () => {
  it("maps an article to a flat doc", () => {
    expect(buildSearchDocs([article()])).toEqual([
      {
        slug: "pool-exhaustion",
        title: "Transaction race conditions begin on pool",
        series: "Postgres Security",
        minutes: 7,
        tags: ["postgresql", "eslint"],
      },
    ]);
  });

  it("a missing series stays null, not undefined (serialized to the client)", () => {
    expect(buildSearchDocs([article({ series: undefined })])[0].series).toBeNull();
  });

  it("the haystack greps beyond the title: series and tags match too", () => {
    const hay = searchHaystack(buildSearchDocs([article()])[0]).toLowerCase();
    // "pg" articles must surface for queries their titles never say.
    expect(hay).toContain("postgresql");
    expect(hay).toContain("postgres security");
    expect(hay).toContain("transaction race");
  });
});

describe("wiring (reachable + accessible)", () => {
  it("the header renders CorpusSearch; the index is a static artifact", () => {
    const HEADER = read("components/app-header.tsx");
    expect(HEADER).toContain("<CorpusSearch />");
    // The docs must NOT ride every page's RSC payload (measured 16.7KB,
    // 11.2% of the homepage HTML) — they live behind the static route.
    expect(HEADER).not.toContain("buildSearchDocs");
    const ROUTE = read("app/search-index.json/route.ts");
    expect(ROUTE).toContain("buildSearchDocs(getAllArticles())");
    expect(ROUTE).toContain('force-static');
  });

  it("the palette fetches the index on intent, with a retry latch", () => {
    const SEARCH = read("components/corpus-search.tsx");
    expect(SEARCH).toContain('fetch("/search-index.json")');
    // Prefetch on hover/focus so the open feels instant…
    expect(SEARCH).toContain("onPointerEnter={ensureDocs}");
    expect(SEARCH).toContain("onFocus={ensureDocs}");
    // …and a failed fetch clears the latch so the next intent retries.
    expect(SEARCH).toContain("loadingRef.current = false");
  });

  it("the palette has an accessible name and the opt-in hotkey", () => {
    const SEARCH = read("components/corpus-search.tsx");
    // A modal without a title is announced as "dialog" and nothing else.
    expect(SEARCH).toContain("<CommandPaletteTitle>");
    expect(SEARCH).toContain("useCommandPaletteHotkey(");
    // Selection navigates — a palette that only closes is decoration.
    expect(SEARCH).toContain("router.push(`/articles/${doc.slug}`)");
  });
});

describe("vendoring (provenance + drift coverage)", () => {
  const DRIFT = readFileSync(
    path.resolve(__dirname, "../../../../scripts/check-vendored-drift.mjs"),
    "utf-8",
  );

  it.each(["components/ui/dialog.tsx", "components/ui/command-palette.tsx"])(
    "%s carries provenance and is tracked by the weekly drift check",
    (rel) => {
      // A vendored file the drift cron doesn't watch rots silently —
      // that is the exact failure mode the cron exists for.
      expect(read(rel)).toContain("// VENDORED from the Interlace DS");
      expect(DRIFT).toContain(`"${rel}"`);
    },
  );
});
