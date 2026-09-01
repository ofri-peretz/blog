// Article-embedded weaves — the Loom placed where readers already are.
//
// Each definition binds one article to one composition. The composition
// is a full `LoomState`, so the embed's "Open in the Loom →" permalink
// is produced by the SAME codec the composer uses (`serializeLoomState`)
// — an embed and its permalink cannot drift apart.
//
// The data the embed renders is the committed snapshot
// (`src/data/loom-embeds.json`, refreshed weekly by
// `scripts/sync-loom-embeds.mts`): article pages are statically built
// without Supabase creds, so they follow the committed-JSON doctrine
// every other data surface here follows (bench receipts, plugin stats).
// The Loom link is where the LIVE data lives.
//
// Rules for adding an embed (locked in loom-embeds-lock.test.ts):
// the slug must be a published article, every series id must exist in
// the snapshot with ≥2 points, and the state must survive the URL
// codec round-trip.

import type { LoomState } from "./loom-url";
// Relative on purpose: the sync script imports this module under plain
// tsx, where the "@/" alias depends on tsconfig discovery — a relative
// specifier removes the moving part.
import type { Point } from "../components/ui/scale";

export interface LoomEmbedDef {
  /** Article slug this weave renders under. */
  slug: string;
  /** Section heading — names the claim, not the chart. */
  title: string;
  /** One sentence connecting the article's claim to the live series. */
  claim: string;
  /** The composition; also the permalink, via serializeLoomState. */
  state: LoomState;
}

/** Shape of src/data/loom-embeds.json — what the sync script writes. */
export interface LoomEmbedSnapshot {
  generatedAt: string;
  observedThrough: string;
  series: Record<
    string,
    { label: string; unit: string; provenance: string; points: Point[] }
  >;
}

export const LOOM_EMBEDS: readonly LoomEmbedDef[] = [
  {
    slug: "abandoned-incumbent-map",
    title: "The ecosystem these numbers describe, live",
    claim:
      "Every download claim in this article ages the moment it publishes — this is the same ecosystem series, re-earned weekly.",
    state: {
      series: ["npm:total"],
      form: "weave",
      window: "all",
      normalize: "abs",
    },
  },
  {
    slug: "eslint-plugin-import-38m-downloads-heres-what-it-still-gets-wrong",
    title: "import-next adoption, live",
    claim:
      "The alternative this article argues for, measured weekly — adoption either grows or this chart says so.",
    state: {
      series: ["npm:eslint-plugin-import-next"],
      form: "weave",
      window: "all",
      normalize: "abs",
    },
  },
  {
    slug: "getting-started-eslint-plugin-node-security",
    title: "node-security adoption, live",
    claim:
      "The plugin this guide installs, as the ecosystem actually installs it — weekly downloads since the ledger began.",
    state: {
      series: ["npm:eslint-plugin-node-security"],
      form: "weave",
      window: "all",
      normalize: "abs",
    },
  },
];
