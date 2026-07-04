#!/usr/bin/env node
/**
 * DEV.TO Article Sync Script
 *
 * This script fetches articles from DEV.TO and generates local content files
 * that serve as canonical URLs at ofriperetz.dev/articles/[slug].
 *
 * Key Features:
 * - Fetches full article content (markdown body)
 * - Preserves slug mapping for SEO continuity
 * - Generates frontmatter with all metadata for OG/SEO
 * - Safe to re-run - updates existing articles without breaking SEO
 * - Creates article manifest for the articles listing page
 *
 * Usage:
 *   node scripts/sync-devto-articles.mjs
 *
 * Environment:
 *   DEVTO_API_KEY - Required for authenticated API (gets full markdown body)
 *
 * @author Ofri Peretz
 * @see https://developers.forem.com/api
 */

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CONTENT_DIR = join(__dirname, "..", "content", "articles");
const MANIFEST_PATH = join(__dirname, "..", "content", "articles.json");

const DEVTO_API_KEY = process.env.DEVTO_API_KEY;
const DEVTO_USERNAME = "ofri-peretz";
const SITE_URL = "https://ofriperetz.dev";

/**
 * @typedef {Object} DevToArticle
 * @property {number} id
 * @property {string} title
 * @property {string} description
 * @property {string} slug
 * @property {string} url
 * @property {string} canonical_url
 * @property {string|null} cover_image
 * @property {string} social_image
 * @property {string} published_at
 * @property {string} edited_at
 * @property {number} reading_time_minutes
 * @property {number} positive_reactions_count
 * @property {number} comments_count
 * @property {number} page_views_count
 * @property {string[]} tag_list
 * @property {string} body_markdown
 * @property {Object} user
 */

/**
 * Fetch all published articles from DEV.TO
 */
async function fetchArticles() {
  console.log("📡 Fetching articles from DEV.TO...");

  const headers = DEVTO_API_KEY ? { "api-key": DEVTO_API_KEY } : {};

  try {
    // Use authenticated endpoint if API key available (includes views)
    const endpoint = DEVTO_API_KEY
      ? "https://dev.to/api/articles/me/published"
      : `https://dev.to/api/articles?username=${DEVTO_USERNAME}&per_page=100`;

    const response = await fetch(endpoint, {
      headers,
      timeout: 30000,
    });

    if (!response.ok) {
      throw new Error(
        `DEV.TO API error: ${response.status} ${response.statusText}`,
      );
    }

    const articles = await response.json();
    console.log(`✅ Found ${articles.length} published articles`);

    return articles;
  } catch (error) {
    console.error("❌ Failed to fetch articles:", error.message);
    throw error;
  }
}

/**
 * Fetch full article details including markdown body
 */
