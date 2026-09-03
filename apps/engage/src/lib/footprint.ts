/**
 * The footprint control room is the source of truth; this app is a view over it.
 *
 * It reads `agents/footprint` off disk rather than importing from it — the two
 * live in different git repos, and a cross-repo import would make the blog's
 * build depend on a private repo that is not checked out on CI. Path is
 * overridable so nothing here is pinned to one machine.
 *
 * Server-only. Every export touches the filesystem.
 */
import "server-only";
import { readFileSync, existsSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

export const FOOTPRINT =
  process.env.FOOTPRINT_ROOT ??
  join(process.env.HOME ?? "", "repos/ofriperetz.dev/agents/footprint");

const QUEUE_DIR = join(FOOTPRINT, "engagement", "queue");

/**
 * The Dev.to key already exists in the footprint control room. Read it from
 * there rather than copying it into this app's own .env — a duplicated secret is
 * a secret with two rotation points, and the second one is always the one that
 * gets missed.
 */
export function secret(name: string): string | undefined {
  if (process.env[name]) return process.env[name];
  for (const p of [join(FOOTPRINT, ".env"), join(FOOTPRINT, "..", ".env.local")]) {
    if (!existsSync(p)) continue;
    const m = readFileSync(p, "utf8").match(
      new RegExp(`^${name}=(.*)$`, "m"),
    );
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  }
  return undefined;
}

export const devtoKey = () => secret("DEVTO_API_KEY");

/**
 * Replies drafted by `engage-replies.ts`. One reader, because two places
 * parsing the same file is how the shapes drift apart — /api/threads serves it
 * to the inbox and /api/insights folds it into the partnership ranking, and
 * both have to agree on what "handled" means.
 */
export interface ReplyDraft {
  commentId: string;
  articleId: number;
  articleTitle?: string;
  articleUrl?: string;
  author: string;
  theirComment?: string;
  at: string;
  draft?: string | null;
  status: "pending" | "sent" | "skipped";
  /**
   * When the draft left `pending` — set by `threads/route.ts` on send or skip.
   *
   * Declared here because `standing/route.ts` reads it to compute answer
   * latency, and it was previously written at runtime and reached through an
   * `as any`. That works, and it works invisibly: the type checker could not
   * see the dependency, so renaming the field would have broken the standing
   * endpoint with no compile error anywhere. (Review.)
   *
   * Optional because every draft written before this field existed lacks it.
   */
  handledAt?: string;
}

export function replyDrafts(): ReplyDraft[] {
  const p = join(FOOTPRINT, "engagement", "reply-drafts.json");
  if (!existsSync(p)) return [];
  try {
    return JSON.parse(readFileSync(p, "utf8")).replies ?? [];
  } catch {
    return [];
  }
}

export type ActionKind = "comment" | "reaction";
/**
 * `opened` is what a click actually proves: the tab opened and the draft went
 * to the clipboard. `posted` is reserved for a reply the reconciler has SEEN on
 * dev.to (or an explicit human override). `expired` is the reconciler giving
 * up after 48 h with a reason. Before this split, `posted` meant "opened", and
 * every conversion number downstream was built on that.
 */
export type ItemStatus =
  | "pending"
  | "reminded"
  | "opened"
  | "posted"
  | "skipped"
  | "expired";
export type ActAction = "open" | "skip" | "posted";

/** What an action does to a status. Pure, so the selfcheck can pin it. */
export function nextStatus(action: ActAction): ItemStatus {
  return action === "skip" ? "skipped" : action === "posted" ? "posted" : "opened";
}

export interface Article {
  id: number;
  title: string;
  url: string;
  author: string;
  tags: string[];
}

export interface Item {
  kind: ActionKind;
  slot: number;
  date: string;
  article: Article;
  tldr?: string;
  comment?: string;
  category?: string;
  status: ItemStatus;
  /** The exact text at click time — the ledger records what was sent, not what was drafted. */
  sent_text?: string | null;
  /** Set only by the reconciler in agents/footprint, never by this app. */
  verified_at?: string | null;
  /** From the generator: why this item was proposed (graph-aware discovery). */
  why?: string | null;
  relevance?: "high" | "medium" | "low" | null;
  alt_comment?: string | null;
}

/** CST day key, matching `todayCST()` in _engage-lib so both agree on "today". */
export function todayCST(now: Date = new Date()): string {
  // Format the wall-clock date in Chicago directly. The previous shape parsed a
  // Chicago-local string back into a Date in the MACHINE zone and then took
  // the UTC date of that, so after 19:00 CDT "today" was tomorrow — and
  // disagreed with the generator in agents/_engage-lib.ts, which uses this
  // same Intl form. Two definitions of "today" over one queue directory is
  // how an action lands in a file the other side is not reading.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function readQueueFile(date: string): any | null {
  const p = join(QUEUE_DIR, `${date}.json`);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

function toItems(q: any, date: string): Item[] {
  if (!q) return [];
  const drafts: Item[] = (q.drafts ?? []).map((d: any) => ({
    kind: "comment" as const,
    slot: d.slot,
    date,
    article: d.article,
    tldr: d.tldr,
    comment: d.comment,
    status: d.status,
    sent_text: d.sent_text ?? null,
    verified_at: d.verified_at ?? null,
    why: d.why ?? null,
    relevance: d.relevance ?? null,
    alt_comment: d.alt_comment ?? null,
  }));
  const reactions: Item[] = (q.reactions ?? []).map((r: any) => ({
    kind: "reaction" as const,
    slot: r.slot,
    date,
    article: r.article,
    category: r.category,
    status: r.status,
    why: r.why ?? null,
  }));
  return [...drafts, ...reactions];
}

const OPEN = new Set<ItemStatus>(["pending", "reminded"]);

/**
 * The stream, not "today's two".
 *
 * The old daily cap made the UI announce "Queue clear — everything handled"
 * after two comments, against a platform floor of one comment per five minutes.
 * That wall was ours, not Dev.to's. So open items from previous days stay in the
 * stream (a draft written yesterday is still a good comment today) and the
 * caller decides when to stop — the safety budget does the limiting now, and it
 * limits by pace rather than by count.
 */
export function stream(limit = 50): Item[] {
  if (!existsSync(QUEUE_DIR)) return [];
  const dates = readdirSync(QUEUE_DIR)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .map((f) => f.replace(/\.json$/, ""))
    .sort()
    .reverse();

  const everything = dates.flatMap((d) => toItems(readQueueFile(d), d));

  /**
   * "Already handled" is a property of the ARTICLE, not of a queue row.
   *
   * The generator re-queues an article on consecutive days while it is still
   * pending, so one article owns several rows. Filtering row-by-row on status
   * therefore leaks two ways, and both were live when this was written:
   *
   *   - 5 articles appeared TWICE in the stream (two pending rows), and
   *   - article 3730207 was offered again after being posted on 2026-05-25,
   *     because its older 05-23 / 05-24 rows were still `pending`.
   *
   * Commenting twice on the same article is publicly visible and unrecoverable,
   * so the settled state of any row retires the article everywhere.
   */
  const settled = new Set<string>();
  for (const it of everything)
    if (!OPEN.has(it.status)) settled.add(`${it.kind}:${it.article.id}`);

  const out: Item[] = [];
  const emitted = new Set<string>();
  for (const it of everything) {
    const key = `${it.kind}:${it.article.id}`;
    if (settled.has(key) || emitted.has(key)) continue;
    if (!OPEN.has(it.status)) continue;
    emitted.add(key);
    out.push(it);
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Every article we have ever posted a comment on or reacted to — the guard the
 * queue GENERATOR should consult before proposing a candidate, so duplicates are
 * prevented at the source rather than filtered at the surface.
 */
export function everActedArticleIds(): Set<number> {
  return new Set(
    allItems()
      .filter((i) => i.status === "posted" || i.status === "opened")
      .map((i) => i.article.id),
  );
}

/** Every item ever seen, for ledger + partnership scoring. */
export function allItems(): Item[] {
  if (!existsSync(QUEUE_DIR)) return [];
  return readdirSync(QUEUE_DIR)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .flatMap((f) => toItems(readQueueFile(f.replace(/\.json$/, "")), f.replace(/\.json$/, "")));
}

export function recordAction(
  kind: ActionKind,
  date: string,
  slot: number,
  action: ActAction,
  text?: string | null,
): { ok: boolean; error?: string } {
  const p = join(QUEUE_DIR, `${date}.json`);
  const q = readQueueFile(date);
  if (!q) return { ok: false, error: `no queue for ${date}` };
  const list = kind === "reaction" ? (q.reactions ?? []) : (q.drafts ?? []);
  const item = list.find((i: any) => i.slot === slot);
  if (!item) return { ok: false, error: `no ${kind} at slot ${slot}` };
  item.status = nextStatus(action);
  item.posted_at = new Date().toISOString();
  if (kind === "comment" && typeof text === "string") item.sent_text = text;
  // Reactions cannot be read back through the API, so a reaction click is the
  // honest ceiling of verification: it goes straight to posted.
  if (kind === "reaction" && action === "open") item.status = "posted";
  if (action === "posted") item.verified_at = new Date().toISOString();
  writeFileSync(p, JSON.stringify(q, null, 2) + "\n");
  return { ok: true };
}

/**
 * Release queue. Shelling out to publish-next keeps ONE definition of the
 * schedule — the 4-day spacing and the score gate live there, and a second
 * implementation here is exactly how the runway text drifted to "3/week" while
 * the publisher was already spacing at 4 days.
 */
export function releaseQueue(): any | null {
  try {
    const out = execFileSync(
      "npx",
      ["tsx", join(FOOTPRINT, "scripts", "publish-next.ts"), "--json"],
      { cwd: FOOTPRINT, encoding: "utf8", timeout: 120_000 },
    );
    return JSON.parse(out.trim().split("\n").pop()!);
  } catch {
    return null;
  }
}
