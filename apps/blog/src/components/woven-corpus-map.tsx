"use client";

// Client seam for the DS TimelineMap: `linkComponent` is a FUNCTION, and a
// server component cannot pass one across the RSC boundary (caught live —
// "Functions cannot be passed directly to Client Components"). The server
// page hands over serializable items; the Link injection happens here —
// and so does the reader's thread, which exists only in this browser
// (reading-history.ts) and therefore only after hydration: the
// server-rendered map is honestly trace-free for crawlers.

import Link from "next/link";
import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";

import {
  TimelineMap,
  type TimelineMapAxis,
  type TimelineMapItem,
  type TimelineMapTrace,
} from "@/components/ui/timeline-map";
import { TrackedLink } from "@/components/tracked-link";
import { track } from "@/lib/analytics";
import {
  parseThreadSnapshot,
  serverThreadSnapshot,
  subscribeThread,
  threadSnapshot,
} from "@/lib/reading-history";
import { pickResume, type SeriesIndex } from "@/lib/series-resume";

// Module constant, not inline: the axis object's identity feeds the
// layout memo — a fresh object per render would recompute it every time.
const MINUTES_AXIS: TimelineMapAxis = {
  kind: "number",
  format: (v) => `${v} min`,
};

export function WovenCorpusMap({
  items,
  seriesIndex,
}: {
  items: readonly TimelineMapItem[];
  /** Public series structure for the resume offer (server-built). */
  seriesIndex: SeriesIndex;
}) {
  // The reader's thread: first-read order from localStorage, narrowed to
  // slugs that are actually on the map. useSyncExternalStore, not
  // effect+setState (the linter rightly flags cascading renders): the
  // raw stored string is the snapshot — value identity, so an unchanged
  // thread never re-renders — the server snapshot is empty (the honest
  // crawler view), and a thread grown in another tab flows in live.
  const rawThread = useSyncExternalStore(
    subscribeThread,
    threadSnapshot,
    serverThreadSnapshot,
  );
  // One parse per thread change; both derivations below ride it (review).
  const allThreadSlugs = useMemo(
    () => parseThreadSnapshot(rawThread),
    [rawThread],
  );
  const readSlugs = useMemo(() => {
    const known = new Set(items.map((i) => i.id));
    return allThreadSlugs.filter((s) => known.has(s));
  }, [allThreadSlugs, items]);

  const trace = useMemo<TimelineMapTrace | undefined>(() => {
    if (readSlugs.length < 2) return undefined;
    return {
      ids: readSlugs,
      label: `Your thread: ${readSlugs.length} of ${items.length} read.`,
    };
  }, [readSlugs, items.length]);

  // The resume offer: the reader's most recent series engagement,
  // continued forward. Uses the FULL thread (not the map-narrowed
  // readSlugs — a read article filtered off the map still counts as
  // read). Null renders nothing — the quiet default.
  const resume = useMemo(
    () => pickResume(allThreadSlugs, seriesIndex),
    [allThreadSlugs, seriesIndex],
  );

  // The wow receipt: how many map views actually show a thread. Once per
  // MOUNT by design (review): this is an IMPRESSION, like a pageview —
  // per-session dedup would undercount it, and PostHog already dedupes
  // unique readers server-side.
  const threadShownFired = useRef(false);
  useEffect(() => {
    if (trace && !threadShownFired.current) {
      threadShownFired.current = true;
      track("corpus_map:your_thread", { read_count: trace.ids.length });
    }
  }, [trace]);

  return (
    <TimelineMap
      items={items}
      data-testid="corpus-map"
      uncategorizedLabel="Standalone"
      axis={MINUTES_AXIS}
      linkComponent={Link}
      trace={trace}
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
        {trace && (
          <>
            {" "}
            <span className="text-foreground">
              The warm strand is you
            </span>{" "}
            — {trace.label.toLowerCase()}
          </>
        )}
        {resume && (
          <>
            {" "}
            Resume {resume.series} ({resume.readInSeries}/{resume.total}):{" "}
            <TrackedLink
              href={`/articles/${resume.next.slug}`}
              event="series:resume_click"
              props={{ to_slug: resume.next.slug }}
              className="text-foreground underline underline-offset-4 hover:text-foreground/80"
            >
              {resume.next.title} →
            </TrackedLink>
          </>
        )}
      </figcaption>
      <TimelineMap.Filter />
      <TimelineMap.Chart />
      <TimelineMap.Detail idle="Hover a dot to preview an article." />
    </TimelineMap>
  );
}
