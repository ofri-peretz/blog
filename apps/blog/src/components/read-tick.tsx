"use client";

import * as React from "react";

import {
  parseThreadSnapshot,
  serverThreadSnapshot,
  subscribeThread,
  threadSnapshot,
} from "@/lib/reading-history";

/**
 * The green ✓ a series part earns once it is on the reader's thread —
 * the lint-run TOC's vocabulary applied to the series navigator. A
 * client leaf so the navigator itself stays a server component: SSR
 * ships the full crawlable parts list, and the ticks hydrate in from
 * localStorage (the honest crawler view has none).
 */
export function ReadTick({ slug }: { slug: string }) {
  const raw = React.useSyncExternalStore(
    subscribeThread,
    threadSnapshot,
    serverThreadSnapshot,
  );
  const read = React.useMemo(
    () => parseThreadSnapshot(raw).includes(slug),
    [raw, slug],
  );
  if (!read) return null;
  return (
    <span data-slot="read-tick" className="ml-auto shrink-0 pl-2">
      <span aria-hidden="true" className="font-mono text-xs text-brand-green">
        ✓
      </span>
      <span className="sr-only">— read</span>
    </span>
  );
}
