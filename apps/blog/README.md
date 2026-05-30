# blog

The canonical site at [ofriperetz.dev](https://ofriperetz.dev) — personal portfolio + articles + live impact dashboard.

## Stack

- **Next.js 16** (App Router) + **React 19**
- **Tailwind v4** with OKLCH neutral palette + `@tailwindcss/typography`
- **Turbopack** (`next dev` / `next build`)
- **Shadcn / Base UI** primitives via [`interlace/docs-baseline`](../../interlace/docs-baseline/) — 47 UI components synced into `src/components/ui/`
- **`motion/react`** for animations, **Recharts** for charts, **next-themes** for dark mode, **Shiki** for syntax highlighting
- **Vercel** deployment

## Layout

```text
src/
  app/
    page.tsx                  home (9-section landing + effects)
    layout.tsx                root, JSON-LD, theme provider, chrome
    articles/                 list + single-article surface
    stats/                    live numbers + DownloadsByPackage chart
    analytics/                historical metrics + 2 charts
    api/                      8 server routes
    og/                       dynamic OG images for / and /articles/[slug]
    sitemap.ts                48 entries (5 static + 44 articles)
    robots.ts
  components/
    ui/                       47 synced shadcn primitives + 3 named effects
    landing/                  9 home-page sections
    charts/                   3 Recharts widgets
    {app-header,app-footer,theme-toggle,markdown-article,structured-data}.tsx
  hooks/                      6 React hooks (npm, github, devto, homepage, idle-callback, visitor-tracking)
  lib/                        cache, markdown preprocessor, metrics-config, source, utils, use-reduced-motion
content/
  articles → ../../blog-old/content/articles    symlink to shared markdown corpus
```

## Develop

```bash
npm run dev      # Turbopack, :3001
npm run build    # production build
npm run lint     # eslint
npx tsc --noEmit -p tsconfig.json
```

## Content pipeline

Articles live in [`apps/blog-old/content/articles/`](../blog-old/content/articles) (44 `.md` files), symlinked into `apps/blog/content/articles/`. They're parsed with `gray-matter` + `unified` + `remark-gfm` + `@shikijs/rehype` server-side. Custom Nuxt-MDC directives (`::install-command{}`, `::dev-to-cta{}`) are converted to standard markdown by [`lib/markdown.ts`](src/lib/markdown.ts) before rendering.

## Effects

Three named decorative effects, each with a Storybook story at [`apps/baseline-storybook/src/ui/named-effects.stories.tsx`](../baseline-storybook/src/ui/named-effects.stories.tsx):

- **Meteors** — Magic-UI-style streak overlay
- **CloudParticles** — slow-drift particle field (tuned `Particles` primitive)
- **SunnyBackground** — animated radial sun glow

All three honor `prefers-reduced-motion`. Pixel-diff budget: ≤3% vs Vue originals (verification deferred to post-cutover).

## Storybook coverage

Components consumed by this app are catalogued in [`apps/baseline-storybook/`](../baseline-storybook/). The canonical source-of-truth for each component is `interlace/docs-baseline/components/` (synced from there into `src/components/`). New stories added in this migration:

- `Home / Landing sections` — About, Skills, FAQ, Philosophy, WorkExperience, ImpactMetricsBlock (2 variants)
- `Home / Charts` — DownloadsByPackage (2), MetricsOverTime (2), EffortStarsCorrelation
- `UI / Named Effects` — Meteors (2), Cloud (2), Sunny (2)

Deferred (require `@storybook/nextjs` framework for `next/link` + `next-themes` resolution): AppHeader, AppFooter, ThemeToggle, FeaturedProject, DevToArticles, Projects.

## Predecessor

This app replaces the Nuxt blog at [`apps/blog-old/`](../blog-old/). The migration is tracked in `~/.claude/plans/how-hard-do-you-mighty-bengio.md`. Production cutover (Vercel domain switch from blog-old → blog) is gated on Lighthouse parity + visual diff and is a separate operation post-PR-merge.
