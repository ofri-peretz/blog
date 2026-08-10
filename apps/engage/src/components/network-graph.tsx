"use client";

import { useMemo, useState } from "react";

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

const W = 900;
const H = 560;
const CX = W / 2;
const CY = H / 2;

/**
 * Concentric layout by degree, not force simulation.
 *
 * A force layout of 276 nodes settles into a hairball where position carries no
 * meaning and every render lands somewhere different. Here radius IS the metric
 * — the centre is who the community converges on — so the picture is readable at
 * a glance and identical every time, which matters when you are comparing it
 * against yesterday.
 */
function layout(nodes: Node[]) {
  const ranked = [...nodes].sort((a, b) => b.degree - a.degree);
  const maxDeg = ranked[0]?.degree || 1;
  return new Map(
    ranked.map((n, i) => {
      // Rank, not raw degree, sets the radius: degree is long-tailed, so a raw
      // scale piles ~200 low-degree nodes onto the same outer ring.
      const t = ranked.length > 1 ? i / (ranked.length - 1) : 0;
      const r = 40 + t * (Math.min(W, H) / 2 - 60);
      // Golden angle keeps successive ranks from lining up into spokes.
      const a = i * 2.399963;
      return [
        n.id,
        {
          x: CX + r * Math.cos(a),
          y: CY + r * Math.sin(a),
          r: 3 + (n.degree / maxDeg) * 9,
        },
      ] as const;
    }),
  );
}

export function NetworkGraph({
  graph,
  onOpenPerson,
}: {
  graph: Graph;
  onOpenPerson?: (u: string) => void;
}) {
  const [sel, setSel] = useState<string | null>(null);
  const [limit, setLimit] = useState(90);

  const shown = useMemo(
    () => [...graph.nodes].sort((a, b) => b.degree - a.degree).slice(0, limit),
    [graph.nodes, limit],
  );
  const ids = useMemo(() => new Set(shown.map((n) => n.id)), [shown]);
  const pos = useMemo(() => layout(shown), [shown]);
  const edges = useMemo(
    () => graph.edges.filter((e) => ids.has(e.from) && ids.has(e.to)),
    [graph.edges, ids],
  );

  const related = useMemo(() => {
    if (!sel) return new Set<string>();
    const s = new Set<string>();
    for (const e of edges) {
      if (e.from === sel) s.add(e.to);
      if (e.to === sel) s.add(e.from);
    }
    return s;
  }, [sel, edges]);

  const selNode = shown.find((n) => n.id === sel);
  const hidden = graph.nodes.length - shown.length;

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-line)] px-4 py-2.5 font-mono text-[11px] text-[var(--color-ink-3)]">
        <span>
          {graph.nodes.length} authors · {graph.edges.length} comment ties ·{" "}
          {graph.sampledArticles} articles sampled
        </span>
        <span className="flex items-center gap-2">
          {[40, 90, 200].map((n) => (
            <button
              key={n}
              onClick={() => setLimit(n)}
              className={`border px-2 py-0.5 ${
                limit === n
                  ? "border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-panel)]"
                  : "border-[var(--color-line)]"
              }`}
            >
              top {n}
            </button>
          ))}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_260px]">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="block w-full"
          role="img"
          aria-label="DEV community comment network"
        >
          {edges.map((e, i) => {
            const a = pos.get(e.from)!;
            const b = pos.get(e.to)!;
            const lit = sel && (e.from === sel || e.to === sel);
            return (
              <line
                key={i}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={lit ? "var(--color-accent)" : "var(--color-ink-3)"}
                strokeWidth={lit ? 1.4 : 0.5}
                opacity={sel ? (lit ? 0.9 : 0.05) : 0.16}
              />
            );
          })}
          {shown.map((n) => {
            const p = pos.get(n.id)!;
            const dim = sel && n.id !== sel && !related.has(n.id);
            return (
              <circle
                key={n.id}
                cx={p.x}
                cy={p.y}
                r={p.r}
                fill={
                  n.us
                    ? "var(--color-accent)"
                    : n.mutual.length
                      ? "var(--color-good)"
                      : "var(--color-ink-3)"
                }
                stroke="var(--color-panel)"
                strokeWidth={1.2}
                opacity={dim ? 0.18 : 1}
                className="cursor-pointer"
                onClick={() => setSel(n.id === sel ? null : n.id)}
              >
                <title>
                  @{n.id} · degree {n.degree}
                </title>
              </circle>
            );
          })}
        </svg>

        <aside className="border-t border-[var(--color-line)] p-4 text-[13px] md:border-l md:border-t-0">
          {selNode ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={`https://dev.to/${selNode.id}`}
                  target="_blank"
                  rel="noopener"
                  className="font-mono text-[13px] text-[var(--color-accent)]"
                >
                  @{selNode.id}
                </a>
                {onOpenPerson && (
                  <button
                    onClick={() => onOpenPerson(selNode.id)}
                    className="rounded border border-[var(--color-accent)] px-2 py-0.5 font-mono text-[10px] uppercase text-[var(--color-accent)]"
                  >
                    drill down
                  </button>
                )}
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-y-1 font-mono text-[12px] text-[var(--color-ink-2)]">
                <dt>ties</dt>
                <dd className="text-right">{selNode.degree}</dd>
                <dt>comments in</dt>
                <dd className="text-right">{selNode.in}</dd>
                <dt>comments out</dt>
                <dd className="text-right">{selNode.out}</dd>
                <dt>mutual</dt>
                <dd className="text-right">{selNode.mutual.length}</dd>
              </dl>
              {selNode.mutual.length > 0 && (
                <p className="mt-3 text-[12px] text-[var(--color-ink-2)]">
                  Two-way with: {selNode.mutual.slice(0, 6).join(", ")}
                </p>
              )}
            </>
          ) : (
            <p className="text-[var(--color-ink-3)]">
              Click a node. Distance from centre is rank by number of ties —
              centre is who this slice of the community converges on.
            </p>
          )}

          <div className="mt-4 space-y-1 border-t border-[var(--color-line)] pt-3 font-mono text-[10px] uppercase tracking-wider text-[var(--color-ink-3)]">
            <div>
              <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[var(--color-accent)]" />
              us
            </div>
            <div>
              <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[var(--color-good)]" />
              mutual tie
            </div>
            <div>
              <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[var(--color-ink-3)]" />
              one-way
            </div>
          </div>
          {hidden > 0 && (
            <p className="mt-3 text-[11px] text-[var(--color-ink-3)]">
              {hidden} lower-degree authors hidden — not filtered out, just below
              the display cap.
            </p>
          )}
        </aside>
      </div>

      {graph.clusters.length === 0 && (
        <p className="border-t border-[var(--color-line)] px-4 py-3 text-[12.5px] text-[var(--color-ink-2)]">
          <b>No mutual clusters yet.</b> We only sample articles we engaged with,
          so we observe who comments on our picks — never whether those authors
          comment on <em>each other</em>. A 2-hop crawl over each author&apos;s own
          articles is what surfaces real communities.
        </p>
      )}
    </div>
  );
}
