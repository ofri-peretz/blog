import { NextResponse } from "next/server";
import { stream, allItems, todayCST } from "@/lib/footprint";
import { publisherSchedule } from "@/lib/cache";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // The release schedule is a 60-120 s subprocess. Every other page already
  // reads it through the disk cache; this route shelled out on every load and
  // was the 11-14 s the home page paid per refresh. `?refresh=1` is the only
  // way past the cache, same contract as the section buttons.
  const force = new URL(req.url).searchParams.get("refresh") === "1";
  const items = stream(50);
  const all = allItems();
  const acted = all
    // `opened` is a click that very probably posted; the pace gauges must see it.
    .filter((i) => i.status === "posted" || i.status === "opened")
    .map((i) => ({
      kind: i.kind,
      author: i.article.author,
      at: Date.parse(i.date),
    }));
  return NextResponse.json({
    date: todayCST(),
    items,
    acted,
    release: publisherSchedule(force).value,
    totals: {
      open: items.length,
      everActed: acted.length,
      everDrafted: all.length,
    },
  });
}
