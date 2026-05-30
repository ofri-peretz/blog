// Scorecard — the public surface for the North Star metric.
//
// Server Component composed of four independent `<Suspense>` boundaries:
//
//   1. NorthStarSection   — the headline + delta + sparkline.
//   2. MomentumSection    — rising / cooling / anomalies columns.
//   3. ContributionsGrid  — what we ship to the world.
//   4. EngagementGrid     — how the world responds.
//
// Each section is a separate async server component with its own `await`s
// against the cached scorecard fetchers from @interlace/docs-baseline. Reads
// dedupe across sections (`react/cache`), so we still hit Supabase at most
// once per view per render — but each `<Suspense>` boundary streams in as
// soon as ITS data resolves. No section is ever blocked by another.
//
// Skeletons are shape-matched so the swap-in is zero-CLS. They live in
// @interlace/docs-baseline so every consumer (blog, future apps) reuses
// the same loading surface.
//
// Per the impact vision (skills/ofri-impact/references/00-vision.md):
// the hero earns attention; the breakdown grid earns trust; the momentum
// panel keeps the work moving. Every number traces back to a queryable
// Supabase view — see the "source ↗" link on each card.
//
// Revalidates once an hour. The daily ingest runs at 05:00 UTC and (after
// the revalidate-tag webhook lands) will fire on-demand revalidations
// within seconds of the ratchet refresh.

import { Suspense } from "react";
import type { Metadata } from "next";
import {
  BookOpen,
  Download,
  Eye,
  FileCode,
  GitCommit,
  GitPullRequest,
  Heart,
  MessageCircle,
  Package,
  ShieldCheck,
  Star,
  Users,
  CircleDot,
} from "lucide-react";

import {
  DownloadsByPackage,
  type PackageDatum,
} from "@/components/charts/downloads-by-package";
import { Skeleton } from "@/components/ui/skeleton";
import { MomentumPanel } from "#interlace/components/scorecard/momentum-panel";
import { MomentumPanelSkeleton } from "#interlace/components/scorecard/momentum-panel-skeleton";
import { NorthStarHero } from "#interlace/components/scorecard/north-star-hero";
import { NorthStarHeroSkeleton } from "#interlace/components/scorecard/north-star-hero-skeleton";
import { RatchetGrid } from "#interlace/components/scorecard/ratchet-grid";
import { RatchetGridSkeleton } from "#interlace/components/scorecard/ratchet-grid-skeleton";
import type {
  Bucket,
  RatchetBreakdownRow,
  RatchetDeltaRow,
  RatchetTrendRow,
} from "#interlace/components/scorecard/types";
import {
  getCachedBreakdown,
  getCachedDeltas,
  getCachedTrends,
  getCachedAnomalies,
  getCachedNorthStarHistory,
} from "#interlace/lib/scorecard-data";

// Render per-request, not at build time. The fetchers throw when
// SUPABASE_URL / SUPABASE_ANON_KEY are missing, so we can't safely
// statically prerender in environments (CI, local) where the env may be
// absent. Vercel's edge layer still caches each rendered response;
// regeneration happens on the next visit after the cache expires.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Scorecard — Ofri Peretz",
  description:
    "A public, schema-enforced ledger of our mutual contribution to the world — both what we ship and how the world responds. Every number is provenance-traceable to its source.",
  alternates: { canonical: "https://ofriperetz.dev/scorecard" },
  openGraph: {
    title: "Scorecard — Ofri Peretz",
    description:
      "Our mutual contribution to the world: contributions + engagement, summed and growing.",
    type: "article",
  },
};

