// One per package on /npm. Server component (no client JS needed for the
// static parts; sparkline + copy-snippet are their own client islands).

import { ExternalLink } from "lucide-react";
import { InstallSnippet } from "./install-snippet";
import { Sparkline } from "./sparkline";

// Inline GitHub mark. lucide-react removed brand/logo icons (Github,
// Twitter, etc.) in its 1.x line for trademark reasons; importing them
// fails the build under the hoisted version. Inline SVG keeps the mark
// without depending on lucide's brand set.
function GitHubMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      aria-hidden
      focusable="false"
    >
      <path d="M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58 0-.29-.01-1.05-.02-2.06-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.33-1.76-1.33-1.76-1.09-.74.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5.99.11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.34-5.47-5.94 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 016.01 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.49 5.93.43.37.81 1.1.81 2.22 0 1.6-.01 2.9-.01 3.29 0 .32.22.7.83.58A12 12 0 0024 12.5C24 5.87 18.63.5 12 .5z" />
    </svg>
  );
}

export interface PackageCardData {
  name: string;
  slug: string;
  category: string | null;
  description: string | null;
  downloads30d: number;
  downloadsLifetime: number;
  dailyData: ReadonlyArray<{ day: string; downloads: number }>;
}

const fmt = (n: number) => new Intl.NumberFormat("en-US").format(n);

// Best-guess GitHub URL for an Interlace plugin. Convention: every plugin
// lives at github.com/ofri-peretz/eslint/tree/main/packages/<bare-name>.
// `bare-name` is the package name minus the `eslint-plugin-` prefix (or
// the `@interlace/` scope's slash-suffix for scoped pkgs).
function githubUrlFor(name: string): string {
  const bare = name.startsWith("@")
    ? (name.split("/")[1] ?? name)
    : name;
  return `https://github.com/ofri-peretz/eslint/tree/main/packages/${bare}`;
}

function npmUrlFor(name: string): string {
  return `https://www.npmjs.com/package/${name}`;
}

export function PackageCard({ pkg }: { pkg: PackageCardData }) {
  return (
    <article
      data-slot="npm-package-card"
      data-pkg={pkg.name}
      className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
    >
      <header className="flex flex-col gap-1.5">
        <div className="flex items-start justify-between gap-3">
          <a
            href={npmUrlFor(pkg.name)}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-1 font-mono text-sm font-semibold hover:underline"
            aria-label={`Open ${pkg.name} on npm`}
          >
            <span className="truncate">{pkg.name}</span>
            <ExternalLink
              className="size-3 shrink-0 opacity-50 transition-opacity group-hover:opacity-100"
              aria-hidden
            />
          </a>
          <a
            href={githubUrlFor(pkg.name)}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
            aria-label={`Source for ${pkg.name} on GitHub`}
          >
            <GitHubMark className="size-4" />
          </a>
        </div>
        {pkg.category && (
          <span className="inline-flex w-fit items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {pkg.category}
          </span>
        )}
        {pkg.description && (
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {pkg.description}
          </p>
        )}
      </header>

      <div>
        <Sparkline data={pkg.dailyData} />
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <div>
          <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Last 30 days
          </dt>
          <dd className="font-semibold tabular-nums">
            {fmt(pkg.downloads30d)}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
            All time
          </dt>
          <dd className="font-semibold tabular-nums">
            {fmt(pkg.downloadsLifetime)}
          </dd>
        </div>
      </dl>

      <InstallSnippet packageName={pkg.name} />
    </article>
  );
}
