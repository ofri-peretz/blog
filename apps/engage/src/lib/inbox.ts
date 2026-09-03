import "server-only";
import { ME } from "@/lib/threads";
import { allItems } from "@/lib/footprint";

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

/** A thread we DID answer, kept for measurement rather than discarded. */
export interface AnsweredThread {
  commentId: string;
  author: string;
  /** Their comment, dev.to `created_at`. */
  at: string;
  /** Our earliest reply under it, dev.to `created_at`. */
  repliedAt: string;
  articleTitle: string;
  onOurArticle: boolean;
}

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
  /** Distinguishes "someone came to our post" from "someone answered us on theirs". */
  onOurArticle?: boolean;
  ageDays: number;
  /**
   * The author's dev.to profile 404s — suspended or deleted.
   *
   * Their COMMENT is still on the article (the crawl reads live trees, so
   * anything returned is genuinely there), but the account behind it is gone.
   * Replying costs a reply and reaches nobody.
   */
  authorGone?: boolean;
  /** Display name, when it adds something the handle does not. */
  authorName?: string | null;
}

/**
 * Who is this, and do they still exist?
 *
 * Both answers need a request, and they need DIFFERENT requests, which is the
 * subtlety worth stating:
 *
 *   - the display name comes from `/api/users/by_username`. A handle is often
 *     unrecognisable on its own — `@circuit` is Rahul S, `@huaian666` is
 *     HUAICHUAN — and with short comments the handle alone is not enough to
 *     place who you are answering.
 *
 *   - liveness CANNOT come from that endpoint. It returns a full, normal 200
 *     for a suspended account: same fields, real name, real join date, no
 *     `suspended` flag anywhere. Measured 2026-08-11, @huaian666 and
 *     @gideon6657 both returned 200 from the API while their profile pages
 *     404'd. The profile PAGE is the only signal dev.to gives.
 *
 * Two requests per DISTINCT author, run together, cached with the inbox.
 */
