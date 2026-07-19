/**
 * Dev.to link-transform lock tests.
 *
 * The transform runs ONLY on the dev.to render path (publish-to-devto.mjs).
 * These tests lock the four rewrite rules + the safety guarantees:
 * /go/ links are never re-rewritten, code fences pass through byte-identical,
 * and the whole transform is idempotent.
 */
/* eslint-disable conventions/utm-taxonomy --
 * utm_source=devto is load-bearing, not a free choice: the /go/ handler
 * routes by `article_platforms.platform === utm_source` and the platform
 * rows are upserted as 'devto'. The whole codebase (supabase-data.ts,
 * hand-written article links) uses `devto`; the taxonomy's `dev_to` is the
 * outlier and needs reconciling in UTM_PHILOSOPHY.md, not here. */
import { describe, expect, it } from "vitest";

import {
  rewriteUrlForDevto,
  transformBodyForDevto,
} from "../../scripts/devto-link-transforms.mjs";

const SLUG = "my-current-article";

describe("rewriteUrlForDevto", () => {
  it("absolutizes relative /articles/ links and routes them through /go/", () => {
    expect(rewriteUrlForDevto("/articles/target-post", SLUG)).toBe(
      `https://ofriperetz.dev/go/target-post?utm_source=devto&from=${SLUG}`,
    );
  });

  it("preserves anchors on relative article links", () => {
    expect(
      rewriteUrlForDevto(
        "/articles/eslint-security-fn-fp-benchmark#on-benchmark-bias",
        SLUG,
      ),
    ).toBe(
      `https://ofriperetz.dev/go/eslint-security-fn-fp-benchmark?utm_source=devto&from=${SLUG}#on-benchmark-bias`,
    );
  });

  it("rewrites absolute cross-article links to /go/<target>", () => {
    expect(
      rewriteUrlForDevto(
        "https://ofriperetz.dev/articles/the-ai-hydra-problem",
        SLUG,
      ),
    ).toBe(
      `https://ofriperetz.dev/go/the-ai-hydra-problem?utm_source=devto&from=${SLUG}`,
    );
  });

  it("preserves anchors on absolute cross-article links", () => {
    expect(
      rewriteUrlForDevto(
        "https://ofriperetz.dev/articles/bias-in-measurement#the-unicorn-incident",
        SLUG,
      ),
    ).toBe(
      `https://ofriperetz.dev/go/bias-in-measurement?utm_source=devto&from=${SLUG}#the-unicorn-incident`,
    );
  });

  it("rewrites npm package links to /go/npm/<pkg>", () => {
    expect(
      rewriteUrlForDevto(
        "https://www.npmjs.com/package/eslint-plugin-pg",
        SLUG,
      ),
    ).toBe(
      `https://ofriperetz.dev/go/npm/eslint-plugin-pg?utm_source=devto&from=${SLUG}`,
    );
  });

  it("rewrites scoped npm package links", () => {
    expect(
      rewriteUrlForDevto(
        "https://www.npmjs.com/package/@interlace/eslint-devkit",
        SLUG,
      ),
    ).toBe(
      `https://ofriperetz.dev/go/npm/@interlace/eslint-devkit?utm_source=devto&from=${SLUG}`,
    );
  });

  it("preserves non-tracking query params on npm package links", () => {
    expect(
      rewriteUrlForDevto(
        "https://www.npmjs.com/package/eslint-plugin-security?activeTab=versions",
        SLUG,
      ),
    ).toBe(
      `https://ofriperetz.dev/go/npm/eslint-plugin-security?activeTab=versions&utm_source=devto&from=${SLUG}`,
    );
  });

  it("leaves non-package npm links untouched (profile, search)", () => {
    expect(rewriteUrlForDevto("https://www.npmjs.com/~ofri-peretz", SLUG)).toBe(
      "https://www.npmjs.com/~ofri-peretz",
    );
    expect(
      rewriteUrlForDevto("https://www.npmjs.com/search?q=%40interlace", SLUG),
    ).toBe("https://www.npmjs.com/search?q=%40interlace");
  });

  it("rewrites our GitHub repo-root links to /go/gh/", () => {
    expect(
      rewriteUrlForDevto("https://github.com/ofri-peretz/eslint", SLUG),
    ).toBe(
      `https://ofriperetz.dev/go/gh/ofri-peretz/eslint?utm_source=devto&from=${SLUG}`,
    );
  });

  it("leaves deep GitHub paths untouched (a /go/gh hop would lose the path)", () => {
    const deep =
      "https://github.com/ofri-peretz/eslint/tree/main/packages/eslint-plugin-pg";
    expect(rewriteUrlForDevto(deep, SLUG)).toBe(deep);
  });

  it("leaves other orgs' GitHub links untouched", () => {
    const other = "https://github.com/eslint/eslint";
    expect(rewriteUrlForDevto(other, SLUG)).toBe(other);
  });

  it("never rewrites links already pointing at /go/", () => {
    const go =
      "https://ofriperetz.dev/go/some-slug?utm_source=devto&from=elsewhere";
    expect(rewriteUrlForDevto(go, SLUG)).toBe(go);
  });

  it("routes owned ofriperetz.dev pages through the /go/l passthrough", () => {
    const out = new URL(
      rewriteUrlForDevto("https://ofriperetz.dev/foundations", SLUG),
    );
    expect(`${out.origin}${out.pathname}`).toBe("https://ofriperetz.dev/go/l");
    expect(out.searchParams.get("to")).toBe(
      "https://ofriperetz.dev/foundations",
    );
    expect(out.searchParams.get("utm_source")).toBe("devto");
    expect(out.searchParams.get("from")).toBe(SLUG);
  });

  it("routes *.interlace.tools links through /go/l (destination rides in ?to=)", () => {
    const out = new URL(
      rewriteUrlForDevto("https://eslint.interlace.tools/docs?tab=rules", SLUG),
    );
    expect(`${out.origin}${out.pathname}`).toBe("https://ofriperetz.dev/go/l");
    expect(out.searchParams.get("to")).toBe(
      "https://eslint.interlace.tools/docs?tab=rules",
    );
    expect(out.searchParams.get("from")).toBe(SLUG);
  });

  it("leaves unrelated links untouched", () => {
    for (const url of [
      "https://dev.to/ofri_peretz",
      "https://owasp.org/Top10/",
      "#local-anchor",
      "mailto:ofri@example.com",
    ]) {
      expect(rewriteUrlForDevto(url, SLUG)).toBe(url);
    }
  });

  it("strips incoming utm_*/from on a rewritten link, keeps other params, stamps fresh /go/ params", () => {
    // A source link carrying a utm_*, a `from`, AND a non-tracking param
    // exercises both operands of the strip predicate: the stale tracking
    // params are dropped, `keep` survives, and the /go/ params are re-stamped.
    expect(
      rewriteUrlForDevto(
        "/articles/target-post?utm_medium=email&from=old-source&keep=1",
        SLUG,
      ),
    ).toBe(
      `https://ofriperetz.dev/go/target-post?keep=1&utm_source=devto&from=${SLUG}`,
    );
  });
});

