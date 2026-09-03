/**
 * Next best action — which of today's open items moves standing the most.
 *
 * Arithmetic over observed edges and ages, nothing else. The model drafts
 * text; it never decides who. Scores, from the standing intent:
 *
 *   +3  answer someone who commented on us and has no tie back from us
 *       (closes a mutual tie — the signal the whole ranking is built on)
 *   +2  comment on a top-N non-staff node we have never touched (core reach)
 *   +1  any author we have no tie with at all
 *   +0.5 per week a reply has waited, capped at 4 weeks
 *    0  inside the 7-day author cooldown
 *   halved if the same author already appears higher in the list
 *
 * Deterministic: same inputs, same order. The selfcheck pins that.
 */
import { STAFF, CORE_N, type StandingGraph } from "./standing";

export interface NbaThread { index: number; author: string; ageDays?: number; replyToUs?: boolean; authorGone?: boolean }
export interface NbaItem { index: number; author: string; kind: "comment" | "reaction" }
export interface NbaActed { author: string; at: number }

export interface NbaRow {
  source: "thread" | "item";
  index: number;
  author: string;
  score: number;
  why: string;
}

export const COOLDOWN_DAYS = 7;

export function rankActions(
  graph: StandingGraph | null,
  me: string,
  threads: NbaThread[],
  items: NbaItem[],
  acted: NbaActed[],
  now = Date.now(),
  coreN = CORE_N,
): NbaRow[] {
  const from = new Set<string>();
  const to = new Set<string>();
  for (const e of graph?.edges ?? []) {
    if (e.from === me) from.add(e.to);
    if (e.to === me) to.add(e.from);
  }
  const core = new Set(
    (graph?.nodes ?? [])
      .filter((n) => !STAFF.has(n.id) && n.id !== me)
      .sort((a, b) => b.degree - a.degree || b.in - a.in || a.id.localeCompare(b.id))
      .slice(0, coreN)
      .map((n) => n.id),
  );
  const lastActed = new Map<string, number>();
  for (const a of acted) lastActed.set(a.author, Math.max(lastActed.get(a.author) ?? 0, a.at));
  const cooling = (author: string) =>
    now - (lastActed.get(author) ?? 0) < COOLDOWN_DAYS * 86_400_000;

  const rows: NbaRow[] = [];
  for (const t of threads) {
    if (t.authorGone || STAFF.has(t.author)) continue;
    let score = 0;
    const why: string[] = [];
    if (to.has(t.author) && !from.has(t.author)) { score += 3; why.push("closes a mutual tie — they commented on us, no tie back yet"); }
    else if (!from.has(t.author) && !to.has(t.author)) { score += 1; why.push("new author"); }
    else why.push("keeps a conversation going");
    if (core.has(t.author)) { score += 2; why.push(`core node (top ${coreN})`); }
    const weeks = Math.min(4, Math.floor((t.ageDays ?? 0) / 7));
    if (weeks) { score += 0.5 * weeks; why.push(`waited ${t.ageDays}d`); }
    rows.push({ source: "thread", index: t.index, author: t.author, score, why: why.join(" · ") });
  }
  for (const it of items) {
    if (STAFF.has(it.author)) continue;
    let score = 0;
    const why: string[] = [];
    if (cooling(it.author)) { rows.push({ source: "item", index: it.index, author: it.author, score: 0, why: `cooldown — acted on @${it.author} in the last ${COOLDOWN_DAYS}d` }); continue; }
    if (to.has(it.author) && !from.has(it.author)) { score += 3; why.push("closes a mutual tie — they commented on us first"); }
    else if (!from.has(it.author) && !to.has(it.author)) { score += 1; why.push("new author"); }
    else why.push("existing tie");
    if (core.has(it.author) && !from.has(it.author)) { score += 2; why.push(`untouched core node (top ${coreN})`); }
    if (it.kind === "reaction") score *= 0.5;
    rows.push({ source: "item", index: it.index, author: it.author, score, why: why.join(" · ") });
  }

  rows.sort((a, b) => b.score - a.score || a.author.localeCompare(b.author) || a.index - b.index);
  const seen = new Set<string>();
  for (const r of rows) {
    if (seen.has(r.author)) r.score /= 2;
    seen.add(r.author);
  }
  rows.sort((a, b) => b.score - a.score || a.author.localeCompare(b.author) || a.index - b.index);
  return rows;
}
