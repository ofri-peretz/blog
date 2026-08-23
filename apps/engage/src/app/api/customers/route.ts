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
      unread: Math.max(0, (c.findings ?? 0) - (c.verifiedFalse ?? 0)),
      perKloc: c.kloc ? Number(((c.findings ?? 0) / c.kloc).toFixed(2)) : null,
    };
  });

  const exposed = customers.filter((c: any) => c.findings > 0).length;

  return NextResponse.json({
    asOf: r.data.asOf ?? null,
    packages: r.data.packages ?? [],
    customers,
    totals: {
      customers: customers.length,
      configures: customers.filter((c: any) => c.depth === "configures").length,
      clean: customers.filter((c: any) => c.findings === 0).length,
      exposed,
      dormant: customers.filter((c: any) => c.churn === "dormant").length,
      weeklyDownloads: (r.data.packages ?? []).reduce(
        (s: number, p: any) => s + (p.weeklyDownloads ?? 0),
        0,
      ),
    },
  });
}
