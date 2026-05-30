# ofriperetz.dev

The blog + scorecard for [ofriperetz.dev](https://ofriperetz.dev) — a [shadcn](https://ui.shadcn.com) Next.js app powered by the **Interlace design-system registry** ([`ds.interlace.tools`](https://ds.interlace.tools)).

Turborepo with a single app:

```
apps/web/        # Next.js 16 (App Router, RSC) — blog, /scorecard, /api/* data routes
  content/articles/   # article markdown (canonical source)
  src/components/ui/  # UI pulled from the @interlace shadcn registry
  scripts/            # publish-to-devto (publish existing articles only)
```

## Develop

```bash
npm install
cp .env.example apps/web/.env.local   # fill in values (see .env.example)
npm run dev
```

## Build / test / lint

```bash
npm run build
npm run test
npm run lint
```

## UI components — from the Interlace registry

Components come from our design-system registry. Add one with:

```bash
cd apps/web && npx shadcn@latest add @interlace/<name>
```

## Publishing articles

Article content lives in `apps/web/content/articles/`. Pushing to `main` runs the
dev.to publish workflow; or run it manually:

```bash
npm run publish:devto -- --article <slug> --dry-run   # preview
npm run publish:devto -- --article <slug>              # publish/update
```

> Requires `DEVTO_API_KEY`. Article **authoring** tooling is intentionally not in this
> repo — only the publish step lives here.

## License

MIT
