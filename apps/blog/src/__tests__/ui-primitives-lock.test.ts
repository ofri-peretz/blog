/**
 * Tier B regression lock — actively-used baseline `ui/` primitives.
 *
 * The blog's `src/components/ui/` directory ships with copies of baseline
 * primitives (per `apps/blog/AGENTS.md`). Most are not referenced from app
 * code; the three below ARE imported and so must satisfy the floor:
 *
 *   - `border-beam.tsx` — `colorFrom`/`colorTo` defaults must be token-driven,
 *     not raw hex.
 *   - `meteors.tsx` — the per-meteor `<span>` shadow color must reference a
 *     token (not a literal hex inside an arbitrary-class).
 *   - `particles.tsx` — the runtime hex fallback is allowed once, in a
 *     documented `DEFAULT_PARTICLE_HEX` constant with an explicit
 *     `eslint-disable-next-line` for the rule. No other hex literals.
 *
 * The other six baseline files (`shimmer-button`, `stars-background`,
 * `background-lines`, `background-gradient-animation`,
 * `background-beams-with-collision`, `article-card`, `animated-gradient-text`)
 * are present but not imported; their fixes are tracked in `INTERLACE_AUDIT.md`
 * under "Tier B baseline-sync queue".
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const UI = path.resolve(__dirname, "..", "components", "ui");

describe("Tier B — actively-used baseline primitives stay token-driven", () => {
  it("border-beam: no raw hex defaults for colorFrom/colorTo", () => {
    const src = readFileSync(path.join(UI, "border-beam.tsx"), "utf-8");
    // The destructure must not pull in literal hex defaults.
    expect(src).not.toMatch(/colorFrom\s*=\s*"#[0-9a-fA-F]/);
    expect(src).not.toMatch(/colorTo\s*=\s*"#[0-9a-fA-F]/);
    // Should consume the token.
    expect(src).toContain("var(--color-beam-from)");
    expect(src).toContain("var(--color-beam-to)");
  });

  it("meteors: shadow uses --color-meteor-glow, gradient uses bg-linear-*", () => {
    const src = readFileSync(path.join(UI, "meteors.tsx"), "utf-8");
    expect(src).toContain("var(--color-meteor-glow)");
    expect(src).not.toMatch(/shadow-\[[^\]]*#[0-9a-fA-F]/);
    // Tailwind v4 idiom — keep us off the deprecated bg-gradient-* alias.
    expect(src).not.toMatch(/\bbg-gradient-to-\w/);
  });

  // `particles.tsx` was deleted in the 2026-08-24 dead-code purge — its
  // last importer (the pre-Nuxt-parity CloudParticles wrapper) is gone,
  // and the hero-atmospherics lock pins CloudParticles as NOT depending
  // on it. If a Particles primitive returns, restore its hex lock here.
  it("particles stays deleted (dead since the CloudParticles rework)", () => {
    expect(existsSync(path.join(UI, "particles.tsx"))).toBe(false);
  });
});
