import { NextResponse } from "next/server";
import { secret } from "@/lib/footprint";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Trends over the REAL series.
 *
 * The local `history.jsonl` starts today, so anything built on it shows one
 * point and reads as broken. Supabase's `creator_daily_metrics` already holds a
 * rolling 30 days per platform and is written by the daily ingest — that is the
 * series to chart. `history.jsonl` remains the long-term store; it just has no
 * past yet.
 *
 * Platform decoding, which is not guessable from the column names:
 *   - `devto`       → followers / views / reactions / comments
 *   - `github`      → `followers` is GitHub FOLLOWERS
 *   - `github-repo` → `followers` is repo STARS
 * Stars were reported as "not connected" because the UI read
 * `plugin_daily_metrics.github_stars`, which the ingest never populates. The
 * number was here the whole time, under a column named for something else.
 */
async function sb(path: string): Promise<any[]> {
  const url = secret("SUPABASE_URL");
  const key = secret("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return [];
  const r = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    cache: "no-store",
  });
  if (!r.ok) return [];
  const j = await r.json();
  return Array.isArray(j) ? j : [];
}

type Point = { t: string; v: number };

/** ISO week key, e.g. 2026-W32. */
function weekKey(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  const day = (d.getUTCDay() + 6) % 7; // Mon = 0
  d.setUTCDate(d.getUTCDate() - day + 3); // Thursday of this week
  const firstThu = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week =
    1 +
    Math.round(
      ((d.getTime() - firstThu.getTime()) / 86_400_000 -
        3 +
        ((firstThu.getUTCDay() + 6) % 7)) /
        7,
    );
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/**
 * Roll a daily cumulative series up to week/month.
 *
 * Takes the LAST value in each bucket, not the mean. These are cumulative
 * totals (followers, views, stars) — averaging them produces a number that
 * never existed on any day and understates the level throughout.
 */
function bucket(points: Point[], grain: "day" | "week" | "month"): Point[] {
  if (grain === "day") return points;
  const key = (t: string) => (grain === "week" ? weekKey(t) : t.slice(0, 7));
  const m = new Map<string, Point>();
  for (const p of points) m.set(key(p.t), { t: key(p.t), v: p.v });
  return [...m.values()];
}

function series(
  rows: any[],
  platform: string,
  col: string,
): Point[] {
  return rows
    .filter((r) => r.platform === platform && r[col] != null)
    .map((r) => ({ t: String(r.observed_on), v: Number(r[col]) }))
    .sort((a, b) => a.t.localeCompare(b.t));
}

export async function GET(req: Request) {
  const grain =
    (new URL(req.url).searchParams.get("grain") as "day" | "week" | "month") ??
    "day";

  const rows = await sb(
    "creator_daily_metrics?select=*&order=observed_on.asc&limit=2000",
  );

  const defs = [
    { key: "followers", label: "dev.to followers", points: series(rows, "devto", "followers") },
    { key: "views", label: "dev.to views", points: series(rows, "devto", "total_views") },
    { key: "reactions", label: "dev.to reactions", points: series(rows, "devto", "total_reactions") },
    { key: "comments", label: "dev.to comments", points: series(rows, "devto", "total_comments") },
    { key: "posts", label: "articles published", points: series(rows, "devto", "posts") },
    { key: "ghFollowers", label: "GitHub followers", points: series(rows, "github", "followers") },
    { key: "stars", label: "GitHub stars", points: series(rows, "github-repo", "followers") },
  ];

  const metrics = defs.map((d) => {
    const pts = bucket(d.points, grain);
    const first = pts[0]?.v ?? null;
    const last = pts[pts.length - 1]?.v ?? null;
    const prev = pts.length > 1 ? pts[pts.length - 2].v : null;
    return {
      key: d.key,
      label: d.label,
      points: pts,
      first,
      last,
      // Change over the whole window, and over the last bucket. Both, because
      // "up 3 this month" and "up 0 this week" are different stories and only
      // showing one of them is how a stall stays invisible.
      change: first != null && last != null ? last - first : null,
      lastChange: prev != null && last != null ? last - prev : null,
      pct:
        first ? Number((((last! - first) / first) * 100).toFixed(1)) : null,
    };
  });

  return NextResponse.json({
    grain,
    metrics,
    days: new Set(rows.map((r) => r.observed_on)).size,
    source: "creator_daily_metrics",
    note:
      rows.length === 0
        ? "Supabase returned no rows — check credentials."
        : null,
  });
}
