import { NextResponse } from "next/server";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { FOOTPRINT, replyDrafts } from "@/lib/footprint";
import { recordAction as ledger } from "@/lib/store";
import { cachedAsync } from "@/lib/cache";
import { buildInbox } from "@/lib/inbox";

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

/**
 * The inbox is now sourced from Dev.to, with the drafts file as ENRICHMENT.
 *
 * It used to be the reverse, and the reversal is the bug: filtering the drafts
 * file to `status === "pending"` answers "what has been drafted and not yet
 * sent", then renders under a heading that promises "what is waiting for a
 * reply". On 2026-08-11 those two answers were 0 and 14, the oldest thread
 * dating to February, and nothing anywhere reported a discrepancy.
 *
 * Handled threads (sent/skipped) are still suppressed — but by commentId
 * against the ledger, so suppression is a decision we recorded rather than a
 * side effect of a thread never having been drafted.
 *
 * A 12h TTL because the crawl is ~15 network calls and the answer changes when
 * someone comments, not when the page is opened. `?force=1` (the panel's own
 * refresh) bypasses it.
 */
export async function GET(req: Request) {
  const force = new URL(req.url).searchParams.get("force") === "1";
  const drafts = load();

  const byId = new Map(drafts.map((r) => [r.commentId, r]));
  let inbox;
  try {
    inbox = await cachedAsync("inbox", 12 * 3_600_000, force, buildInbox);
  } catch (e) {
    // No cache and the crawl failed: say so. Answering with an empty list here
    // is the exact failure this route is being fixed for.
    return NextResponse.json(
      {
        threads: [],
        undrafted: 0,
        error: e instanceof Error ? e.message : String(e),
        hint: "could not reach dev.to — this is an ERROR, not an empty inbox",
      },
      { status: 502 },
    );
  }

  /*
   * ONLY `skipped` suppresses a thread. `sent` deliberately does not.
   *
   * Every thread in `inbox` was just verified against Dev.to as having no reply
   * from us anywhere in its subtree. So a local record saying `sent` for one of
   * them is not a reason to hide it — it is a CONTRADICTION, and the platform
   * wins. Measured on 2026-08-11: all 28 records in reply-drafts.json read
   * `sent` with the identical `handledAt` of 2026-08-10, which is a bulk
   * mark-as-handled rather than 28 replies, and nine of those threads still had
   * no reply on Dev.to. Trusting the flag hid nine real conversations.
   *
   * `skipped` is different and is honoured: it is a human deciding this one does
   * not deserve a reply, which no amount of platform state can contradict.
   */
  const threads = inbox.value.threads
    .filter((t) => byId.get(t.commentId)?.status !== "skipped")
    .map((t) => {
      const d = byId.get(t.commentId);
      return {
        commentId: t.commentId,
        author: t.author,
        body: t.body,
        at: t.at,
        articleTitle: t.articleTitle,
        articleUrl: t.articleUrl,
        depth: t.depth,
        replyToUs: t.replyToUs,
        ageDays: t.ageDays,
        draft: d?.draft,
        drafted: !!d?.draft,
        /**
         * Marked sent locally, but Dev.to has no reply from us. Almost always a
         * send that failed without saying so. Surfaced rather than filtered so
         * the failure is visible instead of being absorbed.
         */
        sendFailed: d?.status === "sent",
      };
    });

  const undrafted = threads.filter((t) => !t.drafted).length;
  const stale = threads.filter((t) => t.ageDays > 30).length;
  const failed = threads.filter((t) => t.sendFailed).length;
  return NextResponse.json({
    threads,
    undrafted,
    asOf: inbox.at,
    scanned: inbox.value.articlesScanned,
    commentsSeen: inbox.value.commentsSeen,
    // A partial crawl that fell back to cache must not read as a fresh answer.
    warning: inbox.error ?? null,
    sendFailed: failed,
    hint:
      [
        failed
          ? `${failed} thread(s) are marked "sent" locally but have no reply on dev.to — those sends did not land.`
          : null,
        undrafted
          ? `${undrafted} waiting with no draft${stale ? `, ${stale} older than 30 days` : ""}. \`npm run engage:replies\` in agents/footprint drafts them.`
          : null,
      ]
        .filter(Boolean)
        .join(" ") || null,
  });
}

export async function POST(req: Request) {
  const { commentId, action } = await req.json();
  if (typeof commentId !== "string")
    return NextResponse.json({ ok: false }, { status: 400 });
  const all = load();
  let hit = all.find((r) => r.commentId === commentId);

  /*
   * A thread with no draft is now the COMMON case, not an error.
   *
   * This used to 404 anything absent from the drafts file, which was safe only
   * while the inbox was that file. Now that the inbox comes from Dev.to, most
   * threads have never been drafted — and 404ing them would mean the eleven
   * oldest unanswered comments were the exact ones that could not be marked
   * handled. So an unknown commentId creates its record instead.
   */
  if (!hit) {
    const inbox = await cachedAsync("inbox", 12 * 3_600_000, false, buildInbox).catch(
      () => null,
    );
    const t = inbox?.value.threads.find((x) => x.commentId === commentId);
    if (!t)
      return NextResponse.json(
        { ok: false, error: "unknown reply" },
        { status: 404 },
      );
    hit = {
      commentId: t.commentId,
      author: t.author,
      theirComment: t.body,
      at: t.at,
      articleTitle: t.articleTitle,
      articleUrl: t.articleUrl,
      status: "pending",
    } as any;
    all.push(hit);
  }

  hit!.status = action === "skip" ? "skipped" : "sent";
  hit!.handledAt = new Date().toISOString();
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
      author: hit!.author,
      articleId: (hit as any).articleId,
      title: hit!.articleTitle,
    });
  } catch {
    /* the reply is already recorded in the file; bookkeeping must not undo it */
  }
  return NextResponse.json({ ok: true });
}
