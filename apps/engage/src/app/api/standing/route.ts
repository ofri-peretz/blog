import { NextResponse } from "next/server";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { FOOTPRINT, replyDrafts, todayCST } from "@/lib/footprint";
import { cachedAsync } from "@/lib/cache";
import { buildInbox } from "@/lib/inbox";
import { ME } from "@/lib/threads";
import { computeStanding, type StandingGraph } from "@/lib/standing";
import { writeStanding, standingHistory } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

/**
 * Today's standing row, computed from the two caches that already exist —
 * the network crawl (`engagement/network-graph.json`) and the reply inbox —
 * and written to `engage.db` so the series spine can chart it.
 *
 * Idempotent per day: every call recomputes and overwrites today's row, so the
 * row reflects the freshest crawl rather than the first page view. It never
 * crawls the network itself; a missing graph is reported, not fabricated.
 */
const GRAPH = join(FOOTPRINT, "engagement", "network-graph.json");

export async function GET(req: Request) {
  const force = new URL(req.url).searchParams.get("refresh") === "1";
  if (!existsSync(GRAPH))
    return NextResponse.json(
      { today: null, history: standingHistory(), error: "no network crawl yet — open the DEV community network section or press its refresh" },
      { status: 200 },
    );
  let graph: StandingGraph & { fetchedAt?: string };
  try {
    graph = JSON.parse(readFileSync(GRAPH, "utf8"));
  } catch (e) {
    return NextResponse.json({ today: null, history: standingHistory(), error: `graph cache unreadable: ${String(e)}` });
  }

  // Answered = the local record says sent. The reconciler in agents/footprint
  // is what makes that mark trustworthy; until it runs, this is the honest
  // floor and the row says so through `reply_latency_h` being a median over
  // marks, not over observed replies.
  const drafts = new Map(replyDrafts().map((d) => [d.commentId, d]));
  let inboxError: string | null = null;
  let threads: { at: string; answeredAt: string | null }[] = [];
  try {
    const inbox = await cachedAsync("inbox", 12 * 3_600_000, force, buildInbox);
    threads = inbox.value.threads
      .filter((t) => drafts.get(t.commentId)?.status !== "skipped" && !t.authorGone)
      .map((t) => {
        // No `as any`: `handledAt` is on ReplyDraft now, so the compiler
        // checks this rather than trusting it. The cast is what let the field
        // be written in one route and read in another with nothing verifying
        // the two agreed. (Review.)
        const d = drafts.get(t.commentId);
        return { at: t.at, answeredAt: d?.status === "sent" && d.handledAt ? d.handledAt : null };
      });
  } catch (e) {
    inboxError = String(e instanceof Error ? e.message : e);
  }

  const row = computeStanding(graph, ME, threads);
  const day = todayCST();
  writeStanding(day, row);
  return NextResponse.json({
    day,
    today: row,
    graphFetchedAt: graph.fetchedAt ?? null,
    inboxError,
    history: standingHistory(),
  });
}
