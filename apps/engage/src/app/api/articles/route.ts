import { NextResponse } from "next/server";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { FOOTPRINT } from "@/lib/footprint";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * The article web: every node in article-graph.ts with its tier, domain, status
 * and outbound links. Read through a tiny tsx eval rather than re-parsing the
 * graph file — article-graph.ts is the single source of truth for the corpus and
 * a second parser here would be one more thing to drift.
 */
export async function GET() {
  try {
    const out = execFileSync(
      "npx",
      [
        "tsx",
        "-e",
        `import { GRAPH } from "./article-graph.js";
         console.log(JSON.stringify(GRAPH.map((n) => ({
           slug: n.slug, title: n.title_short ?? n.slug, tier: n.tier,
           status: n.status, domain: n.domain ?? null,
           links: n.links_to ?? [],
         }))));`,
      ],
      { cwd: FOOTPRINT, encoding: "utf8", timeout: 120_000, maxBuffer: 16 * 1024 * 1024 },
    );
    const line = out.trim().split("\n").pop()!;
    return NextResponse.json({ nodes: JSON.parse(line), error: null });
  } catch (e) {
    return NextResponse.json({
      nodes: [],
      error: e instanceof Error ? e.message.slice(0, 200) : String(e),
    });
  }
}
