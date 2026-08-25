import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getAllArticles,
  getAllArticleSlugs,
  getArticleBySlug,
  getSeriesContext,
  isPublished,
} from "@/lib/source";
import { computeThreads } from "@/lib/corpus-links";
import { ArticleThreads, type ThreadItem } from "@/components/article-threads";
import { SeriesBanner, SeriesPager } from "@/components/series-nav";
import {
  MarkdownArticle,
  renderMarkdownWithToc,
} from "@/components/markdown-article";
import { FloatingToc } from "@/components/floating-toc";
import { TrackedLink } from "@/components/tracked-link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { localCover } from "@/lib/cover";
import { Container } from "@/components/ui/container";
import { buttonVariants } from "@/components/ui/button-variants";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return getAllArticleSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { slug } = await props.params;
  const article = getArticleBySlug(slug);
  if (!article) return {};
  const fm = article.frontmatter;
  const modified = fm.edited_at ?? undefined;
  return {
    title: fm.title,
    description: fm.description,
    // A queued article is on disk and reachable on purpose: dev.to's
    // canonical_url points here, so this URL has to resolve the instant the
    // publisher fires. But reachable is not released — until `published`
    // flips true, keep it out of the index instead of letting crawlers find
    // the release queue. Paired with the getAllArticles() filter in sitemap.ts.
    ...(isPublished(fm) ? {} : { robots: { index: false, follow: false } }),
    alternates: {
      canonical: fm.canonical_url ?? `https://ofriperetz.dev/articles/${slug}`,
    },
    // Social cards want the 1200x630 OG ratio: prefer social_image (the
    // authored /cdn/blog-cover-image/<slug>-og.jpg), fall back to the
    // 1000x420 dev.to cover, then the site-wide /og card. The legacy
    // Satori routes (/og/article, /og/cover) are retired — authored
    // covers are canonical.
    openGraph: {
      title: fm.title,
      description: fm.description,
      type: "article",
      publishedTime: fm.published_at,
      modifiedTime: modified,
      tags: fm.tags,
      images: [
        fm.social_image ??
          fm.cover_image ??
          `/og?title=${encodeURIComponent(fm.title)}&description=${encodeURIComponent(fm.description)}`,
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: fm.title,
      description: fm.description,
      images: [
        fm.social_image ??
          fm.cover_image ??
          `/og?title=${encodeURIComponent(fm.title)}&description=${encodeURIComponent(fm.description)}`,
      ],
    },
  };
}

