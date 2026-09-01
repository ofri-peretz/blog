import { describe, it, expect } from "vitest";
import { localCover } from "@/lib/cover";

/**
 * The point of `localCover` is a performance property, not a string tidy-up:
 * an absolute src makes `next/image` treat the cover as remote and fetch it
 * back over the public internet. These lock the two things that would silently
 * undo that — dropping the cache-busting query, or rewriting a genuinely
 * remote host into a broken local path.
 */
describe("localCover", () => {
  it("converts a same-origin absolute cover to a path", () => {
    expect(
      localCover("https://ofriperetz.dev/cdn/blog-cover-image/a.jpg"),
    ).toBe("/cdn/blog-cover-image/a.jpg");
  });

  it("keeps the cache-busting query string", () => {
    // Dropping `?v=` would serve a stale image from the optimizer cache — the
    // covers are versioned precisely because they get re-rendered in place.
    expect(
      localCover("https://ofriperetz.dev/cdn/blog-cover-image/a.jpg?v=b2"),
    ).toBe("/cdn/blog-cover-image/a.jpg?v=b2");
  });

  it("handles the www host too", () => {
    expect(localCover("https://www.ofriperetz.dev/cdn/x.jpg")).toBe(
      "/cdn/x.jpg",
    );
  });

  it("leaves genuinely remote covers alone", () => {
    // A dev.to cover must stay absolute; rewriting it would 404 locally.
    const remote = "https://media.dev.to/dynamic/image/x.jpg";
    expect(localCover(remote)).toBe(remote);
  });

  it("does not rewrite a lookalike host", () => {
    const evil = "https://ofriperetz.dev.example.com/cdn/x.jpg";
    expect(localCover(evil)).toBe(evil);
  });

  it("passes through paths and undefined", () => {
    expect(localCover("/cdn/x.jpg")).toBe("/cdn/x.jpg");
    expect(localCover(undefined)).toBeUndefined();
  });
});
