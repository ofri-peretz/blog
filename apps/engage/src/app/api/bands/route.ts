import { NextResponse } from "next/server";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { FOOTPRINT } from "@/lib/footprint";
export const dynamic = "force-dynamic";
/** The latest control-band report, written by scripts/control-bands.mjs from the loop. */
export async function GET() {
  const f = join(FOOTPRINT, "engagement", ".cache", "control-bands.json");
  if (!existsSync(f)) return NextResponse.json({ at: null, results: [], hint: "no report yet — the watcher runs Mondays from the loop, or: node apps/engage/scripts/control-bands.mjs" });
  try { return NextResponse.json(JSON.parse(readFileSync(f, "utf8"))); } catch (e) { return NextResponse.json({ at: null, results: [], error: String(e) }); }
}