describe("transformBodyForDevto", () => {
  it("rewrites markdown link destinations in body text", () => {
    const body = [
      "Read [the benchmark](/articles/eslint-security-fn-fp-benchmark) first.",
      "Install [eslint-plugin-pg](https://www.npmjs.com/package/eslint-plugin-pg).",
      "Star [the repo](https://github.com/ofri-peretz/eslint).",
      "More on [my site](https://ofriperetz.dev).",
    ].join("\n");

    const out = transformBodyForDevto(body, SLUG);

    expect(out).toContain(
      `](https://ofriperetz.dev/go/eslint-security-fn-fp-benchmark?utm_source=devto&from=${SLUG})`,
    );
    expect(out).toContain(
      `](https://ofriperetz.dev/go/npm/eslint-plugin-pg?utm_source=devto&from=${SLUG})`,
    );
    expect(out).toContain(
      `](https://ofriperetz.dev/go/gh/ofri-peretz/eslint?utm_source=devto&from=${SLUG})`,
    );
    expect(out).toContain(
      `](https://ofriperetz.dev/go/l?to=https%3A%2F%2Fofriperetz.dev%2F&utm_source=devto&from=${SLUG})`,
    );
  });

  it("leaves fenced code blocks byte-identical", () => {
    const body = [
      "Before [link](/articles/target).",
      "```md",
      "A doc example: [link](/articles/target)",
      "npm view https://www.npmjs.com/package/eslint-plugin-pg",
      "```",
      "After [link](/articles/target).",
    ].join("\n");

    const out = transformBodyForDevto(body, SLUG);
    const lines = out.split("\n");

    expect(lines[2]).toBe("A doc example: [link](/articles/target)");
    expect(lines[3]).toBe(
      "npm view https://www.npmjs.com/package/eslint-plugin-pg",
    );
    expect(lines[0]).toContain("/go/target?utm_source=devto");
    expect(lines[5]).toContain("/go/target?utm_source=devto");
  });

  it("preserves link titles", () => {
    const body = 'See [docs](https://eslint.interlace.tools "Interlace docs").';
    expect(transformBodyForDevto(body, SLUG)).toBe(
      `See [docs](https://ofriperetz.dev/go/l?to=https%3A%2F%2Feslint.interlace.tools%2F&utm_source=devto&from=${SLUG} "Interlace docs").`,
    );
  });

  it("is idempotent — a second pass changes nothing", () => {
    const body = [
      "Read [this](/articles/target-post) and [that](https://ofriperetz.dev/articles/other#sec).",
      "Install [pkg](https://www.npmjs.com/package/eslint-plugin-jwt).",
      "Repo: [gh](https://github.com/ofri-peretz/eslint-benchmark-suite).",
      "Footer: [site](https://ofriperetz.dev) · [docs](https://eslint.interlace.tools).",
    ].join("\n");

    const once = transformBodyForDevto(body, SLUG);
    const twice = transformBodyForDevto(once, SLUG);
    expect(twice).toBe(once);
  });

  it("does not touch a body with no rewritable links", () => {
    const body = [
      "Plain text with [external](https://owasp.org/Top10/) links.",
      "",
      "And a [dev.to](https://dev.to/ofri_peretz) mention.",
    ].join("\n");

    expect(transformBodyForDevto(body, SLUG)).toBe(body);
  });

  it("strips blog `{#anchor}` suffixes from headings (dev.to prints them literally)", () => {
    const body = [
      "## The math, stated plainly {#the-math}",
      "",
      "Body paragraph.",
      "",
      "### Quick reference {#quick-reference}",
    ].join("\n");
    expect(transformBodyForDevto(body, SLUG)).toBe(
      [
        "## The math, stated plainly",
        "",
        "Body paragraph.",
        "",
        "### Quick reference",
      ].join("\n"),
    );
  });

  it("leaves a heading without an anchor suffix unchanged", () => {
    expect(transformBodyForDevto("## A plain heading", SLUG)).toBe(
      "## A plain heading",
    );
  });

  it("drops the blog-only **Skip to:** jump-nav (dev.to renders no heading ids)", () => {
    const body = [
      "Intro.",
      "",
      "**Skip to:** [The math](#the-math) | [Quick reference](#quick-reference)",
      "",
      "## The math, stated plainly {#the-math}",
    ].join("\n");
    expect(transformBodyForDevto(body, SLUG)).toBe(
      ["Intro.", "", "", "## The math, stated plainly"].join("\n"),
    );
  });

  it("leaves brace-hash text that is not a heading untouched", () => {
    const body = "A CSS-ish `a {#id}` snippet in prose stays put.";
    expect(transformBodyForDevto(body, SLUG)).toBe(body);
  });

  it("leaves `{#anchor}` and Skip-to lines inside a code fence byte-identical", () => {
    const body = [
      "```md",
      "## Heading {#kept}",
      "**Skip to:** [x](#kept)",
      "```",
    ].join("\n");
    expect(transformBodyForDevto(body, SLUG)).toBe(body);
  });
});