function formatDate(iso?: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function ArticlePage(props: PageProps) {
  const { slug } = await props.params;
  const article = getArticleBySlug(slug);
  if (!article) notFound();

  const { frontmatter: fm } = article;
  const series = getSeriesContext(slug);
  // The corpus is published-only (getAllArticles filters), so the Threads
  // section can never surface the release queue. Static pages make the
  // O(corpus²) whole-graph scan a build-time cost, not a request-time one.
  const corpus = getAllArticles();
  const threads = computeThreads(slug, article.body, corpus);
  const toThreadItem = (s: string): ThreadItem => {
    const a = corpus.find((c) => c.slug === s)!;
    return { slug: s, title: a.frontmatter.title, series: a.frontmatter.series };
  };
  // Render once: the pipeline emits the HTML and collects the h2 TOC in
  // the same pass, so Shiki never runs twice per page.
  const { html: renderedHtml, toc } = await renderMarkdownWithToc(
    article.body,
  );
  const url = fm.canonical_url ?? `https://ofriperetz.dev/articles/${slug}`;
  const image =
    fm.social_image ??
    fm.cover_image ??
    `https://ofriperetz.dev/og?title=${encodeURIComponent(fm.title)}&description=${encodeURIComponent(fm.description)}`;

  const blogPostingSchema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: fm.title,
    description: fm.description,
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    image,
    datePublished: fm.published_at,
    dateModified: fm.edited_at ?? fm.published_at,
    keywords: fm.tags.join(", "),
    author: {
      "@type": "Person",
      name: fm.author?.name ?? "Ofri Peretz",
      url: "https://ofriperetz.dev",
    },
    publisher: {
      "@type": "Person",
      name: "Ofri Peretz",
      url: "https://ofriperetz.dev",
    },
  };

  return (
    <main id="main" data-slot="article-page">
      <script
        type="application/ld+json"
        // The BlogPosting schema is a deterministic JSON serialization of
        // server-side frontmatter — not user input. Standard SEO pattern.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(blogPostingSchema) }}
      />
      <Container size="prose" className="py-12">
        <nav
          aria-label="Breadcrumb"
          className="mb-6 text-sm text-muted-foreground"
        >
          <Link
            href="/articles"
            className="inline-flex min-h-6 min-w-6 items-center justify-center hover:text-foreground"
          >
            ← All articles
          </Link>
        </nav>
        {fm.cover_image && (
          <div
            data-slot="article-cover"
            className="mb-8 overflow-hidden rounded-lg border border-border"
          >
            {/* next/image, not <img>: routes through Vercel's optimizer so the
                cover is served as AVIF/WebP at the viewer's width. Measured on a
                real cover: 245 KB PNG → 43 KB AVIF. `priority` keeps it eager —
                this is the LCP element.

                `fetchPriority` is set explicitly and is NOT redundant with
                `priority`. Measured in production (4x CPU / Slow 4G, desktop):
                `priority` alone emitted the preload link but left both the link
                and the <img> with no fetchpriority attribute, so Chrome
                scheduled the request at Low and it sat queued — 533 ms of the
                863 ms LCP was "load delay", against a 2 ms download. The image
                was never slow; it was merely late. Removing this attribute puts
                that half-second back. */}
            <Image
              src={localCover(fm.cover_image)}
              alt=""
              width={1000}
              height={420}
              priority
              fetchPriority="high"
              sizes="(max-width: 768px) 100vw, 768px"
              className="w-full object-cover"
            />
          </div>
        )}
        <header className="mb-10">
          <h1 className="text-4xl font-bold tracking-tight">{fm.title}</h1>
          <p className="mt-3 text-lg text-muted-foreground">{fm.description}</p>
          <div className="mt-6 flex items-center gap-3">
            <Avatar className="size-10 shrink-0 ring-1 ring-border">
              <AvatarImage
                src="/ofri-profile.png"
                alt={fm.author?.name ?? "Ofri Peretz"}
                loading="eager"
                decoding="async"
              />
              <AvatarFallback className="text-xs">OP</AvatarFallback>
            </Avatar>
            <div className="flex flex-col text-sm leading-tight">
              <span className="font-medium text-foreground">
                {fm.author?.name ?? "Ofri Peretz"}
              </span>
              <span className="text-muted-foreground">
                Engineering Leader & Open Source Creator
              </span>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            {fm.published_at && (
              <time dateTime={fm.published_at}>
                {formatDate(fm.published_at)}
              </time>
            )}
            {fm.edited_at && fm.edited_at !== fm.published_at && (
              <span>
                · Updated{" "}
                <time dateTime={fm.edited_at}>{formatDate(fm.edited_at)}</time>
              </span>
            )}
            <span>· {article.readingTimeMinutes} min read</span>
            {fm.tags.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {fm.tags.map((tag) => (
                  <li key={tag}>
                    <Link
                      href={`/articles?tag=${encodeURIComponent(tag)}`}
                      className="inline-flex min-h-6 min-w-6 items-center justify-center rounded bg-muted px-2 text-xs hover:bg-muted/70"
                    >
                      #{tag}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </header>

        <SeriesBanner series={series} className="mb-8" />

        {/* Jump menu only where it earns its place — short pieces with one
            or two sections don't need a TOC hovering over them. */}
        {toc.length >= 3 && <FloatingToc items={toc} />}

        <MarkdownArticle body={article.body} renderedHtml={renderedHtml} />

        <SeriesPager series={series} currentSlug={slug} className="mt-12" />

        <ArticleThreads
          currentSlug={slug}
          drawsOn={threads.drawsOn.map(toThreadItem)}
          pulledBy={threads.pulledBy.map(toThreadItem)}
        />

        <DevToCallout
          slug={slug}
          devtoUrl={fm.devto_url}
          username={fm.author?.username ?? "ofri-peretz"}
        />

        <footer className="mt-12 flex flex-wrap items-center gap-3 border-t border-border pt-8">
          <Link
            href="/articles"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            ← All articles
          </Link>
          {fm.devto_url && (
            <a
              href={fm.devto_url}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              Read on dev.to ↗
            </a>
          )}
        </footer>
      </Container>
    </main>
  );
}

function DevToCallout({
  slug,
  devtoUrl,
  username,
}: {
  slug: string;
  devtoUrl?: string;
  username: string;
}) {
  // Funnel decision (2026-08-24): the PRIMARY action after reading routes
  // to OUR product surface, not to a third-party platform. The old primary
  // was "Follow on dev.to" — sending the best-converted readers off-site
  // at the exact moment they were most convinced. dev.to stays as the
  // secondary follow/discussion link.
  const profileUrl = `https://dev.to/${username}`;
  return (
    <aside
      data-slot="devto-callout"
      className="mt-12 rounded-lg border border-border bg-muted/30 p-6"
    >
      <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
        Keep going
      </p>
      <p className="mt-2 text-base text-foreground">
        Everything here ships as runnable lint rules — try them live in the
        playground, or start with the docs. New pieces land on{" "}
        <a
          href={profileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium underline underline-offset-2 hover:text-foreground/80"
        >
          dev.to/{username}
        </a>
        .
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <TrackedLink
          href="https://eslint.interlace.tools/play"
          event="article:playground_cta_click"
          props={{ slug }}
          className={buttonVariants({ variant: "default", size: "sm" })}
        >
          Try the rules in the playground ↗
        </TrackedLink>
        <a
          href={profileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          Follow on dev.to ↗
        </a>
        {devtoUrl && (
          <a
            href={devtoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Discuss on dev.to ↗
          </a>
        )}
      </div>
    </aside>
  );
}
