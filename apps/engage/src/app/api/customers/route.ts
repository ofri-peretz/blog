import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { FOOTPRINT } from "@/lib/footprint";

export const dynamic = "force-dynamic";

/**
 * Who actually runs our rules, and what those rules currently say to them.
 *
 * `/api/repos` answers where the next PR should go. This answers the question
 * that comes after a merge and otherwise never gets asked: is the consumer
 * still there, and is it being shown false positives.
 *
 * Reads `adoption/customers.json`, which the sweep owns. Like the conquest map,
 * the app computes nothing here — measuring findings means cloning eight
 * repositories and linting ~120 KLOC, which is a batch job, not a page load.
 *
 * `idleDays` IS computed here, and only because the alternative is worse: a
 * stored day-count is wrong the morning after it is written, and a stale churn
 * signal is the one number on this page that must never lie.
 */

const FILE = join(FOOTPRINT, "adoption", "customers.json");

const DAY = 86_400_000;

/** Past this, a consumer is unmaintained rather than adopted. */
const DORMANT_DAYS = 90;
const AGING_DAYS = 30;

type ReadResult =
  | { ok: true; data: any }
  | { ok: false; why: "missing" | "corrupt"; detail?: string };

const read = (p: string): ReadResult => {
  if (!existsSync(p)) return { ok: false, why: "missing" };
  try {
    return { ok: true, data: JSON.parse(readFileSync(p, "utf8")) };
  } catch (e) {
    return { ok: false, why: "corrupt", detail: String(e).slice(0, 160) };
  }
};

const daysSince = (iso: string | undefined): number | null => {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / DAY));
};

const churn = (idle: number | null): "live" | "aging" | "dormant" | "unknown" => {
  if (idle == null) return "unknown";
  if (idle > DORMANT_DAYS) return "dormant";
  if (idle > AGING_DAYS) return "aging";
  return "live";
};

