import Link from "next/link";
import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { ArticleCard } from "@/components/ui/article-card";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { localCover } from "@/lib/cover";
import { getAllArticles } from "@/lib/source";
import { CorpusMap, type CorpusPoint } from "@/components/corpus-map";

const PAGE_SIZE = 12;

interface PageProps {
  searchParams: Promise<{ page?: string; tag?: string }>;
}

// Note: `export const revalidate` has no effect here — awaiting `searchParams`
// opts the route out of the full route cache entirely. Edge caching for this
// page is set via a Cache-Control header on /articles in next.config.ts.

export const metadata: Metadata = {
  // Bare page name — the root layout's title template appends "— Ofri
  // Peretz"; hard-coding it here doubled the suffix in the tab title.
  title: "Articles",
  description:
    "Engineering writing on JavaScript static analysis, ESLint, security, and AI-native developer tooling.",
  alternates: {
    canonical: "https://ofriperetz.dev/articles",
  },
};

function parsePage(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? "1", 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

export default async function ArticlesPage(props: PageProps) {
  const { page: rawPage, tag } = await props.searchParams;
  const page = parsePage(rawPage);
  const all = getAllArticles();
  const filtered = tag
    ? all.filter((a) => a.frontmatter.tags.includes(tag))
    : all;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const articles = filtered.slice(start, start + PAGE_SIZE);
  const baseHref = tag
    ? `/articles?tag=${encodeURIComponent(tag)}`
    : "/articles";
  const pageHref = (p: number): string =>
    tag
      ? `/articles?tag=${encodeURIComponent(tag)}&page=${p}`
      : `/articles?page=${p}`;

  // The map shows the WHOLE corpus regardless of tag filter or page — it
  // is the territory view; the grid below is the filtered, paginated one.
  const mapPoints: CorpusPoint[] = all
    .filter((a) => a.frontmatter.published_at)
    .map((a) => ({
      slug: a.slug,
      title: a.frontmatter.title,
      series: a.frontmatter.series ?? null,
      date: (a.frontmatter.published_at ?? "").slice(0, 10),
      minutes: a.readingTimeMinutes,
    }));

  return (
    <main id="main" data-slot="articles-page">
      <Container size="content" className="py-16">
        <header className="mb-12">
          <h1 className="text-4xl font-bold tracking-tight">Articles</h1>
          <p className="mt-3 text-muted-foreground">
            Engineering writing on static analysis, ESLint, security, and
            AI-native developer tooling.
          </p>
          {tag && (
            <p className="mt-4 text-sm">
              Filtered by tag <span className="font-medium">#{tag}</span> ·{" "}
              <Link
                href="/articles"
                className="text-muted-foreground underline-offset-4 hover:underline"
              >
                clear filter
              </Link>
            </p>
          )}
          <CorpusMap points={mapPoints} className="mt-8" />
        </header>

        {articles.length === 0 ? (
          <div
            data-slot="articles-empty"
            className="rounded-lg border border-border bg-card p-10 text-center"
          >
            <p className="text-lg font-medium">No articles yet</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {tag
                ? `Nothing tagged "${tag}". Try clearing the filter or browsing all articles.`
                : "New writing lands every couple of weeks — check back soon."}
            </p>
            {tag && (
              <Link
                href="/articles"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "mt-6",
                )}
              >
                See all articles
              </Link>
            )}
          </div>
        ) : (
          <>
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {articles.map((article, idx) => (
                <li key={article.slug}>
                  <ArticleCard
                    title={article.frontmatter.title}
                    description={article.frontmatter.description}
                    href={`/articles/${article.slug}`}
                    external={false}
                    imageUrl={localCover(article.frontmatter.cover_image ?? undefined)}
                    tags={article.frontmatter.tags}
                    publishedAt={article.frontmatter.published_at}
                    meta={{
                      readingTimeMinutes:
                        article.frontmatter.reading_time_minutes ??
                        article.readingTimeMinutes,
                      reactions: article.frontmatter.reactions,
                      comments: article.frontmatter.comments,
                      views: article.frontmatter.views,
                    }}
                    // First card on the first page is the LCP element.
                    priority={currentPage === 1 && idx === 0}
                  />
                </li>
              ))}
            </ul>

            {totalPages > 1 && (
              <nav
                aria-label="Articles pagination"
                data-slot="articles-pagination"
                className="mt-12 flex items-center justify-between"
              >
                {currentPage > 1 ? (
                  <Link
                    href={
                      currentPage - 1 === 1
                        ? baseHref
                        : pageHref(currentPage - 1)
                    }
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                    })}
                    rel="prev"
                  >
                    ← Previous
                  </Link>
                ) : (
                  <span />
                )}
                <p className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </p>
                {currentPage < totalPages ? (
                  <Link
                    href={pageHref(currentPage + 1)}
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                    })}
                    rel="next"
                  >
                    Next →
                  </Link>
                ) : (
                  <span />
                )}
              </nav>
            )}
          </>
        )}
      </Container>
    </main>
  );
}
