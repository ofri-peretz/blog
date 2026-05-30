import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Regression lock — 2026-05-30.
// On mobile (`grid-cols-2`) a wide 6-figure metric (e.g. NPM downloads
// "113,313") overflowed into the adjacent cell, rendering as "113,31327".
// Fix: show the full figure where it fits (sm+) but fall back to compact
// K/M on narrow viewports, and constrain the grid cells. Reverting any part
// of that should turn this red.
const BLOCK = readFileSync(
  join(__dirname, "../components/landing/impact-metrics-block.tsx"),
  "utf8",
);
const TICKER = readFileSync(
  join(__dirname, "../components/ui/number-ticker.tsx"),
  "utf8",
);

describe("impact-metrics-block — number overflow lock", () => {
  it("renders a compact (K/M) NumberTicker as the narrow-viewport fallback", () => {
    expect(BLOCK).toMatch(/notation="compact"/);
    expect(BLOCK).toMatch(/className="sm:hidden"/);
  });

  it("renders the full grouped figure only at sm+ (where it fits)", () => {
    expect(BLOCK).toMatch(/className="hidden sm:inline"/);
  });

  it("constrains grid cells with min-w-0 so a number can't overflow its neighbor", () => {
    expect(BLOCK).toMatch(/min-w-0/);
  });

  it("NumberTicker supports compact notation (K/M)", () => {
    expect(TICKER).toMatch(/notation\?\s*:\s*"standard"\s*\|\s*"compact"/);
    expect(TICKER).toMatch(/notation:\s*"compact"/);
  });
});
