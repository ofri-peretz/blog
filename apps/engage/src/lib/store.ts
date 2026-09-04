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

    -- Comment yield (first 14 days), one row per day. See lib/yield.ts.
    CREATE TABLE IF NOT EXISTS comment_yield (
      day           TEXT PRIMARY KEY,
      articles_30d  INTEGER, mean14d_30d REAL, with_any_30d INTEGER,
      articles_total INTEGER, with_any_total INTEGER,
      at            TEXT NOT NULL
    );

    -- The league: our rank among the month's authors, one row per day. See lib/league.ts.
    CREATE TABLE IF NOT EXISTS league_daily (
      day TEXT PRIMARY KEY, rank INTEGER, authors INTEGER, reactions INTEGER, comments INTEGER, articles INTEGER,
      t5 INTEGER, t10 INTEGER, t20 INTEGER, t50 INTEGER, t100 INTEGER, at TEXT NOT NULL
    );

    -- The Author Impact Score, one row per day. See lib/impact-score.ts.
    CREATE TABLE IF NOT EXISTS impact_score (
      day        TEXT PRIMARY KEY,
      score      REAL NOT NULL,
      readers    REAL, resonance REAL, standing REAL, arena REAL, downstream REAL,
      measured   INTEGER, total INTEGER,
      at         TEXT NOT NULL
    );

    -- Outreach PRs waiting on us, one row per day. See /api/prs.
    CREATE TABLE IF NOT EXISTS outreach (
      day            TEXT PRIMARY KEY,
      open           INTEGER, our_move INTEGER, blocked INTEGER, behind_base INTEGER, conflicts INTEGER,
      at             TEXT NOT NULL
    );
  `);
  return db;
}

export function writeYield(day: string, s: import("./yield").YieldSummary) {
  open()
    .prepare(
      `INSERT INTO comment_yield (day, articles_30d, mean14d_30d, with_any_30d, articles_total, with_any_total, at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(day) DO UPDATE SET articles_30d=excluded.articles_30d, mean14d_30d=excluded.mean14d_30d,
         with_any_30d=excluded.with_any_30d, articles_total=excluded.articles_total,
         with_any_total=excluded.with_any_total, at=excluded.at`,
    )
    .run(day, s.articles30d, s.mean14d30d, s.withAny30d, s.articlesTotal, s.withAnyTotal, new Date().toISOString());
}
export function yieldHistory(days = 400) {
  return (open().prepare(`SELECT * FROM comment_yield ORDER BY day DESC LIMIT ?`).all(days) as Record<string, number | string | null>[]).reverse();
}

export function writeLeague(day: string, c: import("./league").Climb) {
  open()
    .prepare(
      `INSERT INTO league_daily (day, rank, authors, reactions, comments, articles, t5, t10, t20, t50, t100, at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(day) DO UPDATE SET rank=excluded.rank, authors=excluded.authors, reactions=excluded.reactions, comments=excluded.comments,
         articles=excluded.articles, t5=excluded.t5, t10=excluded.t10, t20=excluded.t20, t50=excluded.t50, t100=excluded.t100, at=excluded.at`,
    )
    .run(day, c.rank, c.authors, c.ours?.reactions ?? null, c.ours?.comments ?? null, c.ours?.articles ?? null, c.thresholds[5], c.thresholds[10], c.thresholds[20], c.thresholds[50], c.thresholds[100], new Date().toISOString());
}
export function leagueHistory(days = 400) {
  return (open().prepare(`SELECT * FROM league_daily ORDER BY day DESC LIMIT ?`).all(days) as Record<string, number | string | null>[]).reverse();
}

export function writeImpact(day: string, r: import("./impact-score").ImpactScore) {
  const p = (id: string) => r.pillars.find((x) => x.id === id)?.points ?? null;
  open()
    .prepare(
      `INSERT INTO impact_score (day, score, readers, resonance, standing, arena, downstream, measured, total, at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(day) DO UPDATE SET score=excluded.score, readers=excluded.readers, resonance=excluded.resonance,
         standing=excluded.standing, arena=excluded.arena, downstream=excluded.downstream,
         measured=excluded.measured, total=excluded.total, at=excluded.at`,
    )
    .run(day, r.score, p("readers"), p("resonance"), p("standing"), p("arena"), p("downstream"), r.measured, r.total, new Date().toISOString());
}
export function impactHistory(days = 400) {
  return (open().prepare(`SELECT * FROM impact_score ORDER BY day DESC LIMIT ?`).all(days) as Record<string, number | string | null>[]).reverse();
}

export function writeOutreach(day: string, r: { open: number; ourMove: number; blocked: number; behindBase: number; conflicts: number }) {
  open()
    .prepare(
      `INSERT INTO outreach (day, open, our_move, blocked, behind_base, conflicts, at) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(day) DO UPDATE SET open=excluded.open, our_move=excluded.our_move, blocked=excluded.blocked,
         behind_base=excluded.behind_base, conflicts=excluded.conflicts, at=excluded.at`,
    )
    .run(day, r.open, r.ourMove, r.blocked, r.behindBase, r.conflicts, new Date().toISOString());
}
export function outreachHistory(days = 400) {
  return (open().prepare(`SELECT * FROM outreach ORDER BY day DESC LIMIT ?`).all(days) as Record<string, number | string | null>[]).reverse();
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
