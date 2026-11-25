# ofriperetz.dev

Measured writing on JavaScript security and tooling: what linters actually catch, how benchmarks
mislead, and what it costs to ship a CLI. Every number in an article comes from a run you can
repeat. Read it at [ofriperetz.dev](https://ofriperetz.dev) or on
[dev.to/ofri-peretz](https://dev.to/ofri-peretz).

**Start with**

- [SonarJS Has 269 Rules. It Still Missed 26 of My 40 Node.js Vulnerabilities.](https://dev.to/ofri-peretz/sonarjs-has-269-rules-it-still-misses-65-of-security-vulnerabilities-3jh)
- [Microsoft's SDL ESLint Plugin Caught 5 Node Vulns. The Domain Plugins Caught 46](https://dev.to/ofri-peretz/microsofts-eslint-security-plugin-catches-10-of-vulnerabilities-heres-what-it-misses-5gii)
- [The Base Rate Problem: Why 95% Precision Means Nothing Without Context](https://dev.to/ofri-peretz/the-base-rate-problem-why-95-precision-means-nothing-without-context-29ik)
- [The Bug That Passes Every Toolchain Check: Circular Dependencies in JavaScript](https://dev.to/ofri-peretz/what-are-circular-dependencies-in-javascript-and-why-they-break-things-51jd)

The projects the articles measure: [eslint](https://github.com/ofri-peretz/eslint) (security and
quality plugins for ESLint and oxlint) and [burgee](https://github.com/ofri-peretz/burgee) (a CLI
framework that serves help, `--json` and MCP from one declaration).

## How this repo works

The site is a [shadcn](https://ui.shadcn.com) Next.js app powered by the **Interlace design-system registry** ([`ds.interlace.tools`](https://ds.interlace.tools)).

Turborepo with a single app:

```
apps/blog/        # Next.js 16 (App Router, RSC) — blog, /scorecard, /api/* data routes
  content/articles/   # article markdown (canonical source)
  src/components/ui/  # UI pulled from the @interlace shadcn registry
  scripts/            # publish-to-devto (publish existing articles only)
```

## Develop

```bash
npm install
cp .env.example apps/blog/.env.local   # fill in values (see .env.example)
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
cd apps/blog && npx shadcn@latest add @interlace/<name>
```

## Publishing articles

Article content lives in `apps/blog/content/articles/`. Merging publishes nothing: dev.to
publishing is a manual dispatch of `publish-devto.yml`, one article at a time, or locally:

```bash
npm run publish:devto -- --article <slug> --dry-run   # preview
npm run publish:devto -- --article <slug>              # publish/update
```

> Requires `DEVTO_API_KEY`. Article **authoring** tooling is intentionally not in this
> repo — only the publish step lives here.

## License

MIT
