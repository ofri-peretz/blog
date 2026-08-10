import path from "node:path";
import type { NextConfig } from "next";

const monorepoRoot = path.join(__dirname, "..", "..");

const nextConfig: NextConfig = {
  turbopack: {
    root: monorepoRoot,
  },
  outputFileTracingRoot: monorepoRoot,
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,

  // Same-origin PostHog ingest (ANALYTICS_PHILOSOPHY §9). Ad blockers match on
  // the `*.i.posthog.com` hostname, not on payload shape, so proxying through
  // our own origin is what recovers the ~30-40% of visitors they were dropping.
  // `skipTrailingSlashRedirect` is required: Next would otherwise 308
  // `/ingest/e/` -> `/ingest/e`, and posthog-js does not follow the redirect.
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      // Static assets (the recorder/surveys bundles) come from a different
      // upstream host than the event API — order matters, this must precede
      // the catch-all below or `:path*` swallows it.
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
    ];
  },

  // Security headers. All free — they ride on responses Vercel already sends.
  // HSTS is set by Vercel; these are the ones that were missing.
  //
  // CSP ships as Report-Only on purpose: Next injects inline scripts for
  // hydration, so an enforcing policy needs nonces and would break the site if
  // any origin is missed. Report-Only surfaces violations in the console
  // without blocking. Promote to `Content-Security-Policy` once the reports
  // come back clean for a few days.
  //
  // No 'unsafe-eval' and no 'unsafe-inline' on script-src — our own
  // eslint-plugin-browser-security rightly flags both (CWE-79 / CWE-95): a
  // policy carrying them buys almost no XSS protection. Next's inline
  // hydration scripts are covered by 'strict-dynamic' + the per-request nonce
  // Next emits; browsers that don't grok strict-dynamic fall back to the
  // host allowlist. style-src keeps 'unsafe-inline' because Tailwind and
  // next/font inject style attributes with no nonce hook — that is a
  // materially smaller risk than script injection, and it is the reason this
  // stays Report-Only until the reports are clean.
  async headers() {
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'strict-dynamic' https://us-assets.i.posthog.com",
      // Tailwind and next/font emit inline style attributes with no nonce hook,
      // so this cannot be removed without dropping both. Scoped to styles, never
      // scripts: no script execution is permitted by this directive. Revisit if
      // Next exposes a nonce for injected <style> tags.
      // eslint-disable-next-line browser-security/no-unsafe-inline-csp
      "style-src 'self' 'unsafe-inline'",
      // data: for inlined SVG/blur placeholders; dev.to hosts the covers.
      "img-src 'self' data: blob: https://media2.dev.to https://media.dev.to https://dev-to-uploads.s3.amazonaws.com https://dev-to-uploads.s3.us-east-2.amazonaws.com",
      "font-src 'self' data:",
      "connect-src 'self' https://us.i.posthog.com https://us-assets.i.posthog.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
      "upgrade-insecure-requests",
    ].join("; ");

    return [
      {
        // /articles reads ?page/?tag, which makes the route dynamic and
        // defaults to `no-store` — every hit re-renders at the origin even
        // though the data is local markdown that only changes on deploy.
        // s-maxage lets the edge hold each variant; stale-while-revalidate
        // means a visitor never waits for the refresh.
        source: "/articles",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=60, stale-while-revalidate=86400",
          },
        ],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
          { key: "Content-Security-Policy-Report-Only", value: csp },
        ],
      },
    ];
  },
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 31_536_000,
    // Covers now reach <Image> as paths (see src/lib/cover.ts), and they carry
    // a `?v=` cache-buster. Next 16 rejects a LOCAL image with a query string
    // unless localPatterns says otherwise — the build fails outright with
    // "using a query string which is not configured in images.localPatterns".
    //
    // `search` is omitted deliberately, and that is the whole point of this
    // entry: Next's matcher only compares `search` when the pattern defines it
    // (matchLocalPattern short-circuits on `pattern.search !== undefined`), so
    // leaving it out is the only way to accept an arbitrary `?v=`. Pinning
    // `search: "?v=b2"` would work today and break silently the next time a
    // cover is re-rendered and versioned.
    //
    // `/**` keeps the previous behaviour for every other local image: with no
    // localPatterns at all Next allows them unconditionally, so anything
    // narrower here would start rejecting the avatar and icons.
    localPatterns: [{ pathname: "/**" }],
    // Article covers come from three places: self-hosted under /cdn (relative,
    // needs no entry), Dev.to's CDN proxy, and Dev.to's S3 bucket for covers
    // uploaded through their editor. Without these, <Image> throws on ~25 posts.
    remotePatterns: [
      // Our own domain. Frontmatter stores absolute URLs (OG scrapers and
      // dev.to cannot resolve relative ones), so next/image treats the cover
      // as REMOTE even though it is served from this very host — and without
      // this entry the optimizer answers INVALID_IMAGE_OPTIMIZE_REQUEST, i.e.
      // every self-hosted cover 400s in the browser while the raw file 200s.
      { protocol: "https", hostname: "ofriperetz.dev" },
      { protocol: "https", hostname: "media2.dev.to" },
      { protocol: "https", hostname: "media.dev.to" },
      { protocol: "https", hostname: "dev-to-uploads.s3.amazonaws.com" },
      { protocol: "https", hostname: "dev-to-uploads.s3.us-east-2.amazonaws.com" },
    ],
  },
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  // Force Vercel's file-trace bundler to include the article corpus in the
  // serverless function payload. Without this, dynamic routes that read
  // content/ at request time (anything with `searchParams`, on-demand
  // revalidate, etc.) come up empty after the trip from build → bundle →
  // lambda. Anchor paths are relative to `apps/blog/` (the project root).
  outputFileTracingIncludes: {
    "/articles": ["./content/articles/**/*.md"],
    "/articles/[slug]": ["./content/articles/**/*.md"],
    "/": ["./content/articles/**/*.md"],
  },
  async redirects() {
    return [
      // Retired Satori OG routes (a drifted second implementation of the
      // brand — no mark, hand-drawn card). The authored covers under
      // /cdn/blog-cover-image/ are canonical: <slug>.jpg is the 1000x420
      // dev.to ratio (/og/cover's job), <slug>-og.jpg the 1200x630 social
      // ratio (/og/article's job). Every published slug has both files, so
      // external caches and social scrapers holding old URLs land on the
      // real cover instead of a 404.
      {
        source: "/og/cover/:slug",
        destination: "/cdn/blog-cover-image/:slug.jpg",
        permanent: true,
      },
      {
        source: "/og/article/:slug",
        destination: "/cdn/blog-cover-image/:slug-og.jpg",
        permanent: true,
      },
      // Legacy Nuxt route — the Projects section now lives on the homepage.
      // Preserve the URL for inbound links and bookmarks.
      { source: "/projects", destination: "/#projects", permanent: true },
      // /stats and /analytics were portfolio-style snapshot pages. The
      // canonical metrics surface is now /scorecard (supabase-backed North
      // Star, monotonic, provenance-linked) per the impact vision —
      // schema-enforced ledger over generic dashboard. Per-plugin npm
      // breakdown from /stats was folded into /scorecard. Permanent 301
      // so search and inbound links land in the right place.
      { source: "/stats", destination: "/scorecard", permanent: true },
      { source: "/analytics", destination: "/scorecard", permanent: true },
      // Benchmark-series duplicate consolidation: each canonical comparison
      // absorbed its twin (the two local files shared one dev.to post).
      // Redirect the retired slugs to the kept canonical.
      {
        source:
          "/articles/sonarjs-has-269-rules-it-still-misses-65-of-security-vulnerabilities-3jh",
        destination: "/articles/benchmark-sonarjs-vs-interlace",
        permanent: true,
      },
      {
        source:
          "/articles/microsofts-eslint-security-plugin-catches-10-of-vulnerabilities-heres-what-it-misses",
        destination: "/articles/benchmark-microsoft-sdl-vs-interlace",
        permanent: true,
      },
      // eslint-plugin-security: the `-abandoned` twin shared one dev.to post
      // (devto_id 3237157) with the kept `-96h` canonical and carried the
      // now-corrected "unmaintained" framing. Retire it to the canonical.
      {
        source: "/articles/eslint-plugin-security-abandoned",
        destination:
          "/articles/eslint-plugin-security-is-unmaintained-heres-what-nobody-tells-you-96h",
        permanent: true,
      },
      // import-next perf cluster: the post-mortem + the (corrupted) getting-started
      // duplicate the kept benchmark canonical. Redirect both to it.
      {
        source: "/articles/why-eslint-plugin-import-slow-fix",
        destination:
          "/articles/eslint-plugin-import-vs-eslint-plugin-import-next-up-to-100x-faster",
        permanent: true,
      },
      {
        source: "/articles/getting-started-with-eslint-plugin-import-next",
        destination:
          "/articles/eslint-plugin-import-vs-eslint-plugin-import-next-up-to-100x-faster",
        permanent: true,
      },
      // NestJS getting-started: the file was renamed to match its frontmatter
      // slug (source.ts derives slugs from filenames, so the old filename-slug
      // served the page while canonical/OG URLs pointed at the frontmatter
      // slug and 404'd). Redirect the old filename-derived slug to the
      // canonical one for any indexed/inbound links.
      {
        source: "/articles/getting-started-eslint-plugin-nestjs-security",
        destination: "/articles/nestjs-guards-pipes-throttlers-6-eslint-rules",
        permanent: true,
      },
      // AI-security Part 2 (Hydra): two local files served the same article.
      // The retired blog-only twin had no devto_id, matched dev.to post
      // 3241678 by exact title, and PUT last on every publish run — clobbering
      // the live canonical_url back to this old slug. The kept file carries
      // the devto_id, so its filename-derived slug is canonical.
      {
        source: "/articles/the-ai-hydra-problem",
        destination: "/articles/the-ai-hydra-problem-fix-one-ai-bug-get-two-more",
        permanent: true,
      },
      // AI-security Part 1: the title + body say "80 functions" (4 models ×
      // 20), but the published canonical slug + dev.to permalink say "60"
      // (the original 3-model run, before Opus 4.6 was appended). The 60-slug
      // is indexed and 27 sibling articles link to it, so it stays canonical.
      // This catches readers who type/share the intuitive "80" URL and lands
      // them on the canonical instead of a 404.
      {
        source:
          "/articles/i-let-claude-write-80-functions-65-75-had-security-vulnerabilities",
        destination:
          "/articles/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities",
        permanent: true,
      },
      // Orphan migrations (2026-07-19): the live dev.to copies of these two
      // articles already carry canonical_urls / body links pointing at slugs
      // that never existed on the blog. The migrated files use the graph's
      // shorter slugs; these redirects make every published link resolve
      // without editing any dev.to body.
      {
        source: "/articles/circular-dependencies-javascript",
        destination: "/articles/circular-dependencies-in-javascript-explained",
        permanent: true,
      },
      {
        source:
          "/articles/payload-cms-has-508-circular-dependencies-nextjs-has-17-heres-why-they-form-in-every-large-js",
        destination: "/articles/payload-508-circular-dependency-cycles",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
