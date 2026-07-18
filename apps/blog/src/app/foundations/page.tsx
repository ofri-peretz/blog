// /foundations — the timeless hub page for the Foundations arc.
//
// Reading order, titles, and tiers mirror `agents/footprint/article-graph.ts`
// (the single source of truth for arc ordering). Adding or reordering a
// chapter happens THERE first; this page follows. The hooks are written for
// this page — they are not the articles' frontmatter descriptions.
//
// Fully static: no data fetching, prerendered at build time. Articles in the
// arc may not be live yet (published: false) — the links are intentional and
// flip with the same release that publishes the articles.

import Link from "next/link";
import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "The Foundations Series — How to Trust a Number",
  description:
    "The full Foundations arc in reading order — 19 chapters on the statistics and security vocabulary behind every benchmark, severity score, and leaderboard.",
  alternates: {
    canonical: "https://ofriperetz.dev/foundations",
  },
  openGraph: {
    title: "The Foundations Series — How to Trust a Number",
    description:
      "19 chapters, one question: how do you come to trust a number? Read in order, bookmark whole.",
    type: "website",
  },
};

type Tier = "T0" | "T1";

interface Chapter {
  slug: string;
  title: string;
  tier: Tier;
  hook: string;
}

const TIER_LABEL: Record<Tier, string> = {
  T0: "foundations",
  T1: "vocabulary",
};

// Arc order 1–19 from article-graph.ts. Do not reorder here.
const CHAPTERS: Chapter[] = [
  {
    slug: "confusion-matrix-tp-fp-fn-tn",
    title: "Confusion matrix",
    tier: "T0",
    hook: "Four counts sit under every detection claim. If you can't name them, you can't argue with the metric.",
  },
  {
    slug: "precision-recall-f1-for-static-analysis",
    title: "Precision, recall, F1",
    tier: "T1",
    hook: "What the four counts collapse into — and what each summary quietly throws away.",
  },
  {
    slug: "base-rate-problem-explained",
    title: "Base rate problem",
    tier: "T0",
    hook: "A 95%-accurate scanner that's usually wrong when it fires. Prevalence does that, and nobody prints it.",
  },
  {
    slug: "bias-in-measurement",
    title: "Bias in measurement",
    tier: "T0",
    hook: "How a measurement lies while everyone involved is being honest.",
  },
  {
    slug: "goodharts-law-explained",
    title: "Goodhart's Law",
    tier: "T0",
    hook: "Point a target at a number and watch the number stop meaning anything.",
  },
  {
    slug: "reproducibility-vs-replicability",
    title: "Reproducibility vs replicability",
    tier: "T0",
    hook: "Same data, same result is table stakes. New data, same claim is where trust starts.",
  },
  {
    slug: "sample-size-and-statistical-power",
    title: "Sample size & power",
    tier: "T0",
    hook: "A benchmark too small to detect the difference it reports isn't evidence. How many cases is enough.",
  },
  {
    slug: "statistical-significance-p-value",
    title: "p-values & significance",
    tier: "T0",
    hook: "What a p-value actually says — which is less than you think, and still worth having.",
  },
  {
    slug: "ranking-vs-measuring",
    title: "Ranking vs measuring",
    tier: "T0",
    hook: "A leaderboard is an ordering, not a measurement. First place says nothing about the gap.",
  },
  {
    slug: "inter-rater-agreement-cohens-kappa",
    title: "Cohen's κ & inter-rater agreement",
    tier: "T0",
    hook: "Two raters agree 80% of the time — chance alone gets you most of the way there. κ subtracts the freebie.",
  },
  {
    slug: "valid-vs-reliable-metrics",
    title: "Valid vs reliable metrics",
    tier: "T0",
    hook: "A metric can give the same wrong answer every time. Consistent is not correct.",
  },
  {
    slug: "proxy-metrics",
    title: "Proxy metrics",
    tier: "T0",
    hook: "Downloads, stars, views — you're not measuring the thing, you're measuring its shadow.",
  },
  {
    slug: "composite-scores-and-weighting",
    title: "Composite scores & weighting",
    tier: "T0",
    hook: "One score means someone chose the weights. Find them before you trust the total.",
  },
  {
    slug: "ground-truth-in-security-testing",
    title: "Ground truth",
    tier: "T1",
    hook: "Every benchmark has an answer key, and a person wrote it. “Correct” is a decision before it's a fact.",
  },
  {
    slug: "cvss-scores-explained",
    title: "CVSS scores",
    tier: "T1",
    hook: "What's inside a severity score — and why a 9.1 can still be the wrong thing to fix first.",
  },
  {
    slug: "cwe-taxonomy-explained",
    title: "CWE taxonomy",
    tier: "T1",
    hook: "The weakness tree every scanner cites. Counting IDs without the hierarchy compares parents to their own children.",
  },
  {
    slug: "owasp-top-10-explained",
    title: "OWASP Top 10",
    tier: "T1",
    hook: "An awareness document, not a checklist — the difference changes what “covered” is allowed to mean.",
  },
  {
    slug: "taint-vs-heuristic-detection",
    title: "Taint vs heuristic detection",
    tier: "T1",
    hook: "Two ways a tool decides code is dangerous: follow the data, or match the shape. They fail differently.",
  },
  {
    slug: "static-analysis-vs-sast-vs-linting",
    title: "Static analysis vs SAST vs linting",
    tier: "T1",
    hook: "Three names for reading code without running it. Where the categories end and the marketing begins.",
  },
];

export default function FoundationsPage() {
  return (
    <main id="main" data-slot="foundations-page">
      <Container size="content" className="py-16">
        <header className="mb-12">
          <h1 className="text-4xl font-bold tracking-tight">
            The Foundations Series
          </h1>
          <p className="mt-3 text-muted-foreground">
            Every benchmark, severity score, and leaderboard ends in a number
            someone wants you to trust. This series walks the whole chain: what
            the counts are, what they summarize, why context changes them, how
            measurement lies, who wrote the answer key, and how numbers turn
            into verdicts. Read it in order — each chapter ends with the
            question the next one answers.
          </p>
        </header>

        <ol
          data-slot="foundations-arc"
          className="divide-y divide-border border-y border-border"
        >
          {CHAPTERS.map((chapter, idx) => (
            <li key={chapter.slug} className="flex gap-4 py-5">
              <span
                aria-hidden
                className="w-7 shrink-0 pt-0.5 text-right text-sm font-medium tabular-nums text-muted-foreground"
              >
                {idx + 1}
              </span>
              <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/articles/${chapter.slug}`}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {chapter.title}
                  </Link>
                  <Badge variant="outline">{TIER_LABEL[chapter.tier]}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{chapter.hook}</p>
              </div>
            </li>
          ))}
        </ol>

        <footer className="mt-10 text-sm text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">foundations</span> =
            the statistics of measurement itself.{" "}
            <span className="font-medium text-foreground">vocabulary</span> =
            the security and static-analysis terms the measurements are about.
            Both are written to be timeless — no tool versions, no news pegs.
          </p>
        </footer>
      </Container>
    </main>
  );
}
