import { TrackedLink } from "@/components/tracked-link";
import type { PluginMention } from "@/lib/plugin-mentions";

/**
 * "Covered in this piece" — live cards for the packages an article
 * actually discusses: current version and real weekly downloads from
 * the synced stats cache, so the article's product numbers are the
 * sync's, never the author's memory going stale. The card links to the
 * package's npm page (the one URL guaranteed to exist per package).
 */
export function ArticlePlugins({
  currentSlug,
  plugins,
  generatedAt,
}: {
  currentSlug: string;
  plugins: readonly PluginMention[];
  /** The sync date — receipts say when they were earned. */
  generatedAt: string;
}) {
  if (plugins.length === 0) return null;
  return (
    <section
      data-slot="article-plugins"
      aria-label="Packages covered in this article"
      className="mt-12 border-t border-border pt-8"
    >
      <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
        Covered in this piece
      </h2>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {plugins.map((p) => (
          <li key={p.name}>
            <TrackedLink
              href={`https://www.npmjs.com/package/${p.name}`}
              event="article:plugin_card_click"
              props={{ slug: currentSlug, package: p.name }}
              className="block rounded-lg border border-border p-4 transition-colors hover:bg-muted/40"
            >
              <span className="block truncate font-mono text-sm font-medium text-foreground">
                {p.name}
              </span>
              <span className="mt-1 block font-mono text-xs text-muted-foreground [font-variant-numeric:tabular-nums]">
                v{p.version} · {formatDownloads(p.weeklyDownloads)}/wk
              </span>
            </TrackedLink>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">
        Live from npm, synced {generatedAt}.
      </p>
    </section>
  );
}

function formatDownloads(n: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}
