import { NextResponse } from "next/server";
import { hogqlPublic } from "@/lib/sources";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Individual sessions, as ordered paths through the site.
 *
 * Aggregates say "the docs homepage got 68 views". A journey says "someone
 * arrived on a rule page from Google, read two more rules, then left" — which
 * is the only shape that answers *who are these people and what were they
 * trying to do*.
 *
 * Constraints that shape this, all measured rather than assumed:
 *   - One PostHog project serves six properties, so `properties.app` is carried
 *     on every row. A journey that silently mixes the blog and the docs site is
 *     not a journey.
 *   - Bots are excluded here, unlike `/api/journey`. There, the bot share IS
 *     the finding (100% of short-link clicks). Here a bot path is just noise:
 *     nothing is learned from a scanner walking a sitemap.
 *   - Sessions of a single pageview are kept but flagged. "Landed and left" is
 *     the most common real outcome and hiding it would flatter every number.
 *
 * No personal data is assembled: the session id is PostHog's own random handle,
 * and only coarse geo/referrer already attached to the event is carried through.
 */
export async function GET(req: Request) {
  const days = Math.min(
    30,
    Math.max(1, Number(new URL(req.url).searchParams.get("days") ?? 7)),
  );

  const [paths, entries, totals] = await Promise.all([
    // One row per session: the ordered path, plus where it began and ended.
    hogqlPublic(`
      SELECT properties.$session_id AS sid,
             any(properties.app) AS app,
             count() AS steps,
             min(timestamp) AS started,
             dateDiff('second', min(timestamp), max(timestamp)) AS seconds,
             arrayStringConcat(
               arraySlice(
                 arrayMap(x -> x.2, arraySort(y -> y.1, groupArray((timestamp, properties.$pathname)))),
                 1, 12
               ), ' → ') AS path,
             any(properties.$referring_domain) AS referrer,
             any(properties.$geoip_country_code) AS country,
             any(properties.$device_type) AS device
      FROM events
      WHERE event = '$pageview'
        AND timestamp > now() - INTERVAL ${days} DAY
        AND properties.$virt_is_bot != true
        AND properties.$session_id IS NOT NULL
      GROUP BY sid
      ORDER BY steps DESC, started DESC
      LIMIT 60
    `),
    // Where sessions begin — the doors people actually come through.
    // The inner query collapses each session to its FIRST pageview; the outer
    // counts those landings. Grouping both at once returns one row per session
    // and PostHog rejects it (HTTP 400), which is what the first version did.
    hogqlPublic(`
      SELECT app, landing, count() AS n
      FROM (
        SELECT any(properties.app) AS app,
               argMin(properties.$pathname, timestamp) AS landing
        FROM events
        WHERE event = '$pageview'
          AND timestamp > now() - INTERVAL ${days} DAY
          AND properties.$virt_is_bot != true
          AND properties.$session_id IS NOT NULL
        GROUP BY properties.$session_id
      )
      GROUP BY app, landing
      ORDER BY n DESC
      LIMIT 20
    `),
    // Summary over EVERY session, not the 60 returned above.
    //
    // The session list is `ORDER BY steps DESC LIMIT 60`, so deriving a summary
    // from it describes only the deepest sessions — the first version reported
    // "0 bounced" while the real bounce rate was most of the traffic. A
    // truncated list must never be the denominator.
    hogqlPublic(`
      SELECT count() AS sessions,
             countIf(steps = 1) AS bounced,
             median(steps) AS med_steps,
             medianIf(secs, steps > 1) AS med_secs
      FROM (
        SELECT properties.$session_id AS sid,
               count() AS steps,
               dateDiff('second', min(timestamp), max(timestamp)) AS secs
        FROM events
        WHERE event = '$pageview'
          AND timestamp > now() - INTERVAL ${days} DAY
          AND properties.$virt_is_bot != true
          AND properties.$session_id IS NOT NULL
        GROUP BY sid
      )
    `),
  ]);

  const sessions = paths.rows.map((r) => ({
    sid: String(r[0] ?? "").slice(0, 8),
    app: String(r[1] ?? "unknown"),
    steps: Number(r[2] ?? 0),
    started: String(r[3] ?? ""),
    seconds: Number(r[4] ?? 0),
    path: String(r[5] ?? ""),
    referrer: String(r[6] ?? "") || "direct",
    country: String(r[7] ?? "") || "—",
    device: String(r[8] ?? "") || "—",
    bounced: Number(r[2] ?? 0) <= 1,
  }));

  const doors = entries.rows.map((r) => ({
    app: String(r[0] ?? "unknown"),
    landing: String(r[1] ?? ""),
    n: Number(r[2] ?? 0),
  }));

  const referrers = new Map<string, number>();
  for (const s of sessions)
    referrers.set(s.referrer, (referrers.get(s.referrer) ?? 0) + 1);

  const t = totals.rows[0] ?? [];
  const allSessions = Number(t[0] ?? 0);
  const allBounced = Number(t[1] ?? 0);

  return NextResponse.json({
    days,
    error: paths.error ?? entries.error ?? totals.error,
    sessions,
    doors,
    referrers: [...referrers.entries()]
      .map(([source, n]) => ({ source, n }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 12),
    summary: {
      sessions: allSessions,
      multiStep: allSessions - allBounced,
      bounced: allBounced,
      bounceRate: allSessions ? Number((allBounced / allSessions).toFixed(3)) : null,
      medianSteps: t[2] == null ? null : Number(t[2]),
      medianSeconds: t[3] == null ? null : Math.round(Number(t[3])),
      shown: sessions.length,
    },
    // Sessions are capped at 60 by the query. Say so, rather than letting a
    // truncated list read as "this is everyone".
    note:
      allSessions > sessions.length
        ? `Listing the ${sessions.length} deepest of ${allSessions} sessions. The summary counts all of them.`
        : null,
  });
}
