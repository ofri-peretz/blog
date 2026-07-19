/**
 * Dev.to link-transform lock tests.
 *
 * The transform runs ONLY on the dev.to render path (publish-to-devto.mjs).
 * EVERY link is routed through /go/: article/npm/gh by a DERIVABLE key, and
 * everything else (owned pages, dev.to, and academic/commercial references) by
 * a STORED /go/r/<hash> slug whose destination lives in the DB — the client
 * link never carries the URL. These tests lock the rewrite rules, the stored-
 * row collection, the fence/idempotency guarantees, and the heading/jump-nav
 * strip.
 */
/* eslint-disable conventions/utm-taxonomy --
 * utm_source=devto is load-bearing: the /go/ resolver routes by
 * short_links.platforms[utm_source] and the whole pipeline standardized on
 * 'devto'. The taxonomy's 'dev_to' is the outlier, reconciled in
 * UTM_PHILOSOPHY.md, not here. */
import { describe, expect, it } from "vitest";

import {
  collectDevtoLinks,
  rewriteUrlForDevto,
  slugForExternal,
  transformBodyForDevto,
} from "../../scripts/devto-link-transforms.mjs";

const SLUG = "my-current-article";

/** The /go/r/ URL an external destination must rewrite to (destination
 * normalized the same way the transform normalizes it, via URL). */
const stored = (dest: string) =>
  `https://ofriperetz.dev/go/${slugForExternal(new URL(dest).href)}?utm_source=devto&from=${SLUG}`;

describe("slugForExternal", () => {
  it("is deterministic — same URL yields the same slug", () => {
    const u = "https://doi.org/10.1016/j.patrec.2005.10.010";
    expect(slugForExternal(u)).toBe(slugForExternal(u));
  });

  it("uses the r/ namespace + a base36 body", () => {
    expect(slugForExternal("https://owasp.org/Top10/")).toMatch(
      /^r\/[0-9a-z]+$/,
    );
  });

  it("distinct URLs get distinct slugs", () => {
    expect(slugForExternal("https://a.example/x")).not.toBe(
      slugForExternal("https://b.example/y"),
    );
  });
});

describe("rewriteUrlForDevto", () => {
  // ── DERIVABLE keys (article / npm / gh) — no DB row needed ──────────
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

  it("rewrites our GitHub repo-root links to /go/gh/", () => {
    expect(
      rewriteUrlForDevto("https://github.com/ofri-peretz/eslint", SLUG),
    ).toBe(
      `https://ofriperetz.dev/go/gh/ofri-peretz/eslint?utm_source=devto&from=${SLUG}`,
    );
  });

  it("strips incoming utm_*/from on a rewritten link, keeps other params, stamps fresh /go/ params", () => {
    expect(
      rewriteUrlForDevto(
        "/articles/target-post?utm_medium=email&from=old-source&keep=1",
        SLUG,
      ),
    ).toBe(
      `https://ofriperetz.dev/go/target-post?keep=1&utm_source=devto&from=${SLUG}`,
    );
  });

  // ── STORED keys (/go/r/<hash>) — every other link, destination in the DB ──
  it("routes npm profile / search (non-package) through a stored slug", () => {
    for (const u of [
      "https://www.npmjs.com/~ofri-peretz",
      "https://www.npmjs.com/search?q=%40interlace",
    ]) {
      expect(rewriteUrlForDevto(u, SLUG)).toBe(stored(u));
    }
  });

  it("routes deep GitHub paths through a stored slug (exact URL kept in the row)", () => {
    const deep =
      "https://github.com/ofri-peretz/eslint/tree/main/packages/eslint-plugin-pg";
    expect(rewriteUrlForDevto(deep, SLUG)).toBe(stored(deep));
  });

  it("routes other orgs' GitHub links through a stored slug", () => {
    const other = "https://github.com/eslint/eslint";
    expect(rewriteUrlForDevto(other, SLUG)).toBe(stored(other));
  });

  it("routes owned non-article pages (home, /foundations) through a stored slug", () => {
    for (const u of [
      "https://ofriperetz.dev",
      "https://ofriperetz.dev/foundations",
    ]) {
      expect(rewriteUrlForDevto(u, SLUG)).toBe(stored(u));
    }
  });

  it("routes *.interlace.tools links through a stored slug", () => {
    const d = "https://eslint.interlace.tools/docs?tab=rules";
    expect(rewriteUrlForDevto(d, SLUG)).toBe(stored(d));
  });

  it("routes dev.to and academic/commercial references through a stored slug", () => {
    for (const u of [
      "https://dev.to/ofri-peretz",
      "https://owasp.org/Top10/",
      "https://doi.org/10.1145/1143844.1143874",
    ]) {
      expect(rewriteUrlForDevto(u, SLUG)).toBe(stored(u));
    }
  });

  // ── pass-throughs ──────────────────────────────────────────────────
  it("never rewrites links already pointing at /go/", () => {
    const go =
      "https://ofriperetz.dev/go/some-slug?utm_source=devto&from=elsewhere";
    expect(rewriteUrlForDevto(go, SLUG)).toBe(go);
  });

  it("leaves anchors and non-http schemes untouched", () => {
    for (const u of ["#local-anchor", "mailto:ofri@example.com"]) {
      expect(rewriteUrlForDevto(u, SLUG)).toBe(u);
    }
  });
});

