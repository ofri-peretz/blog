#!/usr/bin/env node
/**
 * Publish Articles to DEV.TO
 *
 * This script publishes local markdown articles to DEV.TO with the canonical URL
 * pointing back to ofriperetz.dev. This ensures your site is the SEO authority.
 *
 * Key Features:
 * - Publishes new articles to DEV.TO
 * - Updates existing articles (matches by title or devto_id)
 * - Sets canonical_url to ofriperetz.dev automatically
 * - Preserves DEV.TO-specific formatting
 *
 * Usage:
 *   node scripts/publish-to-devto.mjs                    # Publish all unpublished
 *   node scripts/publish-to-devto.mjs --article my-slug  # Publish specific article
 *   node scripts/publish-to-devto.mjs --dry-run          # Preview without publishing
 *
 * Environment:
 *   DEVTO_API_KEY - Required for publishing to DEV.TO
 *
 * @author Ofri Peretz
 * @see https://developers.forem.com/api
 */

import { readdirSync, readFileSync, writeFileSync } from "fs";
import { join, dirname, basename } from "path";
import { fileURLToPath } from "url";
import * as dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CONTENT_DIR = join(__dirname, "..", "content", "articles");

const DEVTO_API_KEY = process.env.DEVTO_API_KEY;
const SITE_URL = "https://ofriperetz.dev";

/**
 * Parse markdown frontmatter
 */
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    return { frontmatter: {}, body: content };
  }

  const frontmatterStr = match[1];
  const body = match[2].trim();

  // Simple YAML parser for our needs
  const frontmatter = {};
  let inObject = false;
  let objectKey = null;
  let objectValue = {};

  for (const line of frontmatterStr.split("\n")) {
    // Skip empty lines
    if (!line.trim()) continue;

    // Check for nested object
    const nestedMatch = line.match(/^(\s{2})(\w+):\s*(.*)$/);
    if (nestedMatch && inObject) {
      const [, , key, value] = nestedMatch;
      objectValue[key] = parseYamlValue(value);
      continue;
    }

    // Check for top-level key
    const topMatch = line.match(/^(\w+):\s*(.*)$/);
    if (topMatch) {
      // Save previous object if we were in one
      if (inObject && objectKey) {
        if (Object.keys(objectValue).length > 0) {
          frontmatter[objectKey] = objectValue;
        } else if (!frontmatter[objectKey]) {
          frontmatter[objectKey] = null;
        }
        inObject = false;
        objectValue = {};
      }

      const [, key, value] = topMatch;
      if (value === "" || value === null) {
        // This might be an object or array
        inObject = true;
        objectKey = key;
        objectValue = {};
      } else {
        frontmatter[key] = parseYamlValue(value);
      }
      continue;
    }

    // Check for array item
    const arrayMatch = line.match(/^\s+-\s*"?([^"]*)"?$/);
    if (arrayMatch && objectKey) {
      if (!Array.isArray(frontmatter[objectKey])) {
        frontmatter[objectKey] = [];
      }
      frontmatter[objectKey].push(arrayMatch[1]);
    }
  }

  // Save last object if we were in one
  if (inObject && objectKey && Object.keys(objectValue).length > 0) {
    frontmatter[objectKey] = objectValue;
  }

  return { frontmatter, body };
}

/**
 * Parse a YAML value
 */
function parseYamlValue(value) {
  if (value === "null" || value === "") return null;
  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "[]") return [];
  if (/^\d+$/.test(value)) return parseInt(value, 10);
  if (/^\d+\.\d+$/.test(value)) return parseFloat(value);
  // Remove quotes
  if (value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1).replace(/\\"/g, '"').replace(/\\n/g, "\n");
  }
  return value;
}

/**
 * Get all local articles
 */
function getLocalArticles() {
  const files = readdirSync(CONTENT_DIR).filter((f) => f.endsWith(".md"));

  return files.map((file) => {
    const content = readFileSync(join(CONTENT_DIR, file), "utf-8");
    const { frontmatter, body } = parseFrontmatter(content);
    const slug = basename(file, ".md");

    return {
      slug,
      filePath: join(CONTENT_DIR, file),
      frontmatter,
      body,
      content,
    };
  });
}

