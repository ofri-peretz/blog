import { NextResponse } from "next/server";
import { hogqlPublic } from "@/lib/sources";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * The journey: article → /go/ short link → site → what they read next.
 *
 * Three things about this data, all of which were wrong in my head first:
 *
 * 1. **The event is `short_link_click`, not `$pageview`.** `/go/` is a
 *    server-side 302 — the browser never runs JS on it, so it cannot emit a
 *    pageview. Querying `$pathname LIKE '/go/%'` returns zero and looks like
 *    "no traffic" rather than "wrong event".
 * 2. **One PostHog project serves six properties.** Every query groups by
 *    `properties.app`; ungrouped counts silently sum unrelated sites.
 * 3. **The clicks are ~entirely bots.** Measured 2026-08-09: 18,006 of 18,006
 *    over 30 days carried `$virt_is_bot = true`. So bot and human are counted
 *    separately and BOTH are returned. A single "clicks" number here would be
 *    a number about scanners, presented as a number about readers.
 */
export async function GET() {
  const since = "now() - INTERVAL 30 DAY";

  const [byLink, bots, landings] = await Promise.all([
    // Which article sends people where. `from` is the source article slug,
    // `destination` the target — the two ends of the journey.
    hogqlPublic(`
      SELECT properties.from AS source,
             properties.destination AS destination,
             properties.app AS app,
             countIf(properties.$virt_is_bot != true) AS humans,
             countIf(properties.$virt_is_bot = true) AS bots
      FROM events
      WHERE event = 'short_link_click'
        AND timestamp > ${since}
      GROUP BY source, destination, app
      ORDER BY bots + humans DESC
      LIMIT 40
    `),
    hogqlPublic(`
      SELECT countIf(properties.$virt_is_bot = true) AS bots,
             countIf(properties.$virt_is_bot != true) AS humans
      FROM events
      WHERE event = 'short_link_click'
        AND timestamp > ${since}
    `),
    // Where real sessions land, per property — this side IS human-measurable,
    // because a landing page does run JS.
    hogqlPublic(`
      SELECT properties.app AS app,
             properties.$pathname AS path,
             count() AS views,
             count(DISTINCT properties.$session_id) AS sessions
      FROM events
      WHERE event = '$pageview'
        AND timestamp > ${since}
        AND properties.$virt_is_bot != true
      GROUP BY app, path
      ORDER BY views DESC
      LIMIT 25
    `),
  ]);

  const botCount = Number(bots.rows[0]?.[0] ?? 0);
  const humanCount = Number(bots.rows[0]?.[1] ?? 0);
  const total = botCount + humanCount;

  return NextResponse.json({
    error: byLink.error ?? bots.error ?? landings.error,
    links: byLink.rows.map((r) => ({
      source: String(r[0] ?? ""),
      destination: String(r[1] ?? ""),
      app: String(r[2] ?? "unknown"),
      humans: Number(r[3] ?? 0),
      bots: Number(r[4] ?? 0),
    })),
    landings: landings.rows.map((r) => ({
      app: String(r[0] ?? "unknown"),
      path: String(r[1] ?? ""),
      views: Number(r[2] ?? 0),
      sessions: Number(r[3] ?? 0),
    })),
    traffic: {
      bots: botCount,
      humans: humanCount,
      botShare: total ? Number(((botCount / total) * 100).toFixed(1)) : null,
      verdict:
        total === 0
          ? "No short-link traffic in the window."
          : humanCount === 0
            ? `All ${botCount.toLocaleString()} short-link clicks in 30 days are bots. The redirect system works, but it is currently measuring scanners — no human click-through is observable, so /go/ cannot yet attribute a single reader.`
            : botCount > humanCount
              ? `Bots are ${((botCount / total) * 100).toFixed(0)}% of short-link clicks — read the human column as a small sample.`
              : null,
    },
    window: "30 days",
  });
}
