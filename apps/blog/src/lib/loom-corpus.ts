// The Loom's corpus, cached — the live `/loom` path.
//
// ## Quota safety — the whole design
//
// Visitors never touch Supabase. `getCachedLoomCorpus` runs inside
// `unstable_cache` (12h TTL, tag `ratchet` — same channel as every
// other metrics read), so assembly hits Supabase at most twice a day
// regardless of traffic; readers get the Vercel Data Cache entry.
// Throw-on-missing-client rides `requireClient` for the same reason the
// other fetchers do: a rejected promise is never cached, an empty
// result cached for 12h is (the /npm lesson).
//
// The assembly itself lives in `loom-corpus-assemble.ts` (no
// server-only, client injected) so the article-embed sync script runs
// the SAME code path under plain node — one bucketing rule, one pick
// list, two consumers. A loom-lock pins that only this module and the
// sync script import it.

import "server-only";

import { unstable_cache } from "next/cache";

import { assembleLoomCorpus, LOOM_EPOCH } from "./loom-corpus-assemble";
import {
  requireClient,
  TAG_RATCHET,
  TWELVE_HOURS_SECONDS,
} from "./supabase-data";

export type { LoomCorpus, LoomSeries } from "./loom-data";
export { LOOM_EPOCH };

export const getCachedLoomCorpus = unstable_cache(
  () => assembleLoomCorpus(requireClient("loom corpus")),
  ["loom-corpus"],
  { revalidate: TWELVE_HOURS_SECONDS, tags: [TAG_RATCHET] },
);
