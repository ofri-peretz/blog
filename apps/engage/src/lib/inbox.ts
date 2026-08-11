import "server-only";
import { ME } from "@/lib/threads";

/**
 * The reply inbox, derived from Dev.to rather than from a drafts file.
 *
 * WHY THIS EXISTS. The "Replies waiting" panel read
 * `engagement/reply-drafts.json` filtered to `status === "pending"`, and
 * reported "No unanswered replies." Measured against the Dev.to API on
 * 2026-08-11 there were FOURTEEN unanswered threads, the oldest from
 * 2026-02-11. The panel was not stale and not broken — it was answering a
 * different question than the one it appeared to answer:
 *
 *   - the drafts file is a QUEUE OF DRAFTS. A thread nobody drafted a reply for
 *     is not in it, and a thread whose draft was sent or dismissed leaves it.
 *     "Nothing pending" is a fact about our drafting, not about our inbox.
 *
 *   - `threads.ts` walks articles WE COMMENTED ON and picks nodes whose parent
 *     is ours. That finds replies-to-our-comments on other people's posts. It
 *     structurally cannot see a top-level comment on one of OUR OWN articles,
 *     which was 9 of the 14.
 *
 * So: two populations, one inbox, sourced from the platform. The drafts file
 * becomes an enrichment — if a draft exists for a thread, show it — never the
 * source of what exists.
 */

export interface InboxThread {
  /** Dev.to comment id_code — stable, and what the reply endpoint keys on. */
  commentId: string;
  author: string;
  body: string;
  at: string;
  articleTitle: string;
  articleUrl: string;
  /** Depth in the comment tree. 0 = top-level on one of our articles. */
  depth: number;
  /**
   * True when this is a reply to OUR comment (the old threads.ts population),
   * false when it is a comment on our article nobody answered. Both need a
   * reply; they are different conversations and the UI should not merge them
   * into one undifferentiated list.
   */
  replyToUs: boolean;
  ageDays: number;
}

interface RawComment {
  id_code: string;
  created_at: string;
  body_html?: string;
  user?: { username?: string };
  children?: RawComment[];
}

const strip = (s = ""): string =>
  s.replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/g, " ").replace(/\s+/g, " ").trim();

async function devto<T>(url: string): Promise<T> {
  const r = await fetch(url, { cache: "no-store" });
  // A 429 or a 503 must throw, not return []. Returning an empty array here is
  // precisely how an inbox reports "all clear" during a rate limit.
  if (!r.ok) throw new Error(`dev.to ${r.status} for ${url}`);
  return r.json() as Promise<T>;
}

/** Does this subtree contain a reply from us anywhere below the node? */
function answeredByUs(children: RawComment[] = []): boolean {
  for (const c of children) {
    if (c.user?.username === ME) return true;
    if (answeredByUs(c.children)) return true;
  }
  return false;
}

export async function buildInbox(): Promise<{
  threads: InboxThread[];
  articlesScanned: number;
  commentsSeen: number;
}> {
  const articles: any[] = [];
  for (let page = 1; ; page++) {
    const batch = await devto<any[]>(
      `https://dev.to/api/articles?username=${ME}&per_page=100&page=${page}`,
    );
    articles.push(...batch);
    if (batch.length < 100) break;
    // A guard, not an expected exit — 10 pages is 1,000 articles.
    if (page >= 10) break;
  }

  const out: InboxThread[] = [];
  let commentsSeen = 0;
  let scanned = 0;
  const now = Date.now();

  for (const a of articles) {
    // comments_count is the cheap filter: no comments, no thread, no request.
    if (!a.comments_count) continue;
    scanned++;
    let tree: RawComment[];
    try {
      tree = await devto<RawComment[]>(`https://dev.to/api/comments?a_id=${a.id}`);
    } catch (e) {
      // One article's comments failing must not empty the whole inbox.
      console.warn(`[inbox] skipping article ${a.id}:`, e);
      continue;
    }

    const walk = (nodes: RawComment[], depth: number, parentIsUs: boolean) => {
      for (const n of nodes) {
        commentsSeen++;
        const isUs = n.user?.username === ME;
        if (!isUs && !answeredByUs(n.children)) {
          out.push({
            commentId: n.id_code,
            author: n.user?.username ?? "(unknown)",
            body: strip(n.body_html),
            at: n.created_at,
            articleTitle: a.title,
            articleUrl: a.url,
            depth,
            replyToUs: parentIsUs,
            ageDays: Math.floor((now - new Date(n.created_at).getTime()) / 86_400_000),
          });
        }
        walk(n.children ?? [], depth + 1, isUs);
      }
    };
    walk(tree, 0, false);

    // Courtesy spacing. Dev.to's documented limit is generous, but this crawl
    // is the only thing here that hits it in a tight loop.
    await new Promise((r) => setTimeout(r, 120));
  }

  // Oldest first: a February comment is more embarrassing than a today one, and
  // sorting newest-first is how the old ones stayed invisible.
  out.sort((a, b) => a.at.localeCompare(b.at));
  return { threads: out, articlesScanned: scanned, commentsSeen };
}