export async function GET() {
  const r = read(FILE);

  if (!r.ok) {
    return NextResponse.json({
      customers: [],
      candidates: [],
      packages: [],
      error:
        r.why === "missing"
          ? "adoption/customers.json missing"
          : `adoption/customers.json is not valid JSON — ${r.detail}`,
      hint:
        r.why === "missing"
          ? "run the published-package sweep and write adoption/customers.json"
          : "repair the file by hand; re-running the sweep will not fix a parse error",
    });
  }

  const customers = (r.data.customers ?? []).map((c: any) => {
    const idleDays = daysSince(c.pushedAt);
    return {
      ...c,
      idleDays,
      churn: churn(idleDays),
      /**
       * Unread is not clean. The gap between what a consumer is shown and what
       * we have actually read in source is the number that decides whether this
       * page is reassuring or alarming, so it is stated rather than implied.
       */
      /**
       * THE APPROACH GATE.
       *
       * A customer is contacted only when we know we expose it to no false
       * positives: every finding read, each one landed as a true or a false
       * positive, and every false positive fixed AND shipped.
       *
       * Unread counts against the gate exactly as hard as a known false positive.
       * Not knowing is not the same as being clean — treating them as the same is
       * what produced this problem in the first place.
       */
      truePositives: c.truePositives ?? [],
      falsePositives: c.falsePositives ?? [],
      tpCount: (c.truePositives ?? []).length,
      fpCount: (c.falsePositives ?? []).reduce((n: number, f: any) => n + (f.count ?? 1), 0),
      fpOpen: (c.falsePositives ?? []).filter((f: any) => !f.fixShipped).length,
      unread: Math.max(
        0,
        (c.findings ?? 0) -
          (c.truePositives ?? []).length -
          (c.falsePositives ?? []).reduce((n: number, f: any) => n + (f.count ?? 1), 0),
      ),
      /**
       * A caret range never crosses a major, so a consumer on ^4.5.0 cannot
       * receive 5.1.2 however many fixes ship. Released and received are
       * different things, and download counts cannot tell them apart.
       */
      receives: c.receives !== false,
      approachable:
        (c.falsePositives ?? []).every((f: any) => f.fixShipped) &&
        (c.findings ?? 0) -
          (c.truePositives ?? []).length -
          (c.falsePositives ?? []).reduce((n: number, f: any) => n + (f.count ?? 1), 0) ===
          0,
      reach: c.reach ?? null,
      perKloc: c.kloc ? Number(((c.findings ?? 0) / c.kloc).toFixed(2)) : null,
    };
  });

  /**
   * Candidate readiness.
   *
   * A repository that measures CLEAN is the strongest candidate we have, because
   * the ask becomes "keep it clean" instead of "you have bugs" — an ask that needs
   * no finding to be defensible and cannot be lost by arguing about one. Both
   * adoptions that actually worked had exactly that shape.
   *
   * Reachability gates it: outside merges, not stars. A 5,666-star repository that
   * never merges an outsider is a worse door than a 9-star one that merges 48.
   */
  const candidates = (r.data.candidates ?? [])
    .map((c: any) => {
      const idleDays = daysSince(c.pushedAt);
      const clean = c.effectivelyClean === true || (c.findings ?? 0) === 0;
      const reach = Math.min(1, (c.outsideMerges ?? 0) / 30);
      const fresh = idleDays == null ? 0 : idleDays > DORMANT_DAYS ? 0 : 1 - idleDays / DORMANT_DAYS;
      // Clean is the dominant term on purpose — it decides whether a PR can be
      // written at all, where reach and freshness only decide how fast it lands.
      const score = (clean ? 0.55 : 0.15) + 0.28 * reach + 0.17 * fresh;
      return {
        ...c,
        idleDays,
        churn: churn(idleDays),
        clean,
        perKloc: c.kloc ? Number(((c.findings ?? 0) / c.kloc).toFixed(2)) : null,
        score: Number(score.toFixed(3)),
        blockers: [
          ...(clean ? [] : ["findings unread — cannot promise a clean gate"]),
          ...((c.outsideMerges ?? 0) < 5 ? ["few outside merges — slow door"] : []),
          ...(idleDays != null && idleDays > DORMANT_DAYS ? ["dormant — unmaintained"] : []),
        ],
      };
    })
    .sort((a: any, b: any) => b.score - a.score);

  /**
   * Grouped by sector, because sector is what actually predicts adoption here.
   * Profiling the eight consumers we have found three config aggregators and two
   * public-sector bodies, and not one product company. Reachability finds
   * repositories that merge PRs; sector finds repositories that want the thing
   * we sell.
   */
  const bySector = new Map<string, any[]>();
  for (const c of candidates) {
    const k = c.sector ?? "unsorted";
    bySector.set(k, [...(bySector.get(k) ?? []), c]);
  }
  const sectors = [...bySector.entries()]
    .map(([sector, items]) => ({
      sector,
      items,
      ready: items.filter((i: any) => i.clean && i.churn !== "dormant").length,
      // A sector is worth working when it has clean, reachable doors in it.
      weight: items.reduce((n: number, i: any) => n + i.score, 0),
    }))
    .sort((a, b) => b.ready - a.ready || b.weight - a.weight);

  const exposed = customers.filter((c: any) => c.findings > 0).length;

  return NextResponse.json({
    asOf: r.data.asOf ?? null,
    packages: r.data.packages ?? [],
    customers,
    candidates,
    sectors,
    totals: {
      customers: customers.length,
      configures: customers.filter((c: any) => c.depth === "configures").length,
      clean: customers.filter((c: any) => c.findings === 0).length,
      exposed,
      dormant: customers.filter((c: any) => c.churn === "dormant").length,
      approachable: customers.filter((c: any) => c.approachable).length,
      strandedInstalls: customers
        .filter((c: any) => c.receives === false)
        .reduce((n: number, c: any) => n + (c.reach ?? 0), 0),
      candidates: candidates.length,
      candidatesClean: candidates.filter((c: any) => c.clean && c.churn !== "dormant").length,
      weeklyDownloads: (r.data.packages ?? []).reduce(
        (s: number, p: any) => s + (p.weeklyDownloads ?? 0),
        0,
      ),
    },
  });
}
