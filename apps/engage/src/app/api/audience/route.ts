import { NextResponse } from "next/server";
import { audienceClock } from "@/lib/sources";

export const dynamic = "force-dynamic";

/**
 * Deliberately NOT folded into /api/sources.
 *
 * That route shells out to ESLint and can take minutes; the audience clock is
 * two fast PostHog queries. Sharing a route would hide a sub-second panel
 * behind a four-minute one, and the chart would be the last thing on the page
 * to appear instead of the first.
 */
export async function GET() {
  return NextResponse.json(await audienceClock());
}
