"use client";

import { useMemo, useState } from "react";

import { NetworkGraph as DsNetworkGraph } from "@/components/ui/charts/network-graph";
import type { GraphNode } from "@/components/ui/charts/graph";

interface Node {
  id: string;
  in: number;
  out: number;
  degree: number;
  mutual: string[];
  us: boolean;
}
interface Edge {
  from: string;
  to: string;
  weight: number;
}
export interface Graph {
  nodes: Node[];
  edges: Edge[];
  clusters: { members: string[]; density: number }[];
  sampledArticles: number;
  /** When the crawl ran. The graph is cached 12h; age belongs on screen. */
  fetchedAt?: string;
}

/**
 * The app's comment network, drawn by `@interlace/ui`'s NetworkGraph.
 *
 * What used to live here — 190 lines of concentric-layout trigonometry, edge
 * and node painting, a selection aside and a colour key — is now the DS
 * component. This file is the adapter: it maps our domain nodes onto the DS's
 * `{ id, weight, group, label }` shape and owns the detail panel, which is
 * exactly the seam the DS documents ("the DS owns the graph; the app owns the
 * meaning").
 *
 * Two things the DS does not do, and how they are handled:
 *
 *  - `GraphNode` is not generic, and `renderDetail` is handed a bare
 *    `GraphNode`. Our `in` / `out` / `mutual` fields cannot ride along through
 *    the type, so the detail panel looks the node back up by id.
 *  - `group` is accepted, feeds the screen-reader table, and is documented as
 *    driving "the legend and the node tone" — but the component paints every
 *    node `fill-viz-node` and renders no legend. The three-way us / mutual /
 *    one-way encoding therefore survives as a header tally and in the detail
 *    panel rather than as node colour.
 */
export function NetworkGraph({
  graph,
  onOpenPerson,
}: {
  graph: Graph & {
    targets?: string[];
    discovered?: string[];
    removedAuthors?: string[];
  };
  onOpenPerson?: (u: string) => void;
}) {
  const [sel, setSel] = useState<string | null>(null);

  const byId = useMemo(
    () => new Map(graph.nodes.map((n) => [n.id, n])),
    [graph.nodes],
  );

  const nodes = useMemo<GraphNode[]>(
    () =>
      graph.nodes.map((n) => ({
        id: n.id,
        weight: n.degree,
        label: `@${n.id}`,
        group: n.us ? "us" : n.mutual.length ? "mutual tie" : "one-way",
      })),
    [graph.nodes],
  );

  /*
   * Freshness, on screen.
   *
   * The crawl is cached for 12 hours, so a graph can be most of a day old with
   * nothing saying so — and every conclusion drawn off it inherits that age
   * silently. Same rule the series spine already follows.
   */
  const ageHours = graph.fetchedAt
    ? Math.round((Date.now() - Date.parse(graph.fetchedAt)) / 3_600_000)
    : null;

  const tally = useMemo(() => {
    let us = 0;
    let mutual = 0;
    for (const n of graph.nodes) {
      if (n.us) us += 1;
      else if (n.mutual.length) mutual += 1;
    }
    return { us, mutual, oneWay: graph.nodes.length - us - mutual };
  }, [graph.nodes]);

  return (
    <div className="space-y-2">
      <DsNetworkGraph
        nodes={nodes}
        edges={graph.edges}
        selected={sel}
        onSelect={setSel}
        caption={`${graph.sampledArticles} articles sampled`}
        renderDetail={(node) => {
          const n = byId.get(node.id);
          if (!n) return null;
          return (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={`https://dev.to/${n.id}`}
                  target="_blank"
                  rel="noopener"
                  className="font-mono text-[13px] text-[var(--primary)]"
                >
                  @{n.id}
                </a>
                {onOpenPerson && (
                  <button
                    onClick={() => onOpenPerson(n.id)}
                    className="rounded border border-[var(--primary)] px-2 py-0.5 font-mono text-[10px] uppercase text-[var(--primary)]"
                  >
                    drill down
                  </button>
                )}
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-y-1 font-mono text-[12px] text-[var(--muted-foreground)]">
                <dt>ties</dt>
                <dd className="text-right">{n.degree}</dd>
                <dt>comments in</dt>
                <dd className="text-right">{n.in}</dd>
                <dt>comments out</dt>
                <dd className="text-right">{n.out}</dd>
                <dt>mutual</dt>
                <dd className="text-right">{n.mutual.length}</dd>
              </dl>
              <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
                {n.us ? "us" : n.mutual.length ? "mutual tie" : "one-way"}
              </p>
              {n.mutual.length > 0 && (
                <p className="mt-3 text-[12px] text-[var(--muted-foreground)]">
                  Two-way with: {n.mutual.slice(0, 6).join(", ")}
                </p>
              )}
            </>
          );
        }}
      />

      {/* Legend. The colours became meaningful; nothing said what they meant. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-[var(--muted-foreground)]">
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-full bg-[var(--primary)]" /> us
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-full bg-[var(--success)]" />
          mutual tie ({tally.mutual})
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-full bg-[var(--muted-foreground)]" />
          one-way ({tally.oneWay})
        </span>
        <span className="ml-auto">
          {ageHours === null
            ? "age unknown"
            : ageHours < 1
              ? "fresh"
              : `${ageHours}h old`}
          {graph.removedAuthors?.length
            ? ` · ${graph.removedAuthors.length} deleted account(s) pruned`
            : ""}
        </span>
      </div>
      <p className="font-mono text-[11px] text-[var(--muted-foreground)]">
        Distance from centre is rank by number of ties.
      </p>

      {/*
        NEW TERRITORY — leading authors on the platform with no edge to us.
        
        This is the actionable half of widening the map. The graph used to be
        seeded only from what we had already touched, so it could never contain
        anyone new; now that it discovers the platform's leaders, the ones we
        have NOT reached are the list worth acting on. Without this panel they
        exist only in the API response, which is the same as not existing.
      */}
      {graph.targets?.length ? (
        <div className="rounded-lg border border-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_6%,transparent)] p-3">
          <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--primary)]">
            not reached yet · {graph.targets.length} of {graph.discovered?.length ?? 0} leading authors
          </div>
          <ul className="flex flex-wrap gap-1.5">
            {graph.targets.slice(0, 24).map((u) => (
              <li key={u}>
                <button
                  onClick={() => onOpenPerson?.(u)}
                  className="rounded border border-[var(--border)] px-2 py-0.5 font-mono text-[11px] text-[var(--muted-foreground)] hover:border-[var(--primary)] hover:text-[var(--primary)]"
                >
                  @{u}
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[12px] text-[var(--muted-foreground)]">
            Ranked by engagement across dev.to&apos;s own feeds, comments weighted
            3x reactions — a reaction is one click, a comment is a conversation
            you can join. Click to open the author.
          </p>
        </div>
      ) : null}

      {graph.clusters.length === 0 && (
        <p className="rounded-lg border border-[var(--border)] px-4 py-3 text-[12.5px] text-[var(--muted-foreground)]">
          <b>No mutual clusters yet.</b> We only sample articles we engaged with,
          so we observe who comments on our picks — never whether those authors
          comment on <em>each other</em>. A 2-hop crawl over each author&apos;s own
          articles is what surfaces real communities.
        </p>
      )}
    </div>
  );
}
