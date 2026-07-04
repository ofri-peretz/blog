# Reproduce-repo scaffolds

Ready-to-publish reproduction harnesses for the AI/benchmark articles. Each folder is
self-contained — move it to a public repo (or gist), fill the `{{PLACEHOLDERS}}`, and the
article's `{{REPRO_REPO}}` link points here. Publishing these is what lifts each article's
**Reproducibility** lens to 9.0+.

| Folder | Backs article | What you must add |
|---|---|---|
| `nestjs-ai-comparison/` | NestJS: Claude vs Gemini (3781266) | the full generated source under `claude/` and `gemini/`; model IDs + run date; ideally n>1 runs |
| `import-next-bench/` | Payload 508 cycles (3785504) + no-cycle 0 cycles (3688612) | pin madge version + the 5 repo commit SHAs; run the bench to regenerate the speedup table |

## Placeholder map (fill across the articles + these scaffolds)
- `{{RUN_DATE}}` — date the runs were executed (e.g. 2026-05-30)
- `{{CLAUDE_MODEL_ID}}` — exact API model id (e.g. `claude-sonnet-4-6-…`)
- `{{GEMINI_CLI_VERSION}}` — Gemini CLI version + the model build it invokes
- `{{NEXTJS_SHA}}`, plus madge audit SHAs for payload/medusa/strapi/twenty
- `{{MADGE_VERSION}}`, `{{OXLINT_VERSION}}`, `{{EPI_VERSION}}` (eslint-plugin-import), `{{OLD_IMPORT_NEXT_VERSION}}`
- `{{FIX_VERSION}}` — the `eslint-plugin-import-next` version that contains the no-cycle fixes
- `{{REPRO_REPO}}` — the public URL these become

> ponytail: these are the minimum harnesses that make each number falsifiable. No CI, no
> packaging — clone, run the one script, compare to the article. Add more only if asked.