describe("collectDevtoLinks", () => {
  it("collects external destinations as {key, destination, kind} rows", () => {
    const doi = "https://doi.org/10.1016/j.patrec.2005.10.010";
    const owasp = "https://owasp.org/Top10/";
    const body = `See [ROC](${doi}) and [OWASP](${owasp}).`;
    expect(collectDevtoLinks(body, SLUG)).toEqual([
      { key: slugForExternal(doi), destination: doi, kind: "external" },
      { key: slugForExternal(owasp), destination: owasp, kind: "external" },
    ]);
  });

  it("dedups a destination cited twice", () => {
    const owasp = "https://owasp.org/Top10/";
    const body = `[a](${owasp}) then later [b](${owasp}) again.`;
    expect(collectDevtoLinks(body, SLUG)).toHaveLength(1);
  });

  it("does NOT collect derivable article/npm/gh links (no row needed)", () => {
    const body = [
      "[x](/articles/y)",
      "[n](https://www.npmjs.com/package/p)",
      "[g](https://github.com/ofri-peretz/eslint)",
    ].join("\n");
    expect(collectDevtoLinks(body, SLUG)).toEqual([]);
  });

  it("ignores links inside fenced code blocks", () => {
    const body = ["```", "[owasp](https://owasp.org/Top10/)", "```"].join("\n");
    expect(collectDevtoLinks(body, SLUG)).toEqual([]);
  });
});

describe("transformBodyForDevto", () => {
  it("routes every link kind in body text (derivable + stored)", () => {
    const site = "https://ofriperetz.dev";
    const body = [
      "Read [the benchmark](/articles/eslint-security-fn-fp-benchmark) first.",
      "Install [eslint-plugin-pg](https://www.npmjs.com/package/eslint-plugin-pg).",
      "Star [the repo](https://github.com/ofri-peretz/eslint).",
      `More on [my site](${site}).`,
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
    expect(out).toContain(`](${stored(site)})`);
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

  it("preserves link titles on a stored redirect", () => {
    const docs = "https://eslint.interlace.tools/docs";
    const body = `See [docs](${docs} "Interlace docs").`;
    expect(transformBodyForDevto(body, SLUG)).toBe(
      `See [docs](${stored(docs)} "Interlace docs").`,
    );
  });

  it("is idempotent — a second pass changes nothing", () => {
    const body = [
      "Read [this](/articles/target-post) and [that](https://ofriperetz.dev/articles/other#sec).",
      "Install [pkg](https://www.npmjs.com/package/eslint-plugin-jwt).",
      "Repo: [gh](https://github.com/ofri-peretz/eslint-benchmark-suite).",
      "Ref: [roc](https://doi.org/10.1016/j.patrec.2005.10.010).",
      "Footer: [site](https://ofriperetz.dev) · [docs](https://eslint.interlace.tools).",
    ].join("\n");

    const once = transformBodyForDevto(body, SLUG);
    const twice = transformBodyForDevto(once, SLUG);
    expect(twice).toBe(once);
  });

  it("leaves a body of only anchors / mailto / fenced links untouched", () => {
    const body = [
      "Jump to [top](#top).",
      "Mail [me](mailto:x@y.z).",
      "```",
      "[c](/articles/z)",
      "```",
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
