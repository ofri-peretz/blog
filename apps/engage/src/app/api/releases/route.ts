import { NextResponse } from "next/server";
import { execFileSync } from "node:child_process";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const APP = process.cwd();
const SEP = "|@|";

/**
 * Release notes for the control room itself.
 *
 * Generated from git rather than hand-written, because a hand-kept changelog
 * drifts from what actually shipped and then quietly becomes fiction. Two
 * consumers: you in six weeks asking "what changed the day this number moved",
 * and the correlation engine, which needs release boundaries as candidate causes
 * in exactly the way it needs actions.
 *
 * `--` scopes the log to this app's directory, so the page describes the control
 * room and not every commit in the blog repo.
 */
export async function GET() {
  let commits: {
    sha: string;
    date: string;
    type: string;
    scope: string | null;
    subject: string;
    author: string;
  }[] = [];

  try {
    const out = execFileSync(
      "git",
      [
        "log",
        "--since=60.days",
        `--pretty=format:%H${SEP}%ad${SEP}%s${SEP}%an`,
        "--date=short",
        "--",
        ".",
      ],
      { cwd: APP, encoding: "utf8", timeout: 30_000, maxBuffer: 8 * 1024 * 1024 },
    );
    commits = out
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((l) => {
        const [sha, date, subject, author] = l.split(SEP);
        // Conventional-commit type drives grouping. Anything unprefixed lands in
        // "other" rather than being silently dropped — a commit missing from the
        // release log is worse than an untidy one in it.
        const m = /^(\w+)(\([^)]*\))?!?:\s*(.+)$/.exec(subject ?? "");
        return {
          sha: (sha ?? "").slice(0, 7),
          date: date ?? "",
          type: m ? m[1] : "other",
          scope: m?.[2]?.slice(1, -1) ?? null,
          subject: m ? m[3] : (subject ?? ""),
          author: author ?? "",
        };
      });
  } catch (e) {
    return NextResponse.json({
      releases: [],
      error:
        e instanceof Error
          ? `git log failed: ${e.message.slice(0, 160)}`
          : String(e),
    });
  }

  const byDay = new Map<string, typeof commits>();
  for (const c of commits) {
    if (!byDay.has(c.date)) byDay.set(c.date, []);
    byDay.get(c.date)!.push(c);
  }

  const releases = [...byDay.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, items]) => ({
      date,
      count: items.length,
      types: [...new Set(items.map((i) => i.type))],
      items,
    }));

  return NextResponse.json({ releases, error: null });
}
