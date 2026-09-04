/**
 * Ties — the comment ledger folded by person.
 * Intent: docs/sdlc/intents/2026-09-04-engage-ties.
 */
export interface CommentRow {
  author: string;
  article_author: string | null;
  direction: "in" | "out";
  created_at: string;
  comment_id?: string;
  body_excerpt?: string | null;
  article_id?: number;
}

export interface Tie {
  who: string;
  in: number;
  out: number;
  lastIn: string | null;
  lastOut: string | null;
  /** Days since the last exchange in either direction. */
  days: number;
  mutual: boolean;
  state: "warm" | "cooling" | "cold";
  /** Their latest comment on us: what a reply in kind would answer. */
  last?: { commentId: string; excerpt: string; articleId: number | null };
}

export const WARM_DAYS = 14;
export const COOLING_DAYS = 45;
export const OWN = "ofri-peretz";

const day = (iso: string) => iso.slice(0, 10);
const later = (a: string | null, b: string) => (a == null || b > a ? b : a);

export function state(days: number): Tie["state"] {
  return days <= WARM_DAYS ? "warm" : days <= COOLING_DAYS ? "cooling" : "cold";
}

/** One tie per counterpart: the comment's author inbound, the article's author outbound. */
export function fold(rows: CommentRow[], now = Date.now()): Tie[] {
  const m = new Map<string, Tie>();
  for (const r of rows) {
    const who = r.direction === "in" ? r.author : (r.article_author ?? "");
    if (!who || who === OWN) continue;
    const t = m.get(who) ?? {
      who,
      in: 0,
      out: 0,
      lastIn: null,
      lastOut: null,
      days: 0,
      mutual: false,
      state: "cold",
    };
    if (r.direction === "in") {
      t.in += 1;
      if (t.lastIn == null || day(r.created_at) >= t.lastIn)
        t.last = {
          commentId: r.comment_id ?? "",
          excerpt: r.body_excerpt ?? "",
          articleId: r.article_id ?? null,
        };
      t.lastIn = later(t.lastIn, day(r.created_at));
    } else {
      t.out += 1;
      t.lastOut = later(t.lastOut, day(r.created_at));
    }
    m.set(who, t);
  }
  for (const t of m.values()) {
    const last = [t.lastIn, t.lastOut]
      .filter((x): x is string => !!x)
      .sort()
      .pop()!;
    t.days = Math.max(0, Math.floor((now - Date.parse(last)) / 86_400_000));
    t.mutual = t.in > 0 && t.out > 0;
    t.state = state(t.days);
  }
  return [...m.values()];
}

/** Mutual ties, the quietest first. */
export function goingCold(ties: Tie[]): Tie[] {
  return ties.filter((t) => t.mutual).sort((a, b) => b.days - a.days);
}

/** They commented on us; we never commented on them. Newest first: still answerable. */
export function owed(ties: Tie[]): Tie[] {
  return ties
    .filter((t) => t.in > 0 && t.out === 0)
    .sort((a, b) => a.days - b.days);
}

export interface FollowerRow {
  onboarding: boolean | null;
}
export function followerSplit(rows: FollowerRow[]) {
  let prior = 0,
    sameDay = 0,
    unresolved = 0;
  for (const r of rows)
    r.onboarding === false
      ? prior++
      : r.onboarding === true
        ? sameDay++
        : unresolved++;
  return { total: rows.length, prior, sameDay, unresolved };
}
