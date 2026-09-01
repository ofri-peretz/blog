/**
 * Article-embed weave snapshot — the Loom's series for the slugs in
 * lib/loom-embeds.ts, baked into a committed cache
 * (src/data/loom-embeds.json).
 *
 * Article pages are statically built without Supabase creds (the
 * committed-JSON doctrine: bench receipts, plugin stats), so the embeds
 * render from this snapshot and the "Open in the Loom →" link serves
 * the live data. The assembly is `loom-corpus-assemble.ts` — the SAME
 * code path `/loom`'s cache runs, so the embed and the Loom can never
 * disagree about how a week is bucketed or which series exist.
 *
 * Advisory by design (the tweet-cache lesson): a failed assembly keeps
 * the previous cache and warns — an upstream hiccup must never wedge
 * the weekly refresh into shipping an empty file. Exit 1 only when the
 * fresh assembly failed AND no cache exists, or when a definition
 * references a series the corpus no longer carries (that one is a
 * REAL error: the embed would silently vanish from the article).
 *
 * Run: npx tsx apps/blog/scripts/sync-loom-embeds.mts
 * Env: SUPABASE_URL, SUPABASE_ANON_KEY (RLS-scoped read-only key).
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import { assembleLoomCorpus } from "../src/lib/loom-corpus-assemble";
import {
  LOOM_EMBEDS,
  type LoomEmbedSnapshot,
} from "../src/lib/loom-embeds";

const OUT = path.join("apps/blog/src/data/loom-embeds.json");

let previous: LoomEmbedSnapshot | null = null;
try {
  previous = JSON.parse(readFileSync(OUT, "utf-8"));
} catch {
  /* first run */
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error("[sync-loom-embeds] SUPABASE_URL / SUPABASE_ANON_KEY missing");
  process.exit(previous ? 0 : 1);
}

// Assembly failures (network, upstream hiccup) are ADVISORY — keep the
// previous snapshot. The definition check below is deliberately outside
// this try: it must stay a hard error (review — a throw inside would be
// swallowed by this catch and land in the keep-previous path, which is
// exactly the silent vanishing it exists to prevent).
let corpus: Awaited<ReturnType<typeof assembleLoomCorpus>> | null = null;
try {
  corpus = await assembleLoomCorpus(createClient(url, key));
} catch (error) {
  console.error(`[sync-loom-embeds] assembly failed: ${String(error)}`);
}

if (!corpus) {
  if (previous) {
    console.warn("[sync-loom-embeds] keeping previous snapshot");
    process.exit(0);
  }
  console.error("[sync-loom-embeds] no fresh snapshot and no cache");
  process.exit(1);
}

const wanted = new Set(LOOM_EMBEDS.flatMap((d) => d.state.series));
const series: LoomEmbedSnapshot["series"] = {};
for (const s of corpus.series) {
  if (!wanted.has(s.id)) continue;
  series[s.id] = {
    label: s.label,
    unit: s.unit,
    provenance: s.provenance,
    points: [...s.points],
  };
}

// A definition pointing at a series the corpus no longer carries is a
// HARD error, cache or no cache: the embed would render nothing and the
// article would silently lose its chart. Fail so the definition is fixed.
const missing = [...wanted].filter((id) => !series[id]);
if (missing.length > 0) {
  console.error(
    `[sync-loom-embeds] definitions reference missing series: ${missing.join(", ")}`,
  );
  process.exit(1);
}

const snapshot: LoomEmbedSnapshot = {
  generatedAt: new Date().toISOString(),
  observedThrough: corpus.observedThrough,
  series,
};

writeFileSync(OUT, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(
  `[sync-loom-embeds] ${Object.keys(snapshot.series).length} series → ${OUT} (observed through ${snapshot.observedThrough})`,
);