async function authorProfile(
  username: string,
): Promise<{ exists: boolean; name: string | null }> {
  const u = encodeURIComponent(username);
  const [pageRes, apiRes] = await Promise.allSettled([
    fetch(`https://dev.to/${u}`, { method: "HEAD", cache: "no-store", redirect: "follow" }),
    fetch(`https://dev.to/api/users/by_username?url=${u}`, { cache: "no-store" }),
  ]);

  // Only a definite 404 counts as gone. A 429 or a 5xx is dev.to having a
  // moment, and treating that as "deleted" would quietly empty the inbox.
  const exists =
    pageRes.status === "fulfilled" ? pageRes.value.status !== 404 : true;

  let name: string | null = null;
  if (apiRes.status === "fulfilled" && apiRes.value.ok) {
    try {
      const j = await apiRes.value.json();
      const n = typeof j?.name === "string" ? j.name.trim() : "";
      // Plenty of accounts set `name` to the handle. Repeating it as
      // "@circuit · circuit" is noise, so only keep a name that adds something.
      if (n && n.toLowerCase() !== username.toLowerCase()) name = n;
    } catch {
      /* a malformed profile costs the name, never the thread */
    }
  }
  return { exists, name };
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

/**
 * Fetch, retrying the retryable.
 *
 * A 429 is not an answer, it is "ask again later" — and treating it as an
 * answer is what made this inbox lie. Measured: one article 429'd during a
 * crawl, its whole comment tree was skipped, and the panel reported FOUR
 * waiting threads when eight more were sitting on dev.to. Confidently.
 */
async function devto<T>(url: string, attempts = 4): Promise<T> {
  let lastStatus = 0;
  for (let n = 0; n < attempts; n++) {
    const r = await fetch(url, { cache: "no-store" });
    if (r.ok) return r.json() as Promise<T>;
    lastStatus = r.status;
    // 4xx other than 429 will never succeed on retry; only back off on the
    // ones that might.
    if (r.status !== 429 && r.status < 500) break;
    const retryAfter = Number(r.headers.get("retry-after"));
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
      ? retryAfter * 1000
      : 800 * 2 ** n;
    await new Promise((x) => setTimeout(x, Math.min(waitMs, 8000)));
  }
  throw new Error(`dev.to ${lastStatus} for ${url}`);
}

/** Does this subtree contain a reply from us anywhere below the node? */
/**
 * When did WE answer this thread, by dev.to's clock?
 *
 * The earliest reply by us anywhere under the thread root. This is the
 * timestamp reply latency is measured from (reply-latency intent): a local
 * "sent" mark says when a button was pressed, and 28 of those were pressed at
 * the same second on 2026-08-10. The platform's `created_at` cannot be bulk-marked.
 */
export function ourReplyAt(children: RawComment[] = []): string | null {
  let earliest: string | null = null;
  for (const c of children) {
    if (c.user?.username === ME && (!earliest || c.created_at < earliest)) earliest = c.created_at;
    const deeper = ourReplyAt(c.children);
    if (deeper && (!earliest || deeper < earliest)) earliest = deeper;
  }
  return earliest;
}

function answeredByUs(children: RawComment[] = []): boolean {
  for (const c of children) {
    if (c.user?.username === ME) return true;
    if (answeredByUs(c.children)) return true;
  }
  return false;
}

export async function buildInbox(): Promise<{
  threads: InboxThread[];
  /** Threads we answered, with both timestamps from dev.to. */
  answered: AnsweredThread[];
  articlesScanned: number;
  commentsSeen: number;
  /** Articles whose comments could not be read. Non-zero means INCOMPLETE. */
  articlesFailed: number;
  failedTitles: string[];
}> {
  /*
   * THREE populations, not one. Missing any of them makes the inbox lie by
   * omission, and each has bitten already:
   *
   *   1. comments on OUR articles                      (9 of the original 14)
   *   2. replies to OUR comments on our own articles
   *   3. replies to OUR comments on OTHER people's articles
   *
   * (3) is why this crawl reads the engagement ledger as well as our own posts.
   * Scanning only our articles looked complete — 4 threads, no failures — while
   * `engage-replies.ts` was simultaneously drafting TWELVE replies for threads
   * this never saw, because it scans the 27 articles we commented on. The
   * inbox said "4 waiting, none drafted"; the drafts existed, for conversations
   * the inbox had no idea about.
   *
   * The dedupe by id matters: an article can be both ours and one we commented
   * on, and crawling it twice would double every thread.
   */
  const articles: any[] = [];
  const seenArticles = new Set<number>();

  for (let page = 1; ; page++) {
    const batch = await devto<any[]>(
      `https://dev.to/api/articles?username=${ME}&per_page=100&page=${page}`,
    );
    for (const a of batch)
      if (a?.id && !seenArticles.has(a.id)) {
        seenArticles.add(a.id);
        articles.push({ ...a, mine: true });
      }
    if (batch.length < 100) break;
    // A guard, not an expected exit — 10 pages is 1,000 articles.
    if (page >= 10) break;
  }

  // Articles we engaged with. `comments_count` is unknown for these, so they
  // carry `null` and are always crawled — the ledger says we commented there,
  // which is reason enough to look for an answer.
  let engaged = 0;
  try {
    for (const it of allItems()) {
      const id = it?.article?.id;
      if (!id || seenArticles.has(id)) continue;
      seenArticles.add(id);
      engaged++;
      articles.push({
        id,
        title: it.article.title,
        url: it.article.url,
        comments_count: null,
        mine: false,
      });
    }
  } catch (e) {
    console.warn("[inbox] could not read the engagement ledger:", e);
  }
  console.log(`[inbox] crawling ${articles.length} articles (${engaged} we commented on)`);

  const out: InboxThread[] = [];

  const answered: AnsweredThread[] = [];
  const failed: string[] = [];
  let commentsSeen = 0;
  let scanned = 0;
  const now = Date.now();

  for (const a of articles) {
    // comments_count is the cheap filter — but only when we KNOW it. Ledger
    // articles carry null, meaning "unknown", and skipping those would drop
    // population (3) all over again.
    if (a.comments_count === 0) continue;
    scanned++;
    let tree: RawComment[];
    try {
      tree = await devto<RawComment[]>(`https://dev.to/api/comments?a_id=${a.id}`);
    } catch (e) {
      /*
       * A skipped article silently REMOVES every thread on it.
       *
       * That is not a degraded result, it is a wrong one: the panel goes on to
       * render a confident count that is missing whole conversations, with
       * nothing on screen saying so. Measured — one 429 turned 12 waiting
       * threads into 4. So the failure is counted and travels with the
       * response; the caller refuses to present the number as complete.
       */
      console.warn(`[inbox] could not read comments for article ${a.id}:`, e);
      failed.push(a.title ?? String(a.id));
      continue;
    }

    const walk = (nodes: RawComment[], depth: number, parentIsUs: boolean) => {
      for (const n of nodes) {
        commentsSeen++;
        const isUs = n.user?.username === ME;
        /*
         * On OUR article, any unanswered comment is ours to answer.
         * On SOMEONE ELSE'S, only a reply to OUR OWN comment is — a stranger
         * commenting on a stranger's post is a conversation we are not in.
         *
         * Without this the ledger's 100+ articles contributed every comment
         * anyone had ever left on them: the inbox jumped from 4 to 2,422, which
         * is not an inbox, it is the site.
         */
        const oursToAnswer = a.mine !== false || parentIsUs;
        if (!isUs && oursToAnswer) {
          const repliedAt = ourReplyAt(n.children);
          if (repliedAt)
            answered.push({
              commentId: n.id_code,
              author: n.user?.username ?? "(unknown)",
              at: n.created_at,
              repliedAt,
              articleTitle: a.title,
              onOurArticle: a.mine !== false,
            });
        }
        if (!isUs && oursToAnswer && !answeredByUs(n.children)) {
          out.push({
            commentId: n.id_code,
            author: n.user?.username ?? "(unknown)",
            body: strip(n.body_html),
            at: n.created_at,
            articleTitle: a.title,
            articleUrl: a.url,
            depth,
            replyToUs: parentIsUs,
            onOurArticle: a.mine !== false,
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

  /*
   * Check each author ONCE, not once per thread.
   *
   * @huaian666 alone accounts for six of the threads here; without the dedupe
   * that is six identical requests for one answer. Checks run in parallel
   * because they are independent and there are only ever a handful.
   */
  const authors = [...new Set(out.map((t) => t.author))];
  const profiles = new Map<string, { exists: boolean; name: string | null }>();
  /*
   * SEQUENTIALLY, with the same courtesy spacing as the article crawl.
   *
   * `Promise.all` over the authors fired 11 x 2 requests at once on top of the
   * article crawl, and dev.to rate-limited part of the burst: @nazar-boyko,
   * @benjamin_nguyen and @gideon6657 came back nameless while @alexshev and
   * @huaian666 resolved fine. All five have names — the difference was purely
   * which requests survived the burst.
   *
   * That failure is invisible in the result (a throttled lookup and a genuinely
   * nameless account both produce `null`), so the fix is to not cause it. A
   * handful of authors at 120ms costs about a second, once per 12h.
   */
  for (const a of authors) {
    profiles.set(a, await authorProfile(a));
    await new Promise((r) => setTimeout(r, 120));
  }
  for (const t of out) {
    const p = profiles.get(t.author);
    t.authorGone = p?.exists === false;
    t.authorName = p?.name ?? null;
  }

  // Oldest first: a February comment is more embarrassing than a today one, and
  // sorting newest-first is how the old ones stayed invisible. Gone authors sink
  // to the bottom — still listed, never silently dropped, but never the thing
  // the stepper opens on.
  out.sort(
    (a, b) =>
      Number(a.authorGone ?? false) - Number(b.authorGone ?? false) ||
      a.at.localeCompare(b.at),
  );
  return {
    threads: out,
    answered,
    articlesScanned: scanned,
    commentsSeen,
    articlesFailed: failed.length,
    failedTitles: failed,
  };
}
