"use client";

// Client seam for the DS TimelineMap: `linkComponent` is a FUNCTION, and a
// server component cannot pass one across the RSC boundary (caught live —
// "Functions cannot be passed directly to Client Components"). The server
// page hands over serializable items; the Link injection happens here.

import Link from "next/link";
import {
  TimelineMap,
  type TimelineMapAxis,
  type TimelineMapItem,
} from "@/components/ui/timeline-map";
import { track } from "@/lib/analytics";

// Module constant, not inline: the axis object's identity feeds the
// layout memo — a fresh object per render would recompute it every time.
const MINUTES_AXIS: TimelineMapAxis = {
  kind: "number",
  format: (v) => `${v} min`,
};

export function WovenCorpusMap({
  items,
}: {
  items: readonly TimelineMapItem[];
}) {
  return (
    <TimelineMap
      items={items}
      data-testid="corpus-map"
      uncategorizedLabel="Standalone"
      axis={MINUTES_AXIS}
      linkComponent={Link}
      onItemClick={(item) =>
        track("corpus_map:dot_click", {
          slug: item.id,
          series: item.category ?? null,
        })
      }
      className="mt-8"
    >
      <figcaption className="mb-3 text-sm text-muted-foreground">
        <span className="text-foreground">Every article, mapped.</span> Left
        to right: reading time — pick your time budget · row: series · dot
        size: community reactions · threads: where one article weaves into
        another. Hover to preview, click to read.
      </figcaption>
      <TimelineMap.Filter />
      <TimelineMap.Chart />
      <TimelineMap.Detail idle="Hover a dot to preview an article." />
    </TimelineMap>
  );
}
