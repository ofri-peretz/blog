/**
 * Dev.to Body Link Transforms
 *
 * Applied ONLY to the dev.to render path (publish-to-devto.mjs). The blog
 * render never calls this — local markdown keeps canonical absolute
 * /articles/ links and stays UTM-free and timeless.
 *
 * EVERY outbound link in the dev.to copy is routed through /go/ AND stored in
 * the short_links table (like bitly): the client link carries only a /go/ id,
 * the destination lives in the DB, and the resolver looks it up. Two id shapes:
 *   - READABLE ids for our own surfaces: /go/<article-slug>, /go/npm/<pkg>,
 *     /go/gh/<owner>/<repo>. An article row also gets a platforms.devto copy
 *     (dev.to reader → dev.to copy) from that article's own publish.
 *   - HASH ids for everything else — owned non-article pages, *.interlace.tools,
 *     dev.to, and every academic / commercial reference — /go/r/<cyrb53>.
 * Either way collectDevtoLinks(body) returns the {key,destination,kind} rows and
 * the publisher upserts them at publish time; the client NEVER passes a URL.
 *
 * Also strips blog-only `{#anchor}` ids — in headings AND inline, since dev.to
 * prints the token verbatim wherever it sits — and the "**Skip to:**" jump-nav
 * (dev.to renders neither). Anchors inside inline code spans are preserved.
 *
 * Guarantees:
 *   - Links already pointing at /go/ are never rewritten (idempotent).
 *   - Fenced code blocks are left byte-identical.
 *   - Non-http destinations (anchors, mailto:) pass through untouched.
 *
 * @author Ofri Peretz
 */

const SITE_URL = "https://ofriperetz.dev";

