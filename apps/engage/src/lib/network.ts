/**
 * The DEV community as a graph.
 *
 * WHAT IS OBTAINABLE, and what is not — this matters, because the obvious
 * version of this feature cannot be built:
 *
 *   Reactions are counts only. `public_reactions_count` is a number; Dev.to
 *   exposes no endpoint listing WHO reacted to an article. So "these authors
 *   react to each other constantly" is not directly measurable, and any graph
 *   claiming to show it would be inferring edges it never observed.
 *
 *   Comments ARE public per article (`/api/comments?a_id=`). So author→author
 *   comment edges are real, observed data. That is the graph this builds.
 *
 * Comment edges are also the better signal: a comment is a deliberate act with
 * a reply surface, where a reaction is one click. Clusters of authors who
 * comment on each other are exactly the groups worth joining.
 */
import "server-only";
import { fetchJson } from "./throttle";

export interface Edge {
  from: string;
  to: string;
  weight: number;
  /** Article ids the edge was observed on — the evidence, kept so a claim is auditable. */
  via: number[];
}

export interface Node {
  id: string;
  /** Comments this author left on others' articles (observed within our sample). */
  out: number;
  /** Comments others left on this author's articles. */
  in: number;
  /** Distinct authors they exchange comments with, both directions. */
  degree: number;
  /** Mutual ties — A commented on B AND B on A. The real relationship signal. */
  mutual: string[];
  us: boolean;
}

export interface Graph {
  nodes: Node[];
  edges: Edge[];
  /** Connected groups above a size floor — candidate communities to join. */
  clusters: { members: string[]; density: number }[];
  sampledArticles: number;
  /** The ids actually crawled, so the sample itself is auditable. */
  sampledIds?: number[];
  fetchedAt: string;
}

export const ME = "ofri-peretz";

interface DevComment {
  id_code: string;
  user: { username: string };
  children?: DevComment[];
}

function flatten(cs: DevComment[]): DevComment[] {
  return cs.flatMap((c) => [c, ...flatten(c.children ?? [])]);
}

/**
 * Build the graph from a set of articles we already know about.
 * `articles` is [id, authorUsername] — the author is the edge target, since a
 * comment on their article is a tie directed at them.
 */