const ICONS: Record<string, React.ReactNode> = {
  contrib_commits: <GitCommit className="size-4" aria-hidden />,
  contrib_articles_authored: <BookOpen className="size-4" aria-hidden />,
  contrib_rules_shipped: <ShieldCheck className="size-4" aria-hidden />,
  contrib_lines_tested: <FileCode className="size-4" aria-hidden />,
  contrib_releases: <Package className="size-4" aria-hidden />,
  contrib_prs_merged: <GitPullRequest className="size-4" aria-hidden />,
  contrib_external_prs: <GitPullRequest className="size-4" aria-hidden />,
  contrib_external_issues: <CircleDot className="size-4" aria-hidden />,
  contrib_devto_comments_left: <MessageCircle className="size-4" aria-hidden />,
  contrib_rules_tested: <ShieldCheck className="size-4" aria-hidden />,
  eng_downloads_cumulative: <Download className="size-4" aria-hidden />,
  eng_devto_views: <Eye className="size-4" aria-hidden />,
  eng_devto_reactions: <Heart className="size-4" aria-hidden />,
  eng_github_stars: <Star className="size-4" aria-hidden />,
  eng_github_followers: <Users className="size-4" aria-hidden />,
  eng_devto_followers: <Users className="size-4" aria-hidden />,
  eng_page_views_cumulative: <Eye className="size-4" aria-hidden />,
};

const iconFor = (kind: string): React.ReactNode => ICONS[kind] ?? null;

// Anchor date the pipeline started recording.
const SINCE = "2025-12-01";

function daysBetween(isoStart: string, isoEnd: Date = new Date()): number {
  const start = new Date(isoStart).getTime();
  const end = isoEnd.getTime();
  return Math.max(0, Math.floor((end - start) / 86400000));
}

const labelForKind =
  (rows: ReadonlyArray<RatchetBreakdownRow>) => (kind: string) =>
    rows.find((r) => r.kind === kind)?.display_label ?? kind;

const findDelta = (
  deltas: ReadonlyArray<RatchetDeltaRow>,
  kind: string,
): RatchetDeltaRow | undefined => deltas.find((d) => d.kind === kind);

// ─── Async section components ────────────────────────────────────────
// Each one awaits ONLY what it needs. React.cache() inside the baseline
// fetchers makes overlapping reads coalesce, so we never over-fetch.

async function NorthStarSection() {
  const [breakdown, deltas, history] = await Promise.all([
    getCachedBreakdown(),
    getCachedDeltas(),
    getCachedNorthStarHistory(),
  ]);
  const headlineRow = breakdown[0] ?? null;
  const value = headlineRow?.north_star_total ?? 0;
  const delta = findDelta(deltas, "north_star_total");

  return (
    <NorthStarHero
      value={value}
      delta30d={delta?.delta_30d ?? null}
      growthPct30d={delta?.growth_pct_30d ?? null}
      since={SINCE}
      daysOfReceipts={daysBetween(SINCE)}
      history={history.map((p) => p.value)}
      description={
        <>
          A public ledger of <em>our mutual contribution to the world</em> —
          both what we ship and how the world responds. Every number is
          provenance-traceable to its source.
        </>
      }
    />
  );
}

async function MomentumSection() {
  const [trends, anomalies, breakdown] = await Promise.all([
    getCachedTrends(),
    getCachedAnomalies(),
    getCachedBreakdown(),
  ]);
  return (
    <MomentumPanel
      trends={trends as RatchetTrendRow[]}
      anomalies={anomalies}
      labelFor={labelForKind(breakdown)}
    />
  );
}

async function BucketGridSection({ bucket }: { bucket: Bucket }) {
  const [breakdown, deltas, trends] = await Promise.all([
    getCachedBreakdown(),
    getCachedDeltas(),
    getCachedTrends(),
  ]);
  const deltaByKind = new Map(deltas.map((d) => [d.kind, d]));
  // Hide rows whose ingest hasn't been wired yet (e.g. page views, tweet
  // engagement). `v_ratchet_deltas` always returns a delta row per kind
  // because the refresh function runs unconditionally, so `hasDelta` alone
  // is not enough — we also require the delta to be non-zero or the
  // current value to be > 0. The filter intentionally errs toward HIDE for
  // the "0 value AND 0 delta" case: those cards otherwise show "0 / 30d"
  // with no useful information and read as broken.
  const rows = breakdown.filter((r) => {
    if (r.bucket !== bucket) return false;
    const hasValue = r.current_value != null && r.current_value > 0;
    const delta = deltaByKind.get(r.kind);
    const hasMeaningfulDelta =
      delta != null &&
      (delta.delta_30d !== 0 ||
        (delta.growth_pct_30d != null && delta.growth_pct_30d !== 0));
    return hasValue || hasMeaningfulDelta;
  });
  return (
    <RatchetGrid
      bucket={bucket}
      rows={rows}
      deltas={deltas}
      trends={trends as RatchetTrendRow[]}
      iconFor={iconFor}
    />
  );
}