/** Matches a markdown inline link destination: `](url)` or `](url "title")`. */
const INLINE_LINK_REGEX = /\]\(([^()\s]+)((?:\s+"[^"]*")?)\)/g;

/** Matches an opening or closing fenced-code-block line. */
const FENCE_REGEX = /^\s*(```|~~~)/;

/** A heading line (H1–H6) carrying a blog `{#custom-anchor}` id suffix. */
const HEADING_ANCHOR_REGEX = /^(#{1,6}\s.*?)\s*\{#[^}]+\}\s*$/;
// dev.to prints `{#anchor}` verbatim WHEREVER it appears, not only in headings.
// crypto-misuse-taxonomy shipped with four literal `{#layer-N}` tags mid-paragraph
// (`**Layer 1 — the primitive.** {#layer-1} Right kind of thing?…`) because the
// heading-only regex above never saw them. Anchors on any non-fence line go.
//
// The leading alternation is load-bearing, not decoration: an INLINE CODE SPAN is
// matched first and handed back untouched, so a CSS example like `a {#id}` — which
// is prose about braces, not an anchor — survives. Without it this eats those too.
const INLINE_ANCHOR_REGEX = /(`[^`]*`)|[ \t]*\{#[a-zA-Z0-9_-]+\}/g;

/** The blog-only "**Skip to:**" jump-nav line (dead on dev.to — no heading ids). */
const SKIP_TO_REGEX = /^\s*\*\*Skip to:\*\*/;

/** Check if a hostname is the blog's own domain. */
function isSiteHost(hostname) {
  return hostname === "ofriperetz.dev" || hostname === "www.ofriperetz.dev";
}

/**
 * cyrb53 — a small, fast, dependency-free string hash (well-known public
 * domain). Pure integer math, so it is byte-identical across Node / vitest /
 * browser and stable forever: the same destination URL always yields the same
 * /go/r/ slug, which keeps the DB rows idempotent across re-publishes.
 */
function cyrb53(str) {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/**
 * Deterministic stored-redirect slug for an external destination URL.
 * `r/` namespaces it so the resolver looks the row up instead of deriving an
 * article path (and a missing row fails safe to the blog home, never a 404).
 */
export function slugForExternal(destUrl) {
  return `r/${cyrb53(destUrl).toString(36)}`;
}

/**
 * Build a DERIVABLE /go/ URL (article/npm/gh): carry the source's non-tracking
 * query params + hash, then stamp utm_source=devto&from=<slug>. Reads
 * `sourceUrl` without mutating it.
 */
function buildGoUrl(goPath, sourceUrl, articleSlug) {
  const go = new URL(`${SITE_URL}${goPath}`);
  for (const [key, value] of sourceUrl.searchParams) {
    if (key.startsWith("utm_") || key === "from") continue;
    go.searchParams.append(key, value);
  }
  go.searchParams.set("utm_source", "devto");
  go.searchParams.set("from", articleSlug);
  go.hash = sourceUrl.hash;
  return go.href;
}

/**
 * Classify + rewrite one link for the dev.to render.
 *
 * @param {string} rawUrl - the link destination as written in the markdown
 * @param {string} articleSlug - slug of the SOURCE article
 * @returns {{ href: string, stored: {key:string,destination:string,kind:string}|null }}
 *   href   — what to write into the markdown (rawUrl unchanged if no rule fits);
 *   stored — the {key,destination,kind} row to upsert for this link (null only
 *            for untouched pass-throughs: anchors, mailto, already-/go/ links).
 */
function classifyDevtoLink(rawUrl, articleSlug) {
  // 1. Absolutize relative /articles/... links.
  let candidate = rawUrl;
  if (candidate.startsWith("/articles/")) candidate = `${SITE_URL}${candidate}`;

  let url;
  try {
    url = new URL(candidate);
  } catch {
    return { href: rawUrl, stored: null }; // anchors, relative paths, malformed
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { href: rawUrl, stored: null }; // mailto:, etc.
  }

  const host = url.hostname;

  // Already a /go/ link — idempotent fixed point.
  if (isSiteHost(host) && url.pathname.startsWith("/go/")) {
    return { href: rawUrl, stored: null };
  }

  // cross-article → /go/<target-slug>; row destination = blog canonical, and
  // the target's own publish adds platforms.devto (dev.to reader → dev.to copy).
  if (isSiteHost(host)) {
    const m = url.pathname.match(/^\/articles\/([^/]+)\/?$/);
    if (m) {
      return {
        href: buildGoUrl(`/go/${m[1]}`, url, articleSlug),
        stored: {
          key: m[1],
          destination: `${url.origin}${url.pathname}`,
          kind: "article",
        },
      };
    }
  }
  // npm package → /go/npm/<pkg> (profile / other npm pages → STORED below)
  if (host === "npmjs.com" || host === "www.npmjs.com") {
    const m = url.pathname.match(/^\/package\/(.+?)\/?$/);
    if (m) {
      return {
        href: buildGoUrl(`/go/npm/${m[1]}`, url, articleSlug),
        stored: {
          key: `npm/${m[1]}`,
          destination: `${url.origin}${url.pathname}`,
          kind: "npm",
        },
      };
    }
  }
  // our GitHub repo ROOT → /go/gh/ofri-peretz/<repo>
  // (deep paths / other orgs → STORED below, so their exact URL is preserved).
  if (host === "github.com" || host === "www.github.com") {
    const m = url.pathname.match(/^\/ofri-peretz\/([^/]+)\/?$/);
    if (m) {
      return {
        href: buildGoUrl(`/go/gh/ofri-peretz/${m[1]}`, url, articleSlug),
        stored: {
          key: `gh/ofri-peretz/${m[1]}`,
          destination: `${url.origin}${url.pathname}`,
          kind: "gh",
        },
      };
    }
  }

  // STORED: everything else — owned non-article pages, *.interlace.tools,
  // dev.to, and every academic / commercial reference — → /go/r/<hash>. The
  // destination is saved server-side; the client link only carries the slug.
  const key = slugForExternal(url.href);
  const go = new URL(`${SITE_URL}/go/${key}`);
  go.searchParams.set("utm_source", "devto");
  go.searchParams.set("from", articleSlug);
  return {
    href: go.href,
    stored: { key, destination: url.href, kind: "external" },
  };
}

/**
 * Rewrite a single link destination for the dev.to render.
 * @returns {string} the rewritten destination (or rawUrl unchanged).
 */
export function rewriteUrlForDevto(rawUrl, articleSlug) {
  return classifyDevtoLink(rawUrl, articleSlug).href;
}

/**
 * Collect the {key,destination,kind} row EVERY routed link in a body maps to,
 * so the publisher can upsert them all — article, npm, gh, and every external
 * reference — before it publishes. The destination is stored server-side and
 * never rides in the client link. Deduped by key; fenced code blocks and pure
 * pass-throughs (anchors, mailto, already-/go/) are skipped.
 *
 * @returns {Array<{key:string,destination:string,kind:string}>}
 */
export function collectDevtoLinks(body, articleSlug) {
  const rows = new Map();
  let inFence = false;
  for (const line of body.split("\n")) {
    if (FENCE_REGEX.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    for (const m of line.matchAll(INLINE_LINK_REGEX)) {
      const { stored } = classifyDevtoLink(m[1], articleSlug);
      if (stored) rows.set(stored.key, stored);
    }
  }
  return [...rows.values()];
}

/**
 * Transform a dev.to body: drop the blog-only heading anchors + jump-nav
 * dev.to can't render, then route every inline link through /go/. Pure and
 * idempotent; fenced code blocks pass through byte-identical.
 *
 * dev.to gives rendered headings no `id`, so `## H {#anchor}` would print the
 * `{#anchor}` verbatim and `[x](#anchor)` jump links would have no target. We
 * strip the `{#anchor}` suffix and drop the "**Skip to:**" line.
 *
 * @param {string} body - the article body markdown (post component-transforms)
 * @param {string} articleSlug - slug of the article being rendered
 * @returns {string} the transformed body
 */
export function transformBodyForDevto(body, articleSlug) {
  let inFence = false;
  const out = [];

  for (const line of body.split("\n")) {
    if (FENCE_REGEX.test(line)) {
      inFence = !inFence;
      out.push(line);
      continue;
    }
    if (inFence) {
      out.push(line);
      continue;
    }
    // Drop the blog-only jump-nav — its anchors have no target on dev.to.
    if (SKIP_TO_REGEX.test(line)) continue;
    // Strip every `{#anchor}` on the line, heading or inline, BEFORE the link
    // rewrite — so a heading that also carries a link still gets its /go/ URL
    // (the old heading-only branch returned early and skipped that).
    const stripped = line
      .replace(HEADING_ANCHOR_REGEX, "$1")
      .replace(INLINE_ANCHOR_REGEX, (match, codeSpan) => codeSpan ?? "");
    // Route every inline link through /go/.
    out.push(
      stripped.replace(INLINE_LINK_REGEX, (match, linkUrl, title) => {
        const rewritten = rewriteUrlForDevto(linkUrl, articleSlug);
        return rewritten === linkUrl ? match : `](${rewritten}${title})`;
      }),
    );
  }

  return out.join("\n");
}
