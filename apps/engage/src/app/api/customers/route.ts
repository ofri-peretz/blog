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
/**
 * Every finding we have ever shown a repository, with its CWE, CVSS and exact
 * line. Separate from customers.json because it is evidence rather than state:
 * it only ever grows, and a finding you cannot point at is not evidence.
 */
const LEDGER = join(FOOTPRINT, "adoption", "findings.json");

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

const churn = (
  idle: number | null,
): "live" | "aging" | "dormant" | "unknown" => {
  if (idle == null) return "unknown";
  if (idle > DORMANT_DAYS) return "dormant";
  if (idle > AGING_DAYS) return "aging";
  return "live";
};

/**
 * WHAT ELSE THEY COULD TAKE.
 *
 * Two different asks, and conflating them wastes the one PR a maintainer will
 * read. An application gets a stack match — it runs Express, so express-security
 * is a claim about their code. An aggregator ships a preset to other people, so
 * the ask is breadth of coverage, and a stack match would be meaningless.
 *
 * A version gap outranks both. A consumer pinned below our current major cannot
 * receive a single fix we ship, so bumping the range is worth more to them than
 * any new plugin — and it is the easiest PR for a maintainer to say yes to.
 */
const STACK_PLUGINS: Record<string, string[]> = {
  express: ["express-security"],
  nestjs: ["nestjs-security"],
  mongo: ["mongodb-security"],
  jwt: ["jwt-security"],
  postgres: ["pg"],
  lambda: ["lambda-security"],
  next: ["browser-security", "vercel-ai-security"],
  react: ["browser-security", "react-a11y"],
  vue: ["browser-security"],
  browser: ["browser-security"],
  ai: ["vercel-ai-security"],
};

/** Offered to any aggregator, in the order we would actually pitch them. */
const BREADTH = [
  "secure-coding",
  "node-security",
  "browser-security",
  "express-security",
  "jwt-security",
  "nestjs-security",
];

/**
 * Plugins that only mean something to one framework. Offering nestjs-security to
 * a React config is the kind of untargeted ask that gets a preset maintainer to
 * stop reading, so a preset with a known stack is only shown the generic four
 * plus whatever its own stack actually justifies.
 */
const FRAMEWORK_BOUND: Record<string, string> = {
  "express-security": "express",
  "nestjs-security": "nestjs",
  "mongodb-security": "mongo",
  pg: "postgres",
  "lambda-security": "lambda",
  "vercel-ai-security": "ai",
};

const majorOf = (range: string | undefined): number | null => {
  const m = /(\d+)\./.exec(String(range ?? ""));
  return m ? Number(m[1]) : null;
};

function upsell(c: any, packages: any[]) {
  const have = new Set<string>(c.plugins ?? []);
  const latest = new Map(packages.map((p: any) => [p.name, p.version]));
  const out: any[] = [];

  // Stranded ranges first — nothing we ship reaches them until this lands.
  for (const [pkg, range] of Object.entries(c.ranges ?? {})) {
    const now = latest.get(pkg);
    if (!now) continue;
    const theirs = majorOf(range as string);
    const ours = majorOf(now);
    if (theirs != null && ours != null && theirs < ours) {
      out.push({
        kind: "version",
        pkg,
        from: range,
        to: `^${now}`,
        why: `pinned to a major that cannot receive ${now} — every fix since is invisible to them`,
      });
    }
  }

  const stack: string[] = c.stack ?? [];
  const wanted: string[] =
    c.kind === "aggregator"
      ? // With no stack signal we cannot narrow, so the full list stands.
        stack.length
        ? BREADTH.filter(
            (p) => !FRAMEWORK_BOUND[p] || stack.includes(FRAMEWORK_BOUND[p]),
          )
        : BREADTH
      : [
          ...new Set<string>(
            stack.flatMap((s: string) => STACK_PLUGINS[s] ?? []),
          ),
        ];

  for (const short of wanted) {
    if (have.has(short)) continue;
    out.push({
      kind: c.kind === "aggregator" ? "breadth" : "stack",
      pkg: short.startsWith("eslint-plugin-")
        ? short
        : `eslint-plugin-${short}`,
      why:
        c.kind === "aggregator"
          ? "not in the preset — consumers of this config get no coverage for it"
          : `they run ${stack.find((s: string) => (STACK_PLUGINS[s] ?? []).includes(short))} and this is the plugin for it`,
    });
  }
  return out;
}

