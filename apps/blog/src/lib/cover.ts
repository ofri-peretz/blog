/**
 * Turn a same-origin cover URL into a path, for `next/image` only.
 *
 * Frontmatter stores covers as absolute URLs, and has to: OG scrapers and
 * dev.to cannot resolve a relative one, so the metadata must stay absolute.
 * But `next/image` decides local-vs-remote purely by whether `src` starts with
 * a scheme. An absolute URL — even one pointing at this very host — is treated
 * as REMOTE, which means the optimizer makes a full public round trip back to
 * ofriperetz.dev to fetch a file already sitting in this deployment's own
 * `public/` directory.
 *
 * That round trip is not free. It costs a DNS lookup, a TLS handshake and a
 * CDN/function hop before optimization can even start, it fails whenever the
 * origin is cold or rate-limited, and it is the reason `next.config.ts` needs a
 * `remotePatterns` entry for our own domain just to stop the optimizer
 * returning INVALID_IMAGE_OPTIMIZE_REQUEST. Measured p75 LCP on the affected
 * pages ranged from 2.4s to 19.4s, against ~0.8s on pages whose largest
 * element is not a cover.
 *
 * Handing `next/image` a path instead makes it read straight off the
 * filesystem. All 82 articles were affected; none needed their frontmatter
 * changed, because the conversion belongs at the render boundary rather than
 * in the content.
 *
 * Anything genuinely remote (a dev.to cover, say) is returned untouched.
 */
const SELF_ORIGINS = ["https://ofriperetz.dev", "https://www.ofriperetz.dev"];

export function localCover(url: string): string;
export function localCover(url: undefined): undefined;
export function localCover(url?: string): string | undefined;
export function localCover(url?: string): string | undefined {
  if (!url) return url;
  // Already a path — nothing to do.
  if (url.startsWith("/")) return url;
  const origin = SELF_ORIGINS.find((o) => url.startsWith(o + "/"));
  if (!origin) return url;
  // Keep the query string: covers are cache-busted with `?v=`, and dropping it
  // would serve a stale image from the optimizer's cache. The leading slash is
  // guaranteed — the origin match above requires `origin + "/"`.
  return url.slice(origin.length);
}
