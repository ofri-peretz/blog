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
    ];
  },
};

export default nextConfig;
