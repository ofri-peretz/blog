/**
 * The /npm lifetime fallback, exercised rather than described.
 *
 * `getNpmPageLifetimeTotal(fallback)` promises the shared ecosystem read on
 * the happy path, and the caller's subset sum ONLY when that read throws.
 *
 * A CORRECTION, because the first version of this comment was wrong. I claimed
 * the existing greps in npm-lifetime-total-lock would keep passing if the two
 * returns were swapped. They do not: `/catch[\s\S]*return fallback/` fails
 * once `return fallback` moves above the catch, and I only know that because I
 * inverted the function and ran them. That lock is stronger than I assumed,
 * and it stays.
 *
 * What it cannot do is judge VALUES. It says nothing about a zero coming back
 * from the shared read, and its `catch[\s\S]*return fallback` slice runs to
 * end-of-file — a `return fallback` in some later function would satisfy it
 * just as well. There is exactly one today, so that is latent rather than
 * live.
 *
 * These tests are therefore complementary, not a replacement: they call the
 * function and assert what comes back, so they hold regardless of how the
 * source is spelled. (behavioural-claims finding)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getCachedNpmAlltimeTotal = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase-data", () => ({
  getCachedNpmAlltimeTotal: () => getCachedNpmAlltimeTotal(),
}));

const FALLBACK = 111; // the caller's subset sum — smaller than the real total
const SHARED = 29_000_000; // what the ecosystem read returns

beforeEach(() => {
  getCachedNpmAlltimeTotal.mockReset();
  // The rejected case logs; silence it so a passing run stays readable.
  vi.spyOn(console, "error").mockImplementation(() => {});
});

// Restore, matching the convention in your-thread-lock and go-resolver.
// Without it each test stacks another wrapper on console.error — contained
// by Vitest's file isolation, but a spy that is never released is one more
// thing quietly not doing what it looks like it does. (Review.)
afterEach(() => {
  vi.restoreAllMocks();
});

describe("getNpmPageLifetimeTotal", () => {
  it("returns the shared ecosystem read, not the caller's subset", async () => {
    getCachedNpmAlltimeTotal.mockResolvedValue(SHARED);
    const { getNpmPageLifetimeTotal } = await import("@/lib/npm-page-data");
    await expect(getNpmPageLifetimeTotal(FALLBACK)).resolves.toBe(SHARED);
  });

  it("falls back to the subset ONLY when the shared read throws", async () => {
    getCachedNpmAlltimeTotal.mockRejectedValue(new Error("supabase down"));
    const { getNpmPageLifetimeTotal } = await import("@/lib/npm-page-data");
    // A degraded render beats a 500 — but this must never be the normal path,
    // which the case above is what proves.
    await expect(getNpmPageLifetimeTotal(FALLBACK)).resolves.toBe(FALLBACK);
  });

  it("does not swallow a zero from the shared read into the fallback", async () => {
    // 0 is a legitimate (if alarming) answer and must not be mistaken for
    // failure — the same "treat a real value as absent" trap the homepage
    // stats fallback had.
    getCachedNpmAlltimeTotal.mockResolvedValue(0);
    const { getNpmPageLifetimeTotal } = await import("@/lib/npm-page-data");
    await expect(getNpmPageLifetimeTotal(FALLBACK)).resolves.toBe(0);
  });
});
