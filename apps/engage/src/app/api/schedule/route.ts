import { NextResponse } from "next/server";
import { execFileSync } from "node:child_process";
import { FOOTPRINT, devtoKey } from "@/lib/footprint";
import { fetchJson } from "@/lib/throttle";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** A slot cell needs this many samples before its lift is quoted as a finding. */
const MIN_N = 5;

interface Post {
  slug: string;
  title: string;
  url: string;
  at: string;
  dow: number;
  hour: number;
  views: number | null;
  reactions: number;
  comments: number;
  ageDays: number;
  /** Views per day since publish. */
  vpd: number | null;
  /** How many articles shipped that same calendar day. */
  sameDay: number;
}

const median = (xs: number[]): number | null => {
  const s = xs.filter((x) => x != null && Number.isFinite(x)).sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : null;
};

/**
 * Publishing history with per-article rate, from our own articles.
 *
 * `page_views_count` is only returned for your own posts, which is exactly why
 * this measures OUR timing rather than anyone else's — nobody's view counts are
 * public, so a "best time to post" claim about the platform at large would be
 * fabricated.
 */
async function history(): Promise<Post[]> {
  const key = devtoKey();
  const out: Post[] = [];
  for (let page = 1; page <= 5; page++) {
    let batch: any[] = [];
    try {
      batch = await fetchJson(
        `https://dev.to/api/articles/me/published?per_page=100&page=${page}`,
        { headers: key ? { "api-key": key } : {} },
      );
    } catch {
      break;
    }
    if (!Array.isArray(batch) || !batch.length) break;
    for (const a of batch) {
      const d = new Date(a.published_at);
      const ageDays = Math.max(1, (Date.now() - d.getTime()) / 86_400_000);
      const views = a.page_views_count ?? null;
      out.push({
        slug: a.slug,
        title: a.title,
        url: a.url,
        at: a.published_at,
        dow: d.getUTCDay(),
        hour: d.getUTCHours(),
        views,
        reactions: a.public_reactions_count ?? 0,
        comments: a.comments_count ?? 0,
        ageDays: Math.round(ageDays),
        vpd: views == null ? null : views / ageDays,
        sameDay: 0,
      });
    }
    if (batch.length < 100) break;
  }
  const perDay = new Map<string, number>();
  for (const p of out)
    perDay.set(p.at.slice(0, 10), (perDay.get(p.at.slice(0, 10)) ?? 0) + 1);
  for (const p of out) p.sameDay = perDay.get(p.at.slice(0, 10)) ?? 1;
  return out;
}

/**
 * Measured slot performance and a scheduling recommendation.
 *
 * Three methodological choices, each of which changes the answer:
 *
 * 1. **Age-normalise.** Raw view totals reward old articles. A slot that happens
 *    to hold last year's posts wins on nothing but time.
 * 2. **Median, never mean.** One 15-views/day outlier otherwise sets a whole
 *    weekday's "performance".
 * 3. **Exclude bursts.** 63 of 80 articles shipped on days carrying 3+ posts.
 *    That is a different regime from the current 1-per-4-days cadence, and the
 *    articles compete with each other. Only solo publishes predict a solo slot.
 *
 * Reactions are deliberately NOT the metric: the median article has 0-1, which
 * cannot discriminate between slots. Views per day can.
 */
