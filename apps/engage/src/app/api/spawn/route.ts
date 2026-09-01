import { NextResponse } from "next/server";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Repos this endpoint will open a session in. */
const REPOS: Record<string, string> = {
  "ofri-peretz/eslint": "eslint",
  "ofri-peretz/agents": "agents",
  "ofri-peretz/blog": "blog-public",
  "ofri-peretz/serverless": "serverless",
};

/**
 * Start a real Claude Code session on a PR, from a click.
 *
 * The board already knows what is blocked on you and why. The gap was that
 * acting on it meant finding the repo, opening a terminal, and re-typing the
 * context the board was already showing — so the board got read and not acted
 * on.
 *
 * This opens Terminal in the right repo with the prompt pre-filled. It does NOT
 * run the agent unattended: the session opens with the prompt typed and waits.
 * Fixing someone's PR is not a thing to fire and forget, and a spawn that
 * silently starts editing is a spawn you have to police.
 *
 * The prompt travels as an `osascript` ARGUMENT (`item 2 of argv`), never
 * interpolated into the AppleScript source. A PR title is attacker-influenced
 * text — anyone can open a PR — and concatenating it into a shell command
 * inside an osascript string is a command-injection hole with a public write
 * path to it. `quoted form of` then escapes it once more for the shell.
 */
export async function POST(req: Request) {
  let body: { repo?: string; number?: number; title?: string; reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }

  const { repo = "", number, title = "", reason = "" } = body;
  const dir = REPOS[repo];
  if (!dir)
    return NextResponse.json(
      { ok: false, error: `unknown repo "${repo}"` },
      { status: 400 },
    );
  if (!Number.isInteger(number))
    return NextResponse.json(
      { ok: false, error: "number must be an integer" },
      { status: 400 },
    );

  const path = join(process.env.HOME ?? "", "repos/ofriperetz.dev", dir);
  if (!existsSync(path))
    return NextResponse.json(
      { ok: false, error: `${path} does not exist` },
      { status: 404 },
    );

  const prompt = [
    `Work PR #${number} in ${repo}: "${title}".`,
    reason && `The board flagged it as blocked on us because: ${reason}.`,
    ``,
    `Read the PR with \`gh pr view ${number}\`, including review comments and`,
    `check status. Do what it needs to become mergeable — resolve conflicts,`,
    `address review threads, fix failing checks — then report what you changed.`,
    `Do not merge it.`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    // `claude` is started with the prompt as a single argv entry via a quoted
    // heredoc-free form: osascript gets a fixed script, and the variable parts
    // travel as arguments (`on run argv`), so nothing from the PR is parsed as
    // AppleScript or as shell.
    const script = `
on run argv
  set repoPath to item 1 of argv
  set thePrompt to item 2 of argv
  tell application "Terminal"
    activate
    do script "cd " & quoted form of repoPath & " && claude " & quoted form of thePrompt
  end tell
end run`;
    execFileSync("osascript", ["-e", script, path, prompt], {
      encoding: "utf8",
      timeout: 20_000,
    });
    return NextResponse.json({ ok: true, path, prompt });
  } catch (e: any) {
    // Still hand back the prompt: a failed spawn should degrade to "paste this
    // somewhere", not to a dead button.
    return NextResponse.json(
      {
        ok: false,
        error: String(e?.stderr || e?.message || e).split("\n")[0].slice(0, 200),
        prompt,
      },
      { status: 502 },
    );
  }
}
