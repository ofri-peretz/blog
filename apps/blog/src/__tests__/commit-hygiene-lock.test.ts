/**
 * Two things that reached a pull request today and that no check would have
 * caught. Both are cheap to detect and expensive to ship.
 *
 * 1. A malformed code fence. An edit left a paragraph glued onto a closing
 *    fence — "``` [Rule docs](…)" — which is not a valid close, so Prettier
 *    escalated the opener to four backticks and eleven lines of prose, two
 *    links and a horizontal rule were swallowed into a monospace block. The
 *    article still built, still passed every existing lock, and would have
 *    published looking broken.
 *
 * 2. A symlink committed to the repo. `node_modules -> /Users/…` was picked up
 *    by `git add -A` and slipped past `.gitignore`, whose rule was
 *    `node_modules/` — a trailing slash matches directories only, never a
 *    symlink. On any other machine that is a dangling pointer into somebody
 *    else's home directory.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../../../..");
const ARTICLES = join(ROOT, "apps/blog/content/articles");

const FENCE = /^(`{3,})(.*)$/;

/**
 * Fence problems in one markdown document.
 *
 * Deliberately a small hand-rolled scanner rather than a markdown parser: a
 * parser resolves the ambiguity silently, which is exactly the behaviour that
 * let the bug through. We want the ambiguity reported.
 */
function fenceProblems(text: string): string[] {
  const problems: string[] = [];
  const lines = text.split("\n");
  let open: { ticks: number; line: number } | null = null;

  for (const [i, line] of lines.entries()) {
    const m = FENCE.exec(line);
    if (!m) continue;
    const ticks = m[1].length;
    const rest = m[2].trim();

    if (!open) {
      open = { ticks, line: i + 1 };
      continue;
    }
    // Inside a fence. A valid close is >= the opener's backticks and NOTHING
    // else on the line.
    if (ticks >= open.ticks && rest === "") {
      open = null;
      continue;
    }
    // Anything else that begins with a run of backticks inside a fence is the
    // bug: either too few backticks, or trailing text, or both. The shipped
    // defect was "``` [Rule docs](…)" closing a ````bash opener — THREE
    // backticks against four. An earlier version of this check tested
    // `ticks >= open.ticks` here and therefore missed the only case it was
    // written for; it passed against the real broken file. Hence this comment.
    problems.push(
      `line ${i + 1}: "${line.slice(0, 60)}" is inside the fence opened on line ${open.line} and does NOT close it (${ticks} backticks vs ${open.ticks}${rest ? ", plus trailing text" : ""})`,
    );
  }
  if (open) problems.push(`fence opened on line ${open.line} is never closed`);
  return problems;
}

const articles = readdirSync(ARTICLES)
  .filter((f) => f.endsWith(".md"))
  .map((f) => [f, readFileSync(join(ARTICLES, f), "utf-8")] as const);

describe("every article's code fences are well-formed", () => {
  it("reads a corpus at all", () => {
    // Without this the suite below passes just as happily over zero files.
    expect(articles.length).toBeGreaterThan(50);
  });

  it("the scanner catches the exact shape that shipped", () => {
    // Proof the check is not vacuous, using the real defect.
    const broken = [
      "text",
      "```bash",
      "npx eslint --print-config file.ts",
      "``` [Rule docs](https://example.com) · [npm](https://example.com).",
      "",
      "more prose",
      "```",
    ].join("\n");
    expect(fenceProblems(broken)).not.toEqual([]);
    expect(fenceProblems(broken)[0]).toMatch(/does NOT close it/);
  });

  it("accepts a normal fence", () => {
    expect(fenceProblems("a\n```ts\nconst x = 1;\n```\nb")).toEqual([]);
  });

  it.each(articles.map(([name, text]) => [name, text] as const))(
    "%s",
    (_name, text) => {
      expect(fenceProblems(text)).toEqual([]);
    },
  );
});

describe("no symlink is tracked in the repository", () => {
  it("git reports no mode-120000 entries", () => {
    // 120000 is git's file mode for a symlink. Committed ones point at paths
    // that exist on exactly one machine.
    const out = execFileSync("git", ["ls-files", "-s"], {
      cwd: ROOT,
      encoding: "utf-8",
      maxBuffer: 32 * 1024 * 1024,
    });
    const symlinks = out
      .split("\n")
      .filter((l) => l.startsWith("120000"))
      .map((l) => l.split("\t")[1]);
    expect(
      symlinks,
      `symlinks committed to the repo:\n  ${symlinks.join("\n  ")}`,
    ).toEqual([]);
  });
});
