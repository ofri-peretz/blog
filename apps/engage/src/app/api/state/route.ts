import { NextResponse } from "next/server";
import { stream, allItems, releaseQueue, todayCST } from "@/lib/footprint";

export const dynamic = "force-dynamic";

export async function GET() {
  const items = stream(50);
  const all = allItems();
  const acted = all
    .filter((i) => i.status === "posted")
    .map((i) => ({
      kind: i.kind,
      author: i.article.author,
      at: Date.parse(i.date),
    }));
  return NextResponse.json({
    date: todayCST(),
    items,
    acted,
    release: releaseQueue(),
    totals: {
      open: items.length,
      everActed: acted.length,
      everDrafted: all.length,
    },
  });
}
