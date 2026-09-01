import { join } from "node:path";
import type { NextConfig } from "next";

/**
 * LOCAL ONLY. This app reads the footprint control-room files off disk and
 * exposes actions that write to them; it must never be deployed. It is not
 * referenced by the blog's Vercel project and has no production build target.
 */
const nextConfig: NextConfig = {
  devIndicators: false,
  // Pinned because Turbopack walks up looking for a lockfile and finds
  // ~/pnpm-lock.yaml, silently rooting the workspace at the home directory.
  //
  // Root is the WORKSPACE (blog-public), not this app: npm hoists next/react to
  // blog-public/node_modules, so rooting at the app dir puts the toolchain
  // outside the compile boundary and Turbopack cannot resolve next/package.json.
  turbopack: { root: join(__dirname, "..", "..") },
};

export default nextConfig;
