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

  for (const [id, owner] of articles) {
    let comments: DevComment[];
    try {
      comments = await fetchJson(`https://dev.to/api/comments?a_id=${id}`);
    } catch {
      continue; // one unreachable article must not void the whole graph
    }
    if (!Array.isArray(comments)) continue;
    sampled++;
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
  opts: { topAuthors?: number; perAuthor?: number } = {},
  fetchJson: (url: string) => Promise<any> = defaultFetch,
): Promise<[number, string][]> {
  const { topAuthors = 25, perAuthor = 3 } = opts;
  const targets = seed.nodes
    .filter((n) => !n.us)
    .sort((a, b) => b.degree - a.degree)
    .slice(0, topAuthors);

  const extra: [number, string][] = [];
  for (const n of targets) {
    try {
      const arts = await fetchJson(
        `https://dev.to/api/articles?username=${encodeURIComponent(n.id)}&per_page=${perAuthor}`,
      );
      if (!Array.isArray(arts)) continue;
      for (const a of arts) if (a?.id) extra.push([a.id, n.id]);
    } catch {
      continue; // one unreachable author must not void the expansion
    }
  }
  return extra;
}
