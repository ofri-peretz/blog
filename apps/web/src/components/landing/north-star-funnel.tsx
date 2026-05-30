"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Clock,
  Compass,
  Download,
  Eye,
  FileText,
  GitCommit,
  GitPullRequest,
  Hammer,
  Heart,
  Info,
  Lightbulb,
  MessageCircle,
  MessageSquare,
  Star,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { NumberTicker } from "@/components/ui/number-ticker";
import { cn } from "@/lib/utils";

const AVG_MINUTES_PER_COMMIT = 20;
const AVG_MINUTES_PER_PR = 45;

interface NorthStarFunnelProps extends React.HTMLAttributes<HTMLElement> {
  views: number;
  downloads: number;
  reactions: number;
  comments: number;
  stars: number;
  starsBreakdown?: { name: string; stars: number; url: string }[];
  githubFollowers?: number;
  devtoFollowers?: number;
  contributions?: number;
  commits?: number;
  articles?: number;
  readingMinutes?: number;
  loading?: boolean;
  /** Stable selector for E2E tests; consumer provides — no default. */
  "data-testid"?: string;
}

interface BreakdownItem {
  label: string;
  value: number;
  Icon: LucideIcon;
  source: string;
  impact: string;
  url?: string;
}

interface FunnelStep {
  id: string;
  label: string;
  subtitle: string;
  value: number;
  subtext: string;
  textGradient: string;
  bgGradient: string;
  borderClass: string;
  Icon: LucideIcon;
  isGoal?: boolean;
  conversion: string | null;
  impactExplanation: string;
  cta?: { label: string; href: string };
  breakdown: BreakdownItem[];
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function buildSteps(props: NorthStarFunnelProps): FunnelStep[] {
  const commits = props.commits ?? 0;
  const contributions = props.contributions ?? 0;
  const prsAndReviews = Math.max(0, contributions - commits);
  const estimatedHours = Math.round(
    (commits * AVG_MINUTES_PER_COMMIT + prsAndReviews * AVG_MINUTES_PER_PR) /
      60,
  );
  const totalEffort = contributions;
  const totalExposure = props.views + props.downloads;
  const totalFollowers =
    (props.githubFollowers ?? 0) + (props.devtoFollowers ?? 0);
  const totalEngagement = props.reactions + props.comments;
  const northStar = props.stars;

  const exposureToEngagement =
    totalExposure === 0
      ? null
      : `${((totalEngagement / totalExposure) * 100).toFixed(2)}%`;
  const engagementToNorthStar =
    totalEngagement === 0
      ? null
      : `${((northStar / totalEngagement) * 100).toFixed(1)}%`;

  return [
    {
      id: "effort",
      label: "Effort",
      subtitle: "Leading Indicators",
      value: totalEffort,
      subtext: `~${estimatedHours} hours invested`,
      textGradient: "from-orange-500 to-amber-400",
      bgGradient: "from-orange-500/10 to-amber-500/10",
      borderClass: "border-orange-500/30",
      Icon: Hammer,
      conversion: null,
      impactExplanation:
        "Active development signals project health → attracts contributors → more eyes on code → increases star probability",
      breakdown: [
        {
          label: "Commits",
          value: commits,
          Icon: GitCommit,
          source: "GitHub",
          impact:
            "Regular commits demonstrate consistent improvement → developers trust actively maintained projects",
        },
        {
          label: "PRs & Reviews",
          value: prsAndReviews,
          Icon: GitPullRequest,
          source: "GitHub",
          impact:
            "PRs and reviews show the project is actively maintained → builds trust → users more likely to star",
        },
        {
          label: "Est. Hours",
          value: estimatedHours,
          Icon: Clock,
          source: "~20min/commit + ~45min/PR",
          impact: "Time invested correlates with project maturity and quality",
        },
      ],
    },
    {
      id: "exposure",
      label: "Total Exposure",
      subtitle: "Reach",
      value: totalExposure,
      subtext: "Reach creates opportunities for discovery",
      textGradient: "from-blue-500 to-cyan-400",
      bgGradient: "from-blue-500/10 to-cyan-500/10",
      borderClass: "border-blue-500/30",
      Icon: Eye,
      conversion: null,
      impactExplanation:
        "Visibility creates discovery → readers find the repo → impressed developers star it",
      breakdown: [
        {
          label: "Views",
          value: props.views,
          Icon: Eye,
          source: "Dev.to",
          impact:
            "Article views drive awareness → readers discover linked repos → increased star probability",
        },
        {
          label: "Downloads",
          value: props.downloads,
          Icon: Download,
          source: "NPM",
          impact:
            "Package downloads validate real utility → users who find value often return to star the repo",
        },
      ],
    },
    {
      id: "followers",
      label: "Followers",
      subtitle: "Network",
      value: totalFollowers,
      subtext: "Network effect amplifies reach",
      textGradient: "from-purple-500 to-violet-400",
      bgGradient: "from-purple-500/10 to-violet-500/10",
      borderClass: "border-purple-500/30",
      Icon: Users,
      conversion: null,
      impactExplanation:
        "Followers see new activity in their feed → amplifies reach → network effect drives stars",
      breakdown: [
        {
          label: "GH Followers",
          value: props.githubFollowers ?? 0,
          Icon: Users,
          source: "GitHub",
          impact:
            "GitHub followers see new repos in their feed → first to discover and star new projects",
        },
        {
          label: "Dev.to Followers",
          value: props.devtoFollowers ?? 0,
          Icon: Users,
          source: "Dev.to",
          impact:
            "Dev.to followers read new articles → discover repo links → cross-platform conversion to stars",
        },
      ],
    },
    {
      id: "engagement",
      label: "Community Engagement",
      subtitle: "Resonance",
      value: totalEngagement,
      subtext: "Active participation signals resonance",
      textGradient: "from-purple-500 to-pink-400",
      bgGradient: "from-purple-500/10 to-pink-500/10",
      borderClass: "border-purple-500/30",
      Icon: MessageCircle,
      conversion: exposureToEngagement,
      impactExplanation:
        "Community validation → builds reputation → establishes credibility → trusted projects get starred",
      breakdown: [
        {
          label: "Reactions",
          value: props.reactions,
          Icon: Heart,
          source: "Dev.to",
          impact:
            "Likes signal quality content → algorithms boost visibility → more readers discover the repo",
        },
        {
          label: "Comments",
          value: props.comments,
          Icon: MessageSquare,
          source: "Dev.to",
          impact:
            "Discussion builds community → shows author is responsive → establishes trust and authority",
        },
      ],
    },
    {
      id: "content",
      label: "Content",
      subtitle: "Knowledge Sharing",
      value: (props.articles ?? 0) + (props.readingMinutes ?? 0),
      subtext: "Original content builds thought leadership",
      textGradient: "from-emerald-500 to-emerald-400",
      bgGradient: "from-emerald-500/10 to-emerald-500/10",
      borderClass: "border-emerald-500/30",
      Icon: BookOpen,
      conversion: null,
      impactExplanation:
        "Educational content establishes expertise → readers trust recommendations → more likely to star linked projects",
      cta: { label: "View All Articles", href: "/articles" },
      breakdown: [
        {
          label: "Articles",
          value: props.articles ?? 0,
          Icon: FileText,
          source: "Dev.to + Medium",
          impact:
            "Published articles demonstrate expertise → readers explore linked repositories",
        },
        {
          label: "Reading Minutes",
          value: props.readingMinutes ?? 0,
          Icon: Clock,
          source: "Total Read Time",
          impact:
            "Time readers invest in your content correlates with depth of engagement → deeper trust → more likely to explore and star your projects",
        },
      ],
    },
    {
      id: "northstar",
      label: "North Star",
      subtitle: "Authority",
      value: northStar,
      subtext: "Peer-recognized technical value",
      textGradient: "from-amber-400 to-orange-500",
      bgGradient: "from-amber-400/10 to-orange-500/10",
      borderClass: "border-amber-500/30",
      Icon: Star,
      isGoal: true,
      conversion: engagementToNorthStar,
      impactExplanation:
        "Stars are the ultimate measure of peer-recognized technical value — demonstrates your projects resonate with the developer community",
      breakdown:
        props.starsBreakdown && props.starsBreakdown.length > 0
          ? props.starsBreakdown.map((repo) => ({
              label: repo.name,
              value: repo.stars,
              Icon: Star,
              source: "GitHub",
              url: repo.url,
              impact:
                "Each star represents a developer who found this project valuable enough to bookmark → social proof attracts more stars",
            }))
          : [
              {
                label: "GitHub Stars",
                value: props.stars,
                Icon: Star,
                source: "GitHub",
                impact:
                  "Stars are the ultimate measure of peer-recognized technical value",
              },
            ],
    },
  ];
}

export function NorthStarFunnel(props: NorthStarFunnelProps) {
  const { className, "data-testid": testId, loading, ...rest } = props;
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const steps = buildSteps(props);
  const referenceValue = steps[0]?.value || 1;

  return (
    <section
      data-slot="north-star-funnel"
      data-testid={testId}
      className={cn(
        "w-full overflow-hidden rounded-xl border border-border bg-card",
        className,
      )}
      // Forward unknown HTML attributes; we typed-pluck loading separately to
      // avoid passing it through to the DOM.
      {...(rest as React.HTMLAttributes<HTMLElement>)}
    >
      <header className="flex flex-wrap items-start justify-between gap-2 border-b border-border p-4 sm:items-center sm:p-6">
        <div className="flex items-start gap-2 sm:items-center">
          <Compass
            aria-hidden="true"
            className="mt-0.5 h-4 w-4 shrink-0 animate-pulse text-foreground sm:mt-0 sm:h-5 sm:w-5"
          />
          <div>
            <h3 className="text-sm font-semibold sm:text-base">
              North Star Impact Funnel
            </h3>
            <p className="mt-0.5 text-[10px] text-muted-foreground sm:text-xs">
              Following{" "}
              <a
                href="https://articles.sequoiacap.com/frameworks-for-product-success"
                target="_blank"
                rel="noopener noreferrer"
                className="underline-offset-4 hover:underline"
              >
                Sequoia&apos;s Framework
              </a>{" "}
              for measuring product success
            </p>
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-1 text-[10px] text-muted-foreground sm:text-xs">
          <Info aria-hidden="true" className="h-3 w-3" />
          Click to expand
        </span>
      </header>

      <ol className="relative space-y-3 p-4 sm:space-y-4 sm:p-6">
        <div
          aria-hidden="true"
          className="absolute bottom-8 left-6 top-8 -z-10 hidden w-0.5 bg-gradient-to-b from-orange-300 via-purple-300 to-amber-300 sm:block dark:from-orange-700 dark:via-purple-700 dark:to-amber-700"
        />

        {steps.map((step, index) => {
          const isExpanded = expanded.has(step.id);
          const progressWidth =
            index === 0
              ? 100
              : Math.max(5, (step.value / referenceValue) * 100);

          return (
            <li key={step.id} className="relative">
              <div className="group flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
                <div className="relative z-10 hidden shrink-0 sm:flex">
                  <div
                    className={cn(
                      "flex h-12 w-12 items-center justify-center rounded-full border-2 border-background bg-muted shadow-sm transition-all duration-300 group-hover:scale-110",
                      step.isGoal &&
                        "ring-2 ring-amber-400 ring-offset-2 ring-offset-background",
                    )}
                  >
                    <step.Icon
                      aria-hidden="true"
                      className={cn(
                        "h-6 w-6 transition-colors",
                        step.isGoal
                          ? "text-amber-500"
                          : "text-muted-foreground group-hover:text-foreground",
                      )}
                    />
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => toggle(step.id)}
                    aria-expanded={isExpanded}
                    aria-controls={`funnel-breakdown-${step.id}`}
                    className={cn(
                      "relative w-full cursor-pointer overflow-hidden rounded-lg border bg-gradient-to-br p-3 text-left transition-all duration-300 hover:shadow-md sm:rounded-xl sm:p-4",
                      step.bgGradient,
                      step.borderClass,
                    )}
                  >
                    <div className="mb-2 flex flex-col gap-1.5 sm:mb-3 sm:flex-row sm:items-start sm:justify-between sm:gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                          <span className="text-base font-bold sm:text-lg">
                            {step.label}
                          </span>
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] sm:text-xs",
                              step.isGoal
                                ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                                : "bg-muted text-muted-foreground",
                            )}
                          >
                            {step.isGoal ? "🎯 Goal" : step.subtitle}
                          </span>
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-[10px] text-muted-foreground sm:mt-1 sm:line-clamp-none sm:text-xs">
                          {step.subtext}
                        </p>
                        {!step.isGoal && (
                          <p className="mt-1.5 flex items-start gap-1 text-[10px] italic leading-relaxed text-muted-foreground sm:mt-2 sm:gap-1.5 sm:text-[11px]">
                            <Zap
                              aria-hidden="true"
                              className="mt-0.5 h-2.5 w-2.5 shrink-0 text-amber-500 sm:h-3 sm:w-3"
                            />
                            {step.impactExplanation}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end sm:gap-0">
                        <div
                          className={cn(
                            "bg-clip-text bg-gradient-to-r text-xl font-bold tabular-nums text-transparent sm:text-2xl md:text-3xl",
                            step.textGradient,
                          )}
                        >
                          {loading ? (
                            <span className="animate-pulse">…</span>
                          ) : (
                            <NumberTicker
                              value={step.value}
                              startValue={0}
                              duration={2}
                            />
                          )}
                        </div>
                        {isExpanded ? (
                          <ChevronUp
                            aria-hidden="true"
                            className="h-3.5 w-3.5 text-muted-foreground sm:mt-1 sm:h-4 sm:w-4"
                          />
                        ) : (
                          <ChevronDown
                            aria-hidden="true"
                            className="h-3.5 w-3.5 text-muted-foreground sm:mt-1 sm:h-4 sm:w-4"
                          />
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div
                        id={`funnel-breakdown-${step.id}`}
                        className="mt-3 overflow-hidden border-t border-border pt-3"
                      >
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                          {step.breakdown.map((item) => (
                            <div
                              key={item.label}
                              className="flex items-center gap-2 rounded-lg bg-background/50 p-2"
                            >
                              <item.Icon
                                aria-hidden="true"
                                className="h-4 w-4 text-muted-foreground"
                              />
                              <div className="flex-1">
                                <div className="flex items-center gap-1 text-sm font-semibold tabular-nums">
                                  {formatNumber(item.value)}
                                  <span
                                    title={item.impact}
                                    className="cursor-help"
                                  >
                                    <Info
                                      aria-hidden="true"
                                      className="h-3 w-3 text-muted-foreground hover:text-foreground"
                                    />
                                  </span>
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                  {item.label}
                                </div>
                              </div>
                              <span className="text-[9px] text-muted-foreground">
                                {item.source}
                              </span>
                            </div>
                          ))}
                        </div>
                        {step.cta && (
                          <div className="mt-3 text-center">
                            <Link
                              href={step.cta.href}
                              className="inline-flex items-center gap-1.5 text-sm font-medium underline-offset-4 hover:underline"
                            >
                              {step.cta.label}
                              <ArrowRight
                                aria-hidden="true"
                                className="h-4 w-4"
                              />
                            </Link>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          "h-full rounded-full bg-gradient-to-r transition-all duration-1000 ease-out",
                          step.textGradient,
                        )}
                        style={{ width: `${progressWidth}%` }}
                      />
                    </div>
                  </button>
                </div>

                {step.conversion && index > 0 && (
                  <div className="absolute -top-3 left-[3.25rem] z-10 hidden sm:block">
                    <div className="flex items-center gap-1 rounded-full border border-border bg-background px-2 py-1 text-[10px] text-muted-foreground shadow-sm">
                      <ArrowDown aria-hidden="true" className="h-3 w-3" />
                      {step.conversion} conversion
                    </div>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <footer className="flex items-center justify-center gap-2 border-t border-border p-4 text-center text-xs text-muted-foreground sm:p-6">
        <Lightbulb aria-hidden="true" className="h-4 w-4" />
        <span>
          Metrics show how effort and exposure convert into lasting authority
        </span>
      </footer>
    </section>
  );
}