export async function buildGraph(
  articles: [number, string][],
  fetchJson: (url: string) => Promise<any> = defaultFetch,
): Promise<Graph> {
  const edges = new Map<string, Edge>();
  let sampled = 0;
  // The ids, not just the count. `sampledArticles: 132` cannot be reproduced,
  // audited, or diffed against a later run — you cannot tell a graph that
  // sampled the wrong 132 articles from one that sampled the right ones. The
  // `via` evidence on each edge is only checkable against the sample it came
  // from.
  const sampledIds: number[] = [];

  for (const [id, owner] of articles) {
    let comments: DevComment[];
    try {
      comments = await fetchJson(`https://dev.to/api/comments?a_id=${id}`);
    } catch {
      continue; // one unreachable article must not void the whole graph
    }
    if (!Array.isArray(comments)) continue;
    sampled++;
    sampledIds.push(id);
    for (const c of flatten(comments)) {
      const from = c.user?.username;
      if (!from || from === owner) continue; // self-comments are not a tie
      const key = `${from}→${owner}`;
      const e = edges.get(key) ?? { from, to: owner, weight: 0, via: [] };
      e.weight++;
      if (!e.via.includes(id)) e.via.push(id);
      edges.set(key, e);
    }
  }

  const nodeMap = new Map<string, Node>();
  const touch = (id: string) =>
    nodeMap.get(id) ??
    nodeMap.set(id, { id, out: 0, in: 0, degree: 0, mutual: [], us: id === ME })
      .get(id)!;

  for (const e of edges.values()) {
    touch(e.from).out += e.weight;
    touch(e.to).in += e.weight;
  }
  const has = (a: string, b: string) => edges.has(`${a}→${b}`);
  for (const n of nodeMap.values()) {
    const partners = new Set<string>();
    for (const e of edges.values()) {
      if (e.from === n.id) partners.add(e.to);
      if (e.to === n.id) partners.add(e.from);
    }
    n.degree = partners.size;
    n.mutual = [...partners].filter((p) => has(n.id, p) && has(p, n.id));
  }

  return {
    nodes: [...nodeMap.values()].sort((a, b) => b.degree - a.degree),
    edges: [...edges.values()],
    clusters: clusters([...nodeMap.values()], [...edges.values()]),
    sampledArticles: sampled,
    sampledIds,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Connected components over MUTUAL edges only.
 *
 * One-directional edges are mostly noise here — a drive-by comment is not a
 * relationship. Requiring reciprocity is what makes a cluster mean "these people
 * actually talk to each other", which is the question being asked.
 */
function clusters(nodes: Node[], edges: Edge[]) {
  const mutual = new Map<string, Set<string>>();
  const has = (a: string, b: string) =>
    edges.some((e) => e.from === a && e.to === b);
  for (const e of edges) {
    if (!has(e.to, e.from)) continue;
    (mutual.get(e.from) ?? mutual.set(e.from, new Set()).get(e.from)!).add(e.to);
    (mutual.get(e.to) ?? mutual.set(e.to, new Set()).get(e.to)!).add(e.from);
  }
  const seen = new Set<string>();
  const out: { members: string[]; density: number }[] = [];
  for (const start of mutual.keys()) {
    if (seen.has(start)) continue;
    const group: string[] = [];
    const stack = [start];
    while (stack.length) {
      const cur = stack.pop()!;
      if (seen.has(cur)) continue;
      seen.add(cur);
      group.push(cur);
      for (const nb of mutual.get(cur) ?? []) if (!seen.has(nb)) stack.push(nb);
    }
    if (group.length < 3) continue; // a pair is not a community
    const pairs = (group.length * (group.length - 1)) / 2;
    let present = 0;
    for (let i = 0; i < group.length; i++)
      for (let j = i + 1; j < group.length; j++)
        if (mutual.get(group[i])?.has(group[j])) present++;
    out.push({ members: group, density: pairs ? present / pairs : 0 });
  }
  return out.sort((a, b) => b.members.length - a.members.length);
}

async function defaultFetch(url: string) {
  return fetchJson(url, { headers: { accept: "application/json" } });
}

/**
 * Phase 4 — the second hop.
 *
 * One hop only ever answers "who commented on the articles WE picked", so
 * reciprocity is structurally unobservable and every cluster count comes back 0.
 * The second hop samples the discovered authors' OWN recent articles, which is
 * where A-commented-on-B and B-commented-on-A can both be seen — and mutual
 * edges are the entire basis for saying a group exists.
 *
 * Cost is the reason this is bounded: each author costs one article-list request
 * plus one comment request per article. `topAuthors` x `perAuthor` is the budget,
 * and it is deliberately small enough to stay polite to a public API.
 */
export async function expandTwoHop(
  seed: Graph,
  opts: { topAuthors?: number; perAuthor?: number; ourArticles?: number } = {},
  fetchJson: (url: string) => Promise<any> = defaultFetch,
): Promise<[number, string][]> {
  const { topAuthors = 25, perAuthor = 3, ourArticles = 200 } = opts;

  /*
   * OUR OWN ARTICLES ARE ALWAYS SAMPLED, and are not subject to the top-N
   * ranking.
   *
   * This used to read `.filter((n) => !n.us)`, which looks like a sensible
   * "don't waste budget on ourselves" and is the one exclusion that breaks the
   * thing this hop exists for. Every edge points at the OWNER of the article it
   * was observed on, so never sampling our articles means no edge can ever
   * point at us: our `in` is structurally 0, our `mutual` structurally empty,
   * for any corpus, forever.
   *
   * Measured against the dev.to API on 2026-08-11: the graph had 0 edges to us
   * and in=0, while 19 distinct authors had left 37 comments on our articles —
   * and 11 of those 19 were ALREADY nodes in the graph, just never connected to
   * us. The "ranked by who talked back" panel was ranking on a column that
   * could only ever be zero.
   *
   * A larger budget than `perAuthor` because this is the whole inbound signal
   * rather than one sample among 25.
   */
  const targets: { id: string; take: number }[] = [
    { id: ME, take: ourArticles },
    ...seed.nodes
      .filter((n) => !n.us)
      .sort((a, b) => b.degree - a.degree)
      .slice(0, topAuthors)
      .map((n) => ({ id: n.id, take: perAuthor })),
  ];

  const extra: [number, string][] = [];
  const seen = new Set<number>();
  for (const t of targets) {
    try {
      const arts = await fetchJson(
        `https://dev.to/api/articles?username=${encodeURIComponent(t.id)}&per_page=${t.take}`,
      );
      if (!Array.isArray(arts)) continue;
      for (const a of arts) {
        if (!a?.id || seen.has(a.id)) continue;
        /*
         * For OUR articles, skip the ones with no comments.
         *
         * The list endpoint already returns `comments_count`, so an article
         * with zero comments is a guaranteed-empty crawl request. Skipping
         * them buys full history for FEWER requests than the 40-most-recent
         * window cost: measured, a 40-article window saw 26 of the 37 comments
         * on our articles, missing everything older — including a thread from
         * February. Filtering by count covers all of them and still only pays
         * for the ~14 articles that have anything on them.
         *
         * Not applied to other authors: `perAuthor` is a deliberate sampling
         * budget there, not an attempt at completeness.
         */
        if (t.id === ME && typeof a.comments_count === "number" && a.comments_count === 0)
          continue;
        seen.add(a.id);
        extra.push([a.id, t.id]);
      }
    } catch {
      continue; // one unreachable author must not void the expansion
    }
  }
  return extra;
}