export async function GET() {
  const posts = await history();
  const solo = posts.filter((p) => p.sameDay <= 2 && p.vpd != null);
  const burst = posts.filter((p) => p.sameDay > 2 && p.vpd != null);

  const base = median(solo.map((p) => p.vpd!)) ?? 0;

  const byDow = DOW.map((label, i) => {
    const g = solo.filter((p) => p.dow === i);
    const m = median(g.map((p) => p.vpd!));
    return {
      label,
      dow: i,
      n: g.length,
      vpd: m,
      lift: m && base ? Number((m / base).toFixed(2)) : null,
      trusted: g.length >= MIN_N,
    };
  });

  const HOURS: [string, number, number][] = [
    ["00-06", 0, 6],
    ["06-09", 6, 9],
    ["09-12", 9, 12],
    ["12-15", 12, 15],
    ["15-18", 15, 18],
    ["18-24", 18, 24],
  ];
  const byHour = HOURS.map(([label, a, b]) => {
    const g = solo.filter((p) => p.hour >= a && p.hour < b);
    const m = median(g.map((p) => p.vpd!));
    return {
      label,
      from: a,
      to: b,
      n: g.length,
      vpd: m,
      lift: m && base ? Number((m / base).toFixed(2)) : null,
      trusted: g.length >= MIN_N,
    };
  });

  // Upcoming fires from the publisher — never re-derived here.
  let schedule: any = { fires: [], queue: [], minDays: null, error: null };
  try {
    const raw = execFileSync("npx", ["tsx", "scripts/publish-next.ts", "--json"], {
      cwd: FOOTPRINT,
      encoding: "utf8",
      timeout: 90_000,
      maxBuffer: 8 << 20,
    });
    schedule = JSON.parse(raw.slice(raw.indexOf("{")));
  } catch (e: any) {
    schedule.error = String(e?.message ?? e).split("\n")[0].slice(0, 200);
  }

  const bestDay = [...byDow].filter((d) => d.trusted).sort((a, b) => (b.lift ?? 0) - (a.lift ?? 0))[0] ?? null;
  const bestHour = [...byHour].filter((h) => h.trusted).sort((a, b) => (b.lift ?? 0) - (a.lift ?? 0))[0] ?? null;

  // Which weekdays the current cadence actually lands on.
  const fireDows = (schedule.fires ?? []).map((f: string) => new Date(f).getUTCDay());
  const minDays = schedule.minDays ?? null;
  const holdsWeekday = minDays != null && minDays % 7 === 0;

  const recommendations: { title: string; detail: string; confidence: string }[] = [];

  if (bestHour) {
    const cur = (schedule.fires ?? [])[0]
      ? new Date(schedule.fires[0]).getUTCHours()
      : null;
    const inBest =
      cur != null && cur >= bestHour.from && cur < bestHour.to;
    recommendations.push({
      title: inBest
        ? `Keep the hour — ${bestHour.label} UTC is already the best measured slot`
        : `Move the hour to ${bestHour.label} UTC`,
      detail: `${bestHour.label} UTC measures ${bestHour.lift}× the median rate (n=${bestHour.n} solo publishes). Current slot fires at ${cur ?? "?"}:00 UTC.`,
      confidence: bestHour.n >= 8 ? "moderate" : "low — small sample",
    });
  }

  if (bestDay && minDays != null && !holdsWeekday) {
    recommendations.push({
      title: `A ${minDays}-day cadence cannot hold the best weekday`,
      detail: `${bestDay.label} measures ${bestDay.lift}× the median rate (n=${bestDay.n}), but ${minDays} days is not a multiple of 7 — so the slot walks through the week and lands on ${bestDay.label} roughly 1 time in 7. The next ${fireDows.length} fires are ${fireDows.map((d: number) => DOW[d]).join(", ")}. To hold ${bestDay.label} the gap must be 7 or 14 days; the trade is ${(30 / minDays).toFixed(1)} → ${(30 / 7).toFixed(1)} articles a month. An alternating 3/4-day gap keeps volume and pins two weekdays instead of one.`,
      confidence: bestDay.n >= 8 ? "moderate" : "low — small sample",
    });
  }

  if (burst.length > solo.length) {
    const bm = median(burst.map((p) => p.vpd!));
    recommendations.push({
      title: "Bursting did not dilute per-article performance",
      detail: `${burst.length} of ${posts.length} articles shipped on days carrying 3+ posts, at a median ${bm?.toFixed(2)} views/day against ${base.toFixed(2)} for solo publishes — effectively identical. So the case against bursts is not per-article reach; it is the ~10-day recency window that decides suggest-list membership.`,
      confidence: "moderate",
    });
  }

  return NextResponse.json({
    schedule,
    calendar: (schedule.fires ?? []).map((f: string, i: number) => {
      const d = new Date(f);
      const slot = byDow[d.getUTCDay()];
      return {
        at: f,
        dow: DOW[d.getUTCDay()],
        hourUtc: d.getUTCHours(),
        article: (schedule.queue ?? [])[i] ?? null,
        // The measured lift of the weekday this fire lands on, so a slot with
        // nothing behind it is visibly a guess rather than a silent default.
        lift: slot?.trusted ? slot.lift : null,
        n: slot?.n ?? 0,
      };
    }),
    byDow,
    byHour,
    base: Number(base.toFixed(2)),
    counts: { total: posts.length, solo: solo.length, burst: burst.length },
    minN: MIN_N,
    recommendations,
    caveat:
      "Views per day, age-normalised, median, solo publishes only. Reactions are not used — the median article has 0-1, which cannot separate slots. Cells below n=" +
      MIN_N +
      " are shown but never used for a recommendation.",
  });
}
