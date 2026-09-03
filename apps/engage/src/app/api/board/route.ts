import { NextResponse } from "next/server";
import { cachedAsync } from "@/lib/cache";
import { prBoard } from "@/lib/sources";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

export async function GET(req: Request) {
  // A GitHub sweep (~15 s cold). 15 minutes is long enough to make navigation
  // free and short enough that "whose move is it" is never a stale answer for
  // long; `?refresh=1` re-asks GitHub now.
  const force = new URL(req.url).searchParams.get("refresh") === "1";
  const hit = await cachedAsync("board", 15 * 60_000, force, prBoard);
  return NextResponse.json({ ...hit.value, cachedAt: hit.at, cached: !hit.fresh });
}
