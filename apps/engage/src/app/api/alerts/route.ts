import { NextResponse } from "next/server";
import { evaluateAlerts } from "@/lib/alerts";

export const dynamic = "force-dynamic";

/**
 * Firing stall alerts.
 *
 * No new machinery: every rule is a read over `/api/series`, which already
 * carries per-series freshness budgets and trend detection. The one thing this
 * route adds is that somebody actually looks.
 *
 * `evaluated` is returned alongside the alerts on purpose. "0 alerts" and "0
 * alerts because 0 series had enough points to judge" are different answers,
 * and a dashboard that renders them identically is how the thing this route
 * watches for happened in the first place.
 */
export async function GET() {
  try {
    const { alerts, evaluated } = await evaluateAlerts();
    return NextResponse.json({
      alerts,
      evaluated,
      firing: alerts.length,
      high: alerts.filter((a) => a.severity === "high").length,
      at: Date.now(),
    });
  } catch (e) {
    return NextResponse.json(
      { alerts: [], evaluated: 0, error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
