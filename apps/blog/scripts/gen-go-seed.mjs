#!/usr/bin/env node
/**
 * Generate the /go/r/ stored-redirect seed SQL from the article corpus.
 *
 * The /go/ redirect layer never lets a client pass a destination URL — every
 * external link becomes a stored slug (/go/r/<hash>) whose target lives in the
 * short_links table. This script extracts every such destination from the local
 * articles (using the SAME collectDevtoLinks the publisher uses, so the slugs
 * match exactly) and prints an idempotent INSERT … ON CONFLICT.
 *
 * It is a one-time bootstrap: the publisher self-upserts new stored links on
 * every publish, so you only need this to seed the DB up front. Usage:
 *   node scripts/gen-go-seed.mjs > seed.sql
 */
import { readdirSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

import { collectDevtoLinks } from "./devto-link-transforms.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONTENT_DIR = join(__dirname, "..", "content", "articles");

const rows = new Map();
let articleCount = 0;
for (const file of readdirSync(CONTENT_DIR).filter((f) => f.endsWith(".md"))) {
  const content = readFileSync(join(CONTENT_DIR, file), "utf-8");
  const body = content.replace(/^---\n[\s\S]*?\n---\n/, ""); // strip frontmatter
  const slug = file.replace(/\.md$/, "");
  articleCount++;
  for (const link of collectDevtoLinks(body, slug)) rows.set(link.key, link);
}

const esc = (s) => s.replace(/'/g, "''");
const values = [...rows.values()]
  .sort((a, b) => a.key.localeCompare(b.key))
  .map((r) => `  ('${esc(r.key)}', 'external', '${esc(r.destination)}')`)
  .join(",\n");

process.stdout.write(
  `-- ${rows.size} stored redirects from ${articleCount} articles\n` +
    `INSERT INTO public.short_links (key, kind, destination) VALUES\n` +
    `${values}\n` +
    `ON CONFLICT (key) DO UPDATE\n` +
    `  SET destination = EXCLUDED.destination, kind = EXCLUDED.kind, updated_at = now();\n`,
);
process.stderr.write(
  `✓ ${rows.size} stored redirects from ${articleCount} articles\n`,
);
