/**
 * Persistence — Phase 2 of ENGAGE-NOW-PLAN.
 *
 * `node:sqlite` is built into Node 24, so this adds zero dependencies for real
 * queries, indexes and history. The queue JSONs stay the source of truth for
 * what is *pending*; this DB is the accumulator for everything that has to
 * survive and be compared over time — the session ledger, the per-author cache
 * with narrow invalidation, reply threads, and metric snapshots (without which
 * no chart can exist, because every API read is a single point in time).
 *
 * Lives beside the queue in the footprint control room, not in this app: the app
 * is a view and should be disposable, the accumulated history should not be.
 */
import "server-only";
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import { mkdirSync } from "node:fs";
import { FOOTPRINT } from "./footprint";

const DB_DIR = join(FOOTPRINT, "engagement");
const DB_PATH = join(DB_DIR, "engage.db");

let db: DatabaseSync | null = null;

export function open(): DatabaseSync {
  if (db) return db;
  mkdirSync(DB_DIR, { recursive: true });
  db = new DatabaseSync(DB_PATH);
  // WAL so a long network crawl writing snapshots never blocks a page read.
  db.exec("PRAGMA journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS actions (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      at        TEXT NOT NULL,
      session   TEXT NOT NULL,
      kind      TEXT NOT NULL,
      action    TEXT NOT NULL,
      author    TEXT NOT NULL,
      articleId INTEGER NOT NULL,
      title     TEXT
    );
    CREATE INDEX IF NOT EXISTS actions_at      ON actions(at);
    CREATE INDEX IF NOT EXISTS actions_author  ON actions(author);
    CREATE INDEX IF NOT EXISTS actions_article ON actions(articleId);

    CREATE TABLE IF NOT EXISTS snapshots (
      day       TEXT PRIMARY KEY,
      followers INTEGER, articles INTEGER, reactions INTEGER,
      comments  INTEGER, views INTEGER, at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS threads (
      commentId TEXT PRIMARY KEY,
      articleId INTEGER NOT NULL,
      articleTitle TEXT,
      articleUrl   TEXT,
      author    TEXT NOT NULL,
      body      TEXT,
      at        TEXT NOT NULL,
      parentIsMine INTEGER NOT NULL DEFAULT 0,
      handled   INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS threads_handled ON threads(handled, at);

    -- Per-author cache. Invalidated narrowly: acting on one author expires only
    -- that author's row, never the whole table.
    CREATE TABLE IF NOT EXISTS author_cache (
      author    TEXT PRIMARY KEY,
      payload   TEXT NOT NULL,
      at        TEXT NOT NULL
    );

    -- Standing: one row per day, see lib/standing.ts. sample_size/sample_hash
    -- travel with the row because a rank is only comparable within one sample
    -- policy; a wider crawl raises everyone's degree.
    CREATE TABLE IF NOT EXISTS standing (
      day             TEXT PRIMARY KEY,
      degree          INTEGER, in_authors INTEGER, mutual INTEGER, core_reach INTEGER,
      rank_nonstaff   INTEGER, rank_pct INTEGER,
      replies_waiting INTEGER, reply_latency_h REAL,
      sample_size     INTEGER NOT NULL, sample_hash TEXT NOT NULL,
      at              TEXT NOT NULL
    );
  `);
  return db;
}

/** One standing row per day. Re-running overwrites — a day has one truth. */
export function writeStanding(day: string, r: import("./standing").StandingRow) {
  open()
    .prepare(
      `INSERT INTO standing (day, degree, in_authors, mutual, core_reach, rank_nonstaff, rank_pct,
                             replies_waiting, reply_latency_h, sample_size, sample_hash, at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(day) DO UPDATE SET
         degree=excluded.degree, in_authors=excluded.in_authors, mutual=excluded.mutual,
         core_reach=excluded.core_reach, rank_nonstaff=excluded.rank_nonstaff, rank_pct=excluded.rank_pct,
         replies_waiting=excluded.replies_waiting, reply_latency_h=excluded.reply_latency_h,
         sample_size=excluded.sample_size, sample_hash=excluded.sample_hash, at=excluded.at`,
    )
    .run(
      day, r.degree, r.in_authors, r.mutual, r.core_reach, r.rank_nonstaff, r.rank_pct,
      r.replies_waiting, r.reply_latency_h, r.sample_size, r.sample_hash, new Date().toISOString(),
    );
}

export function standingHistory(days = 400) {
  return (open()
    .prepare(`SELECT * FROM standing ORDER BY day DESC LIMIT ?`)
    .all(days) as Record<string, number | string | null>[]).reverse();
}

export function recordAction(a: {
  session: string;
  kind: string;
  action: string;
  author: string;
  articleId: number;
  title?: string;
}) {
  open()
    .prepare(
      `INSERT INTO actions (at, session, kind, action, author, articleId, title)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      new Date().toISOString(),
      a.session,
      a.kind,
      a.action,
      a.author,
      a.articleId,
      a.title ?? null,
    );
  invalidateAuthor(a.author);
}

/** The narrow cache miss: one author expires, everyone else stays warm. */
export function invalidateAuthor(author: string) {
  open().prepare(`DELETE FROM author_cache WHERE author = ?`).run(author);
}

export function cachedAuthor<T>(author: string, maxAgeMs: number): T | null {
  const row = open()
    .prepare(`SELECT payload, at FROM author_cache WHERE author = ?`)
    .get(author) as { payload: string; at: string } | undefined;
  if (!row) return null;
  if (Date.now() - Date.parse(row.at) > maxAgeMs) return null;
  try {
    return JSON.parse(row.payload) as T;
  } catch {
    return null;
  }
}

export function cacheAuthor(author: string, payload: unknown) {
  open()
    .prepare(
      `INSERT INTO author_cache (author, payload, at) VALUES (?, ?, ?)
       ON CONFLICT(author) DO UPDATE SET payload = excluded.payload, at = excluded.at`,
    )
    .run(author, JSON.stringify(payload), new Date().toISOString());
}

/** One row per day. Re-running on the same day overwrites — a day has one truth. */
export function snapshot(m: Record<string, number | null>) {
  const day = new Date().toISOString().slice(0, 10);
  open()
    .prepare(
      `INSERT INTO snapshots (day, followers, articles, reactions, comments, views, at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(day) DO UPDATE SET
         followers=excluded.followers, articles=excluded.articles,
         reactions=excluded.reactions, comments=excluded.comments,
         views=excluded.views, at=excluded.at`,
    )
    .run(
      day,
      m.followers ?? null,
      m.articles ?? null,
      m.reactions ?? null,
      m.comments ?? null,
      m.views ?? null,
      new Date().toISOString(),
    );
}

export function history(days = 60) {
  return open()
    .prepare(`SELECT * FROM snapshots ORDER BY day DESC LIMIT ?`)
    .all(days)
    .reverse() as Record<string, number | string>[];
}

export function sessionActions(session: string) {
  return open()
    .prepare(`SELECT * FROM actions WHERE session = ? ORDER BY at`)
    .all(session) as Record<string, unknown>[];
}

export function recentActions(limit = 200) {
  return open()
    .prepare(`SELECT * FROM actions ORDER BY at DESC LIMIT ?`)
    .all(limit) as Record<string, unknown>[];
}

export function upsertThread(t: {
  commentId: string;
  articleId: number;
  articleTitle?: string;
  articleUrl?: string;
  author: string;
  body?: string;
  at: string;
  parentIsMine: boolean;
}) {
  open()
    .prepare(
      `INSERT INTO threads (commentId, articleId, articleTitle, articleUrl, author, body, at, parentIsMine)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(commentId) DO NOTHING`,
    )
    .run(
      t.commentId,
      t.articleId,
      t.articleTitle ?? null,
      t.articleUrl ?? null,
      t.author,
      t.body ?? null,
      t.at,
      t.parentIsMine ? 1 : 0,
    );
}

export function openThreads(limit = 50) {
  return open()
    .prepare(
      `SELECT * FROM threads WHERE handled = 0 ORDER BY at DESC LIMIT ?`,
    )
    .all(limit) as Record<string, unknown>[];
}

export function markThreadHandled(commentId: string) {
  open()
    .prepare(`UPDATE threads SET handled = 1 WHERE commentId = ?`)
    .run(commentId);
}
