/**
 * Dev.to Body Link Transforms
 *
 * Applied ONLY to the dev.to render path (publish-to-devto.mjs). The blog
 * render never calls this — local markdown keeps canonical absolute
 * /articles/ links and stays UTM-free and timeless.
 *
 * At publish time the dev.to copy gets (plan L5 / L5.5 / L5.6):
 *   1. Relative /articles/... links absolutized to https://ofriperetz.dev/...
 *      (relative links pushed to dev.to resolve against dev.to and break).
 *   2. Cross-article links routed through /go/<target-slug> — repointable
 *      links + X→Y edge analytics via ?from=<source-slug>.
 *   3. npmjs.com/package/<pkg> → /go/npm/<pkg> and
 *      github.com/ofri-peretz/<repo> (repo ROOT only) → /go/gh/ofri-peretz/<repo>
 *      for exact per-article click attribution. Deep GitHub paths
 *      (tree/blob/issues) and other orgs' GitHub links are never touched.
 *   4. Remaining ofriperetz.dev / *.interlace.tools links (footer, homepage,
 *      docs sites) decorated with UTMs — only domains where our PostHog runs.
 *
 * Guarantees:
 *   - Links already pointing at /go/ are never rewritten (idempotent — the
 *     whole transform is a fixed point on its own output).
 *   - Fenced code blocks are left byte-identical.
 *   - Unrecognized / non-http destinations (anchors, mailto:) pass through.
 *
 * @author Ofri Peretz
 */

const SITE_URL = "https://ofriperetz.dev";

/** Matches a markdown inline link destination: `](url)` or `](url "title")`. */
const INLINE_LINK_REGEX = /\]\(([^()\s]+)((?:\s+"[^"]*")?)\)/g;

/** Matches an opening or closing fenced-code-block line. */
const FENCE_REGEX = /^\s*(```|~~~)/;

/**
 * Check if a hostname is the blog's own domain
 */
function isSiteHost(hostname) {
  return hostname === "ofriperetz.dev" || hostname === "www.ofriperetz.dev";
}

/**
 * Check if a hostname is an owned interlace.tools domain
 */
function isInterlaceHost(hostname) {
  return (
    hostname === "interlace.tools" || hostname.endsWith(".interlace.tools")
  );
}

/**
 * Drop utm_* / from params (they get replaced by the /go/ params)
 */
function stripTrackingParams(searchParams) {
  for (const key of [...searchParams.keys()]) {
    if (key.startsWith("utm_") || key === "from") {
      searchParams.delete(key);
    }
  }
}

/**
 * Build a /go/ URL: preserve non-tracking query params and the hash,
 * then stamp utm_source=devto&from=<source-slug> (routing + attribution).
 */
function buildGoUrl(goPath, sourceUrl, articleSlug) {
  const go = new URL(`${SITE_URL}${goPath}`);
  stripTrackingParams(sourceUrl.searchParams);
  for (const [key, value] of sourceUrl.searchParams) {
    go.searchParams.append(key, value);
  }
  go.searchParams.set("utm_source", "devto");
  go.searchParams.set("from", articleSlug);
  go.hash = sourceUrl.hash;
  return go.href;
}

/**
 * Rewrite a single link destination for the dev.to render.
 * Pure — returns the input string unchanged when no rule applies.
 *
 * @param {string} rawUrl - The link destination as written in the markdown
 * @param {string} articleSlug - Slug of the article being rendered (the SOURCE)
 * @returns {string} The rewritten destination, or rawUrl unchanged
 */
export function rewriteUrlForDevto(rawUrl, articleSlug) {
  // 1. Absolutize relative /articles/... links
  let candidate = rawUrl;
  if (candidate.startsWith("/articles/")) {
    candidate = `${SITE_URL}${candidate}`;
  }

  let url;
  try {
    url = new URL(candidate);
  } catch {
    return rawUrl; // anchors, other relative paths, malformed — leave as-is
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return rawUrl; // mailto:, etc.
  }

  const host = url.hostname;

  // Never rewrite links already pointing at /go/
  if (isSiteHost(host) && url.pathname.startsWith("/go/")) {
    return rawUrl;
  }

  // 2. Cross-article links → /go/<target-slug>
  if (isSiteHost(host)) {
    const articleMatch = url.pathname.match(/^\/articles\/([^/]+)\/?$/);
    if (articleMatch) {
      return buildGoUrl(`/go/${articleMatch[1]}`, url, articleSlug);
    }
  }

  // 3a. npm package links → /go/npm/<pkg>
  if (host === "npmjs.com" || host === "www.npmjs.com") {
    const pkgMatch = url.pathname.match(/^\/package\/(.+?)\/?$/);
    if (pkgMatch) {
      return buildGoUrl(`/go/npm/${pkgMatch[1]}`, url, articleSlug);
    }
    return rawUrl; // profile / search / other npm pages — leave as-is
  }

  // 3b. Our GitHub repos (repo ROOT only) → /go/gh/ofri-peretz/<repo>.
  // Deep links keep their exact destination (a /go/gh hop would land on the
  // repo page and lose the path); other orgs' links are never touched.
  if (host === "github.com" || host === "www.github.com") {
    const repoMatch = url.pathname.match(/^\/ofri-peretz\/([^/]+)\/?$/);
    if (repoMatch) {
      const go = new URL(`${SITE_URL}/go/gh/ofri-peretz/${repoMatch[1]}`);
      go.searchParams.set("utm_source", "devto");
      go.searchParams.set("from", articleSlug);
      go.hash = url.hash;
      return go.href;
    }
    return rawUrl;
  }

  // 4. Remaining owned-domain links → UTM decoration
  if (isSiteHost(host) || isInterlaceHost(host)) {
    if (url.searchParams.has("utm_source")) {
      return rawUrl; // already decorated (hand-written UTMs in older articles)
    }
    url.searchParams.set("utm_source", "devto");
    url.searchParams.set("utm_medium", "article");
    url.searchParams.set("utm_campaign", articleSlug);
    return url.href;
  }

  return rawUrl;
}

/**
 * Transform every markdown inline-link destination in a dev.to body.
 * Pure and idempotent — fenced code blocks pass through byte-identical.
 *
 * @param {string} body - The article body markdown (post component-transforms)
 * @param {string} articleSlug - Slug of the article being rendered
 * @returns {string} The transformed body
 */
export function transformBodyForDevto(body, articleSlug) {
  let inFence = false;

  return body
    .split("\n")
    .map((line) => {
      if (FENCE_REGEX.test(line)) {
        inFence = !inFence;
        return line;
      }
      if (inFence) return line;

      return line.replace(INLINE_LINK_REGEX, (match, linkUrl, title) => {
        const rewritten = rewriteUrlForDevto(linkUrl, articleSlug);
        return rewritten === linkUrl ? match : `](${rewritten}${title})`;
      });
    })
    .join("\n");
}