/**
 * Fetch existing DEV.TO articles to check for duplicates
 */
async function fetchExistingArticles() {
  if (!DEVTO_API_KEY) return [];

  try {
    const response = await fetch(
      "https://dev.to/api/articles/me/all?per_page=100",
      {
        headers: { "api-key": DEVTO_API_KEY },
      },
    );

    if (!response.ok) {
      throw new Error(`DEV.TO API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Failed to fetch existing articles:", error.message);
    return [];
  }
}

/**
 * Create DEV.TO article payload
 */
function createArticlePayload(article) {
  const { frontmatter, body, slug } = article;
  const canonicalUrl = `${SITE_URL}/articles/${slug}`;

  // Transform Nuxt Content components to standard Markdown for DEV.TO
  let transformedBody = body;

  // Transform ::install-command
  const installRegex = /::install-command\{package="([^"]+)"(?:\s+dev)?\}\n::/g;
  transformedBody = transformedBody.replace(installRegex, (match, pkg) => {
    return "```bash\n" + `npm install --save-dev ${pkg}` + "\n```";
  });

  // Transform ::dev-to-cta
  const ctaRegex = /::dev-to-cta\{url="([^"]+)"\}\n([^\n]+)\n::/g;
  transformedBody = transformedBody.replace(ctaRegex, (match, url, label) => {
    return `**[${label}](${url})**`;
  });

  // Build tags array
  let tags = frontmatter.tags || [];
  if (typeof tags === "string") {
    tags = tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  }
  // DEV.TO allows max 4 tags
  tags = tags.slice(0, 4);

  return {
    article: {
      title: frontmatter.title,
      body_markdown: transformedBody,
      published: frontmatter.published !== false,
      tags: tags,
      canonical_url: canonicalUrl,
      description: frontmatter.description || "",
      main_image: frontmatter.cover_image || null,
      series: frontmatter.series || null,
    },
  };
}

/**
 * Publish article to DEV.TO
 */
async function publishArticle(article, existingArticles, dryRun = false) {
  const { frontmatter, slug } = article;

  // Check if article already exists on DEV.TO
  let existingArticle = null;
  let matchReason = null;

  // Match by devto_id first
  if (frontmatter.devto_id) {
    existingArticle = existingArticles.find(
      (a) => a.id === frontmatter.devto_id,
    );
    if (existingArticle) matchReason = `devto_id: ${frontmatter.devto_id}`;
  }

  // Match by title if no devto_id
  if (!existingArticle) {
    existingArticle = existingArticles.find(
      (a) => a.title.toLowerCase() === frontmatter.title?.toLowerCase(),
    );
    if (existingArticle)
      matchReason = `exact title match: "${frontmatter.title}"`;
  }

  const payload = createArticlePayload(article);

  if (dryRun) {
    if (existingArticle) {
      console.log(
        `   🔄 [MATCHED] Found existing article on DEV.TO via ${matchReason}`,
      );
      console.log(
        `   📋 [DRY RUN] Mode: UPDATE existing post (ID: ${existingArticle.id})`,
      );
    } else {
      console.log(
        `   🆕 [NEW] No match found on DEV.TO (checked by ID and Title)`,
      );
      console.log(`   📋 [DRY RUN] Mode: CREATE new post`);
    }
    console.log(`      Slug: ${slug}`);
    console.log(`      Title: ${payload.article.title}`);
    console.log(`      Series: ${payload.article.series || "None"}`);
    console.log(`      Tags: ${payload.article.tags.join(", ")}`);
    // console.log(`      Canonical: ${payload.article.canonical_url}`);
    return { success: true, dryRun: true, isNew: !existingArticle };
  }

  try {
    let response;

    if (existingArticle) {
      // Update existing article
      response = await fetch(
        `https://dev.to/api/articles/${existingArticle.id}`,
        {
          method: "PUT",
          headers: {
            "api-key": DEVTO_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );
    } else {
      // Create new article
      response = await fetch("https://dev.to/api/articles", {
        method: "POST",
        headers: {
          "api-key": DEVTO_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error ${response.status}: ${errorText}`);
    }

    const result = await response.json();

    // Update local file with devto_id and devto_url if it's a new article
    if (!existingArticle && result.id) {
      updateLocalArticle(article, result);
    }

    return {
      success: true,
      action: existingArticle ? "updated" : "created",
      devtoId: result.id,
      devtoUrl: result.url,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Update local article with DEV.TO metadata
 */
function updateLocalArticle(article, devtoResult) {
  const { content, filePath, frontmatter } = article;

  // Add devto_id and devto_url to frontmatter if not present
  let updatedContent = content;

  if (!frontmatter.devto_id) {
    updatedContent = updatedContent.replace(
      /^(---\n)/,
      `$1devto_id: ${devtoResult.id}\n`,
    );
  }

  if (!frontmatter.devto_url) {
    updatedContent = updatedContent.replace(
      /^(---\n)/,
      `$1devto_url: "${devtoResult.url}"\n`,
    );
  }

  writeFileSync(filePath, updatedContent, "utf-8");
}

/**
 * Main publish function
 */
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const specificArticle = args.find((_, i, arr) => arr[i - 1] === "--article");

  console.log("\n📤 Publish to DEV.TO");
  console.log("=".repeat(50));

  if (!DEVTO_API_KEY) {
    console.error("❌ DEVTO_API_KEY is required for publishing.");
    console.error("   Set it in your .env file.");
    process.exit(1);
  }

  if (dryRun) {
    console.log("🔍 DRY RUN MODE - No changes will be made\n");
  }

  // Get local articles
  const localArticles = getLocalArticles();
  console.log(`📁 Found ${localArticles.length} local articles`);

  // Filter to specific article if requested
  let articlesToPublish = localArticles;
  if (specificArticle) {
    articlesToPublish = localArticles.filter((a) => a.slug === specificArticle);
    if (articlesToPublish.length === 0) {
      console.error(`❌ Article not found: ${specificArticle}`);
      process.exit(1);
    }
  }

  // Fetch existing DEV.TO articles
  console.log("📡 Fetching existing DEV.TO articles...");
  const existingArticles = await fetchExistingArticles();
  console.log(
    `   Found ${existingArticles.length} existing articles on DEV.TO\n`,
  );

  // Publish articles
  console.log("📝 Publishing articles...");

  let created = 0;
  let updated = 0;
  let failed = 0;
  const failedArticles = [];

  for (const article of articlesToPublish) {
    const result = await publishArticle(article, existingArticles, dryRun);

    if (result.success) {
      if (result.action === "created" || (dryRun && result.isNew)) {
        if (!dryRun) {
          console.log(`   ✅ Created: ${article.slug}`);
          console.log(`      → ${result.devtoUrl}`);
        }
        created++;
      } else {
        if (!dryRun) {
          console.log(`   🔄 Updated: ${article.slug}`);
        }
        updated++;
      }
    } else {
      console.log(`   ❌ Failed: ${article.slug}`);
      console.log(`      Error: ${result.error}`);
      failed++;
      failedArticles.push(article.slug);
    }

    // Rate limiting
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  // Summary
  console.log("\n" + "=".repeat(50));
  console.log("📊 Summary");
  if (dryRun) {
    console.log(`   📋 Total to Process: ${articlesToPublish.length} articles`);
    console.log(`   🆕 Would Create:    ${created}`);
    console.log(`   🔄 Would Update:    ${updated}`);
  } else {
    console.log(`   ✅ Created: ${created}`);
    console.log(`   🔄 Updated: ${updated}`);
    if (failed > 0) {
      console.log(`   ❌ Failed: ${failed}`);
      console.log(`      Slugs: ${failedArticles.join(", ")}`);
    }
  }
  console.log("\n✨ Done!\n");
}

main().catch((error) => {
  console.error("\n💥 Fatal error:", error);
  process.exit(1);
});