// Per-package npm download breakdown — the one /stats card that adds
// information /scorecard didn't already have. Pulls from /api/npm-stats
// (public registry, no auth) at request time, cached 5 min, falls back
// to an empty array on failure so the rest of the page still renders.
async function DownloadsByPackageSection() {
  const base = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : `http://localhost:${process.env.PORT || 3001}`;
  let packages: PackageDatum[] = [];
  try {
    const res = await fetch(`${base}/api/npm-stats`, {
      next: { revalidate: 300 },
    });
    if (res.ok) {
      const data = (await res.json()) as { packages?: PackageDatum[] };
      packages = data.packages ?? [];
    }
  } catch {
    // Network/transient failure — render the empty state instead of
    // breaking the whole page.
  }
  return (
    <section className="mt-4 flex flex-col gap-4 border-t border-border pt-12">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Per-plugin breakdown
        </p>
        <h2 className="text-2xl font-semibold tracking-tight">
          The headline number, decomposed
        </h2>
        <p className="text-sm text-muted-foreground">
          Cumulative npm downloads split across the individual Interlace
          plugins. The vocabulary is the marketing.
        </p>
      </header>
      <DownloadsByPackage packages={packages} limit={12} />
    </section>
  );
}

function DownloadsByPackageSkeleton() {
  return (
    <section className="mt-4 flex flex-col gap-4 border-t border-border pt-12">
      <header className="flex flex-col gap-2">
        <Skeleton className="h-3 w-44" />
        <Skeleton className="h-7 w-96 max-w-full" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </header>
      <Skeleton className="h-72 w-full" />
    </section>
  );
}

export default function ScorecardPage() {
  return (
    <main
      data-page="scorecard"
      className="mx-auto flex max-w-6xl flex-col gap-12 px-6 py-12 sm:py-16"
    >
      <Suspense fallback={<NorthStarHeroSkeleton />}>
        <NorthStarSection />
      </Suspense>

      <Suspense fallback={<MomentumPanelSkeleton />}>
        <MomentumSection />
      </Suspense>

      <Suspense
        fallback={<RatchetGridSkeleton bucket="contributions" cardCount={9} />}
      >
        <BucketGridSection bucket="contributions" />
      </Suspense>

      <Suspense
        fallback={<RatchetGridSkeleton bucket="engagement" cardCount={6} />}
      >
        <BucketGridSection bucket="engagement" />
      </Suspense>

      <Suspense fallback={<DownloadsByPackageSkeleton />}>
        <DownloadsByPackageSection />
      </Suspense>

      <footer className="border-t pt-8 text-sm text-muted-foreground">
        <p className="mb-3 font-medium">Where the numbers come from</p>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <li>
            <a
              className="underline-offset-4 hover:text-foreground hover:underline"
              href="https://www.npmjs.com/~ofriperetz"
              target="_blank"
              rel="noopener noreferrer"
            >
              npm registry — downloads
            </a>
          </li>
          <li>
            <a
              className="underline-offset-4 hover:text-foreground hover:underline"
              href="https://github.com/ofri-peretz"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub — commits, PRs, stars, releases
            </a>
          </li>
          <li>
            <a
              className="underline-offset-4 hover:text-foreground hover:underline"
              href="https://codecov.io/gh/ofri-peretz/eslint"
              target="_blank"
              rel="noopener noreferrer"
            >
              Codecov — coverage % + lines tested
            </a>
          </li>
          <li>
            <a
              className="underline-offset-4 hover:text-foreground hover:underline"
              href="https://dev.to/ofri-peretz"
              target="_blank"
              rel="noopener noreferrer"
            >
              dev.to — articles, views, reactions
            </a>
          </li>
        </ul>
        <p className="mt-6 text-xs">
          Pipeline runs daily at 05:00 UTC. Source-of-truth: Supabase project{" "}
          <code className="font-mono">ofri-and-interlace-data</code>. Page
          revalidates every hour.
        </p>
      </footer>
    </main>
  );
}
