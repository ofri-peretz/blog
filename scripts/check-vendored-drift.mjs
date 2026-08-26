/**
 * Vendored-DS drift check — compares every copy-with-provenance file in
 * apps/blog against its canonical source in the interlace repo.
 *
 * Runs on a WEEKLY cron that files an issue (never in PR CI — external
 * repos must not wedge merges; see the tweet-cache lesson). The vendor
 * recipe is fixed: line 1 of canonical, a provenance comment block, the
 * rest of canonical with the `cn` import swapped. This script reverses
 * exactly that recipe and diffs.
 *
 * Exit codes: 0 = in sync, 1 = drift (stdout lists files), 2 = a fetch
 * failed (network/renamed path — surfaced, never treated as drift).
 */

const RAW =
  "https://raw.githubusercontent.com/ofri-peretz/interlace/main/packages/ui/src";

/** vendored path (under apps/blog/src) → canonical path (under ui/src). */
const VENDORED = {
  "components/ui/timeline-map.tsx": "patterns/timeline-map.tsx",
  "components/ui/reading-strand.tsx": "primitives/reading-strand.tsx",
  "components/ui/hero-strand.tsx": "effects/hero-strand.tsx",
  "components/ui/section-index.tsx": "primitives/section-index.tsx",
  "components/ui/dialog.tsx": "primitives/dialog.tsx",
  "components/ui/command-palette.tsx": "primitives/command-palette.tsx",
  "components/ui/code-block.tsx": "primitives/code-block.tsx",
  "components/ui/skeleton.tsx": "primitives/skeleton.tsx",
  "components/ui/skeleton-variants.ts": "primitives/skeleton-variants.ts",
  "components/ui/time-series.tsx": "charts/time-series.tsx",
  "components/ui/radial-weave.tsx": "charts/radial-weave.tsx",
  "components/ui/strand-field.tsx": "effects/strand-field.tsx",
  "components/ui/series-table.tsx": "charts/series-table.tsx",
  "components/ui/scale.ts": "charts/scale.ts",
  "components/ui/data-state.tsx": "primitives/data-state.tsx",
  "components/ui/data-state-model.ts": "primitives/data-state-model.ts",
  "components/ui/toggle.tsx": "primitives/toggle.tsx",
};

import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Reverse the vendor recipe: drop the provenance block, restore cn.
 *
 * Sibling-import restoration is canonical-directory-aware: a vendored
 * `./skeleton` came from `../primitives/skeleton.js` when the canonical
 * lives in `charts/`, but from `./skeleton.js` when it lives in
 * `primitives/` — the flat vendored dir erases that distinction, so the
 * canonical path has to put it back.
 */
function normalizeVendored(src, canonical) {
  const lines = src.split("\n");
  const out = [];
  let inProvenance = false;
  for (const line of lines) {
    if (line.startsWith("// VENDORED from the Interlace DS")) {
      inProvenance = true;
      // The provenance block replaces one blank line; swallow the blank
      // line ABOVE it that the recipe inserted.
      if (out[out.length - 1] === "") out.pop();
      continue;
    }
    if (inProvenance) {
      if (line.startsWith("//")) continue;
      // First non-comment line ends the block. The blank that often
      // follows is CANONICAL's own line 2 — keep it (the recipe's
      // inserted blank sits ABOVE the block and was popped there).
      inProvenance = false;
    }
    out.push(line);
  }
  const joined = out
    .join("\n")
    .replace('import { cn } from "@/lib/utils";', "import { cn } from '../lib/cn.js';");
  // Sibling imports: the blog drops the .js extension (webpack resolves
  // extensionless; canonical is ESM-explicit — TS maps .js→.ts but
  // webpack does not). replaceAll: skeleton.tsx references its variants
  // module TWICE (import + bottom re-export); a single replace left the
  // second one broken. No-ops on files that lack the string.
  if (canonical.startsWith("charts/")) {
    return joined
      .replaceAll("} from './skeleton';", "} from '../primitives/skeleton.js';")
      .replaceAll("} from './data-state';", "} from '../primitives/data-state.js';")
      .replaceAll("from './scale';", "from './scale.js';")
      .replaceAll("from './series-table';", "from './series-table.js';")
      .replaceAll("from './time-series';", "from './time-series.js';");
  }
  if (canonical.startsWith("effects/")) {
    // strand-field reaches ACROSS directories (charts/) for its scale
    // math and hue identity; hero-strand imports only cn and no-ops here.
    return joined
      .replaceAll("from './scale';", "from '../charts/scale.js';")
      .replaceAll("} from './time-series';", "} from '../charts/time-series.js';");
  }
  if (canonical.startsWith("patterns/")) {
    return joined.replaceAll(
      "} from './toggle';",
      "} from '../primitives/toggle.js';",
    );
  }
  return joined
    .replaceAll("} from './dialog';", "} from './dialog.js';")
    .replaceAll("} from './skeleton';", "} from './skeleton.js';")
    .replaceAll("} from './skeleton-variants';", "} from './skeleton-variants.js';")
    .replaceAll("from './data-state-model';", "from './data-state-model.js';");
}

// A fetch failure must not hide drift in the REMAINING files (review):
// accumulate both, keep comparing, and report everything at the end.
const drifted = [];
const failed = [];
for (const [vendored, canonical] of Object.entries(VENDORED)) {
  const local = normalizeVendored(
    readFileSync(path.join("apps/blog/src", vendored), "utf-8"),
    canonical,
  );
  const res = await fetch(`${RAW}/${canonical}`);
  if (!res.ok) {
    console.error(`FETCH FAILED (${res.status}): ${canonical}`);
    failed.push(canonical);
    continue;
  }
  const remote = await res.text();
  if (local.trim() !== remote.trim()) drifted.push(vendored);
}

if (drifted.length > 0) {
  console.log(drifted.join("\n"));
  process.exit(1); // drift outranks fetch trouble — it is actionable now
}
if (failed.length > 0) process.exit(2);
console.log("all vendored components in sync with canonical");
