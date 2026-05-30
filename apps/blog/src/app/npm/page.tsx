// /npm — per-package breakdown of all actively-promoted npm packages.
// Source: Supabase plugin_daily_metrics (30-day sparkline) + npm registry
// range API (lifetime per-package totals). Cached 12h.

import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { PackageCard } from "@/components/npm/package-card";
import { getNpmPagePackages } from "@/lib/npm-page-data";

export const revalidate = 43200; // 12h — matches the unified cache policy

export const metadata: Metadata = {
  title: "npm packages — Ofri Peretz",
  description:
    "Per-package breakdown of every npm package I actively maintain — lifetime + recent downloads, install commands, source links.",
  alternates: { canonical: "https://ofriperetz.dev/npm" },
  openGraph: {
    title: "npm packages — Ofri Peretz",
    description:
      "Per-package breakdown of every actively-maintained npm package: downloads over time, install commands, source.",
    type: "article",
  },
};

const fmt = (n: number) => new Intl.NumberFormat("en-US").format(n);

async function PackageGrid() {
  const packages = await getNpmPagePackages();
  if (packages.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No package data available. Source: Supabase{" "}
        <code className="font-mono">plugin_daily_metrics</code>; daily ingest
        cron writes it.
      </p>
    );
  }
  const totalLifetime = packages.reduce(
    (s, p) => s + p.downloadsLifetime,
    0,
  );
  const total30d = packages.reduce((s, p) => s + p.downloads30d, 0);
  return (
    <div className="flex flex-col gap-8">
      <dl className="grid grid-cols-3 gap-4 rounded-xl border bg-card p-6">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Packages
          </dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums">
            {packages.length}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Downloads (last 30d)
          </dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums">
            {fmt(total30d)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Downloads (lifetime)
          </dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums">
            {fmt(totalLifetime)}
          </dd>
        </div>
      </dl>
      <div
        data-slot="npm-package-grid"
        className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3"
      >
        {packages.map((p) => (
          <PackageCard key={p.name} pkg={p} />
        ))}
      </div>
    </div>
  );
}

function PackageGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-56 w-full" />
      ))}
    </div>
  );
}

export default function NpmPage() {
  return (
    <main
      data-page="npm"
      className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-12 sm:py-16"
    >
      <header className="flex flex-col gap-3">
        <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Packages
        </p>
        <h1 className="text-4xl font-semibold tracking-tight">
          npm packages I maintain
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Every actively-promoted package, with downloads over time, install
          commands, and links to source. Daily downloads come from the npm
          registry via Supabase. Cached for 12 hours.
        </p>
      </header>

      <Suspense fallback={<PackageGridSkeleton />}>
        <PackageGrid />
      </Suspense>

      <footer className="border-t pt-6 text-xs text-muted-foreground">
        <p>
          Source-of-truth:{" "}
          <a
            href="https://www.npmjs.com/~ofriperetz"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            npm registry · ~ofriperetz
          </a>{" "}
          and Supabase <code className="font-mono">plugin_daily_metrics</code>.
        </p>
      </footer>
    </main>
  );
}
