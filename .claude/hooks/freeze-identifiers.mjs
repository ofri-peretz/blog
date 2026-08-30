#!/usr/bin/env node
// PreToolUse hook — a published article's identifiers are immutable.
//
// dev.to permalinks cannot be renamed. Changing the slug of an article that
// has already published 404s every inbound link that ever pointed at it, and
// the damage is invisible locally: the site builds, the tests pass, and the
// only symptom is traffic that stops arriving.
//
// The rule was documented and still relied on a reviewer noticing. This makes
// it deterministic: the edit does not happen.
//
// Contract: reads the tool call as JSON on stdin. Exit 0 allows, exit 2 blocks
// and shows stderr to Claude.
import { readFileSync, existsSync } from "node:fs";
import matter from "gray-matter";

const FROZEN = ["slug", "devto_id", "devto_url", "canonical_url"];
const ARTICLE = /apps\/blog\/content\/articles\/[^/]+\.md$/;

const allow = () => process.exit(0);
const block = (msg) => {
  process.stderr.write(msg);
  process.exit(2);
};

let payload;
try {
  payload = JSON.parse(readFileSync(0, "utf-8"));
} catch {
  allow(); // never let a malformed payload wedge the session
}

const tool = payload?.tool_name;
const input = payload?.tool_input ?? {};
const file = input.file_path;

if (!file || !ARTICLE.test(file) || !existsSync(file)) allow();
if (!["Edit", "Write", "NotebookEdit"].includes(tool)) allow();

const before = readFileSync(file, "utf-8");
let current;
try {
  current = matter(before).data;
} catch {
  allow();
}

// Unpublished drafts are still being shaped; the freeze starts at publish.
if (!current.devto_id) allow();

// Simulate the edit and compare, rather than pattern-matching the diff — an
// exact comparison cannot be defeated by whitespace or quoting style.
let after;
if (tool === "Write") {
  after = input.content ?? "";
} else {
  const oldStr = input.old_string ?? "";
  if (!oldStr || !before.includes(oldStr)) allow();
  after = input.replace_all
    ? before.split(oldStr).join(input.new_string ?? "")
    : before.replace(oldStr, input.new_string ?? "");
}

let next;
try {
  next = matter(after).data;
} catch {
  block(
    `Blocked: this edit makes ${file} unparseable as frontmatter.\n` +
      `Fix the YAML before writing.\n`,
  );
}

const changed = FROZEN.filter(
  (k) => String(current[k] ?? "") !== String(next[k] ?? ""),
);

if (changed.length) {
  block(
    `Blocked: ${file} is published (devto_id ${current.devto_id}) and these ` +
      `identifiers are frozen.\n\n` +
      changed
        .map(
          (k) =>
            `  ${k}\n    was: ${current[k] ?? "(unset)"}\n    now: ${next[k] ?? "(unset)"}`,
        )
        .join("\n") +
      `\n\ndev.to permalinks cannot be renamed — changing one 404s every inbound ` +
      `link.\nTo retitle, change the frontmatter \`title\` and the body only. A ` +
      `stale number\ninside a slug is accepted debt, not a bug to fix.\n` +
      `See CLAUDE.md > "Frozen identifiers".\n`,
  );
}

allow();
