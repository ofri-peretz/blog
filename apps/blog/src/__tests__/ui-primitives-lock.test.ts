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
import { readFileSync } from "node:fs";
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

  it("particles: only one documented hex literal, gated by eslint-disable", () => {
    const src = readFileSync(path.join(UI, "particles.tsx"), "utf-8");
    const lines = src.split("\n");
    const hexLines = lines
      .map((line, i) => ({ line, n: i + 1 }))
      .filter(({ line }) => /#[0-9a-fA-F]{3,8}\b/.test(line))
      // Comment lines and the schema docs at top are fine.
      .filter(
        ({ line }) =>
          !line.trim().startsWith("//") &&
          !line.trim().startsWith("*") &&
          !line.trim().startsWith("/*"),
      );
    // Exactly one production-code hex literal allowed; pinned to the
    // documented constant.
    expect(
      hexLines,
      hexLines.map((h) => `${h.n}: ${h.line.trim()}`).join("\n"),
    ).toHaveLength(1);
    expect(hexLines[0]?.line).toContain("DEFAULT_PARTICLE_HEX");
    // The disable comment must accompany it.
    const disableIdx = lines.findIndex((l) =>
      l.includes("eslint-disable-next-line no-raw-color-literal"),
    );
    expect(disableIdx, "expected eslint-disable comment").toBeGreaterThan(-1);
    expect(lines[disableIdx + 1] ?? "").toContain("DEFAULT_PARTICLE_HEX");
  });
});
