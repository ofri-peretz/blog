import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ArticleBenchReceipt } from "../components/article-bench-receipt";
import receipts from "../data/bench-receipts.json";

/**
 * Bench-receipt locks — the cache keeps the shape the card trusts, the
 * card is receipts-honest (all rows, dated, linked to the public run),
 * a data gap renders nothing, and the series gate stays wired.
 */

const read = (rel: string): string =>
  readFileSync(path.resolve(__dirname, "..", rel), "utf-8");

describe("receipts cache (structural)", () => {
  it("carries the run date, target repo, versions, and complete rows", () => {
    expect(receipts.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(typeof receipts.repo).toBe("string");
    expect(receipts.versions.eslint).toMatch(/^v?\d/);
    expect(receipts.rows.length).toBeGreaterThanOrEqual(2);
    expect(receipts.rows.some((r) => r.key === "ours")).toBe(true);
    for (const r of receipts.rows) {
      expect(typeof r.label, r.key).toBe("string");
      expect(typeof r.coldMs, r.key).toBe("number");
      expect(typeof r.warmMs, r.key).toBe("number");
    }
  });
});

describe("the rendered receipt", () => {
  const html = renderToStaticMarkup(
    <ArticleBenchReceipt
      currentSlug="x"
      data={{
        generatedAt: "2026-08-25T13:10:19.605Z",
        repo: "shadcn-ui",
        versions: { eslint: "v9.39.4", oxlint: "1.63.0", node: "v24" },
        rows: [
          { key: "ours", label: "Interlace (ESLint)", coldMs: 1981.2, warmMs: 1006.8 },
          { key: "competitor", label: "Community plugins (ESLint)", coldMs: 3726.8, warmMs: 1137.5 },
        ],
      }}
    />,
  );

  it("prints every row with both timings and the re-earned date", () => {
    // ALL rows — a receipt that only prints wins is marketing.
    expect(html).toContain("Interlace (ESLint)");
    expect(html).toContain("Community plugins (ESLint)");
    expect(html).toContain("warm 1.0s");
    expect(html).toContain("cold 3.7s");
    expect(html).toContain("re-earned 2026-08-25");
    expect(html).toContain("shadcn-ui");
    expect(html).toContain("https://eslint.interlace.tools/docs/benchmarks");
  });

  it("missing version keys render no husks — the segment just drops", () => {
    const noVersions = renderToStaticMarkup(
      <ArticleBenchReceipt
        currentSlug="x"
        data={{
          generatedAt: "2026-08-25T13:10:19.605Z",
          repo: "shadcn-ui",
          versions: {},
          rows: [
            { key: "ours", label: "Interlace (ESLint)", coldMs: 1000, warmMs: 900 },
          ],
        }}
      />,
    );
    expect(noVersions).not.toContain("eslint ·");
    expect(noVersions).not.toContain("oxlint ·");
    expect(noVersions).toContain("shadcn-ui");
  });

  it("a data gap renders NOTHING — no card, no zeros", () => {
    expect(
      renderToStaticMarkup(<ArticleBenchReceipt currentSlug="x" data={null} />),
    ).toBe("");
    expect(
      renderToStaticMarkup(
        <ArticleBenchReceipt
          currentSlug="x"
          data={{ generatedAt: "", repo: "", versions: {}, rows: [] }}
        />,
      ),
    ).toBe("");
  });
});

describe("wiring", () => {
  it("the article page gates the receipt on the benchmark series", () => {
    const PAGE = read("app/articles/[slug]/page.tsx");
    expect(PAGE).toContain('fm.series === "Inside our linter benchmarks"');
    expect(PAGE).toContain("<ArticleBenchReceipt currentSlug={slug} data={benchReceipts} />");
  });

  it("the link is a TrackedLink carrying the slug", () => {
    const SRC = read("components/article-bench-receipt.tsx");
    expect(SRC).toContain('event="article:bench_receipt_click"');
    expect(SRC).toContain("props={{ slug: currentSlug }}");
  });

  it("the sync is advisory and schema-pinned", () => {
    const SYNC = readFileSync(
      path.resolve(__dirname, "../../scripts/sync-bench-receipts.mjs"),
      "utf-8",
    );
    expect(SYNC).toContain('"ilb-headline-site/v1"');
    expect(SYNC).toContain("keeping cache");
    expect(SYNC).toContain("refusing to write empty receipts");
    // An upstream key rename must reject the fetch, not blank the footer.
    expect(SYNC).toContain("versions.${key} missing");
  });
});
