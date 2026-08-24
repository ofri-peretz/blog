// SSR-honesty lock for NumberTicker — 2026-08-24.
//
// With `startValue={0}` the ticker used to render "0" as its static markup,
// so the homepage Impact section showed EIGHT zeros to every crawler, LLM,
// reader-mode, and JS-off visitor — the exact audiences that never see the
// count-up. renderToStaticMarkup is the honest proxy for that audience:
// effects never run there, so whatever this test sees is what they get.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NumberTicker } from "@/components/ui/number-ticker";
import { ImpactMetricsBlock } from "@/components/landing/impact-metrics-block";

describe("NumberTicker static markup", () => {
  it("carries the FINAL value even when a count-up is requested", () => {
    const html = renderToStaticMarkup(
      <NumberTicker value={409111} startValue={0} />,
    );
    expect(html).toContain("409,111");
    expect(html).not.toMatch(/>0</);
  });

  it("without startValue it renders the value (no regression on the default)", () => {
    const html = renderToStaticMarkup(<NumberTicker value={82} />);
    expect(html).toContain("82");
  });
});

describe("Impact section static markup", () => {
  it("omits zero-valued metrics entirely — a 0 here is a data gap, not a fact", () => {
    const html = renderToStaticMarkup(
      <ImpactMetricsBlock
        stats={{
          github: { totalStars: 16, totalRepos: 36, totalContributions: 0 },
          npm: { totalDownloads: 409111, packageCount: 36 },
          devto: {
            totalViews: 8400,
            articleCount: 82,
            totalReactions: 87,
            totalComments: 67,
          },
        }}
      />,
    );
    expect(html).not.toContain("Contributions");
    expect(html).toContain("GitHub stars");
  });

  it("shows real metrics, never a wall of zeros", () => {
    const html = renderToStaticMarkup(
      <ImpactMetricsBlock
        stats={{
          github: { totalStars: 16, totalRepos: 36, totalContributions: 4210 },
          npm: { totalDownloads: 409111, packageCount: 36 },
          devto: {
            totalViews: 8400,
            articleCount: 82,
            totalReactions: 87,
            totalComments: 67,
          },
        }}
      />,
    );
    expect(html).toContain("409,111");
    expect(html).toContain("8,400");
    // A metric legitimately valued 0 would render "0" — but with the fixture
    // above all-nonzero, any ">0<" means a ticker regressed to startValue.
    expect(html).not.toMatch(/>0</);
  });
});
