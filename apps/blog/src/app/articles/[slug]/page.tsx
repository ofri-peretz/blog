import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAllArticleSlugs, getArticleBySlug } from "@/lib/source";
import { MarkdownArticle } from "@/components/markdown-article";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
    alternates: {
      canonical: fm.canonical_url ?? `https://ofriperetz.dev/articles/${slug}`,
    },
    openGraph: {
      title: fm.title,
      description: fm.description,
      type: "article",
      publishedTime: fm.published_at,
      modifiedTime: modified,
      tags: fm.tags,
      // Social cards want the 1200x630 OG ratio: prefer social_image
      // (/og/article), fall back to the 1000x420 dev.to cover, then the route.
      images: [fm.social_image ?? fm.cover_image ?? `/og/article/${slug}`],
    },
    twitter: {
      card: "summary_large_image",
      title: fm.title,
      description: fm.description,
      images: [fm.social_image ?? fm.cover_image ?? `/og/article/${slug}`],
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
  const url = fm.canonical_url ?? `https://ofriperetz.dev/articles/${slug}`;
  const image =
    fm.social_image ??
    fm.cover_image ??
    `https://ofriperetz.dev/og/article/${slug}`;

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
          <Link href="/articles" className="inline-flex min-h-6 min-w-6 items-center justify-center hover:text-foreground">
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
                this is the LCP element. */}
            <Image
              src={fm.cover_image}
              alt=""
              width={1000}
              height={420}
              priority
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

        <MarkdownArticle body={article.body} />

        <DevToCallout
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
  devtoUrl,
  username,
}: {
  devtoUrl?: string;
  username: string;
}) {
  const profileUrl = `https://dev.to/${username}`;
  return (
    <aside
      data-slot="devto-callout"
      className="mt-12 rounded-lg border border-border bg-muted/30 p-6"
    >
      <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
        Enjoyed this?
      </p>
      <p className="mt-2 text-base text-foreground">
        I publish on{" "}
        <a
          href={profileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium underline underline-offset-2 hover:text-foreground/80"
        >
          dev.to/{username}
        </a>{" "}
        — follow for new pieces on ESLint, security, and AI-assisted code.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <a
          href={profileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: "default", size: "sm" })}
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
            Read this on dev.to ↗
          </a>
        )}
      </div>
    </aside>
  );
}
