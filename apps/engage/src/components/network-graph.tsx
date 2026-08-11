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
  graph: Graph;
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

      <p className="font-mono text-[11px] text-[var(--muted-foreground)]">
        {tally.us} us · {tally.mutual} mutual ties · {tally.oneWay} one-way.
        Distance from centre is rank by number of ties.
      </p>

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
