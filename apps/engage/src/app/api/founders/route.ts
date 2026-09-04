import { NextResponse } from "next/server";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { FOOTPRINT } from "@/lib/footprint";
export const dynamic = "force-dynamic";
/**
 * The founders brief: what DEV's staff are building and running, read for us.
 * Written by engage-founders-brief.ts in the morning batch (the model runs
 * there, never here); this route only reads the file, like the reply drafts.
 */
export async function GET() {
  const f = join(FOOTPRINT, "engagement", "founders-brief.json");
  if (!existsSync(f)) return NextResponse.json({ asOf: null, brief: null, posts: [], hint: "no brief yet — the loop writes it once a day (engage-founders-brief.ts)" });
  try { return NextResponse.json(JSON.parse(readFileSync(f, "utf8"))); } catch (e) { return NextResponse.json({ asOf: null, brief: null, posts: [], error: String(e) }); }
}
