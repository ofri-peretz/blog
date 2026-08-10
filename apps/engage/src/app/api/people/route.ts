import { NextResponse } from "next/server";
import { peopleActivity, googleAiFeed, googleAiRoster } from "@/lib/people";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

export async function GET() {
  const [people, feed, roster] = await Promise.all([
    peopleActivity(),
    googleAiFeed(),
    googleAiRoster().catch(() => []),
  ]);
  return NextResponse.json({ ...people, googleAi: feed, roster });
}
