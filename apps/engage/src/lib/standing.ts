/**
 * Standing — are we becoming a more important author on DEV?
 *
 * Intent: docs/sdlc/intents/2026-09-02-engage-standing. "Important" is defined
 * there as: people comment on our work, we answer, and the ties are two-way
 * with the authors the network converges on. Every number here is a COUNT of
 * comment edges or threads that exist on dev.to. Nothing is inferred: no
 * centrality from a layout, no reputation guess, no follower comparison
 * (followers are only exposed for our own account, so no rank is possible).
 *
 * Pure: takes the crawled graph and the inbox, returns a row. The route stores
 * the row; the series spine charts it. Keeping it pure is what lets the
 * selfcheck pin it against a fixture graph.
 *
 * Sample-bound, and says so: `sample_size` and `sample_hash` travel with every
 * row, because a wider crawl raises everyone's degree and a rank is only
 * comparable to a rank from the same sample policy.
 */
import { createHash } from "node:crypto";

export interface StandingNode {
  id: string;
  in: number;
  out: number;
  degree: number;
  mutual: string[];
  us?: boolean;
}
export interface StandingEdge {
  from: string;
  to: string;
  weight: number;
}
export interface StandingGraph {
  nodes: StandingNode[];
  edges: StandingEdge[];
  sampledArticles?: number;
  sampledIds?: number[];
}
export interface StandingThread {
  at: string;
  ageDays?: number;
  /** Set when we have answered — from the reconciler or the local mark. */
  answeredAt?: string | null;
}

export interface StandingRow {
  degree: number;
  /** Distinct authors with an observed edge INTO us. */
  in_authors: number;
  mutual: number;
  /** Mutual ties with the top-N non-staff nodes. */
  core_reach: number;
  /** 1-based rank among non-staff nodes by degree; null if we are absent. */
  rank_nonstaff: number | null;
  /** Percentile of non-staff nodes we out-rank, 0-100. */
  rank_pct: number | null;
  replies_waiting: number;
  /** Median hours from their comment to our answer, over answered threads. null = nothing answered yet. */
  reply_latency_h: number | null;
  sample_size: number;
  sample_hash: string;
}

/** Forem staff sit at the top of the graph by construction. Labelled, not hidden. */
export const STAFF = new Set(["sloan", "ben", "jess", "peter", "michaeltharrington", "thepracticaldev"]);

export const CORE_N = 40;

export function sampleHash(ids: number[] | undefined): string {
  const sorted = [...(ids ?? [])].sort((a, b) => a - b);
  return createHash("sha1").update(sorted.join(",")).digest("hex").slice(0, 12);
}

export function computeStanding(
  graph: StandingGraph,
  me: string,
  threads: StandingThread[] = [],
  coreN = CORE_N,
): StandingRow {
  const us = graph.nodes.find((n) => n.id === me);
  const nonStaff = graph.nodes
    .filter((n) => !STAFF.has(n.id))
    .sort((a, b) => b.degree - a.degree || b.in - a.in || a.id.localeCompare(b.id));
  const idx = nonStaff.findIndex((n) => n.id === me);
  const core = new Set(nonStaff.filter((n) => n.id !== me).slice(0, coreN).map((n) => n.id));

  const inAuthors = new Set(graph.edges.filter((e) => e.to === me).map((e) => e.from));
  const mutual = us?.mutual ?? [];

  const answered = threads
    .filter((t) => t.answeredAt)
    .map((t) => (Date.parse(t.answeredAt!) - Date.parse(t.at)) / 3_600_000)
    .filter((h) => Number.isFinite(h) && h >= 0)
    .sort((a, b) => a - b);
  const latency =
    answered.length === 0
      ? null
      : answered.length % 2
        ? answered[(answered.length - 1) / 2]
        : (answered[answered.length / 2 - 1] + answered[answered.length / 2]) / 2;

  return {
    degree: us?.degree ?? 0,
    in_authors: inAuthors.size,
    mutual: mutual.length,
    core_reach: mutual.filter((m) => core.has(m)).length,
    rank_nonstaff: idx === -1 ? null : idx + 1,
    rank_pct:
      idx === -1 || nonStaff.length < 2
        ? null
        : Math.round((100 * (nonStaff.length - 1 - idx)) / (nonStaff.length - 1)),
    replies_waiting: threads.filter((t) => !t.answeredAt).length,
    reply_latency_h: latency === null ? null : Math.round(latency * 10) / 10,
    sample_size: graph.sampledArticles ?? graph.sampledIds?.length ?? 0,
    sample_hash: sampleHash(graph.sampledIds),
  };
}
