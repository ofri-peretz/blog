// Shared helpers for the stage-6 detectors and the sdlc:* scripts.
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import matter from "gray-matter";

export const ROOT = resolve(import.meta.dirname, "../..");
export const ARTICLES_DIR = join(ROOT, "apps/blog/content/articles");
export const SPEC_DIR = join(ROOT, "sdlc/spec");
export const INTENT_DIR = join(ROOT, "sdlc/intent");
export const INCIDENT_DIR = join(ROOT, "sdlc/incident");

/** Every article as { slug, file, data, body }. `slug` falls back to the
 *  filename so a malformed frontmatter still gets reported rather than
 *  silently skipped — a detector that drops its own inputs is worse than none. */
export function articles() {
  return readdirSync(ARTICLES_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      const file = join(ARTICLES_DIR, f);
      const { data, content } = matter(readFileSync(file, "utf-8"));
      return {
        slug: data.slug || f.replace(/\.md$/, ""),
        file,
        data,
        body: content,
      };
    });
}

/** Published = has a dev.to id. Drafts are exempt from the publish-time gates. */
export const isPublished = (a) => Boolean(a.data.devto_id);

/** Specs as { slug, file, data, claims }. A claim row is one line of the
 *  stage-2 evidence table: | claim | value | `command` | version | verified | */
export function specs() {
  let files;
  try {
    files = readdirSync(SPEC_DIR).filter(
      (f) => f.endsWith(".md") && f !== "TEMPLATE.md",
    );
  } catch {
    return [];
  }
  return files.map((f) => {
    const file = join(SPEC_DIR, f);
    const { data, content } = matter(readFileSync(file, "utf-8"));
    return {
      slug: data.slug || f.replace(/\.md$/, ""),
      file,
      data,
      claims: parseClaims(content),
    };
  });
}

const SEPARATOR_ROW = /^\|[\s|:-]+\|$/;

export function parseClaims(markdown) {
  const rows = [];
  for (const line of markdown.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|") || SEPARATOR_ROW.test(trimmed)) continue;
    const cells = trimmed
      .slice(1, -1)
      .split("|")
      .map((c) => c.trim());
    if (cells.length < 5) continue;
    const [claim, value, command, version, verified] = cells;
    if (claim.toLowerCase() === "claim") continue; // header
    rows.push({
      claim,
      value,
      command: executable(command),
      evidence: command,
      version,
      verified,
    });
  }
  return rows;
}

/** The command a cell asks to be RUN, or "" when the cell is prose.
 *
 *  Only a cell that is exactly one backtick span — `like this` — is a command.
 *  A cell like ``npm i x` in an empty package then `du -sk node_modules`` is a
 *  procedure for a human: stripping only its outer backticks used to hand the
 *  shell the inner ones as command substitution, so the detector ran
 *  `npm i x … du -sk node_modules` in the repo root, and a cell quoting
 *  `npx "vercel@$VERCEL_CLI_VERSION"` ran a bare `npx vercel@` that created and
 *  deployed a Vercel project from a developer's CLI session (2026-09-23). */
export function executable(cell) {
  const match = /^`([^`]+)`$/.exec(cell.trim());
  return match ? match[1].trim() : "";
}

/** A value is "numeric" if the article could get it wrong by a digit — those
 *  are the claims that need a command. Prose claims are the reviewer's job. */
export function isNumericValue(value) {
  return /\d/.test(value);
}
