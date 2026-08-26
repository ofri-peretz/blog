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

  it("collects article/npm/gh links too — EVERY link is stored", () => {
    const body = [
      "[x](/articles/y)",
      "[n](https://www.npmjs.com/package/p)",
      "[g](https://github.com/ofri-peretz/eslint)",
    ].join("\n");
    expect(collectDevtoLinks(body, SLUG)).toEqual([
      {
        key: "y",
        destination: "https://ofriperetz.dev/articles/y",
        kind: "article",
      },
      {
        key: "npm/p",
        destination: "https://www.npmjs.com/package/p",
        kind: "npm",
      },
      {
        key: "gh/ofri-peretz/eslint",
        destination: "https://github.com/ofri-peretz/eslint",
        kind: "gh",
      },
    ]);
  });

  it("ignores links inside fenced code blocks", () => {
    const body = ["```", "[owasp](https://owasp.org/Top10/)", "```"].join("\n");
    expect(collectDevtoLinks(body, SLUG)).toEqual([]);
  });

  it("skips pass-through links (mailto, anchors, already-/go/) — no row for them", () => {
    const owasp = "https://owasp.org/Top10/";
    const body = [
      "Mail [me](mailto:x@y.z).",
      "Jump [up](#top).",
      "Existing [go](https://ofriperetz.dev/go/foo).",
      `Ref [owasp](${owasp}).`,
    ].join("\n");
    // Only the external ref yields a row; the three pass-throughs are skipped.
    expect(collectDevtoLinks(body, SLUG)).toEqual([
      { key: slugForExternal(owasp), destination: owasp, kind: "external" },
    ]);
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

  // Regression: crypto-misuse-taxonomy (devto_id 4286252) published with four
  // literal `{#layer-N}` tags visible mid-paragraph — the strip was heading-only.
  it("strips {#anchor} inline, not just on headings", () => {
    const body = [
      "## Four layers {#the-four-layers}",
      "**Layer 1 — the primitive.** {#layer-1} Right kind of thing?",
      "A [link](/articles/target) after {#layer-2} an anchor.",
      "### Heading with [a link](/articles/target) {#h-link}",
      "```js",
      "const css = '{#not-an-anchor}';",
      "```",
    ].join("\n");

    const out = transformBodyForDevto(body, SLUG);

    expect(out).not.toMatch(/\{#(the-four-layers|layer-1|layer-2|h-link)\}/);
    expect(out).toContain("## Four layers");
    expect(out).toContain("**Layer 1 — the primitive.** Right kind of thing?");
    // A heading carrying a link must still get its /go/ URL.
    expect(out).toContain(
      `### Heading with [a link](https://ofriperetz.dev/go/target?utm_source=devto&from=${SLUG})`,
    );
    // Fenced content is untouched, brace-looking strings included.
    expect(out).toContain("const css = '{#not-an-anchor}';");
  });

  // A double-backtick span is how markdown writes inline code that itself
  // contains a backtick; a single-backtick guard would end the span early and
  // eat the brace inside.
  it("preserves {#...} inside multi-backtick code spans", () => {
    const body = "Prose ``a {#id}`` and ```b {#id2}``` stay, {#gone} goes.";
    expect(transformBodyForDevto(body, SLUG)).toBe(
      "Prose ``a {#id}`` and ```b {#id2}``` stay, goes.",
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

describe("shiki notation markers (fenced code)", () => {
  const fence = [
    "```ts",
    "function validate(input: string) {",
    "  return eval(input); // [!code --]",
    "  return schema.parse(input); // [!code ++]",
    "  audit(input); // [!code highlight]",
    "}",
    "```",
  ].join("\n");

  it("strips markers and drops removed lines — dev.to gets the post-diff code", () => {
    const out = transformBodyForDevto(fence, SLUG);
    expect(out).not.toContain("[!code");
    // The removed (vulnerable) line goes entirely; kept lines lose only
    // the trailing marker comment.
    expect(out).not.toContain("eval(input)");
    expect(out).toContain("  return schema.parse(input);");
    expect(out).toContain("  audit(input);");
  });

  it("is idempotent and leaves marker-free fences byte-identical", () => {
    const once = transformBodyForDevto(fence, SLUG);
    expect(transformBodyForDevto(once, SLUG)).toBe(once);

    const plain = "```ts\nconst a = 1; // not a marker\n```";
    expect(transformBodyForDevto(plain, SLUG)).toBe(plain);
  });

  it("handles hash-comment and block-comment marker forms", () => {
    const bash = "```bash\nnpm install pkg # [!code highlight]\n```";
    expect(transformBodyForDevto(bash, SLUG)).toBe(
      "```bash\nnpm install pkg\n```",
    );
    const css = "```css\na { color: red; } /* [!code --] */\nb { color: blue; } /* [!code ++] */\n```";
    expect(transformBodyForDevto(css, SLUG)).toBe(
      "```css\nb { color: blue; }\n```",
    );
  });

  it("prose mentioning [!code ...] outside a fence is untouched", () => {
    const prose = "Use the `[!code highlight]` marker to mark a line.";
    expect(transformBodyForDevto(prose, SLUG)).toBe(prose);
  });
});
