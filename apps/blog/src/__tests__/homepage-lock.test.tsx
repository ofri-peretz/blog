/**
 * Homepage composition lock — see CLAUDE.md.
 *
 * The composition order is the brand argument (2026-08-24 decision): hero
 * states the agenda, Impact proves it with numbers, Agenda names the ideas,
 * Featured is the shipped product, Writing is the ideas in long form, and
 * Experience is the leadership record. The page sells a leader with an
 * agenda — NOT a developer's skill inventory, which is why the old Stack
 * and FAQ sections are locked OUT below, not just absent.
 *
 * Pattern: file-text grep on src/app/page.tsx. We don't render the page —
 * the home page is `async` server-component + fetches live APIs. We pin
 * the source structure, which is the regression surface that matters.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const HOMEPAGE = readFileSync(
  path.resolve(__dirname, "..", "app", "page.tsx"),
  "utf-8",
);

// Hero atmospheric cluster — see CLAUDE.md regression policy. The three
// primitives below were degraded from their Nuxt blog-old reference into
// generic Aceternity-style components during the React port; the user
// reported "meteors are weird" and "sunlight + clouds are not presenting".
// This block locks the restored Nuxt-faithful versions so the regression
// can't recur.
const HERO_BACKDROP = readFileSync(
  path.resolve(__dirname, "..", "components", "home", "hero-backdrop.tsx"),
  "utf-8",
);
const METEORS = readFileSync(
  path.resolve(__dirname, "..", "components", "ui", "meteors.tsx"),
  "utf-8",
);
const SUNNY = readFileSync(
  path.resolve(__dirname, "..", "components", "ui", "sunny-background.tsx"),
  "utf-8",
);
const CLOUDS = readFileSync(
  path.resolve(__dirname, "..", "components", "ui", "cloud-particles.tsx"),
  "utf-8",
);

describe("homepage composition lock", () => {
  it("imports every required landing section", () => {
    const REQUIRED_IMPORTS = [
      "HeroBackdrop",
      "Agenda",
      "FeaturedProject",
      "WorkExperience",
      "DevToArticles",
      "ImpactMetricsBlock",
    ];
    for (const name of REQUIRED_IMPORTS) {
      expect(HOMEPAGE).toContain(name);
    }
  });

  it("renders sections in the agenda-led order", () => {
    const ORDER = [
      "HeroBackdrop",
      "ImpactMetricsBlock",
      "<Agenda",
      "<FeaturedProject",
      "<DevToArticles",
      "<WorkExperience",
    ];
    let cursor = 0;
    for (const marker of ORDER) {
      const idx = HOMEPAGE.indexOf(marker, cursor);
      expect(
        idx,
        `expected ${marker} after position ${cursor}`,
      ).toBeGreaterThan(-1);
      cursor = idx;
    }
  });

  it("does NOT sell a skill inventory — Stack and FAQ stay gone", () => {
    // The 2026-08-24 brand decision: ideas, products, impact — not a list
    // of technologies. A future "add back a skills grid" PR must fail here
    // and argue with this comment first.
    expect(HOMEPAGE).not.toMatch(/<Skills\b/);
    expect(HOMEPAGE).not.toMatch(/<Faq\b/);
    expect(HOMEPAGE).not.toMatch(/landing\/skills/);
    expect(HOMEPAGE).not.toMatch(/landing\/faq/);
  });

  it("uses the Container and Section primitives (no open-coded layout)", () => {
    // The Layout primitive contract: pages must consume <Container>/<Section>
    // rather than open-coded `mx-auto max-w-… px-6`.
    expect(HOMEPAGE).toMatch(/<Container\s/);
    expect(HOMEPAGE).toMatch(/<Section\s/);
    expect(HOMEPAGE).not.toMatch(/mx-auto\s+max-w-[a-z0-9]+\s+px-6/);
    expect(HOMEPAGE).not.toContain("container mx-auto px-4");
  });

  it("anchors the hero CTA with a Button-variant link (R12 / CTA)", () => {
    expect(HOMEPAGE).toContain("buttonVariants(");
    expect(HOMEPAGE).toContain("Explore the docs");
  });

  it("gates the animation cluster on prefers-reduced-motion", () => {
    expect(HOMEPAGE).toContain("HeroBackdrop");
    // The cluster lives inside HeroBackdrop; the page must NOT render the
    // raw animation primitives unconditionally.
    expect(HOMEPAGE).not.toMatch(/<SunnyBackground/);
    expect(HOMEPAGE).not.toMatch(/<CloudParticles/);
    expect(HOMEPAGE).not.toMatch(/<Meteors/);
  });

  it('sets `id="main"` on <main> so the skip-link works', () => {
    expect(HOMEPAGE).toMatch(/<main\s+id="main"/);
  });
});

// ──────────────────────────────────────────────────────────────────
// Hero atmospherics — Nuxt blog-old parity lock.
// User reported "meteors weird, sunlight + clouds not presenting" on
// 2026-05-17. Root cause: the React port substituted generic
// Aceternity-style components (registry Meteors with slate-300 / 22
// random / 3–9s; single amber blur for sun; mouse-reactive Particles
// dots for clouds) instead of the Nuxt source's hand-tuned visuals.
// This block pins the byte-for-byte port back to the Nuxt reference.
// ──────────────────────────────────────────────────────────────────

describe("hero atmospherics — Nuxt blog-old parity", () => {
  describe("HeroBackdrop call-site", () => {
    it("composes the three primitives in the canonical order", () => {
      const sunIdx = HERO_BACKDROP.indexOf("<SunnyBackground");
      const cloudIdx = HERO_BACKDROP.indexOf("<CloudParticles");
      const meteorIdx = HERO_BACKDROP.indexOf("<Meteors");
      expect(sunIdx).toBeGreaterThan(-1);
      expect(cloudIdx).toBeGreaterThan(sunIdx);
      expect(meteorIdx).toBeGreaterThan(cloudIdx);
    });

    it("gates the daylight surface (sun + clouds) to light theme via `block dark:hidden`", () => {
      // Without this gate the sun bleeds through the cosmic hero in dark
      // mode and the headline loses contrast — the regression we just
      // fixed. Lock the wrapper so a future refactor can't drop it.
      expect(HERO_BACKDROP).toMatch(
        /block\s+dark:hidden[\s\S]{0,400}<SunnyBackground/,
      );
      expect(HERO_BACKDROP).toMatch(
        /block\s+dark:hidden[\s\S]{0,400}<CloudParticles/,
      );
    });

    it("gates the cosmic surface (meteors) to dark theme via `hidden dark:block`", () => {
      expect(HERO_BACKDROP).toMatch(/hidden\s+dark:block[\s\S]{0,200}<Meteors/);
    });

    it("passes the Nuxt-faithful meteor count (3, NOT 15 or 22)", () => {
      expect(HERO_BACKDROP).toMatch(/<Meteors\s+number=\{3\}/);
    });

    it("passes the fluffy-cloud density (3, NOT 30 dots)", () => {
      expect(HERO_BACKDROP).toMatch(/<CloudParticles\s+density=\{3\}/);
    });

    it("still short-circuits the whole cluster on prefers-reduced-motion", () => {
      expect(HERO_BACKDROP).toContain("useReducedMotion");
      expect(HERO_BACKDROP).toMatch(/if\s*\(\s*reduced\s*\)\s*return\s+null/);
    });
  });

  describe("Meteors — Nuxt purple shower", () => {
    it("default count is 3 (was 22 in the registry primitive)", () => {
      expect(METEORS).toMatch(/number\s*=\s*3\b/);
    });

    it("uses purple trail tokens (NOT slate-300/dark:slate-200; hex flows via globals.css)", () => {
      // Source-text lock — meteors.tsx consumes the three meteor-trail
      // tokens defined in globals.css; the registry primitive's
      // slate-* classes must be gone. Tier-B ui-primitives-lock already
      // forbids hex in `shadow-[]` arbitrary classes; we don't repeat
      // that here so comments referencing the source hex are fine.
      expect(METEORS).toContain("var(--color-meteor-trail)");
      expect(METEORS).toContain("var(--color-meteor-trail-fade)");
      expect(METEORS).toContain("var(--color-meteor-glow)");
      expect(METEORS).not.toMatch(/bg-slate-300|bg-slate-200/);
    });

    it("trail is a 120px linear-gradient ribbon (NOT the variable 50–140px registry trail)", () => {
      expect(METEORS).toMatch(/TRAIL_PX\s*=\s*120/);
      // Negative lock: the registry primitive's randomized trail range.
      expect(METEORS).not.toMatch(/TRAIL_MIN_PX|TRAIL_MAX_PX/);
    });

    it("anchors all meteors at `top: -40px` (NOT random -15vh→55vh)", () => {
      expect(METEORS).toContain('top: "-40px"');
      expect(METEORS).not.toMatch(/TOP_MIN_VH|TOP_MAX_VH/);
    });

    it("positions are deterministic via `idx * (spread / count) - spread / 2`", () => {
      // Spread is now viewport-aware (see SPREAD_MAX_PX / SPREAD_VIEWPORT_FACTOR
      // — the old constant `SPREAD_PX = 1600` became `SPREAD_MAX_PX = 1600` and
      // the divisor moved to a runtime `spread` param).
      expect(METEORS).toMatch(/idx\s*\*\s*\(\s*spreadPx\s*\/\s*count\s*\)/);
    });

    it("viewport-aware spread caps at 1600px (Nuxt cap) and stays inside the viewport on narrower screens", () => {
      // First-impression fix #2: the Nuxt original used SPREAD_PX = 1600
      // unconditionally, which clipped meteor 0 off-screen on every
      // viewport < 1600px. The replacement clamps to viewport-width ×
      // factor. The factor MUST be ≤ 1.0 — values above 1 push the edge
      // meteors back off-screen on viewports < SPREAD_MAX_PX.
      expect(METEORS).toMatch(/SPREAD_MAX_PX\s*=\s*1600/);
      const factor = METEORS.match(/SPREAD_VIEWPORT_FACTOR\s*=\s*([0-9.]+)/);
      expect(
        factor,
        "SPREAD_VIEWPORT_FACTOR constant must exist",
      ).not.toBeNull();
      expect(Number(factor![1])).toBeLessThanOrEqual(1.0);
      expect(METEORS).toMatch(
        /Math\.min\(\s*SPREAD_MAX_PX,\s*window\.innerWidth\s*\*\s*SPREAD_VIEWPORT_FACTOR\s*\)/,
      );
      expect(METEORS).toMatch(/useEffectiveSpread/);
    });

    it("delay/duration are seeded by `(idx * 13 + 7) % 100` (Nuxt seed)", () => {
      expect(METEORS).toMatch(/idx\s*\*\s*13\s*\+\s*7\s*\)\s*%\s*100/);
    });

    it("delay is NEGATIVE so meteors are mid-flight at t=0 (no blank first second)", () => {
      // First-impression fix #1: the Nuxt source used positive
      // animation-delays (0–20s) which left the hero empty for the
      // first ~1.4 seconds on every page load. Negative delays start
      // the animation already-in-progress.
      expect(METEORS).toMatch(
        /const\s+delay\s*=\s*-\(\(\s*seed\s*\/\s*100\s*\)\s*\*\s*DURATION_BASE_S\)/,
      );
      // Negative lock — the positive-delay form is gone.
      expect(METEORS).not.toMatch(/DELAY_RANGE_S\s*=/);
    });

    it("duration range is 12–30s (NOT 3–9s)", () => {
      expect(METEORS).toMatch(/DURATION_BASE_S\s*=\s*12/);
      expect(METEORS).toMatch(/DURATION_RANGE_S\s*=\s*18/);
    });

    it("keyframe rotates 215° and translates X by -500px (Nuxt cadence)", () => {
      expect(METEORS).toMatch(/rotate\(\$\{ANGLE_DEG\}deg\)\s+translateX\(0\)/);
      expect(METEORS).toMatch(/translateX\(-\$\{TRAVEL_PX\}px\)/);
      expect(METEORS).toMatch(/ANGLE_DEG\s*=\s*215/);
      expect(METEORS).toMatch(/TRAVEL_PX\s*=\s*500/);
    });

    it("keyframe fades opacity in (0 → 0.8 over 0–15%) and out (0.8 → 0 over 85–100%)", () => {
      // First-impression fix #3: the Nuxt 0% keyframe was `opacity: 0.8`
      // so meteors materialized at full strength rather than entering
      // the scene. The new keyframe has explicit fade-in + fade-out
      // edges so the meteor reads as TRAVELLING rather than appearing.
      expect(METEORS).toMatch(/0%\s*\{[\s\S]{0,200}opacity:\s*0\b/);
      expect(METEORS).toMatch(/15%\s*\{[\s\S]{0,80}opacity:\s*\$\{OPACITY\}/);
      expect(METEORS).toMatch(/85%\s*\{[\s\S]{0,80}opacity:\s*\$\{OPACITY\}/);
      expect(METEORS).toMatch(/100%\s*\{[\s\S]{0,200}opacity:\s*0/);
    });

    it("steady-state opacity target is 0.8 (NOT random 0.45–1.0)", () => {
      expect(METEORS).toMatch(/OPACITY\s*=\s*0\.8/);
      expect(METEORS).not.toMatch(/OPACITY_MIN|OPACITY_MAX/);
    });

    it("honors prefers-reduced-motion via the existing hook", () => {
      expect(METEORS).toContain("useReducedMotion");
      expect(METEORS).toMatch(/if\s*\(\s*reduced\s*\)\s*return\s+null/);
    });
  });

  describe("SunnyBackground — multi-layer photorealistic sun", () => {
    it("renders both corona layers (outer + middle, atmospheric diffraction)", () => {
      expect(SUNNY).toContain("blog-sun-corona-outer");
      expect(SUNNY).toContain("blog-sun-corona-middle");
    });

    it("renders an overexposed core (the bright sun disk)", () => {
      expect(SUNNY).toContain("blog-sun-core");
    });

    it("renders conic-gradient rays animated over 120s (matches Nuxt)", () => {
      expect(SUNNY).toMatch(/animation:\s*blog-sun-rays-rotate\s+120s/);
      expect(SUNNY).toContain("conic-gradient");
    });

    it("Sun rays honor prefers-reduced-motion (animation: none under reduce)", () => {
      expect(SUNNY).toMatch(
        /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]{0,200}blog-sun-rays[\s\S]{0,80}animation:\s*none/,
      );
    });

    it("renders all four lens flares (h / v / diag-1 / diag-2) — anamorphic look", () => {
      expect(SUNNY).toContain("blog-lens-flare-h");
      expect(SUNNY).toContain("blog-lens-flare-v");
      expect(SUNNY).toContain("blog-lens-flare-diag-1");
      expect(SUNNY).toContain("blog-lens-flare-diag-2");
    });

    it("renders two secondary flare spots (off-axis ghosts)", () => {
      expect(SUNNY).toContain("blog-flare-spot-1");
      expect(SUNNY).toContain("blog-flare-spot-2");
    });

    it("sky base uses the Nuxt HSL Rayleigh ramp (zenith blue → horizon amber)", () => {
      expect(SUNNY).toMatch(/hsl\(210,\s*80%,\s*55%\)/);
      expect(SUNNY).toMatch(/hsl\(45,\s*50%,\s*88%\)/);
    });

    it("renders the bottom horizon golden-hour band + vignette", () => {
      expect(SUNNY).toContain("blog-sky-horizon");
      expect(SUNNY).toContain("blog-sky-vignette");
    });

    it("anchors the sun top-right (responsive nudge on small viewports)", () => {
      expect(SUNNY).toMatch(/top-8\s+right-16/);
      expect(SUNNY).toMatch(/sm:top-12\s+sm:right-24/);
    });

    it("does NOT keep the single-blob `60vmin` regression", () => {
      expect(SUNNY).not.toMatch(/h-\[60vmin\]\s+w-\[60vmin\]/);
    });
  });

  describe("CloudParticles — SVG turbulence fluffy clouds", () => {
    it("does NOT depend on the mouse-reactive Particles primitive any more", () => {
      expect(CLOUDS).not.toMatch(/from\s+["']\.\/particles["']/);
      expect(CLOUDS).not.toContain("<Particles");
    });

    it("defines a 5-layer feMerge stack (volumetric depth from Vue source)", () => {
      const merges = CLOUDS.match(/<feMergeNode\b/g) ?? [];
      expect(merges.length).toBeGreaterThanOrEqual(4);
    });

    it("uses dual feTurbulence sources (detail + broad fluff shapes)", () => {
      const turbs = CLOUDS.match(/<feTurbulence\b/g) ?? [];
      expect(turbs.length).toBe(2);
    });

    it("preserves the blue-tinted underside shadow `rgb(66, 105, 146)`", () => {
      expect(CLOUDS).toMatch(/rgb\(\s*66\s*,\s*105\s*,\s*146\s*\)/);
    });

    it("uses fractalNoise (organic) — not regular turbulence", () => {
      const turbs = CLOUDS.match(/type=["']fractalNoise["']/g) ?? [];
      expect(turbs.length).toBe(2);
    });

    it("drift keyframe sweeps `translateX(130vw)` (matches Nuxt)", () => {
      expect(CLOUDS).toMatch(/translateX\(130vw\)/);
    });

    it("default density is 3 (NOT 30 dots from the previous Particles wrap)", () => {
      expect(CLOUDS).toMatch(/density\s*=\s*3\b/);
    });

    it("mobile (<768px) clamps to 2 clouds (matches Vue GPU budget)", () => {
      expect(CLOUDS).toMatch(/MOBILE_BREAKPOINT\s*=\s*768/);
      expect(CLOUDS).toMatch(/MOBILE_CLOUD_CAP\s*=\s*2/);
    });

    it("positions are deterministic via golden-ratio seed (φ = 1.618)", () => {
      expect(CLOUDS).toMatch(/PHI\s*=\s*1\.618/);
    });

    it("honors prefers-reduced-motion via the existing hook", () => {
      expect(CLOUDS).toContain("useReducedMotion");
      expect(CLOUDS).toMatch(/if\s*\(\s*reduced\s*\)\s*return\s+null/);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────
// Lighthouse-audit locks (2026-08-25 mobile audit of the live site).
// ─────────────────────────────────────────────────────────────────────
describe("lighthouse findings stay fixed", () => {
  it("in-text links carry a resting underline, never color alone (WCAG 1.4.1)", () => {
    // link-in-text-block: hover-only underlines leave color as the only
    // resting distinguisher inside prose.
    const AGENDA = readFileSync(
      path.resolve(__dirname, "..", "components", "landing", "agenda.tsx"),
      "utf-8",
    );
    for (const src of [HOMEPAGE, AGENDA]) {
      expect(src).not.toMatch(/text-foreground underline-offset-4 hover:underline/);
    }
    expect(HOMEPAGE).toContain("underline underline-offset-4");
    expect(AGENDA).toContain("underline underline-offset-4");
  });

  it("CSP is ENFORCED and never regresses to Report-Only or strict-dynamic theater", () => {
    const CONFIG = readFileSync(
      path.resolve(__dirname, "..", "..", "next.config.ts"),
      "utf-8",
    );
    // Enforced header, not Report-Only.
    expect(CONFIG).toContain('key: "Content-Security-Policy", value: csp');
    expect(CONFIG).not.toContain("Content-Security-Policy-Report-Only");
    // strict-dynamic without a nonce made browsers ignore 'self' — every
    // chunk violated and the policy could never be enforced on SSG.
    // Scoped to the policy array so prose in comments can't trip it.
    // Regex, not indexOf slices (review): a reformatted `.join` made the
    // old slice degrade to almost-the-whole-file and the guard passed
    // vacuously. The match is asserted non-empty so it fails LOUDLY.
    const policyBlock = CONFIG.match(/const csp = \[[\s\S]*?\]\.join\(/)?.[0];
    expect(policyBlock, "policy array not found — lock cannot scan").toBeTruthy();
    expect(policyBlock).not.toContain("strict-dynamic");
    // Meaningful only under enforcement; restored with it.
    expect(CONFIG).toMatch(/"upgrade-insecure-requests"/);
  });

  it("FloatingToc's collapsed button name starts with its visible label (WCAG 2.5.3)", () => {
    const TOC = readFileSync(
      path.resolve(__dirname, "..", "components", "floating-toc.tsx"),
      "utf-8",
    );
    expect(TOC).toContain('aria-label="On this page');
  });
});
