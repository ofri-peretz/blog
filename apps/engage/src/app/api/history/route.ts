import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { FOOTPRINT } from "@/lib/footprint";
import { recentActions } from "@/lib/store";

export const dynamic = "force-dynamic";

const FILE = join(FOOTPRINT, "engagement", "history.jsonl");

/**
 * The series behind every chart, plus the actions to annotate them with.
 *
 * JSONL, one object per day: append-only survives partial writes, is diffable,
 * needs no migration, and a corrupt line costs one day rather than the series.
 */
export async function GET() {
  if (!existsSync(FILE))
    return NextResponse.json({
      days: [],
      annotations: [],
      hint: "No history yet — run `npm run engage:snapshot` in agents/footprint. Series cannot be back-filled.",
    });

  const days = readFileSync(FILE, "utf8")
    .trim()
    .split("\n")
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null; // one bad line must not void the series
      }
    })
    .filter(Boolean);

  let annotations: { t: string; label: string; kind: string }[] = [];
  try {
    annotations = recentActions(300).map((a: any) => ({
      t: String(a.at).slice(0, 10),
      label: `${a.action} ${a.kind} @${a.author}`,
      kind: "action",
    }));
  } catch {
    /* the ledger is optional context, never a reason to fail the series */
  }

  return NextResponse.json({ days, annotations, hint: null });
}
