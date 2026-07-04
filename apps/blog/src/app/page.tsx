import type { Metadata } from "next";
import Link from "next/link";
import { HeroBackdrop } from "@/components/home/hero-backdrop";
import { buttonVariants } from "@/components/ui/button-variants";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { About } from "@/components/landing/about";
import { Skills } from "@/components/landing/skills";
import { FeaturedProject } from "@/components/landing/featured-project";
import { Faq } from "@/components/landing/faq";
import { Philosophy } from "@/components/landing/philosophy";
import { WorkExperience } from "@/components/landing/work-experience";
import { DevToArticles } from "@/components/landing/devto-articles";
import { ImpactMetricsBlock } from "@/components/landing/impact-metrics-block";
import { FloatingToc } from "@/components/floating-toc";
import { getAllArticles } from "@/lib/source";

const TOC_ITEMS = [
  { id: "impact", label: "Impact" },
  { id: "about", label: "About" },
  { id: "featured", label: "Featured" },
  { id: "experience", label: "Experience" },
  { id: "philosophy", label: "Philosophy" },
  { id: "writing", label: "Writing" },
  { id: "stack", label: "Stack" },
  { id: "faq", label: "FAQ" },
];

export const metadata: Metadata = {
  title: "Ofri Peretz — Engineering Leader & Open Source Creator",
  description:
    "Building Products That Matter • Engineering Leadership • Open-Source Contributor. Creator of the Interlace ESLint Ecosystem.",
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
            Building Products That Matter. Architect of the{" "}
            <Link
              href="https://eslint.interlace.tools"
              className="text-foreground underline-offset-4 hover:underline"
            >
              Interlace ESLint Ecosystem
            </Link>{" "}
            — 332+ security rules across 18 specialized plugins, designed for
            the AI/Agentic era.
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
      <About id="about" />
      <FeaturedProject
        id="featured"
        stars={stats?.github.totalStars}
        downloads={stats?.npm.totalDownloads}
      />
      <WorkExperience id="experience" />
      <Philosophy id="philosophy" />
      <DevToArticles id="writing" articles={getAllArticles().slice(0, 6)} />
      <Skills id="stack" />
      <Faq id="faq" />
    </main>
  );
}
