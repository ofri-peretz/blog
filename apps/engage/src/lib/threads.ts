/**
 * Phase 3 — the reply inbox.
 *
 * Someone answering your comment is the highest-decay signal in this whole
 * system: the window to reply is hours, and right now it is completely invisible
 * — nothing in the stack ever looked at whether a comment got a response.
 *
 * Dev.to has no "replies to me" endpoint. It does expose the full comment tree
 * per article (`/comments?a_id=`), so we walk the articles we have commented on
 * and pick out the nodes whose PARENT is ours.
 */
import "server-only";
import { allItems } from "./footprint";
import { upsertThread } from "./store";

export const ME = "ofri-peretz";

interface RawComment {
  id_code: string;
  created_at: string;
  body_html?: string;
  user: { username: string };
  children?: RawComment[];
}

function stripHtml(s = "") {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Walk the tree keeping parentage. Flattening — which the older
 * `checkAlreadyCommented` does — is what makes replies invisible: once the tree
 * is flat, "who answered whom" is gone.
 */
function repliesToMe(
  nodes: RawComment[],
  parentIsMine: boolean,
  out: { c: RawComment; parentIsMine: boolean }[] = [],
) {
  for (const n of nodes) {
    if (parentIsMine && n.user?.username !== ME)
      out.push({ c: n, parentIsMine: true });
    repliesToMe(n.children ?? [], n.user?.username === ME, out);
  }
  return out;
}

export async function pollThreads(limit = 40): Promise<number> {
  // Only articles we actually commented on can carry a reply to us.
  const mine = allItems().filter(
    (i) => i.kind === "comment" && i.status === "posted",
  );
  const seen = new Map<number, { title: string; url: string }>();
  for (const i of mine)
    seen.set(i.article.id, { title: i.article.title, url: i.article.url });

  let found = 0;
  for (const [id, meta] of [...seen.entries()].slice(0, limit)) {
    let tree: RawComment[];
    try {
      const r = await fetch(`https://dev.to/api/comments?a_id=${id}`, {
        cache: "no-store",
      });
      if (!r.ok) continue;
      tree = await r.json();
    } catch {
      continue;
    }
    if (!Array.isArray(tree)) continue;
    for (const { c } of repliesToMe(tree, false)) {
      upsertThread({
        commentId: c.id_code,
        articleId: id,
        articleTitle: meta.title,
        articleUrl: meta.url,
        author: c.user.username,
        body: stripHtml(c.body_html).slice(0, 600),
        at: c.created_at,
        parentIsMine: true,
      });
      found++;
    }
  }
  return found;
}
