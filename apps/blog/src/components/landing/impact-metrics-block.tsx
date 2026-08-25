import { NumberTicker } from "@/components/ui/number-ticker";
import { BorderBeam } from "@/components/ui/border-beam";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { cn } from "@/lib/utils";
import { SectionIndex } from "@/components/ui/section-index";

interface Stats {
  github: {
    totalStars: number;
    totalRepos: number;
    totalContributions: number;
  };
  npm: { totalDownloads: number; packageCount: number };
  devto: {
    totalViews: number;
    articleCount: number;
    totalReactions: number;
    totalComments: number;
  };
}

interface ImpactMetricsBlockProps extends React.HTMLAttributes<HTMLElement> {
  /** 1-based position in the homepage sequence — the numbered eyebrow. */
  index: number;
  stats: Stats;
  /** Stable selector for E2E tests; consumer provides — no default. */
  "data-testid"?: string;
}

const formatCompact = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
};

interface Metric {
  label: string;
  value: number;
  display: string;
  group: "code" | "writing" | "community";
}

function buildMetrics(stats: Stats): Metric[] {
  // Zero metrics are omitted, not rendered: on this surface a zero always
  // means a data gap (an unauthenticated fetch, a source not yet wired) —
  // and a first impression that says "CONTRIBUTIONS 0" reads as
  // abandonment. Same rule as the docs site's ImpactCard: a card reading
  // 0 is a claim; a missing card is a gap.
  return buildAllMetrics(stats).filter((m) => m.value > 0);
}

function buildAllMetrics(stats: Stats): Metric[] {
  return [
    {
      label: "npm downloads",
      value: stats.npm.totalDownloads,
      display: formatCompact(stats.npm.totalDownloads),
      group: "code",
    },
    {
      label: "Packages published",
      value: stats.npm.packageCount,
      display: String(stats.npm.packageCount),
      group: "code",
    },
    {
      label: "GitHub stars",
      value: stats.github.totalStars,
      display: String(stats.github.totalStars),
      group: "code",
    },
    {
      label: "Contributions",
      value: stats.github.totalContributions,
      display: formatCompact(stats.github.totalContributions),
      group: "code",
    },
    {
      label: "Articles published",
      value: stats.devto.articleCount,
      display: String(stats.devto.articleCount),
      group: "writing",
    },
    {
      label: "Article views",
      value: stats.devto.totalViews,
      display: formatCompact(stats.devto.totalViews),
      group: "writing",
    },
    {
      label: "Reactions",
      value: stats.devto.totalReactions,
      display: String(stats.devto.totalReactions),
      group: "community",
    },
    {
      label: "Comments",
      value: stats.devto.totalComments,
      display: String(stats.devto.totalComments),
      group: "community",
    },
  ];
}

export function ImpactMetricsBlock({
  index,
  stats,
  className,
  "data-testid": testId,
  ...rest
}: ImpactMetricsBlockProps) {
  const metrics = buildMetrics(stats);

  return (
    <Section
      data-slot="landing-impact-metrics"
      data-testid={testId}
      divider="bottom"
      spacing="tight"
      container="wide"
      className={cn(className)}
      {...rest}
    >
      <Container size="wide">
        <SectionIndex value={index} data-testid="impact-metrics-block-index" className="mb-3">
          Impact
        </SectionIndex>
        <h2 className="text-3xl font-semibold tracking-tight">
          The numbers behind the work
        </h2>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Cumulative totals across code, writing, and community — refreshed
          daily, every number traceable to its source.
        </p>

        <div className="relative mt-10 overflow-hidden rounded-xl border border-border bg-card p-6 sm:p-10">
          <BorderBeam size={200} duration={16} delay={4} />
          <dl className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4">
            {metrics.map((m) => (
              <div key={m.label} className="min-w-0">
                <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:text-xs">
                  {m.label}
                </dt>
                {/* Full 6-figure value where it fits (sm+); compact K/M on
                    narrow viewports so a wide number can't overflow into
                    the adjacent grid cell. text-2xl on mobile: "409.1K"
                    outgrew the text-3xl headroom the original fix left
                    (seen colliding with the neighbor at 280-375px). */}
                <dd className="mt-2 text-2xl font-semibold tabular-nums sm:text-4xl">
                  <NumberTicker
                    value={m.value}
                    startValue={0}
                    delay={0.1}
                    notation="compact"
                    className="sm:hidden"
                  />
                  <NumberTicker
                    value={m.value}
                    startValue={0}
                    delay={0.1}
                    className="hidden sm:inline"
                  />
                </dd>
              </div>
            ))}
          </dl>
          <p className="sr-only">
            Aggregate display values:{" "}
            {metrics.map((m) => `${m.label}: ${m.display}`).join(", ")}
          </p>
        </div>
      </Container>
    </Section>
  );
}
