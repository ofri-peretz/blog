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
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 31_536_000,
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
    ];
  },
};

export default nextConfig;
