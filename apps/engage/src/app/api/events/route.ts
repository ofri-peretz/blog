import { NextResponse } from "next/server";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { FOOTPRINT } from "@/lib/footprint";

export const dynamic = "force-dynamic";

/**
 * Things that happened, on the same time axis as the numbers.
 *
 * A terminal draws earnings on the price chart because a gap you cannot
 * explain is noise, and a gap you can is information. Every series panel in
 * this app has had the same hole: followers step up on a Tuesday and nothing
 * on screen says an article shipped that morning.
 *
 * Sources are all local — article frontmatter, the adoption history, the
 * engagement ledger. Nothing here costs a network call, because markers get
 * fetched alongside every chart and an API round trip per render is how the
 * refresh problem started.
 */

interface Event {
  t: string;
  kind: "publish" | "adoption" | "engagement";
  label: string;
  href?: string;
  /** Emphasis for the axis: a merge matters more than a comment. */
  weight: 1 | 2 | 3;
}

const ARTICLES = join(process.cwd(), "..", "blog", "content", "articles");
const ADOPTION = join(FOOTPRINT, "adoption");

/** Article publishes, from the frontmatter that already carries devto_id. */
function publishes(): Event[] {
  if (!existsSync(ARTICLES)) return [];
  const out: Event[] = [];
  for (const f of readdirSync(ARTICLES).filter((n) => n.endsWith(".md"))) {
    let head = "";
    try {
      head = readFileSync(join(ARTICLES, f), "utf8").slice(0, 1600);
    } catch {
      continue;
    }
    // Only articles that actually went out: published_at is written by the
    // publisher, so a draft with a date in its body cannot fake an event.
    const at = /^published_at:\s*"?([0-9T:\-Z.]+)"?/m.exec(head)?.[1];
    if (!at) continue;
    const title = /^title:\s*"(.+?)"\s*$/m.exec(head)?.[1] ?? f.replace(/\.md$/, "");
    const url = /^devto_url:\s*"(.+?)"\s*$/m.exec(head)?.[1];
    out.push({
      t: at.slice(0, 10),
      kind: "publish",
      label: title.length > 70 ? title.slice(0, 68) + "…" : title,
      href: url,
      weight: 2,
    });
  }
  return out;
}

/**
 * Adoption transitions.
 *
 * history.jsonl is the live record and only exists once something has moved,
 * so repos.json's mergedOn is read too — the four merges that predate the
 * history file would otherwise be invisible on the axis, which is exactly the
 * period worth explaining.
 */
function adoption(): Event[] {
  const out: Event[] = [];

  const nodes = join(ADOPTION, "repos.json");
  if (existsSync(nodes)) {
    try {
      const d = JSON.parse(readFileSync(nodes, "utf8"));
      for (const r of d.repos ?? []) {
        if (r.state === "merged" && r.mergedOn)
          out.push({
            t: String(r.mergedOn).slice(0, 10),
            kind: "adoption",
            label: `merged into ${r.slug}${r.depth ? ` (${r.depth})` : ""}`,
            href: `https://github.com/${r.slug}${r.pr ? `/pull/${r.pr}` : ""}`,
            weight: 3,
          });
      }
    } catch {
      /* a corrupt node table must not take the whole axis down */
    }
  }

  const hist = join(ADOPTION, "history.jsonl");
  if (existsSync(hist)) {
    try {
      for (const line of readFileSync(hist, "utf8").split("\n").filter(Boolean)) {
        const e = JSON.parse(line);
        // Merges already came from repos.json; re-adding them here would
        // double-draw the same marker.
        if (e.to === "merged") continue;
        out.push({
          t: String(e.at).slice(0, 10),
          kind: "adoption",
          label: `${e.slug}: ${e.from} → ${e.to}`,
          href: `https://github.com/${e.slug}`,
          weight: 1,
        });
      }
    } catch {
      /* one bad line must not hide the rest */
    }
  }
  return out;
}

/** Engagement actions, bucketed per day — 89 comments is not 89 markers. */
function engagement(): Event[] {
  const db = join(FOOTPRINT, "engagement", "engage.db");
  if (!existsSync(db)) return [];
  try {
    // Imported lazily: node:sqlite is unavailable in some runtimes and a
    // missing binding must not 500 the whole endpoint.
    const { DatabaseSync } = require("node:sqlite") as typeof import("node:sqlite");
    const conn = new DatabaseSync(db, { readOnly: true });
    const rows = conn
      .prepare(
        `SELECT substr(at,1,10) AS day, COUNT(*) AS n
           FROM actions GROUP BY day ORDER BY day`,
      )
      .all() as { day: string; n: number }[];
    conn.close();
    return rows.map((r) => ({
      t: r.day,
      kind: "engagement" as const,
      label: `${r.n} engagement action${r.n === 1 ? "" : "s"}`,
      weight: 1 as const,
    }));
  } catch {
    return [];
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const kinds = (url.searchParams.get("kinds") ?? "publish,adoption,engagement").split(",");

  const all = [
    ...(kinds.includes("publish") ? publishes() : []),
    ...(kinds.includes("adoption") ? adoption() : []),
    ...(kinds.includes("engagement") ? engagement() : []),
  ]
    .filter((e) => e.t && (!from || e.t >= from) && (!to || e.t <= to))
    .sort((a, b) => a.t.localeCompare(b.t));

  return NextResponse.json({
    events: all,
    counts: {
      publish: all.filter((e) => e.kind === "publish").length,
      adoption: all.filter((e) => e.kind === "adoption").length,
      engagement: all.filter((e) => e.kind === "engagement").length,
    },
    sources: {
      articles: existsSync(ARTICLES),
      adoption: existsSync(join(ADOPTION, "repos.json")),
    },
  });
}
