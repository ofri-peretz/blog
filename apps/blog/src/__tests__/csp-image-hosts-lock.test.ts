/**
 * Every external image an article embeds must be a host the CSP allows.
 *
 * Four `img.shields.io` badges sat in three published articles while
 * `img-src` did not list that host. They were blocked in production for as
 * long as they had been there — no build error, no console anyone was
 * reading, just four images that never appeared. It surfaced on 2026-09-04
 * only because the post-deploy layout audit happened to be injecting a style
 * tag at the moment one of them tried to load, on one of 288 viewport/route
 * /theme combinations. That is luck, not detection.
 *
 * The failure shape is the one this repo cares about most: a silent visual
 * regression on the storefront, invisible to CI, invisible in dev (where the
 * headers are not applied the same way), and invisible to a reader who simply
 * sees nothing where a badge should be.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../../../..");
const ARTICLES = join(ROOT, "apps/blog/content/articles");
const CONFIG = readFileSync(join(ROOT, "apps/blog/next.config.ts"), "utf-8");

/** Hosts listed in the CSP img-src directive. */
function allowedImageHosts(): string[] {
  const m = /"img-src ([^"]+)"/.exec(CONFIG);
  if (!m) throw new Error("img-src directive not found in next.config.ts");
  return m[1]
    .split(/\s+/)
    .filter((t) => t.startsWith("https://"))
    .map((t) => t.replace("https://", ""));
}

/** Hosts of every absolute markdown image across the corpus. */
function referencedImageHosts(): Map<string, string[]> {
  const byHost = new Map<string, string[]>();
  for (const file of readdirSync(ARTICLES).filter((f) => f.endsWith(".md"))) {
    const text = readFileSync(join(ARTICLES, file), "utf-8");
    // Markdown image syntax only. Frontmatter cover_image/social_image are
    // served through next/image from our own domain and are covered by the
    // cover-asset lock in sdlc-chain-lock.
    for (const m of text.matchAll(/!\[[^\]]*\]\((https:\/\/[^/)]+)/g)) {
      const host = m[1].replace("https://", "");
      byHost.set(host, [...(byHost.get(host) ?? []), file]);
    }
  }
  return byHost;
}

const allowed = allowedImageHosts();
const referenced = referencedImageHosts();

describe("CSP img-src covers every image the corpus embeds", () => {
  it("the directive parses and is not empty", () => {
    // Guards the whole file: a regex that stopped matching would otherwise
    // make every assertion below vacuously true.
    expect(allowed.length).toBeGreaterThan(0);
  });

  it("the corpus scan finds the badges we know are there", () => {
    // Same guard from the other side. If this scan returns nothing, the
    // subject-matter test cannot fail no matter how broken the policy is.
    expect(referenced.size).toBeGreaterThan(0);
  });

  it("no article embeds an image from a host the CSP blocks", () => {
    const blocked = [...referenced.entries()]
      .filter(([host]) => !allowed.includes(host))
      .map(([host, files]) => `${host} (in ${[...new Set(files)].join(", ")})`);
    expect(
      blocked,
      `articles embed images from hosts img-src does not allow:\n  ${blocked.join("\n  ")}\n` +
        `allowed: ${allowed.join(", ")}`,
    ).toEqual([]);
  });

  it("img-src never uses a bare scheme wildcard", () => {
    // `https:` would make this lock pass forever while allowing any host on
    // the internet to serve images into the page.
    const directive = /"img-src ([^"]+)"/.exec(CONFIG)![1];
    expect(directive).not.toMatch(/(^|\s)https:(\s|$)/);
    expect(directive).not.toContain("*");
  });
});
