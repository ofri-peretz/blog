import Link from "next/link";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { cn } from "@/lib/utils";

export interface DevToArticleEntry {
  slug: string;
  readingTimeMinutes: number;
  frontmatter: {
    title: string;
    description: string;
    published_at?: string;
    reactions?: number;
    comments?: number;
    cover_image?: string | null;
  };
}

interface DevToArticlesProps extends React.HTMLAttributes<HTMLElement> {
  /** Articles to render — page passes via `getAllArticles().slice(0, 6)`. Required so the
   *  component stays presentational and Storybook-friendly (the `fs` import that
   *  `getAllArticles` uses doesn't bundle for browser-side stories). */
  articles: DevToArticleEntry[];
  /** Stable selector for E2E tests; consumer provides — no default. */
  "data-testid"?: string;
}

function formatDate(iso?: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function DevToArticles({
  articles,
  className,
  "data-testid": testId,
  ...rest
}: DevToArticlesProps) {
  if (articles.length === 0) return null;

  return (
    <Section
      data-slot="landing-devto-articles"
      data-testid={testId}
      divider="bottom"
      spacing="tight"
      className={cn(className)}
      {...rest}
    >
      <Container size="content">
        <div className="mb-8 flex items-baseline justify-between">
          <div>
            <p className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Writing
            </p>
            <h2 className="text-3xl font-semibold tracking-tight">
              Latest articles
            </h2>
          </div>
          <Link
            href="/articles"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            View all →
          </Link>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2">
          {articles.map((article) => {
            const reactions =
              article.frontmatter.reactions !== undefined &&
              article.frontmatter.reactions > 0
                ? article.frontmatter.reactions
                : null;
            const comments =
              article.frontmatter.comments !== undefined &&
              article.frontmatter.comments > 0
                ? article.frontmatter.comments
                : null;
            const cover = article.frontmatter.cover_image ?? null;
            return (
              <li key={article.slug}>
                <Link
                  href={`/articles/${article.slug}`}
                  className="group flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card transition-colors hover:bg-muted/40"
                >
                  {cover ? (
                    // Raw <img> matches the article page (next.config has
                    // no remotePatterns for dev.to media). 16:9 keeps CLS=0.
                    <div
                      data-slot="article-card-cover"
                      className="aspect-video w-full overflow-hidden bg-muted"
                    >
                      <img
                        src={cover}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                      />
                    </div>
                  ) : (
                    <div
                      aria-hidden
                      data-slot="article-card-cover-fallback"
                      className="flex aspect-video w-full items-center justify-center bg-linear-to-br from-muted via-muted/70 to-muted/40 px-6 text-center"
                    >
                      <span className="line-clamp-3 text-sm font-medium text-muted-foreground">
                        {article.frontmatter.title}
                      </span>
                    </div>
                  )}
                  <div className="flex flex-1 flex-col p-5">
                    <h3 className="font-medium leading-snug group-hover:underline">
                      {article.frontmatter.title}
                    </h3>
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                      {article.frontmatter.description}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      {article.frontmatter.published_at && (
                        <time dateTime={article.frontmatter.published_at}>
                          {formatDate(article.frontmatter.published_at)}
                        </time>
                      )}
                      <span>· {article.readingTimeMinutes} min</span>
                      {reactions !== null && <span>· ❤ {reactions}</span>}
                      {comments !== null && <span>· 💬 {comments}</span>}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </Container>
    </Section>
  );
}
