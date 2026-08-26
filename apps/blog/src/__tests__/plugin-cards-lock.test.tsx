import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ArticlePlugins } from "../components/article-plugins";
import { detectPlugins } from "../lib/plugin-mentions";
import stats from "../data/plugin-stats.json";

/**
 * Live-plugin-card locks — detection is body-derived and whitelist-
 * bound (no stats → no card, structurally), peers never match, and the
 * rendered card is receipts-honest: live numbers plus the sync date.
 */

describe("detection (body-derived, ours only)", () => {
  it("counts our packages, ranks by mentions, caps at the ink budget", () => {
    const body = `
      eslint-plugin-pg eslint-plugin-pg eslint-plugin-pg
      eslint-plugin-jwt eslint-plugin-jwt
      eslint-plugin-node-security
      eslint-plugin-secure-coding eslint-plugin-secure-coding eslint-plugin-secure-coding eslint-plugin-secure-coding
    `;
    const found = detectPlugins(body);
    expect(found.map((p) => p.name)).toEqual([
      "eslint-plugin-secure-coding",
      "eslint-plugin-pg",
      "eslint-plugin-jwt",
    ]);
    expect(found[0].version).toBe(stats.plugins["eslint-plugin-secure-coding"].version);
  });

  it("a peer plugin sharing a suffix never matches", () => {
    // eslint-plugin-security is a PEER — mentioning it must not light
    // any of our security plugins' cards.
    expect(detectPlugins("use eslint-plugin-security here")).toEqual([]);
    // …and boundaries hold: our name inside a longer token is no match.
    expect(detectPlugins("pkg-eslint-plugin-pg-fork")).toEqual([]);
  });

  it("no mention, no card", () => {
    expect(detectPlugins("nothing about linting at all")).toEqual([]);
  });
});

describe("stats cache (structural)", () => {
  it("every entry carries version + weeklyDownloads, and a sync date exists", () => {
    expect(stats.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const entries = Object.entries(stats.plugins);
    expect(entries.length).toBeGreaterThan(10);
    for (const [name, s] of entries) {
      expect(name, name).toMatch(/^eslint-/);
      expect(typeof s.version).toBe("string");
      expect(typeof s.weeklyDownloads).toBe("number");
    }
  });
});

describe("rendered card (receipts honesty)", () => {
  const html = renderToStaticMarkup(
    <ArticlePlugins
      currentSlug="x"
      generatedAt="2026-08-25"
      plugins={[
        { name: "eslint-plugin-jwt", version: "3.1.0", weeklyDownloads: 2200, mentions: 5 },
      ]}
    />,
  );

  it("shows version + compact downloads and says when they were earned", () => {
    expect(html).toContain("eslint-plugin-jwt");
    expect(html).toContain("v3.1.0");
    expect(html).toContain("2.2K/wk");
    expect(html).toContain("synced 2026-08-25");
    expect(html).toContain('href="https://www.npmjs.com/package/eslint-plugin-jwt"');
  });

  it("no plugins, no section", () => {
    expect(
      renderToStaticMarkup(
        <ArticlePlugins currentSlug="x" generatedAt="2026-08-25" plugins={[]} />,
      ),
    ).toBe("");
  });
});
