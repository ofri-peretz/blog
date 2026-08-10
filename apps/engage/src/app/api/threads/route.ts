import { NextResponse } from "next/server";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { FOOTPRINT, replyDrafts } from "@/lib/footprint";
import { recordAction as ledger } from "@/lib/store";

export const dynamic = "force-dynamic";

const FILE = join(FOOTPRINT, "engagement", "reply-drafts.json");

/**
 * Reads PRE-DRAFTED replies written by `engage-replies.ts`.
 *
 * Same model as the comment queue: the agent runs in the batch job, the app only
 * reads a file. Drafting live on click failed if the CLI auth had lapsed, made
 * you wait 20-60s mid-flow, and spent quota at the worst moment. A file read
 * does none of those.
 *
 * Refresh here is deliberately NOT a re-crawl — press the button and you would
 * be paying for a Dev.to crawl plus N model calls on a page load. `npm run
 * engage:replies` owns that, and it runs with the daily job.
 */
const load = (): any[] => replyDrafts();

export async function GET() {
  const all = load();
  const threads = all
    .filter((r) => r.status === "pending")
    .sort((a, b) => String(b.at).localeCompare(String(a.at)))
    .map((r) => ({
      commentId: r.commentId,
      author: r.author,
      body: r.theirComment,
      at: r.at,
      articleTitle: r.articleTitle,
      articleUrl: r.articleUrl,
      draft: r.draft,
      drafted: !!r.draft,
    }));
  const undrafted = threads.filter((t) => !t.drafted).length;
  return NextResponse.json({
    threads,
    undrafted,
    hint: undrafted
      ? `${undrafted} reply(ies) found but not yet drafted — run \`npm run engage:replies\` in agents/footprint (needs the claude CLI logged in).`
      : null,
  });
}

export async function POST(req: Request) {
  const { commentId, action } = await req.json();
  if (typeof commentId !== "string")
    return NextResponse.json({ ok: false }, { status: 400 });
  const all = load();
  const hit = all.find((r) => r.commentId === commentId);
  if (!hit) return NextResponse.json({ ok: false, error: "unknown reply" }, { status: 404 });
  hit.status = action === "skip" ? "skipped" : "sent";
  hit.handledAt = new Date().toISOString();
  writeFileSync(
    FILE,
    JSON.stringify({ generated_at: new Date().toISOString(), replies: all }, null, 2) + "\n",
  );

  // The reply also belongs in the ledger. Handling it only in this file meant a
  // reply was invisible to the history the rest of the app reads back — and it
  // left the per-author cache warm, so an author you had just answered still
  // rendered with their pre-reply state.
  try {
    ledger({
      session: "reply",
      kind: "reply",
      action: action === "skip" ? "skip" : "done",
      author: hit.author,
      articleId: hit.articleId,
      title: hit.articleTitle,
    });
  } catch {
    /* the reply is already recorded in the file; bookkeeping must not undo it */
  }
  return NextResponse.json({ ok: true });
}