/** Pipeline stage for one outreach PR — the only view that says who is blocking. */
const stageOf = (o: any): string =>
  o.state === "merged"
    ? "merged"
    : o.state === "closed"
      ? "closed"
      : o.state === "gone"
        ? "gone"
        : o.waitingOn === "us"
          ? "our move"
          : o.respondedAt
            ? "in review"
            : "awaiting first reply";

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
      fpCount: (c.falsePositives ?? []).reduce(
        (n: number, f: any) => n + (f.count ?? 1),
        0,
      ),
      fpOpen: (c.falsePositives ?? []).filter((f: any) => !f.fixShipped).length,
      unread: Math.max(
        0,
        (c.findings ?? 0) -
          (c.truePositives ?? []).length -
          (c.falsePositives ?? []).reduce(
            (n: number, f: any) => n + (f.count ?? 1),
            0,
          ),
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
          (c.falsePositives ?? []).reduce(
            (n: number, f: any) => n + (f.count ?? 1),
            0,
          ) ===
          0,
      reach: c.reach ?? null,
      upsell: upsell(c, r.data.packages ?? []),
      outreach: (c.outreach ?? []).map((o: any) => ({
        ...o,
        stage: stageOf(o),
      })),
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
  /**
   * Institutional weight.
   *
   * A national government body is a strategically different prize from a hobby
   * repository with the same star count: the adoption is cited, it is copied by
   * the other departments in the same ministry, and it survives the maintainer
   * leaving. Downloads cannot see any of that, so it is scored separately and
   * explicitly rather than smuggled in through stars.
   */
  const INSTITUTION: Array<[RegExp, number, string]> = [
    [
      /^(alphagov|hmcts|ministryofjustice|UKHomeOffice|NHSDigital|nhsx|dfe-digital|DEFRA|HMRC|UKHSA|dwp-)/i,
      1.0,
      "national government",
    ],
    [
      /^(18F|GSA|usds|cds-snc|canada-ca|AusDTO|govau|GovTechSG|IMDA-GDS|betagouv|bundesAPI|digitalservicebund|MinBZK|minvws)/i,
      1.0,
      "national government",
    ],
    [
      /^(City-of-|CityOf|cityofaustin|NYCPlanning|bcgov|ongov|Amsterdam|Vlaanderen|digipolisantwerp)/i,
      0.72,
      "city or regional government",
    ],
    [
      /^(w3c|whatwg|mozilla|mdn|nodejs|openjs|cncf|kubernetes|open-telemetry)/i,
      0.85,
      "standards or foundation",
    ],
  ];
  const institutionOf = (slug: string) => {
    const org = slug.split("/")[0];
    for (const [re, w, label] of INSTITUTION)
      if (re.test(org)) return { weight: w, label };
    return { weight: 0, label: null as string | null };
  };

  /**
   * Candidate readiness.
   *
   * A repository that measures CLEAN is the strongest candidate we have, because
   * the ask becomes "keep it clean" instead of "you have bugs" — an ask that needs
   * no finding to be defensible and cannot be lost by arguing about one. Both
   * adoptions that actually worked had exactly that shape. So clean still gates.
   *
   * What clean cannot tell us is whether landing it is worth the week. That is
   * three separate questions, and they are scored separately because they can
   * disagree: can we get in (outside merges), is anyone home (freshness), and
   * how far does one merge travel (npm downloads, institutional weight, stars).
   */
  const candidates = (r.data.candidates ?? [])
    .map((c: any) => {
      const idleDays = daysSince(c.pushedAt);
      const clean = c.effectivelyClean === true || (c.findings ?? 0) === 0;

      // Outside merges, not stars: whether the door opens at all.
      const reach = Math.min(1, (c.outsideMerges ?? 0) / 60);
      const fresh =
        idleDays == null
          ? 0
          : idleDays > DORMANT_DAYS
            ? 0
            : 1 - idleDays / DORMANT_DAYS;

      // Downloads on a log scale — 1k/wk and 1M/wk are both real, and a linear
      // scale would let one package erase every other lead on the board.
      const dl = c.weeklyDownloads ?? 0;
      const downloadWeight = dl > 0 ? Math.min(1, Math.log10(dl) / 6) : 0;
      const starWeight = c.stars ? Math.min(0.8, Math.log10(c.stars) / 5) : 0;
      const inst = institutionOf(c.slug);

      // The three are alternative routes to the same thing — how much a single
      // merge is worth — so the strongest one counts rather than their sum.
      const impact = Math.max(downloadWeight, inst.weight, starWeight);

      const score =
        (clean ? 0.4 : 0.1) + 0.2 * reach + 0.12 * fresh + 0.28 * impact;

      return {
        ...c,
        idleDays,
        churn: churn(idleDays),
        clean,
        perKloc: c.kloc
          ? Number(((c.findings ?? 0) / c.kloc).toFixed(2))
          : null,
        institution: inst.label,
        // Shown in the UI so a rank is always explainable rather than magic.
        why: {
          clean,
          reach: Number(reach.toFixed(2)),
          fresh: Number(fresh.toFixed(2)),
          impact: Number(impact.toFixed(2)),
          impactFrom:
            impact === 0
              ? "none"
              : impact === downloadWeight && dl > 0
                ? `${dl.toLocaleString()} downloads/wk`
                : impact === inst.weight && inst.label
                  ? inst.label
                  : `${c.stars} stars`,
        },
        score: Number(score.toFixed(3)),
        blockers: [
          ...(clean ? [] : ["findings unread — cannot promise a clean gate"]),
          ...((c.outsideMerges ?? 0) < 5
            ? ["few outside merges — slow door"]
            : []),
          ...(idleDays != null && idleDays > DORMANT_DAYS
            ? ["stale — unmaintained"]
            : []),
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

  const led = read(LEDGER);
  const ledger = led.ok
    ? (() => {
        const repos = Object.entries(led.data.repos ?? {}).map(
          ([slug, r]: [string, any]) => ({
            slug,
            kloc: r.kloc,
            scannedAt: r.scannedAt,
            findings: r.findings ?? [],
            // Worst-first: a critical among thirty mediums is the whole story.
            worst: (r.findings ?? []).reduce(
              (m: number, f: any) => Math.max(m, f.cvss ?? 0),
              0,
            ),
          }),
        );
        return {
          asOf: led.data.asOf ?? null,
          totals: led.data.totals ?? null,
          repos: repos
            .filter((r) => r.findings.length)
            .sort((a, b) => b.worst - a.worst),
          cleanRepos: repos.filter((r) => !r.findings.length).length,
        };
      })()
    : null;

  /**
   * The pipeline, flattened across customers and candidates alike, because a PR
   * does not care which bucket the repository sits in. `ourMove` is the only
   * number here we control directly — anything sitting in it is a self-inflicted
   * delay, so it leads.
   */
  const pipeline = [...customers, ...candidates].flatMap((c: any) =>
    (c.outreach ?? []).map((o: any) => ({
      ...o,
      slug: c.slug,
      sector: c.sector ?? null,
    })),
  );
  const replied = pipeline.filter((o: any) => o.respondedAt);

  return NextResponse.json({
    asOf: r.data.asOf ?? null,
    packages: r.data.packages ?? [],
    customers,
    candidates,
    sectors,
    pipeline: pipeline.sort(
      (a: any, b: any) =>
        Number(b.waitingOn === "us") - Number(a.waitingOn === "us") ||
        (b.quietDays ?? 0) - (a.quietDays ?? 0),
    ),
    pipelineTotals: {
      open: pipeline.filter((o: any) => o.state === "open").length,
      ourMove: pipeline.filter((o: any) => o.waitingOn === "us").length,
      awaitingFirstReply: pipeline.filter(
        (o: any) => o.state === "open" && !o.respondedAt,
      ).length,
      inReview: pipeline.filter((o: any) => o.state === "open" && o.respondedAt)
        .length,
      merged: pipeline.filter((o: any) => o.state === "merged").length,
      closed: pipeline.filter((o: any) => o.state === "closed").length,
      // Reply rate and median latency are what tell us whether the *profile* is
      // right, independent of any single maintainer being slow.
      replyRate: pipeline.length
        ? Number((replied.length / pipeline.length).toFixed(2))
        : null,
      medianReplyDays: replied.length
        ? replied
            .map((o: any) => o.responseDays)
            .sort((a: number, b: number) => a - b)[
            Math.floor(replied.length / 2)
          ]
        : null,
      // A PR nobody has touched in three weeks needs a nudge, not more waiting.
      stalled: pipeline.filter(
        (o: any) => o.state === "open" && (o.quietDays ?? 0) > 21,
      ).length,
      checkedAt: r.data.outreachCheckedAt ?? null,
    },
    upsells: [...customers, ...candidates]
      .filter((c: any) => (c.upsell ?? []).length)
      .map((c: any) => ({
        slug: c.slug,
        repoUrl: c.repoUrl ?? `https://github.com/${c.slug}`,
        kind: c.kind ?? null,
        approachable: c.approachable ?? c.clean ?? false,
        items: c.upsell,
      }))
      // A version bump on a live consumer beats a new plugin on a stranger.
      .sort(
        (a: any, b: any) =>
          Number(b.items.some((i: any) => i.kind === "version")) -
            Number(a.items.some((i: any) => i.kind === "version")) ||
          b.items.length - a.items.length,
      ),
    ledger,
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
      candidatesClean: candidates.filter(
        (c: any) => c.clean && c.churn !== "dormant",
      ).length,
      weeklyDownloads: (r.data.packages ?? []).reduce(
        (s: number, p: any) => s + (p.weeklyDownloads ?? 0),
        0,
      ),
    },
  });
}