async function fetchArticleDetails(articleId) {
  const headers = DEVTO_API_KEY ? { "api-key": DEVTO_API_KEY } : {};

  try {
    const response = await fetch(`https://dev.to/api/articles/${articleId}`, {
      headers,
      timeout: 15000,
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch article ${articleId}: ${response.status}`,
      );
    }

    return await response.json();
  } catch (error) {
    console.error(`❌ Failed to fetch article ${articleId}:`, error.message);
    return null;
  }
}

/**
 * Generate a URL-safe slug from the DEV.TO slug
 * Preserves the original slug for SEO continuity
 */
function normalizeSlug(devtoSlug) {
  // DEV.TO slugs include a unique ID suffix (e.g., "my-article-4k2m")
  // We strip this suffix to use clean slugs for our canonical URLs
  const baseSlug = devtoSlug
    .toLowerCase()
    .replace(/-[a-z0-9]{4,5}$/, "") // Strip DEV.TO hash suffix
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  // Manual mappings for shortened/custom clean slugs
  const mappings = {
    "transaction-race-conditions-why-begin-on-pool-breaks-everything":
      "transaction-race-conditions-begin-on-pool",
    "the-30-minute-security-audit-a-static-analysis-protocol-for-onboarding":
      "30-minute-security-audit-onboarding",
    "hardening-the-data-layer-the-node-postgres-static-analysis-standard":
      "getting-started-eslint-plugin-pg",
    "runtime-security-at-scale-the-nodejs-static-analysis-standard":
      "getting-started-eslint-plugin-node-security",
    "securing-middleware-the-expressjs-static-analysis-standard":
      "getting-started-eslint-plugin-express-security",
    "securing-the-edge-the-lambda-static-analysis-standard":
      "getting-started-eslint-plugin-lambda-security",
    "securing-the-modern-api-the-nestjs-static-analysis-standard":
      "nestjs-guards-pipes-throttlers-6-eslint-rules",
    "the-owasp-llm-protocol-100-automated-coverage-for-vercel-ai":
      "owasp-llm-top-10-vercel-ai-sdk",
    "searchpath-hijacking-the-postgresql-attack-youve-never-heard-of":
      "searchpath-hijacking-postgresql-attack",
    "the-n1-insert-loop-that-slowed-our-api-to-a-crawl":
      "n-plus-1-insert-loop-api-performance",
    "the-connection-leak-that-took-down-our-production-database":
      "database-connection-leak-production-outage",
    "why-eslint-plugin-import-takes-45-seconds-and-how-we-fixed-it":
      "why-eslint-plugin-import-slow-fix",
    "your-vercel-ai-sdk-app-has-a-prompt-injection-vulnerability":
      "vercel-ai-sdk-prompt-injection-vulnerability",
    "sql-injection-in-node-postgres-the-pattern-everyone-gets-wrong":
      "sql-injection-node-postgres-pattern",
    "hardcoded-secrets-the-1-vulnerability-ai-agents-can-auto-fix":
      "hardcoded-secrets-ai-agents-autofix",
    "copy-from-exploits-when-postgresql-reads-your-filesystem":
      "postgresql-copy-from-exploit-filesystem-access",
    "getting-started-with-eslint-plugin-browser-security":
      "getting-started-eslint-plugin-browser-security",
    "getting-started-with-eslint-plugin-crypto":
      "getting-started-eslint-plugin-node-security", // Mapping to node security if crypto is bundled
    "getting-started-with-eslint-plugin-jwt":
      "getting-started-eslint-plugin-jwt",
    "getting-started-with-eslint-plugin-nestjs-security":
      "nestjs-guards-pipes-throttlers-6-eslint-rules",
    "getting-started-with-eslint-plugin-pg": "getting-started-eslint-plugin-pg",
    "getting-started-with-eslint-plugin-secure-coding":
      "getting-started-eslint-plugin-secure-coding",
    "getting-started-with-eslint-plugin-vercel-ai-security":
      "getting-started-eslint-plugin-vercel-ai-security",
  };

  return mappings[baseSlug] || baseSlug;
}

/**
 * Convert DEV.TO article to local markdown content file
 */
function generateMarkdownFile(article) {
  const slug = normalizeSlug(article.slug);
  const canonicalUrl = `${SITE_URL}/articles/${slug}`;
  const devtoUrl = article.url;

  // Create YAML frontmatter with all SEO-critical metadata
  const frontmatter = {
    title: article.title,
    description: article.description || "",
    slug: slug,

    // SEO & Canonical
    canonical_url: canonicalUrl,
    devto_url: devtoUrl,
    devto_id: article.id,

    // Dates (ISO format for SEO)
    published_at: article.published_at,
    edited_at: article.edited_at || null,

    // Media
    cover_image: article.cover_image || article.social_image || null,
    social_image: article.social_image || null,

    // Metadata
    reading_time_minutes: article.reading_time_minutes || 5,
    tags: normalizeTags(article.tag_list),

    // Engagement metrics (updated on sync)
    reactions: article.positive_reactions_count || 0,
    comments: article.comments_count || 0,
    views: article.page_views_count || 0,

    // Author info
    author: {
      name: article.user?.name || "Ofri Peretz",
      username: article.user?.username || "ofri-peretz",
      avatar: article.user?.profile_image || null,
      twitter: article.user?.twitter_username || "ofriperetzdev",
    },

    // Series info (if part of a series)
    series: article.series || null,
  };

  // Generate YAML frontmatter string
  const yamlFrontmatter = generateYamlFrontmatter(frontmatter);

  // Get the article body (markdown content)
  const body = article.body_markdown || "";

  // Remove the DEV.TO frontmatter from body if present
  const cleanBody = removeDevtoFrontmatter(body);

  return `---\n${yamlFrontmatter}---\n\n${cleanBody}`;
}

/**
 * Generate YAML frontmatter from object
 */
function generateYamlFrontmatter(obj, indent = 0) {
  const spaces = "  ".repeat(indent);
  let yaml = "";

  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      yaml += `${spaces}${key}: null\n`;
    } else if (Array.isArray(value)) {
      if (value.length === 0) {
        yaml += `${spaces}${key}: []\n`;
      } else if (typeof value[0] === "object") {
        yaml += `${spaces}${key}:\n`;
        for (const item of value) {
          yaml += `${spaces}  - ${generateYamlFrontmatter(item, indent + 2)
            .trim()
            .replace(/\n/g, `\n${spaces}    `)}\n`;
        }
      } else {
        yaml += `${spaces}${key}:\n`;
        for (const item of value) {
          yaml += `${spaces}  - "${escapeYamlString(String(item))}"\n`;
        }
      }
    } else if (typeof value === "object") {
      yaml += `${spaces}${key}:\n`;
      yaml += generateYamlFrontmatter(value, indent + 1);
    } else if (typeof value === "string") {
      // Use quotes for strings to handle special characters
      yaml += `${spaces}${key}: "${escapeYamlString(value)}"\n`;
    } else {
      yaml += `${spaces}${key}: ${value}\n`;
    }
  }

  return yaml;
}

/**
 * Escape special characters in YAML strings
 */
function escapeYamlString(str) {
  return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

/**
 * Normalize tags - DEV.TO sometimes returns string, sometimes array
 */
function normalizeTags(tagList) {
  if (!tagList) return [];
  if (Array.isArray(tagList)) return tagList;
  if (typeof tagList === "string") {
    return tagList
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  }
  return [];
}

/**
 * Convert DEV.TO liquid tags to standard markdown
 */
function convertLiquidTags(body) {
  let content = body;

  // Convert {% cta url %} text {% endcta %} to ::dev-to-cta{url="url"} text ::
  content = content.replace(
    /\{%\s*cta\s+([^\s%}]+)\s*%\}\s*([\s\S]*?)\s*\{%\s*endcta\s*%\}/g,
    (_, url, text) => `::dev-to-cta{url="${url.trim()}"}\n${text.trim()}\n::`,
  );

  // Convert {% embed url %} to just the URL (will be handled by renderer)
  content = content.replace(
    /\{%\s*embed\s+(https?:\/\/[^\s%]+)\s*%\}/g,
    (_, url) => url,
  );

  // Convert {% youtube id %} to YouTube embed link
  content = content.replace(
    /\{%\s*youtube\s+([a-zA-Z0-9_-]+)\s*%\}/g,
    (_, id) => `https://www.youtube.com/watch?v=${id}`,
  );

  // Convert {% github user/repo %} to GitHub link
  content = content.replace(
    /\{%\s*github\s+([^\s%]+)\s*%\}/g,
    (_, repo) => `https://github.com/${repo}`,
  );

  // Convert {% twitter id %} to Twitter link
  content = content.replace(
    /\{%\s*twitter\s+([^\s%]+)\s*%\}/g,
    (_, id) => `https://twitter.com/i/status/${id}`,
  );

  // Convert {% codepen url %} to CodePen link
  content = content.replace(
    /\{%\s*codepen\s+(https?:\/\/[^\s%]+)\s*%\}/g,
    (_, url) => url,
  );

  // Convert {% codesandbox id %} to CodeSandbox link
  content = content.replace(
    /\{%\s*codesandbox\s+([^\s%]+)\s*%\}/g,
    (_, id) => `https://codesandbox.io/s/${id}`,
  );

  // Remove any remaining liquid tags we don't handle
  content = content.replace(/\{%\s*[^%]+\s*%\}/g, "");

  return content;
}

/**
 * Remove DEV.TO frontmatter from markdown body
 */
function removeDevtoFrontmatter(body) {
  // DEV.TO articles may have frontmatter that starts with ---
  const frontmatterRegex = /^---\n[\s\S]*?\n---\n/;
  const cleanBody = body.replace(frontmatterRegex, "").trim();
  // Convert liquid tags to standard markdown
  return convertLiquidTags(cleanBody);
}

/**
 * Generate article manifest for the listing page
 */
function generateManifest(articles) {
  const manifest = articles.map((article) => ({
    slug: normalizeSlug(article.slug),
    title: article.title,
    description: article.description || "",
    cover_image: article.cover_image || article.social_image || null,
    published_at: article.published_at,
    reading_time_minutes: article.reading_time_minutes || 5,
    tags: article.tag_list || [],
    reactions: article.positive_reactions_count || 0,
    comments: article.comments_count || 0,
    views: article.page_views_count || 0,
    devto_url: article.url,
    canonical_url: `${SITE_URL}/articles/${normalizeSlug(article.slug)}`,
    series: article.series || null,
  }));

  // Sort by published date (most recent first)
  manifest.sort(
    (a, b) =>
      new Date(b.published_at).getTime() - new Date(a.published_at).getTime(),
  );

  return {
    generated_at: new Date().toISOString(),
    total_articles: manifest.length,
    articles: manifest,
  };
}

/**
 * Main sync function
 */
async function syncArticles() {
  const args = process.argv.slice(2);
  const forceOverwrite = args.includes("--force");

  console.log("\n🚀 DEV.TO Article Sync (One-Time Import)");
  console.log("=".repeat(50));

  if (forceOverwrite) {
    console.log("⚠️  FORCE MODE: Existing files will be overwritten!\n");
  } else {
    console.log(
      "ℹ️  Existing files will be SKIPPED (source of truth protection)",
    );
    console.log("   Use --force to overwrite existing files\n");
  }

  if (!DEVTO_API_KEY) {
    console.warn(
      "⚠️  No DEVTO_API_KEY found. Using public API (limited data).",
    );
    console.warn(
      "   Set DEVTO_API_KEY in .env for full article body and views.",
    );
  }

  // Create articles directory if it doesn't exist
  if (!existsSync(CONTENT_DIR)) {
    mkdirSync(CONTENT_DIR, { recursive: true });
    console.log(`📁 Created directory: ${CONTENT_DIR}`);
  }

  // Fetch all articles
  const articles = await fetchArticles();

  if (articles.length === 0) {
    console.log("ℹ️  No articles found.");
    return;
  }

  console.log("\n📝 Syncing articles...");

  let synced = 0;
  let skipped = 0;
  let failed = 0;
  const syncedArticles = [];

  for (const article of articles) {
    try {
      const slug = normalizeSlug(article.slug);
      const filePath = join(CONTENT_DIR, `${slug}.md`);

      // Check if file already exists
      if (existsSync(filePath) && !forceOverwrite) {
        console.log(`   ⏭️  Skipped (exists): ${slug}`);
        skipped++;
        // Still add to syncedArticles for manifest
        syncedArticles.push(article);
        continue;
      }

      // Fetch full article details (including body_markdown)
      const fullArticle = await fetchArticleDetails(article.id);

      if (!fullArticle) {
        failed++;
        continue;
      }

      // Generate markdown content
      const markdownContent = generateMarkdownFile(fullArticle);

      // Write to file
      writeFileSync(filePath, markdownContent, "utf-8");

      syncedArticles.push(fullArticle);
      synced++;

      console.log(
        `   ✅ ${forceOverwrite && existsSync(filePath) ? "Updated" : "Created"}: ${slug}`,
      );

      // Rate limiting: small delay between requests
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`   ❌ Failed: ${article.slug} - ${error.message}`);
      failed++;
    }
  }

  // Generate manifest
  console.log("\n📋 Generating articles manifest...");
  const manifest = generateManifest(syncedArticles);
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), "utf-8");
  console.log(`   ✅ ${MANIFEST_PATH}`);

  // Summary
  console.log("\n" + "=".repeat(50));
  console.log("📊 Sync Summary");
  console.log(`   ✅ Created: ${synced} articles`);
  if (skipped > 0) {
    console.log(`   ⏭️  Skipped: ${skipped} articles (already exist)`);
  }
  if (failed > 0) {
    console.log(`   ❌ Failed: ${failed} articles`);
  }
  console.log(`   📁 Output: ${CONTENT_DIR}`);
  console.log(`   📋 Manifest: ${MANIFEST_PATH}`);
  console.log("\n✨ Done!\n");
}

// Run the sync
syncArticles().catch((error) => {
  console.error("\n💥 Fatal error:", error);
  process.exit(1);
});
