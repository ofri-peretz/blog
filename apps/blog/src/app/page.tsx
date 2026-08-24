import type { Metadata } from "next";
import Link from "next/link";
import { HeroBackdrop } from "@/components/home/hero-backdrop";
import { buttonVariants } from "@/components/ui/button-variants";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Agenda } from "@/components/landing/agenda";
import { FeaturedProject } from "@/components/landing/featured-project";
import { WorkExperience } from "@/components/landing/work-experience";
import { DevToArticles } from "@/components/landing/devto-articles";
import { ImpactMetricsBlock } from "@/components/landing/impact-metrics-block";
import { FloatingToc } from "@/components/floating-toc";
import { getAllArticles } from "@/lib/source";
import numbers from "@/data/interlace-numbers.json";

// Brand decision (2026-08-24): the page sells a leader with an agenda —
// ideas, shipped products, impact — not a developer's skill inventory.
// Stack and FAQ are gone; About + Philosophy merged into Agenda; Writing
// moved above Experience because the ideas ARE the product here.
const TOC_ITEMS = [
  { id: "impact", label: "Impact" },
  { id: "agenda", label: "Agenda" },
  { id: "featured", label: "Featured" },
  { id: "writing", label: "Writing" },
  { id: "experience", label: "Experience" },
];

export const metadata: Metadata = {
  title: "Ofri Peretz — Engineering Leader & Open Source Creator",
  description:
    "Engineering leader building the trust layer for machine-written software. Creator of the Interlace ESLint Ecosystem.",
};

interface HomepageStats {
  github: {
    totalStars: number;
    totalForks: number;
    totalRepos: number;
    followers: number;
    recentCommits: number;
    totalContributions: number;
    starsBreakdown: { name: string; stars: number; url: string }[];
  };
  npm: { totalDownloads: number; packageCount: number };
  devto: {
    totalViews: number;
    followers: number;
    articleCount: number;
    totalReactions: number;
    totalComments: number;
  };
}

async function fetchStats(): Promise<HomepageStats | null> {
  try {
    // VERCEL_URL is the per-deployment URL (sits behind Deployment
    // Protection → 401 for internal fetches). Prefer the public production
    // host so the homepage stats card actually renders.
    const base = process.env.NEXT_PUBLIC_SITE_URL
      ? process.env.NEXT_PUBLIC_SITE_URL
      : process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : `http://localhost:${process.env.PORT || 3001}`;
    const res = await fetch(`${base}/api/homepage-stats`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) {
      console.error(`[homepage] stats → ${res.status}`);
      return null;
    }
    return (await res.json()) as HomepageStats;
  } catch (error) {
    console.error("[homepage] stats fetch failed:", error);
    return null;
  }
}

export default async function HomePage() {
  const stats = await fetchStats();

  return (
    <main id="main">
      <Section
        as="header"
        data-slot="home-hero"
        spacing="spacious"
        divider="bottom"
        className="relative overflow-hidden"
      >
        <HeroBackdrop />
        <Container size="content" className="relative">
          <p className="mb-4 text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Engineering Leader & Open Source Creator
          </p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            Ofri Peretz
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
            Most production code will soon be written by machines — I build
            the trust layer for it. Architect of the{" "}
            <Link
              href="https://eslint.interlace.tools"
              className="text-foreground underline-offset-4 hover:underline"
            >
              Interlace ESLint Ecosystem
            </Link>{" "}
            — {numbers.rules.total} rules across {numbers.plugins.total}{" "}
            specialized plugins, built for the AI/agentic era.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="https://eslint.interlace.tools"
              className={buttonVariants({ variant: "default", size: "lg" })}
            >
              Explore the docs
            </Link>
            <Link
              href="/articles"
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              Read the writing
            </Link>
          </div>
        </Container>
      </Section>

      <FloatingToc items={TOC_ITEMS} />
      {stats && <ImpactMetricsBlock id="impact" stats={stats} />}
      <Agenda id="agenda" />
      <FeaturedProject
        id="featured"
        stars={stats?.github.totalStars}
        downloads={stats?.npm.totalDownloads}
      />
      <DevToArticles id="writing" articles={getAllArticles().slice(0, 6)} />
      <WorkExperience id="experience" />
    </main>
  );
}
