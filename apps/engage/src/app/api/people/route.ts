import { NextResponse } from "next/server";
import { cachedAsync } from "@/lib/cache";
import { peopleActivity, googleAiFeed, googleAiRoster } from "@/lib/people";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

export async function GET(req: Request) {
  // Three Dev.to crawls (~15 s cold). Cached on disk for an hour; the section's
  // refresh button sends `?refresh=1` and is the only way past it.
  const force = new URL(req.url).searchParams.get("refresh") === "1";
  const hit = await cachedAsync("people", 60 * 60_000, force, async () => {
    const [people, feed, roster] = await Promise.all([
      peopleActivity(),
      googleAiFeed(),
      googleAiRoster().catch(() => []),
    ]);
    return { ...people, googleAi: feed, roster };
  });
  return NextResponse.json({ ...hit.value, cachedAt: hit.at, cached: !hit.fresh });
}
