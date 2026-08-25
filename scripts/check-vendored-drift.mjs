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
};

import { readFileSync } from "node:fs";
import path from "node:path";

/** Reverse the vendor recipe: drop the provenance block, restore cn. */
function normalizeVendored(src) {
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
  return out
    .join("\n")
    .replace('import { cn } from "@/lib/utils";', "import { cn } from '../lib/cn.js';");
}

let drifted = [];
for (const [vendored, canonical] of Object.entries(VENDORED)) {
  const local = normalizeVendored(
    readFileSync(path.join("apps/blog/src", vendored), "utf-8"),
  );
  const res = await fetch(`${RAW}/${canonical}`);
  if (!res.ok) {
    console.error(`FETCH FAILED (${res.status}): ${canonical}`);
    process.exit(2);
  }
  const remote = await res.text();
  if (local.trim() !== remote.trim()) drifted.push(vendored);
}

if (drifted.length > 0) {
  console.log(drifted.join("\n"));
  process.exit(1);
}
console.log("all vendored components in sync with canonical");
