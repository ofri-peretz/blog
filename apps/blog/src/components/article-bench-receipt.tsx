import { TrackedLink } from "@/components/tracked-link";

export interface BenchReceiptRow {
  key: string;
  label: string;
  coldMs: number;
  warmMs: number;
}

export interface BenchReceiptData {
  generatedAt: string;
  repo: string;
  versions: Record<string, string>;
  rows: readonly BenchReceiptRow[];
}

/**
 * "The numbers, re-earned" — the weekly public benchmark's headline
 * result, rendered on the benchmark-series articles so their
 * performance claims either re-earn their place every Monday or
 * visibly age. All rows ship, wins and losses alike — a receipt that
 * only prints when we win is marketing, not measurement. The card
 * links to the full public run.
 *
 * Data gap renders nothing: no cache, no rows, no card.
 */
export function ArticleBenchReceipt({
  currentSlug,
  data,
}: {
  currentSlug: string;
  data: BenchReceiptData | null;
}) {
  if (!data || !data.rows || data.rows.length === 0) return null;
  const date = data.generatedAt.slice(0, 10);
  return (
    <section
      data-slot="article-bench-receipt"
      aria-label="Latest weekly benchmark result"
      className="mt-12 border-t border-border pt-8"
    >
      <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
        The numbers, re-earned {date}
      </h2>
      <ul className="mt-4 space-y-2">
        {data.rows.map((r) => (
          <li
            key={r.key}
            data-slot="article-bench-receipt-row"
            className="flex items-baseline justify-between gap-4 rounded-lg border border-border px-4 py-2.5"
          >
            <span
              className={
                r.key === "ours"
                  ? "truncate text-sm font-medium text-foreground"
                  : "truncate text-sm text-muted-foreground"
              }
            >
              {r.label}
            </span>
            <span className="shrink-0 font-mono text-xs text-muted-foreground [font-variant-numeric:tabular-nums]">
              warm {formatMs(r.warmMs)} · cold {formatMs(r.coldMs)}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">
        {/* Segments render only when present — a missing key must not
            leave "eslint · oxlint ·" husks (the data-gap rule applies
            to fragments too). The sync validates both keys, so absence
            here means a stale hand-edited cache. */}
        Full lint of {data.repo}
        {data.versions.eslint ? <> · eslint {data.versions.eslint}</> : null}
        {data.versions.oxlint ? <> · oxlint {data.versions.oxlint}</> : null} ·{" "}
        <TrackedLink
          href="https://eslint.interlace.tools/docs/benchmarks"
          event="article:bench_receipt_click"
          props={{ slug: currentSlug }}
          className="underline underline-offset-4 hover:text-foreground"
        >
          see the full weekly run
        </TrackedLink>
        .
      </p>
    </section>
  );
}

function formatMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`;
}
