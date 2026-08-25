import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { HeroStrand } from "../components/ui/hero-strand";

/**
 * HeroStrand consumption locks — vendored provenance, the decorative/
 * dash-math contract, the draw-verb CSS the vendored component depends
 * on (a component whose keyframe is missing simply never draws), and
 * the articles-page placement: the strand belongs to the TITLE block,
 * never the homepage hero (whose sun/clouds/meteors backdrop is its own
 * locked identity — one visual system per view).
 */

const read = (...p: string[]): string =>
  readFileSync(path.resolve(__dirname, "..", ...p), "utf-8");

describe("consumption contract", () => {
  it("the strand is the vendored DS effect, with provenance", () => {
    const SRC = read("components", "ui", "hero-strand.tsx");
    expect(SRC).toContain("VENDORED from the Interlace DS");
    expect(SRC).toContain("interlace#63");
  });

  it("globals.css carries the draw verb: token, keyframe, reduce clamp", () => {
    const CSS = read("app", "globals.css");
    expect(CSS).toContain("--animate-strand-draw: strand-draw 600ms");
    expect(CSS).toMatch(
      /@keyframes strand-draw \{\s*from \{\s*stroke-dashoffset: 100;\s*\}\s*to \{\s*stroke-dashoffset: 0;\s*\}/,
    );
    // Completes instantly under reduce — never `animation: none`, which
    // would leave the strand invisible forever (information, not motion).
    expect(CSS).toMatch(
      /\.animate-strand-draw \{\s*animation-duration: 0\.01ms !important;/,
    );
  });

  it("the articles page draws the crossing behind its title block only", () => {
    const PAGE = read("app", "articles", "page.tsx");
    expect(PAGE).toContain('<HeroStrand data-testid="articles-hero-strand" counter />');
    // Scoped: the strand and the title share one relative wrapper; the
    // map is its own surface.
    expect(PAGE).toMatch(/<div className="relative py-6">\s*<HeroStrand/);
  });

  it("the homepage hero stays the sky's — no strand over the locked backdrop", () => {
    const HOME = read("app", "page.tsx");
    expect(HOME).not.toContain("HeroStrand");
  });
});

describe("decorative + dash-math contract (rendered)", () => {
  const woven = renderToStaticMarkup(
    <HeroStrand data-testid="hs" counter />,
  );

  it("aria-hidden survives any override, pointer-transparent, both strands", () => {
    const overridden = renderToStaticMarkup(
      <HeroStrand data-testid="hs" counter aria-hidden={false} />,
    );
    expect(overridden).toMatch(/aria-hidden="true"/);
    expect(woven).toContain("pointer-events-none");
    expect(woven).toContain("stroke-strand-a");
    expect(woven).toContain("stroke-strand-b");
    expect(woven).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });

  it("pathLength normalization, no vector-effect (the #726 bug class)", () => {
    for (const p of woven.match(/<path[^>]*>/g) ?? []) {
      expect(p).toContain('pathLength="100"');
      expect(p).toContain("animate-strand-draw");
    }
    expect(woven).not.toContain("vector-effect");
  });
});
